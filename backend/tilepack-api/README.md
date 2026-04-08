# tilepack-api

A small public, pull-based microservice that generates `.mbtiles` /
`.pmtiles` archives from a single OpenAerialMap STAC item's COG.

## Surface

```text
POST /tilepacks/{stac_item_id}?format=pmtiles|mbtiles[&min_zoom=N&max_zoom=N]
GET  /healthz
```

The only user input is a STAC item id (regex-validated, max 128 chars,
must exist in the configured `openaerialmap` STAC collection) and the
output format. Optional `min_zoom`/`max_zoom` let callers cap the
output to reduce file size; when omitted the worker derives the max
zoom from the source COG's native ground resolution.

Responses:

| Status | Body                                 |
| ------ | ------------------------------------ |
| 200    | `{status:"ready", url}`              |
| 202    | `{status:"started"}` / `in_progress` |
| 400    | `{status:"error", message}`          |
| 404    | `{status:"error", message}`          |
| 422    | `{status:"error"}`                   |
| 429    | `{status:"rate_limited"\|"busy"}`    |

Meanings:

- 200: Already exists, here's the URL.
- 202: Worker is now generating it.
- 400: Bad input.
- 404: Item not in OAM collection.
- 422: Item has no COG asset.
- 429: Per-IP limit or global cap reached.

The endpoint is **idempotent**: re-POSTing the same id+format will
return `ready` once the artifact lands. There is no separate status
endpoint - STAC and S3 are the source of truth.

## Statelessness

- Existing artifact → looked up via STAC item asset (`tilepack_pmtiles`
  / `tilepack_mbtiles`) for canonical-zoom requests, or via S3
  HeadObject for custom-zoom variants.
- In-progress → a small `*.lock` object next to the output key. Locks
  expire after `LOCK_TTL_SECONDS` so a crashed worker cannot block
  regeneration permanently.
- Concurrency cap → live count of active worker Jobs in the namespace.

There is no database. The API pod is single-replica because the
per-IP rate limiter is in-memory.

## Limits

- Per-IP: 1 request / 10s, burst 2 (configurable).
- Global concurrent jobs: 5 (configurable).
- Only the `openaerialmap` STAC collection is queryable.
- The first MVP only tilepacks from a **single COG asset** per item.
  A future endpoint will use the deployed titiler-pgstac mosaic
  capability via `go-tilepacks` to handle multi-COG AoIs - see TODO
  in this repo.

## Components

```text
cmd/api/        Go HTTP server (single binary, distroless)
internal/       config, stac, s3, k8s, ratelimit, handler
worker/         Python image: rio-tiler + go-pmtiles
chart/          Helm chart (mirrors backend/global-tms/chart layout)
```

The worker is a separate image so the Go API stays tiny and so the
Python/GDAL toolchain isn't pulled into the request path.

## Local dev

```sh
docker compose up --build
```

This runs only the Go API against your AWS creds and a STAC URL - the
worker side requires a real Kubernetes cluster.

## Deploy

The chart lives in `./chart` and follows the same conventions as
`backend/global-tms/chart`. Apply it via the same flow used by the
`k8s-infra` repo for other OAM services.
