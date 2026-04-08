package main

import (
	"context"
	"log"
	"net/http"
	"time"

	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/config"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/handler"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/k8s"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/pgstac"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/ratelimit"
	tps3 "github.com/hotosm/openaerialmap/backend/tilepack-api/internal/s3"
	"github.com/hotosm/openaerialmap/backend/tilepack-api/internal/stac"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("config: %v", err)
	}

	ctx := context.Background()
	s3c, err := tps3.New(ctx, cfg.S3Bucket, cfg.S3PublicBaseURL)
	if err != nil {
		log.Fatalf("s3: %v", err)
	}
	kc, err := k8s.New(k8s.NewOpts{
		Namespace:            cfg.WorkerNamespace,
		WorkerImage:          cfg.WorkerImage,
		WorkerServiceAccount: cfg.WorkerServiceAccount,
		InternalBaseURL:      cfg.InternalBaseURL,
		InternalTokenSecret:  cfg.InternalTokenSecret,
		S3CredsSecret:        cfg.S3CredsSecret,
		S3CredsAccessKey:     cfg.S3CredsAccessKey,
		S3CredsSecretKey:     cfg.S3CredsSecretKey,
		AWSRegion:            cfg.AWSRegion,
		WorkerCPURequest:     cfg.WorkerCPURequest,
		WorkerMemoryRequest:  cfg.WorkerMemoryRequest,
		WorkerCPULimit:       cfg.WorkerCPULimit,
		WorkerMemoryLimit:    cfg.WorkerMemoryLimit,
	})
	if err != nil {
		log.Fatalf("k8s: %v", err)
	}
	pc, err := pgstac.New(ctx, cfg.PGStacDSN)
	if err != nil {
		log.Fatalf("pgstac: %v", err)
	}
	defer pc.Close()
	sc := stac.New(cfg.STACBaseURL, cfg.STACCollection)
	lim := ratelimit.NewPerIP(cfg.PerIPRatePerSecond, cfg.PerIPBurst)

	h := handler.New(cfg, sc, s3c, kc, pc, lim)

	srv := &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           h.Routes(),
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("tilepack-api listening on %s", cfg.ListenAddr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
