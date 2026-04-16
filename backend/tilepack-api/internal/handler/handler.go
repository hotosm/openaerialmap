package handler

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/config"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/k8s"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/pgstac"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/ratelimit"
	tps3 "github.com/hotosm/openaerialmap/backend/tilepack-api/internal/s3"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/stac"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
)

// stacIDPattern matches the only shape of STAC ids the API accepts.
// It's intentionally narrow - the id is the *only* user-controlled
// input that gets interpolated into other systems (S3 keys, K8s Job
// names, STAC URLs), so any character outside this set is rejected
// before it can reach those systems.
var stacIDPattern = regexp.MustCompile(`^[A-Za-z0-9_\-]{1,128}$`)

type Handler struct {
	cfg     *config.Config
	stac    *stac.Client
	s3      *tps3.Client
	k8s     *k8s.Client
	pgstac  *pgstac.Client
	limiter *ratelimit.PerIP
}

func New(cfg *config.Config, sc *stac.Client, s3c *tps3.Client, kc *k8s.Client, pc *pgstac.Client, lim *ratelimit.PerIP) *Handler {
	return &Handler{cfg: cfg, stac: sc, s3: s3c, k8s: kc, pgstac: pc, limiter: lim}
}

func (h *Handler) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("Tilepack API\n\nUsage\n\nGenerate a PMTiles archive for a STAC item:\n\ncurl -X POST \"https://packager.imagery.hotosm.org/tilepacks/67ac270a43f18e3e3665bef7?format=pmtiles\"\n\nPoll the same endpoint until it returns 200 with a download URL (returns 202 while the worker is still running).\n\nOnce complete, view the updated STAC record with the new asset:\n\nhttps://api.imagery.hotosm.org/stac/collections/openaerialmap/items/67ac270a43f18e3e3665bef7\n"))
	})
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})
	mux.HandleFunc("POST /tilepacks/{id}", h.postTilepack)
	mux.HandleFunc("POST /internal/items/{id}/assets", h.postInternalAsset)
	return mux
}

type internalAssetRequest struct {
	Key   string       `json:"key"`
	Asset pgstac.Asset `json:"asset"`
}

// postInternalAsset is the worker-facing write path. It is mounted on
// the same port as the public API but is protected by a shared bearer
// token and should never be exposed through ingress - only reachable
// via the ClusterIP Service. See chart/templates/ingress.yaml which
// only routes /tilepacks and /healthz.
func (h *Handler) postInternalAsset(w http.ResponseWriter, r *http.Request) {
	got, ok := bearerToken(r.Header.Get("Authorization"))
	if !ok {
		writeJSON(w, http.StatusUnauthorized, response{Status: "error", Message: "unauthorized"})
		return
	}
	expected := h.internalToken()
	if expected == "" || subtle.ConstantTimeCompare([]byte(got), []byte(expected)) != 1 {
		writeJSON(w, http.StatusUnauthorized, response{Status: "error", Message: "unauthorized"})
		return
	}
	id := r.PathValue("id")
	if !stacIDPattern.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Message: "invalid stac id"})
		return
	}
	var req internalAssetRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Message: "invalid body"})
		return
	}
	// The only asset keys the worker is ever allowed to set, to
	// prevent a compromised worker from overwriting arbitrary assets.
	if req.Key != "pmtiles" && req.Key != "mbtiles" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Message: "asset key not allowed"})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()
	if err := h.pgstac.AddAsset(ctx, id, h.cfg.STACCollection, req.Key, req.Asset); err != nil {
		writeJSON(w, http.StatusBadGateway, response{Status: "error", Message: err.Error()})
		return
	}
	log.Printf("worker finished: stac_id=%s asset=%s", id, req.Key)
	writeJSON(w, http.StatusOK, response{Status: "ok"})
}

type response struct {
	Status     string `json:"status"`
	URL        string `json:"url,omitempty"`
	RetryAfter int    `json:"retry_after,omitempty"`
	Message    string `json:"message,omitempty"`
}

func (h *Handler) postTilepack(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !stacIDPattern.MatchString(id) {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Message: "invalid stac id"})
		return
	}

	format := strings.ToLower(r.URL.Query().Get("format"))
	if format != "pmtiles" && format != "mbtiles" {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Message: "format must be pmtiles or mbtiles"})
		return
	}

	minZoom, maxZoom, err := parseZooms(r.URL.Query().Get("min_zoom"), r.URL.Query().Get("max_zoom"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, response{Status: "error", Message: err.Error()})
		return
	}
	canonical := minZoom == 0 && maxZoom == 0

	// Per-IP rate limit happens before any expensive work so abusive
	// clients are cheap to reject.
	if !h.limiter.Allow(clientIP(r)) {
		w.Header().Set("Retry-After", "30")
		writeJSON(w, http.StatusTooManyRequests, response{Status: "rate_limited", RetryAfter: 30})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 20*time.Second)
	defer cancel()

	item, err := h.stac.GetItem(ctx, id)
	if err != nil {
		var nf *stac.ErrNotFound
		if errors.As(err, &nf) {
			writeJSON(w, http.StatusNotFound, response{Status: "error", Message: "stac item not found"})
			return
		}
		writeJSON(w, http.StatusBadGateway, response{Status: "error", Message: "stac lookup failed"})
		return
	}

	cogURL, ok := stac.PrimaryCOGAsset(item)
	if !ok {
		writeJSON(w, http.StatusUnprocessableEntity, response{Status: "error", Message: "stac item has no COG asset"})
		return
	}

	outputKey, err := h.s3.KeyFromCOGURL(cogURL, format, minZoom, maxZoom)
	if err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, response{Status: "error", Message: err.Error()})
		return
	}
	lockKey := h.s3.LockKey(outputKey)

	assetHref, hasAsset := stac.HasTilepackAsset(item, format)
	s3Exists, _, outputSize, err := h.s3.HeadObject(ctx, outputKey)
	if err != nil {
		log.Printf("state check failed: stac_id=%s format=%s key=%s err=%v", id, format, outputKey, err)
		writeJSON(w, http.StatusBadGateway, response{Status: "error", Message: "could not check object state"})
		return
	}

	if canonical {
		if hasAsset && s3Exists {
			log.Printf("ready: stac_id=%s format=%s state=stac+s3", id, format)
			writeJSON(w, http.StatusOK, response{Status: "ready", URL: assetHref})
			return
		}
		if !hasAsset && s3Exists {
			log.Printf("reconcile: stac_id=%s format=%s state=s3_only action=patch_stac", id, format)
			asset := canonicalTilepackAsset(format, h.s3.PublicURL(outputKey), outputSize)
			if err := h.pgstac.AddAsset(ctx, id, h.cfg.STACCollection, format, asset); err != nil {
				log.Printf("reconcile failed: stac_id=%s format=%s action=patch_stac err=%v", id, format, err)
				writeJSON(w, http.StatusBadGateway, response{Status: "error", Message: "could not patch stac asset"})
				return
			}
			log.Printf("reconcile complete: stac_id=%s format=%s action=patch_stac", id, format)
			writeJSON(w, http.StatusOK, response{Status: "ready", URL: asset.Href})
			return
		}
		if hasAsset && !s3Exists {
			log.Printf("reconcile: stac_id=%s format=%s state=stac_only action=regenerate", id, format)
		}
		// If STAC says asset exists but S3 object is missing, fall through
		// and regenerate so both systems converge.
	} else if s3Exists {
		// Non-canonical requests are represented by the concrete S3 object,
		// not by a STAC asset entry.
		log.Printf("ready: stac_id=%s format=%s mode=non_canonical state=s3", id, format)
		writeJSON(w, http.StatusOK, response{Status: "ready", URL: h.s3.PublicURL(outputKey)})
		return
	}

	// In-progress detection via the lock object. Stale locks (older
	// than the configured TTL) are ignored so a crashed worker
	// doesn't permanently block regeneration.
	if exists, modified, _, err := h.s3.HeadObject(ctx, lockKey); err == nil && exists {
		if time.Since(modified) < time.Duration(h.cfg.LockTTLSeconds)*time.Second {
			writeJSON(w, http.StatusAccepted, response{Status: "in_progress"})
			return
		}
	}

	// Global concurrency cap - counted live from the cluster so the
	// API is stateless across restarts.
	active, err := h.k8s.CountActiveJobs(ctx)
	if err != nil {
		writeJSON(w, http.StatusBadGateway, response{Status: "error", Message: "could not check job state"})
		return
	}
	if active >= h.cfg.MaxConcurrentJobs {
		w.Header().Set("Retry-After", "60")
		writeJSON(w, http.StatusTooManyRequests, response{Status: "busy", RetryAfter: 60})
		return
	}

	gsd, _ := stac.GSD(item)

	if err := h.s3.PutLock(ctx, lockKey); err != nil {
		writeJSON(w, http.StatusBadGateway, response{Status: "error", Message: "could not write lock"})
		return
	}

	err = h.k8s.CreateJob(ctx, k8s.JobSpec{
		StacID:    id,
		Format:    format,
		COGURL:    cogURL,
		OutputKey: outputKey,
		LockKey:   lockKey,
		MinZoom:   minZoom,
		MaxZoom:   maxZoom,
		Canonical: canonical,
		GSD:       gsd,
	})
	if err != nil {
		// AlreadyExists means another concurrent request beat us to
		// it; that's success from the caller's point of view. Leave
		// the lock in place - the other worker will clean it up.
		if k8serrors.IsAlreadyExists(err) {
			writeJSON(w, http.StatusAccepted, response{Status: "in_progress"})
			return
		}
		// Any other error means no worker will ever run, so the
		// lock we just wrote would block retries for LOCK_TTL_SECONDS.
		// Best-effort delete; log-and-ignore on the delete side.
		_ = h.s3.DeleteObject(ctx, lockKey)
		writeJSON(w, http.StatusBadGateway, response{Status: "error", Message: "could not create job"})
		return
	}
	if canonical {
		log.Printf("worker started: stac_id=%s format=%s zoom=auto (gsd=%.4f)", id, format, gsd)
	} else {
		log.Printf("worker started: stac_id=%s format=%s zoom=%d-%d", id, format, minZoom, maxZoom)
	}
	writeJSON(w, http.StatusAccepted, response{Status: "started"})
}

func canonicalTilepackAsset(format, href string, fileSize int64) pgstac.Asset {
	asset := pgstac.Asset{
		Href:     href,
		Type:     map[string]string{"mbtiles": "application/vnd.mbtiles", "pmtiles": "application/vnd.pmtiles"}[format],
		Roles:    []string{"tiles"},
		Title:    strings.ToUpper(format) + " archive",
		ProjCode: 3857,
	}
	if fileSize > 0 {
		asset.FileSize = fileSize
	}
	return asset
}

func parseZooms(minStr, maxStr string) (int, int, error) {
	if minStr == "" && maxStr == "" {
		return 0, 0, nil
	}
	if minStr == "" || maxStr == "" {
		return 0, 0, errors.New("min_zoom and max_zoom must both be set")
	}
	minZ, err := strconv.Atoi(minStr)
	if err != nil {
		return 0, 0, errors.New("min_zoom must be an integer")
	}
	maxZ, err := strconv.Atoi(maxStr)
	if err != nil {
		return 0, 0, errors.New("max_zoom must be an integer")
	}
	if minZ < 0 || maxZ < 0 || minZ > 24 || maxZ > 24 || minZ > maxZ {
		return 0, 0, errors.New("zoom must be 0..24 and min<=max")
	}
	return minZ, maxZ, nil
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		if i := strings.Index(xff, ","); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

func bearerToken(authHeader string) (string, bool) {
	if !strings.HasPrefix(authHeader, "Bearer ") {
		return "", false
	}
	tok := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
	if tok == "" {
		return "", false
	}
	return tok, true
}

func (h *Handler) internalToken() string {
	if strings.TrimSpace(h.cfg.InternalTokenFile) != "" {
		if b, err := os.ReadFile(h.cfg.InternalTokenFile); err == nil {
			if tok := strings.TrimSpace(string(b)); tok != "" {
				return tok
			}
		}
	}
	return h.cfg.InternalToken
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
