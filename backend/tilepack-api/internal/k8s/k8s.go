package k8s

import (
	"context"
	"crypto/sha256"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/api/resource"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"

	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/config"
)

// Client wraps the in-cluster Kubernetes client and only exposes the
// two operations the API needs: create a worker Job and count the
// active worker Jobs (for the global concurrency cap).
type Client struct {
	cs        *kubernetes.Clientset
	cfg       *config.Config
	resources corev1.ResourceRequirements
}

const (
	// LabelApp marks every Job and Pod this service creates.
	LabelApp = "app"
	AppName  = "oam-tilepack-worker"
)

// New builds an in-cluster client. Resource quantities are parsed here so
// a malformed value fails at startup rather than on the first request.
func New(cfg *config.Config) (*Client, error) {
	restCfg, err := rest.InClusterConfig()
	if err != nil {
		return nil, fmt.Errorf("in-cluster config: %w", err)
	}
	cs, err := kubernetes.NewForConfig(restCfg)
	if err != nil {
		return nil, err
	}
	return &Client{
		cs:  cs,
		cfg: cfg,
		resources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:              resource.MustParse(cfg.WorkerCPURequest),
				corev1.ResourceMemory:           resource.MustParse(cfg.WorkerMemoryRequest),
				corev1.ResourceEphemeralStorage: resource.MustParse(cfg.WorkerEphemeralRequest),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:              resource.MustParse(cfg.WorkerCPULimit),
				corev1.ResourceMemory:           resource.MustParse(cfg.WorkerMemoryLimit),
				corev1.ResourceEphemeralStorage: resource.MustParse(cfg.WorkerEphemeralLimit),
			},
		},
	}, nil
}

// CountActiveJobs returns how many worker Jobs in the namespace still
// have an active pod. Used to enforce the cluster-wide concurrency cap
// without needing any external coordination - Kubernetes itself is the
// source of truth.
func (c *Client) CountActiveJobs(ctx context.Context) (int, error) {
	jobs, err := c.cs.BatchV1().Jobs(c.cfg.WorkerNamespace).List(ctx, metav1.ListOptions{
		LabelSelector: fmt.Sprintf("%s=%s", LabelApp, AppName),
	})
	if err != nil {
		log.Printf("k8s count active jobs failed: namespace=%s err=%v", c.cfg.WorkerNamespace, err)
		return 0, err
	}
	n := 0
	for _, j := range jobs.Items {
		if j.Status.Active > 0 {
			n++
		}
	}
	log.Printf("k8s count active jobs: namespace=%s active=%d", c.cfg.WorkerNamespace, n)
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

// CreateJob launches a deterministic one-shot Job to deduplicate concurrent requests.
func (c *Client) CreateJob(ctx context.Context, spec JobSpec) error {
	name := JobName(spec)

	ttl := c.cfg.WorkerJobTTLSeconds
	deadline := c.cfg.WorkerActiveDeadlineSeconds
	backoff := int32(1)
	grace := c.cfg.WorkerTerminationGraceSeconds

	job := &batchv1.Job{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: c.cfg.WorkerNamespace,
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
					ServiceAccountName: c.cfg.WorkerServiceAccount,
					// Room for the worker to release its S3 lock on SIGTERM.
					TerminationGracePeriodSeconds: &grace,
					Containers: []corev1.Container{{
						Name:            "worker",
						Image:           c.cfg.WorkerImage,
						ImagePullPolicy: corev1.PullAlways,
						Resources:       c.resources,
						Env: []corev1.EnvVar{
							{Name: "STAC_ITEM_ID", Value: spec.StacID},
							{Name: "FORMAT", Value: spec.Format},
							{Name: "COG_URL", Value: spec.COGURL},
							{Name: "OUTPUT_KEY", Value: spec.OutputKey},
							{Name: "LOCK_KEY", Value: spec.LockKey},
							{Name: "MIN_ZOOM", Value: strconv.Itoa(spec.MinZoom)},
							{Name: "MAX_ZOOM", Value: strconv.Itoa(spec.MaxZoom)},
							{Name: "CANONICAL", Value: strconv.FormatBool(spec.Canonical)},
							{Name: "GSD", Value: strconv.FormatFloat(spec.GSD, 'g', -1, 64)},
							{Name: "MAX_TILE_COUNT", Value: strconv.Itoa(c.cfg.WorkerMaxTileCount)},
							{Name: "MAX_ENCODED_BYTES", Value: strconv.FormatInt(c.cfg.WorkerMaxEncodedBytes, 10)},
							{Name: "INTERNAL_BASE_URL", Value: c.cfg.InternalBaseURL},
							{Name: "AWS_REGION", Value: c.cfg.AWSRegion},
							{
								Name: "INTERNAL_TOKEN",
								ValueFrom: &corev1.EnvVarSource{
									SecretKeyRef: &corev1.SecretKeySelector{
										LocalObjectReference: corev1.LocalObjectReference{
											Name: c.cfg.InternalTokenSecret,
										},
										Key: "token",
									},
								},
							},
							{
								Name: "AWS_ACCESS_KEY_ID",
								ValueFrom: &corev1.EnvVarSource{
									SecretKeyRef: &corev1.SecretKeySelector{
										LocalObjectReference: corev1.LocalObjectReference{Name: c.cfg.S3CredsSecret},
										Key:                  c.cfg.S3CredsAccessKey,
									},
								},
							},
							{
								Name: "AWS_SECRET_ACCESS_KEY",
								ValueFrom: &corev1.EnvVarSource{
									SecretKeyRef: &corev1.SecretKeySelector{
										LocalObjectReference: corev1.LocalObjectReference{Name: c.cfg.S3CredsSecret},
										Key:                  c.cfg.S3CredsSecretKey,
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
	if c.cfg.AWSEndpointURL != "" {
		container := &job.Spec.Template.Spec.Containers[0]
		container.Env = append(container.Env, corev1.EnvVar{
			Name: "AWS_ENDPOINT_URL", Value: c.cfg.AWSEndpointURL,
		})
	}
	_, err := c.cs.BatchV1().Jobs(c.cfg.WorkerNamespace).Create(ctx, job, metav1.CreateOptions{})
	if err != nil {
		log.Printf("k8s create job failed: namespace=%s name=%s stac_id=%s format=%s err=%v", c.cfg.WorkerNamespace, name, spec.StacID, spec.Format, err)
		return err
	}
	return nil
}

// JobName is deterministic: the API looks a Job up by this before creating one.
func JobName(spec JobSpec) string {
	identity := fmt.Sprintf("%s\x00%s\x00%d\x00%d\x00%t", spec.StacID, spec.Format, spec.MinZoom, spec.MaxZoom, spec.Canonical)
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(identity)))[:32]
	prefix := sanitize(spec.StacID)
	if len(prefix) > 21 {
		prefix = prefix[:21]
	}
	return fmt.Sprintf("tilepack-%s-%s", prefix, hash)
}

var notDNS1123 = regexp.MustCompile(`[^a-z0-9-]`)

// sanitize reduces a STAC id to the DNS-1123 subset Kubernetes names allow.
func sanitize(s string) string {
	return notDNS1123.ReplaceAllString(strings.ToLower(strings.ReplaceAll(s, "_", "-")), "")
}

// JobPhase is the coarse lifecycle state of a worker Job.
type JobPhase string

const (
	JobPhaseAbsent JobPhase = "absent"
	// Running, or created and not yet scheduled.
	JobPhaseActive    JobPhase = "active"
	JobPhaseSucceeded JobPhase = "succeeded"
	// Terminal: the Job has exhausted BackoffLimit (1, i.e. one retry).
	JobPhaseFailed JobPhase = "failed"
)

type JobState struct {
	Phase   JobPhase
	Reason  string
	Message string
	// FinishedAt starts the Job TTL and is zero for active Jobs.
	FinishedAt time.Time
}

// DeadlineExceededReason means "too big", not "broken" - worth reporting.
const DeadlineExceededReason = "DeadlineExceeded"

// GetJobState classifies one Job by name; a missing Job is not an error.
func (c *Client) GetJobState(ctx context.Context, name string) (JobState, error) {
	job, err := c.cs.BatchV1().Jobs(c.cfg.WorkerNamespace).Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		if apierrors.IsNotFound(err) {
			return JobState{Phase: JobPhaseAbsent}, nil
		}
		log.Printf("k8s get job failed: namespace=%s name=%s err=%v", c.cfg.WorkerNamespace, name, err)
		return JobState{}, err
	}
	return classifyJob(job), nil
}

// TTLRemaining returns how long a terminal Job blocks recreation.
func (c *Client) TTLRemaining(state JobState, now time.Time) time.Duration {
	if state.FinishedAt.IsZero() {
		return 0
	}
	remaining := state.FinishedAt.
		Add(time.Duration(c.cfg.WorkerJobTTLSeconds) * time.Second).
		Sub(now)
	if remaining < 0 {
		return 0
	}
	return remaining
}

// classifyJob ignores interim conditions such as JobFailureTarget.
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
