package k8s

import (
	"strings"
	"testing"

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
			name := jobName(tt.spec)
			if len(name) > 63 {
				t.Fatalf("jobName() length = %d, want <= 63", len(name))
			}
			if errs := validation.IsDNS1123Subdomain(name); len(errs) != 0 {
				t.Fatalf("jobName() = %q is not Kubernetes-safe: %v", name, errs)
			}
			if name != jobName(tt.spec) {
				t.Fatalf("jobName() is not deterministic: %q != %q", name, jobName(tt.spec))
			}
		})
	}

	firstLongID := "a" + strings.Repeat("b", 126) + "c"
	secondLongID := "a" + strings.Repeat("b", 126) + "d"
	if first, second := jobName(JobSpec{StacID: firstLongID, Format: "pmtiles", Canonical: true}), jobName(JobSpec{StacID: secondLongID, Format: "pmtiles", Canonical: true}); first == second {
		t.Fatalf("different long STAC IDs produced the same job name: %q", first)
	}

	base := JobSpec{StacID: longID, Format: "pmtiles"}
	if jobName(base) == jobName(JobSpec{StacID: longID, Format: "mbtiles"}) {
		t.Fatal("different formats produced the same job name")
	}
	if jobName(JobSpec{StacID: longID, Format: "pmtiles", MinZoom: 1, MaxZoom: 10}) == jobName(JobSpec{StacID: longID, Format: "pmtiles", MinZoom: 2, MaxZoom: 10}) {
		t.Fatal("different zoom ranges produced the same job name")
	}
}
