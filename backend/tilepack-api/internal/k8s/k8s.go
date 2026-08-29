package k8s

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

// Client wraps the in-cluster Kubernetes client and only exposes the
// two operations the API needs: create a worker Job and count the
// active worker Jobs (for the global concurrency cap).
type Client struct {
	cs                   *kubernetes.Clientset
	namespace            string
	workerImage          string
	workerServiceAccount string
	internalBaseURL      string
	internalTokenSecret  string // Secret name holding INTERNAL_TOKEN
	s3CredsSecret        string
	s3CredsAccessKey     string
	s3CredsSecretKey     string
	awsRegion            string
	awsEndpointURL       string
	workerResources      corev1.ResourceRequirements

	// Ordered against the API's lock TTL; config.Load enforces it.
	activeDeadlineSeconds   int64
	jobTTLSeconds           int32
	terminationGraceSeconds int64

	maxTileCount    int
	maxEncodedBytes int64
}

const (
	LabelApp = "app"
	AppName  = "oam-tilepack-worker"
)

type NewOpts struct {
	Namespace            string
	WorkerImage          string
	WorkerServiceAccount string
	InternalBaseURL      string
	InternalTokenSecret  string
	S3CredsSecret        string
	S3CredsAccessKey     string
	S3CredsSecretKey     string
	AWSRegion            string
	AWSEndpointURL       string
	WorkerCPURequest     string
	WorkerMemoryRequest  string
	WorkerCPULimit       string
	WorkerMemoryLimit    string
	EphemeralRequest     string
	EphemeralLimit       string
	MaxTileCount         int
	MaxEncodedBytes      int64

	ActiveDeadlineSeconds   int64
	JobTTLSeconds           int32
	TerminationGraceSeconds int64
}

func New(opts NewOpts) (*Client, error) {
	cfg, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("in-cluster config: %w", err)
	}
	cs, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, err
	}
	return &Client{
		cs:                   cs,
		namespace:            opts.Namespace,
		workerImage:          opts.WorkerImage,
		workerServiceAccount: opts.WorkerServiceAccount,
		internalBaseURL:      opts.InternalBaseURL,
		internalTokenSecret:  opts.InternalTokenSecret,
		s3CredsSecret:        opts.S3CredsSecret,
		s3CredsAccessKey:     opts.S3CredsAccessKey,
		s3CredsSecretKey:     opts.S3CredsSecretKey,
		awsRegion:            opts.AWSRegion,
		awsEndpointURL:       opts.AWSEndpointURL,

		activeDeadlineSeconds:   opts.ActiveDeadlineSeconds,
		jobTTLSeconds:           opts.JobTTLSeconds,
		terminationGraceSeconds: opts.TerminationGraceSeconds,
		maxTileCount:            opts.MaxTileCount,
		maxEncodedBytes:         opts.MaxEncodedBytes,

		workerResources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:              resource.MustParse(opts.WorkerCPURequest),
				corev1.ResourceMemory:           resource.MustParse(opts.WorkerMemoryRequest),
				corev1.ResourceEphemeralStorage: resource.MustParse(opts.EphemeralRequest),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:              resource.MustParse(opts.WorkerCPULimit),
				corev1.ResourceMemory:           resource.MustParse(opts.WorkerMemoryLimit),
				corev1.ResourceEphemeralStorage: resource.MustParse(opts.EphemeralLimit),
			},
		},
	}, nil
}

// CountActiveJobs returns how many worker Jobs in the namespace still
// have an active pod. Used to enforce the cluster-wide concurrency cap
// without needing any external coordination - Kubernetes itself is the
// source of truth.
func (c *Client) CountActiveJobs(ctx context.Context) (int, error) {
	jobs, err := c.cs.BatchV1().Jobs(c.namespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelApp, AppName),
	})
	if err != nil {
		log.Printf("k8s count active jobs failed: namespace=%s err=%v", c.namespace, err)
		return 0, err
	}
	n := 0
	for _, j := range jobs.Items {
		if j.Status.Active > 0 {
			n++
		}
	}
	log.Printf("k8s count active jobs: namespace=%s active=%d", c.namespace, n)
	return n, nil
}

// JobSpec carries the parameters the worker container needs.
type JobSpec struct {
	StacID    string
	Format    string
	COGURL    string
	OutputKey string
	LockKey   string
	MinZoom   int
	MaxZoom   int
	Canonical bool
	// GSD is the source COG ground sample distance in metres/pixel,
	// read from the STAC item's properties. The worker uses it to
	// pick a default MaxZoom when the request didn't specify one.
	GSD float64
}

// CreateJob launches a one-shot worker Job. The Job name is deterministic so
// that two simultaneous requests for the same artifact race on Job creation
// rather than producing two duplicate workers.
func (c *Client) CreateJob(ctx context.Context, spec JobSpec) error {
	name := JobName(spec)

	ttl := c.jobTTLSeconds
	deadline := c.activeDeadlineSeconds
	backoff := int32(1)
	grace := c.terminationGraceSeconds

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: c.namespace,
			Labels: map[string]string{
				LabelApp:      AppName,
				"stac-id":     sanitize(spec.StacID),
				"tile-format": spec.Format,
			},
		},
		Spec: batchv1.JobSpec{
			TTLSecondsAfterFinished: &ttl,
			ActiveDeadlineSeconds:   &deadline,
			BackoffLimit:            &backoff,
			Template: corev1.PodTemplateSpec{
				ObjectMeta: metav1.ObjectMeta{
					Labels: map[string]string{LabelApp: AppName},
				},
				Spec: corev1.PodSpec{
					RestartPolicy:      corev1.RestartPolicyNever,
					ServiceAccountName: c.workerServiceAccount,
					// Room for the worker to release its S3 lock on SIGTERM.
					TerminationGracePeriodSeconds: &grace,
					Containers: []corev1.Container{{
						Name:            "worker",
						Image:           c.workerImage,
						ImagePullPolicy: corev1.PullAlways,
						Resources:       c.workerResources,
						Env: []corev1.EnvVar{
							{Name: "STAC_ITEM_ID", Value: spec.StacID},
							{Name: "FORMAT", Value: spec.Format},
							{Name: "COG_URL", Value: spec.COGURL},
							{Name: "OUTPUT_KEY", Value: spec.OutputKey},
							{Name: "LOCK_KEY", Value: spec.LockKey},
							{Name: "MIN_ZOOM", Value: itoa(spec.MinZoom)},
							{Name: "MAX_ZOOM", Value: itoa(spec.MaxZoom)},
							{Name: "CANONICAL", Value: boolStr(spec.Canonical)},
							{Name: "GSD", Value: fmt.Sprintf("%g", spec.GSD)},
							{Name: "MAX_TILE_COUNT", Value: itoa(c.maxTileCount)},
							{Name: "MAX_ENCODED_BYTES", Value: fmt.Sprintf("%d", c.maxEncodedBytes)},
							{Name: "INTERNAL_BASE_URL", Value: c.internalBaseURL},
							{Name: "AWS_REGION", Value: c.awsRegion},
							{
								Name: "INTERNAL_TOKEN",
								ValueFrom: &corev1.EnvVarSource{
									SecretKeyRef: &corev1.SecretKeySelector{
										LocalObjectReference: corev1.LocalObjectReference{
											Name: c.internalTokenSecret,
										},
										Key: "token",
									},
								},
							},
							{
								Name: "AWS_ACCESS_KEY_ID",
								ValueFrom: &corev1.EnvVarSource{
									SecretKeyRef: &corev1.SecretKeySelector{
										LocalObjectReference: corev1.LocalObjectReference{Name: c.s3CredsSecret},
										Key:                  c.s3CredsAccessKey,
									},
								},
							},
							{
								Name: "AWS_SECRET_ACCESS_KEY",
								ValueFrom: &corev1.EnvVarSource{
									SecretKeyRef: &corev1.SecretKeySelector{
										LocalObjectReference: corev1.LocalObjectReference{Name: c.s3CredsSecret},
										Key:                  c.s3CredsSecretKey,
									},
								},
							},
						},
					}},
				},
			},
		},
	}
	// Only when set: an empty AWS_ENDPOINT_URL in the worker's environment
	// reads as "no endpoint" to boto3 anyway, but leaving it out keeps a plain
	// AWS deployment's Job spec free of settings that do nothing.
	if c.awsEndpointURL != "" {
		container := &job.Spec.Template.Spec.Containers[0]
		container.Env = append(container.Env, corev1.EnvVar{
			Name: "AWS_ENDPOINT_URL", Value: c.awsEndpointURL,
		})
	}
	_, err := c.cs.BatchV1().Jobs(c.namespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		log.Printf("k8s create job failed: namespace=%s name=%s stac_id=%s format=%s err=%v", c.namespace, name, spec.StacID, spec.Format, err)
		return err
	}
	return nil
}

// JobName is the deterministic Job name for a request. The API looks a
// Job up by this before deciding whether to create one.
func JobName(spec JobSpec) string {
	identity := fmt.Sprintf("%s\x00%s\x00%d\x00%d\x00%t", spec.StacID, spec.Format, spec.MinZoom, spec.MaxZoom, spec.Canonical)
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(identity)))[:32]
	prefix := sanitize(spec.StacID)
	if len(prefix) > 21 {
		prefix = prefix[:21]
	}
	return fmt.Sprintf("tilepack-%s-%s", prefix, hash)
}

func sanitize(s string) string {
	out := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		ch := s[i]
		switch {
		case ch >= 'a' && ch <= 'z', ch >= '0' && ch <= '9', ch == '-':
			out = append(out, ch)
		case ch >= 'A' && ch <= 'Z':
			out = append(out, ch+32)
		case ch == '_':
			out = append(out, '-')
		}
	}
	return string(out)
}

func itoa(n int) string { return fmt.Sprintf("%d", n) }
func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// JobPhase is the coarse lifecycle state of a worker Job.
type JobPhase string

const (
	JobPhaseAbsent JobPhase = "absent"
	// Running, or created and not yet scheduled.
	JobPhaseActive    JobPhase = "active"
	JobPhaseSucceeded JobPhase = "succeeded"
	// Terminal: BackoffLimit is 1, so nothing retries it.
	JobPhaseFailed JobPhase = "failed"
)

type JobState struct {
	Phase   JobPhase
	Reason  string
	Message string
	// When TTLSecondsAfterFinished starts counting down. Zero if not terminal.
	FinishedAt time.Time
}

// DeadlineExceededReason means "too big", not "broken" - worth reporting.
const DeadlineExceededReason = "DeadlineExceeded"

// GetJobState classifies one Job by name. A missing Job is
// JobPhaseAbsent with a nil error, not an error.
func (c *Client) GetJobState(ctx context.Context, name string) (JobState, error) {
	job, err := c.cs.BatchV1().Jobs(c.namespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return JobState{Phase: JobPhaseAbsent}, nil
		}
		log.Printf("k8s get job failed: namespace=%s name=%s err=%v", c.namespace, name, err)
		return JobState{}, err
	}
	return classifyJob(job), nil
}

// TTLRemaining is how long a terminal Job lingers before Kubernetes
// collects it. Until then the same Job cannot be recreated, so it is
// also how long a caller must wait before a retry can do anything.
func (c *Client) TTLRemaining(state JobState, now time.Time) time.Duration {
	if state.FinishedAt.IsZero() {
		return 0
	}
	remaining := state.FinishedAt.
		Add(time.Duration(c.jobTTLSeconds) * time.Second).
		Sub(now)
	if remaining < 0 {
		return 0
	}
	return remaining
}

// classifyJob is split from GetJobState so it can be tested without a
// cluster. Matches condition types exactly: newer Kubernetes adds
// interim ones (JobFailureTarget) that are not terminal.
func classifyJob(job *batchv1.Job) JobState {
	for _, cond := range job.Status.Conditions {
		if cond.Status != corev1.ConditionTrue {
			continue
		}
		switch cond.Type {
		case batchv1.JobFailed:
			return JobState{
				Phase:      JobPhaseFailed,
				Reason:     cond.Reason,
				Message:    cond.Message,
				FinishedAt: terminalTime(job, cond),
			}
		case batchv1.JobComplete:
			return JobState{
				Phase:      JobPhaseSucceeded,
				Reason:     cond.Reason,
				FinishedAt: terminalTime(job, cond),
			}
		}
	}
	// Running or not yet scheduled - both mean "a worker is on its way".
	return JobState{Phase: JobPhaseActive}
}

func terminalTime(job *batchv1.Job, cond batchv1.JobCondition) time.Time {
	if !cond.LastTransitionTime.IsZero() {
		return cond.LastTransitionTime.Time
	}
	if job.Status.CompletionTime != nil {
		return job.Status.CompletionTime.Time
	}
	return time.Time{}
}
