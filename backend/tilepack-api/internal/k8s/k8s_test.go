package k8s

import (
	"strings"
	"testing"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	validation "k8s.io/apimachinery/pkg/util/validation"
)

func TestJobName(t *testing.T) {
	longID := "a" + strings.Repeat("b", 127)
	tests := []struct {
		name string
		spec JobSpec
	}{
		{
			name: "short normal id",
			spec: JobSpec{StacID: "67ac270a43f18e3e3665bef7", Format: "pmtiles", Canonical: true},
		},
		{
			name: "maximum length id",
			spec: JobSpec{StacID: longID, Format: "pmtiles", Canonical: true},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			name := JobName(tt.spec)
			if len(name) > 63 {
				t.Fatalf("JobName() length = %d, want <= 63", len(name))
			}
			if errs := validation.IsDNS1123Subdomain(name); len(errs) != 0 {
				t.Fatalf("JobName() = %q is not Kubernetes-safe: %v", name, errs)
			}
			if name != JobName(tt.spec) {
				t.Fatalf("JobName() is not deterministic: %q != %q", name, JobName(tt.spec))
			}
		})
	}

	firstLongID := "a" + strings.Repeat("b", 126) + "c"
	secondLongID := "a" + strings.Repeat("b", 126) + "d"
	if first, second := JobName(JobSpec{StacID: firstLongID, Format: "pmtiles", Canonical: true}), JobName(JobSpec{StacID: secondLongID, Format: "pmtiles", Canonical: true}); first == second {
		t.Fatalf("different long STAC IDs produced the same job name: %q", first)
	}

	base := JobSpec{StacID: longID, Format: "pmtiles"}
	if JobName(base) == JobName(JobSpec{StacID: longID, Format: "mbtiles"}) {
		t.Fatal("different formats produced the same job name")
	}
	if JobName(JobSpec{StacID: longID, Format: "pmtiles", MinZoom: 1, MaxZoom: 10}) == JobName(JobSpec{StacID: longID, Format: "pmtiles", MinZoom: 2, MaxZoom: 10}) {
		t.Fatal("different zoom ranges produced the same job name")
	}
}

func failedJob(reason string, at time.Time) *batchv1.Job {
	return &batchv1.Job{Status: batchv1.JobStatus{
		Conditions: []batchv1.JobCondition{{
			Type:               batchv1.JobFailed,
			Status:             corev1.ConditionTrue,
			Reason:             reason,
			Message:            "Job was active longer than specified deadline",
			LastTransitionTime: metav1.NewTime(at),
		}},
	}}
}

func TestClassifyJob(t *testing.T) {
	at := time.Date(2026, 8, 29, 10, 56, 0, 0, time.UTC)

	tests := []struct {
		name       string
		job        *batchv1.Job
		wantPhase  JobPhase
		wantReason string
		wantFinish time.Time
	}{
		{
			name:      "running pod",
			job:       &batchv1.Job{Status: batchv1.JobStatus{Active: 1}},
			wantPhase: JobPhaseActive,
		},
		{
			// On its way - must not be mistaken for finished.
			name:      "created but not yet scheduled",
			job:       &batchv1.Job{Status: batchv1.JobStatus{}},
			wantPhase: JobPhaseActive,
		},
		{
			name:       "killed by the deadline",
			job:        failedJob(DeadlineExceededReason, at),
			wantPhase:  JobPhaseFailed,
			wantReason: DeadlineExceededReason,
			wantFinish: at,
		},
		{
			name:       "failed for another reason",
			job:        failedJob("BackoffLimitExceeded", at),
			wantPhase:  JobPhaseFailed,
			wantReason: "BackoffLimitExceeded",
			wantFinish: at,
		},
		{
			name: "completed",
			job: &batchv1.Job{Status: batchv1.JobStatus{
				Succeeded: 1,
				Conditions: []batchv1.JobCondition{{
					Type:               batchv1.JobComplete,
					Status:             corev1.ConditionTrue,
					LastTransitionTime: metav1.NewTime(at),
				}},
			}},
			wantPhase:  JobPhaseSucceeded,
			wantFinish: at,
		},
		{
			name: "failed condition that is not true",
			job: &batchv1.Job{Status: batchv1.JobStatus{
				Active: 1,
				Conditions: []batchv1.JobCondition{{
					Type:   batchv1.JobFailed,
					Status: corev1.ConditionFalse,
				}},
			}},
			wantPhase: JobPhaseActive,
		},
		{
			// Newer Kubernetes sets interim conditions; only exact
			// terminal types count.
			name: "interim FailureTarget condition only",
			job: &batchv1.Job{Status: batchv1.JobStatus{
				Conditions: []batchv1.JobCondition{{
					Type:   batchv1.JobFailureTarget,
					Status: corev1.ConditionTrue,
					Reason: DeadlineExceededReason,
				}},
			}},
			wantPhase: JobPhaseActive,
		},
		{
			// Falls back to CompletionTime so retry_after stays useful.
			name: "terminal without transition time",
			job: &batchv1.Job{Status: batchv1.JobStatus{
				CompletionTime: &metav1.Time{Time: at},
				Conditions: []batchv1.JobCondition{{
					Type:   batchv1.JobComplete,
					Status: corev1.ConditionTrue,
				}},
			}},
			wantPhase:  JobPhaseSucceeded,
			wantFinish: at,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := classifyJob(tt.job)
			if got.Phase != tt.wantPhase {
				t.Fatalf("Phase = %q, want %q", got.Phase, tt.wantPhase)
			}
			if got.Reason != tt.wantReason {
				t.Fatalf("Reason = %q, want %q", got.Reason, tt.wantReason)
			}
			if !got.FinishedAt.Equal(tt.wantFinish) {
				t.Fatalf("FinishedAt = %v, want %v", got.FinishedAt, tt.wantFinish)
			}
		})
	}
}

func TestTTLRemaining(t *testing.T) {
	at := time.Date(2026, 8, 29, 10, 56, 0, 0, time.UTC)
	c := &Client{jobTTLSeconds: 3600}

	tests := []struct {
		name  string
		state JobState
		now   time.Time
		want  time.Duration
	}{
		{
			name:  "just failed",
			state: JobState{Phase: JobPhaseFailed, FinishedAt: at},
			now:   at,
			want:  time.Hour,
		},
		{
			name:  "half way through the cooldown",
			state: JobState{Phase: JobPhaseFailed, FinishedAt: at},
			now:   at.Add(30 * time.Minute),
			want:  30 * time.Minute,
		},
		{
			name:  "past the ttl",
			state: JobState{Phase: JobPhaseFailed, FinishedAt: at},
			now:   at.Add(2 * time.Hour),
			want:  0,
		},
		{
			name:  "non-terminal job has no cooldown",
			state: JobState{Phase: JobPhaseActive},
			now:   at,
			want:  0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := c.TTLRemaining(tt.state, tt.now); got != tt.want {
				t.Fatalf("TTLRemaining() = %v, want %v", got, tt.want)
			}
		})
	}
}
