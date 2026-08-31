package handler

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/config"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/k8s"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/ratelimit"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/stac"
)

const cogType = "image/tiff; application=geotiff; profile=cloud-optimized"

type fakeJobs struct {
	state     k8s.JobState
	stateErr  error
	active    int
	activeErr error
	createErr error
	created   []k8s.JobSpec
	ttl       time.Duration
}

func (f *fakeJobs) GetJobState(context.Context, string) (k8s.JobState, error) {
	return f.state, f.stateErr
}
func (f *fakeJobs) CountActiveJobs(context.Context) (int, error) { return f.active, f.activeErr }
func (f *fakeJobs) CreateJob(_ context.Context, spec k8s.JobSpec) error {
	if f.createErr != nil {
		return f.createErr
	}
	f.created = append(f.created, spec)
	return nil
}
func (f *fakeJobs) TTLRemaining(k8s.JobState, time.Time) time.Duration { return f.ttl }

type fakeStore struct {
	objects map[string]time.Time
	text    map[string]string
	deleted []string
	locked  []string
}

func newFakeStore() *fakeStore {
	return &fakeStore{objects: map[string]time.Time{}, text: map[string]string{}}
}
func (f *fakeStore) KeyFromCOGURL(string, string, int, int) (string, error) {
	return "out/archive.pmtiles", nil
}
func (f *fakeStore) LockKey(outputKey string) string { return outputKey + ".lock" }
func (f *fakeStore) ErrorKey(lockKey string) string  { return lockKey + ".error" }
func (f *fakeStore) PublicURL(key string) string     { return "https://s3.example/" + key }
func (f *fakeStore) HeadObject(_ context.Context, key string) (bool, time.Time, int64, error) {
	modified, ok := f.objects[key]
	if !ok {
		return false, time.Time{}, 0, nil
	}
	return true, modified, 1024, nil
}
func (f *fakeStore) ReadText(_ context.Context, key string) (string, error) {
	return f.text[key], nil
}
func (f *fakeStore) PutLock(_ context.Context, key string) error {
	f.locked = append(f.locked, key)
	f.objects[key] = time.Now()
	return nil
}
func (f *fakeStore) DeleteObject(_ context.Context, key string) error {
	f.deleted = append(f.deleted, key)
	delete(f.objects, key)
	return nil
}

type fakeCatalogue struct{ item *stac.Item }

func (f *fakeCatalogue) GetItem(context.Context, string) (*stac.Item, error) {
	return f.item, nil
}

type fakeAssets struct{ calls int }

func (f *fakeAssets) AddAsset(context.Context, string, string, string, stac.ItemAsset) error {
	f.calls++
	return nil
}

func packableItem() *stac.Item {
	return &stac.Item{
		ID:         "67ac270a43f18e3e3665bef7",
		Collection: "openaerialmap",
		Properties: map[string]any{"gsd": 0.5},
		Assets: map[string]stac.ItemAsset{
			"visual": {Href: "https://s3.example/in/scene.tif", Type: cogType},
		},
	}
}

func newTestHandler(jobs *fakeJobs, store *fakeStore) (*Handler, *fakeAssets) {
	assets := &fakeAssets{}
	return &Handler{
		cfg: &config.Config{
			STACCollection:    "openaerialmap",
			MaxConcurrentJobs: 2,
			LockTTLSeconds:    300,
		},
		stac:    &fakeCatalogue{item: packableItem()},
		s3:      store,
		k8s:     jobs,
		pgstac:  assets,
		limiter: ratelimit.NewPerIP(100, 100),
	}, assets
}

func post(t *testing.T, h *Handler) (int, response) {
	t.Helper()
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/tilepacks/67ac270a43f18e3e3665bef7?format=pmtiles", nil)
	h.Routes().ServeHTTP(rr, req)
	var resp response
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return rr.Code, resp
}

func TestJobState_ActiveIsInProgress(t *testing.T) {
	h, _ := newTestHandler(&fakeJobs{state: k8s.JobState{Phase: k8s.JobPhaseActive}}, newFakeStore())
	code, resp := post(t, h)
	if code != http.StatusAccepted || resp.Status != "in_progress" {
		t.Fatalf("got %d %q, want 202 in_progress", code, resp.Status)
	}
}

func TestJobState_FailedIsTerminalWithCooldown(t *testing.T) {
	jobs := &fakeJobs{
		state: k8s.JobState{Phase: k8s.JobPhaseFailed, Reason: "BackoffLimitExceeded"},
		ttl:   40 * time.Minute,
	}
	store := newFakeStore()
	store.objects["out/archive.pmtiles.lock"] = time.Now()
	h, _ := newTestHandler(jobs, store)

	code, resp := post(t, h)

	if code != http.StatusConflict || resp.Status != "failed" {
		t.Fatalf("got %d %q, want 409 failed", code, resp.Status)
	}
	if resp.RetryAfter != 2400 {
		t.Fatalf("retry_after = %d, want 2400", resp.RetryAfter)
	}
	if len(store.deleted) != 1 || store.deleted[0] != "out/archive.pmtiles.lock" {
		t.Fatalf("deleted = %v, want the lock released", store.deleted)
	}
}

func TestJobState_FailedReportsTheWorkersOwnReason(t *testing.T) {
	jobs := &fakeJobs{
		state: k8s.JobState{Phase: k8s.JobPhaseFailed, Reason: "BackoffLimitExceeded"},
		ttl:   time.Minute,
	}
	store := newFakeStore()
	store.text["out/archive.pmtiles.lock.error"] = "MemoryError: tile buffer at zoom 19"
	h, _ := newTestHandler(jobs, store)

	_, resp := post(t, h)

	if want := "tilepack generation failed: MemoryError: tile buffer at zoom 19"; resp.Message != want {
		t.Fatalf("message = %q, want %q", resp.Message, want)
	}
}

func TestJobState_DeadlineKeepsItsOwnAdvice(t *testing.T) {
	jobs := &fakeJobs{
		state: k8s.JobState{Phase: k8s.JobPhaseFailed, Reason: k8s.DeadlineExceededReason},
		ttl:   time.Minute,
	}
	store := newFakeStore()
	store.text["out/archive.pmtiles.lock.error"] = "generation was stopped early (SIGTERM)"
	h, _ := newTestHandler(jobs, store)

	code, resp := post(t, h)

	if code != http.StatusConflict {
		t.Fatalf("status = %d, want 409", code)
	}
	if resp.Message != "tilepack generation exceeded its time limit; retry with a lower max_zoom" {
		t.Fatalf("message = %q, want the deadline advice", resp.Message)
	}
}

func TestJobState_SucceededWithoutOutputIsAFailure(t *testing.T) {
	jobs := &fakeJobs{state: k8s.JobState{Phase: k8s.JobPhaseSucceeded}, ttl: time.Minute}
	h, _ := newTestHandler(jobs, newFakeStore())

	code, resp := post(t, h)

	if code != http.StatusConflict || resp.Status != "failed" {
		t.Fatalf("got %d %q, want 409 failed", code, resp.Status)
	}
}

func TestJobState_FreshLockWithoutAJobIsInProgress(t *testing.T) {
	store := newFakeStore()
	store.objects["out/archive.pmtiles.lock"] = time.Now().Add(-10 * time.Second)
	jobs := &fakeJobs{state: k8s.JobState{Phase: k8s.JobPhaseAbsent}}
	h, _ := newTestHandler(jobs, store)

	code, resp := post(t, h)

	if code != http.StatusAccepted || resp.Status != "in_progress" {
		t.Fatalf("got %d %q, want 202 in_progress", code, resp.Status)
	}
	if len(jobs.created) != 0 {
		t.Fatalf("created %d jobs, want none while the lock is fresh", len(jobs.created))
	}
}

func TestJobState_StaleLockStartsAFreshJob(t *testing.T) {
	store := newFakeStore()
	store.objects["out/archive.pmtiles.lock"] = time.Now().Add(-time.Hour)
	jobs := &fakeJobs{state: k8s.JobState{Phase: k8s.JobPhaseAbsent}}
	h, _ := newTestHandler(jobs, store)

	code, resp := post(t, h)

	if code != http.StatusAccepted || resp.Status != "started" {
		t.Fatalf("got %d %q, want 202 started", code, resp.Status)
	}
	if len(jobs.created) != 1 {
		t.Fatalf("created %d jobs, want 1", len(jobs.created))
	}
}

func TestJobState_ConcurrencyCapIsRetryable(t *testing.T) {
	jobs := &fakeJobs{state: k8s.JobState{Phase: k8s.JobPhaseAbsent}, active: 2}
	h, _ := newTestHandler(jobs, newFakeStore())

	code, resp := post(t, h)

	if code != http.StatusTooManyRequests || resp.Status != "busy" {
		t.Fatalf("got %d %q, want 429 busy", code, resp.Status)
	}
	if resp.RetryAfter == 0 {
		t.Fatal("busy must say when to come back")
	}
	if len(jobs.created) != 0 {
		t.Fatalf("created %d jobs past the cap", len(jobs.created))
	}
}
