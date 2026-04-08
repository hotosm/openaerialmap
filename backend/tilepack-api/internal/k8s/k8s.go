package k8s

import (
	"context"
	"fmt"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
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
	workerResources      corev1.ResourceRequirements
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
	WorkerCPURequest     string
	WorkerMemoryRequest  string
	WorkerCPULimit       string
	WorkerMemoryLimit    string
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
		workerResources: corev1.ResourceRequirements{
			Requests: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse(opts.WorkerCPURequest),
				corev1.ResourceMemory: resource.MustParse(opts.WorkerMemoryRequest),
			},
			Limits: corev1.ResourceList{
				corev1.ResourceCPU:    resource.MustParse(opts.WorkerCPULimit),
				corev1.ResourceMemory: resource.MustParse(opts.WorkerMemoryLimit),
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
		return 0, err
	}
	n := 0
	for _, j := range jobs.Items {
		if j.Status.Active > 0 {
			n++
		}
	}
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

// CreateJob launches a one-shot worker Job. The Job is named
// deterministically from the stac id + format so that two simultaneous
// requests for the same artifact race on Job creation rather than
// producing two duplicate workers - the second creation fails with
// AlreadyExists, which the handler treats as "already in progress".
func (c *Client) CreateJob(ctx context.Context, spec JobSpec) error {
	name := fmt.Sprintf("tilepack-%s-%s", sanitize(spec.StacID), spec.Format)
	if !spec.Canonical {
		name = fmt.Sprintf("%s-z%d-%d", name, spec.MinZoom, spec.MaxZoom)
	}
	if len(name) > 63 {
		name = name[:63]
	}

	ttl := int32(3600)
	deadline := int64(1800)
	backoff := int32(1)

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
					Containers: []corev1.Container{{
						Name:      "worker",
						Image:     c.workerImage,
						Resources: c.workerResources,
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
	_, err := c.cs.BatchV1().Jobs(c.namespace).Create(ctx, job, metav1.CreateOptions{})
	return err
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
