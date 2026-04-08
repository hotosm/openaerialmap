package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config is loaded from environment variables at startup.
//
// All values are required except where a default is documented; the
// process exits early via Load() if a required variable is missing so
// misconfiguration is caught at deploy time rather than first request.
type Config struct {
	ListenAddr string

	// STACBaseURL is the eoapi STAC root, e.g. https://stac.openaerialmap.org
	STACBaseURL string
	// STACCollection is the only collection from which items may be tilepacked.
	STACCollection string

	// S3Bucket is the public bucket where tilepacks are written.
	// Tilepack archives land next to the source COG under the same
	// <metadata-id>/0/<id>.{mbtiles|pmtiles} key.
	S3Bucket string
	// S3PublicBaseURL is the https origin used to construct asset hrefs
	// in STAC, e.g. https://oin-hotosm-temp.s3.us-east-1.amazonaws.com
	S3PublicBaseURL string

	// LockTTLSeconds - locks older than this are treated as stale and
	// the request will re-trigger generation.
	LockTTLSeconds int64

	// MaxConcurrentJobs caps cluster-wide in-flight worker Jobs.
	MaxConcurrentJobs int
	// PerIPRatePerSecond - token bucket refill rate per client IP.
	PerIPRatePerSecond float64
	// PerIPBurst - token bucket burst size per client IP.
	PerIPBurst int

	// Worker job spec
	WorkerImage          string
	WorkerNamespace      string
	WorkerServiceAccount string

	// PGStacDSN is a libpq-style connection string pointing at the
	// pgstac-managed database. Used only by the internal asset-patch
	// endpoint, not by the public tilepack endpoint.
	PGStacDSN string
	// InternalToken is a shared secret that the worker presents on
	// the internal asset-patch endpoint. Compared with
	// subtle.ConstantTimeCompare on the server side.
	InternalToken string
	// InternalBaseURL is what the worker is told to POST back to.
	// Injected into worker pods as env so they don't have to guess
	// the in-cluster service DNS.
	InternalBaseURL string
	// InternalTokenSecret is the name of the K8s Secret (in the
	// worker namespace) holding the shared internal token under
	// the key "token". The worker Job mounts it via envFrom
	// secretKeyRef rather than receiving the token in clear text.
	InternalTokenSecret string

	// S3 credentials Secret mounted by worker Jobs. The same env
	// var names are used on the API pod but are mounted directly
	// by the chart's Deployment template, not via this config.
	S3CredsSecret    string
	S3CredsAccessKey string
	S3CredsSecretKey string
	AWSRegion        string

	// Worker pod resource requests/limits (Kubernetes quantity strings).
	WorkerCPURequest    string
	WorkerMemoryRequest string
	WorkerCPULimit      string
	WorkerMemoryLimit   string
}

func Load() (*Config, error) {
	c := &Config{
		ListenAddr:           getenv("LISTEN_ADDR", ":8080"),
		STACBaseURL:          os.Getenv("STAC_BASE_URL"),
		STACCollection:       getenv("STAC_COLLECTION", "openaerialmap"),
		S3Bucket:             getenv("S3_BUCKET", "oin-hotosm-temp"),
		S3PublicBaseURL:      getenv("S3_PUBLIC_BASE_URL", "https://oin-hotosm-temp.s3.us-east-1.amazonaws.com"),
		LockTTLSeconds:       getenvInt64("LOCK_TTL_SECONDS", 1800),
		MaxConcurrentJobs:    getenvInt("MAX_CONCURRENT_JOBS", 5),
		PerIPRatePerSecond:   getenvFloat("PER_IP_RATE_PER_SECOND", 0.1),
		PerIPBurst:           getenvInt("PER_IP_BURST", 2),
		WorkerImage:          os.Getenv("WORKER_IMAGE"),
		WorkerNamespace:      getenv("WORKER_NAMESPACE", "default"),
		WorkerServiceAccount: getenv("WORKER_SERVICE_ACCOUNT", "oam-tilepack-worker"),
		PGStacDSN:            os.Getenv("PGSTAC_DSN"),
		InternalToken:        os.Getenv("INTERNAL_TOKEN"),
		InternalBaseURL:      os.Getenv("INTERNAL_BASE_URL"),
		InternalTokenSecret:  getenv("INTERNAL_TOKEN_SECRET", "oam-tilepack-api-internal"),
		S3CredsSecret:        getenv("S3_CREDS_SECRET", "oam-s3-creds"),
		S3CredsAccessKey:     getenv("S3_CREDS_ACCESS_KEY_KEY", "S3_ACCESS_KEY"),
		S3CredsSecretKey:     getenv("S3_CREDS_SECRET_KEY_KEY", "S3_SECRET_KEY"),
		AWSRegion:            getenv("AWS_REGION", "us-east-1"),
		WorkerCPURequest:     getenv("WORKER_CPU_REQUEST", "500m"),
		WorkerMemoryRequest:  getenv("WORKER_MEMORY_REQUEST", "768Mi"),
		WorkerCPULimit:       getenv("WORKER_CPU_LIMIT", "2"),
		WorkerMemoryLimit:    getenv("WORKER_MEMORY_LIMIT", "2Gi"),
	}
	if c.PGStacDSN == "" {
		return nil, fmt.Errorf("PGSTAC_DSN is required")
	}
	if c.InternalToken == "" {
		return nil, fmt.Errorf("INTERNAL_TOKEN is required")
	}
	if c.InternalBaseURL == "" {
		return nil, fmt.Errorf("INTERNAL_BASE_URL is required")
	}
	if c.STACBaseURL == "" {
		return nil, fmt.Errorf("STAC_BASE_URL is required")
	}
	if c.WorkerImage == "" {
		return nil, fmt.Errorf("WORKER_IMAGE is required")
	}
	return c, nil
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func getenvInt(k string, def int) int {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func getenvInt64(k string, def int64) int64 {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			return n
		}
	}
	return def
}

func getenvFloat(k string, def float64) float64 {
	if v := os.Getenv(k); v != "" {
		if n, err := strconv.ParseFloat(v, 64); err == nil {
			return n
		}
	}
	return def
}
