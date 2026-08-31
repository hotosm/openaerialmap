# Tilepack API

A microservice for OpenAerialMap that generates downloadable MBTiles
and PMTiles tile archives from Cloud-Optimized GeoTIFFs (COGs).

## How It Works

The service has two components: a **Go API** and a **Python worker**.

When a user sends
`POST /tilepacks/{stac-item-id}?format=pmtiles|mbtiles`, the API
validates the request, fetches the STAC item from the
`openaerialmap` collection, and checks whether the archive already
exists on S3. If it does, the URL is returned immediately. If not, the
API launches an asynchronous Kubernetes Job running the Python worker
to generate it.

The worker reads the COG via rio-tiler, renders tiles across the
appropriate zoom range (derived automatically from the image's ground
sample distance, or user-specified), writes them into an MBTiles SQLite
archive, and optionally converts to PMTiles via `go-pmtiles`. The
finished archive is uploaded to S3 in the same directory as the source
COG, and the new asset is registered back into the STAC catalog via
pgstac.

Callers poll the same endpoint to check progress. The API returns
**202** while generation is in progress and **200** with a download URL
once complete. A failed build returns **409** with
`{"status": "failed"}`, which is terminal for `retry_after` seconds -
stop polling. **429** (busy or rate limited) is retryable: back off for
`retry_after` and try again.

## API Surface

```text
POST /tilepacks/{stac_item_id}?format=pmtiles|mbtiles[&min_zoom=N&max_zoom=N]
GET  /healthz
```

The only user input is a STAC item id (regex-validated, max 128 chars,
must exist in the configured `openaerialmap` STAC collection) and the
output format.

Zoom behavior has two modes:

- **Canonical request**: omit `min_zoom` and `max_zoom`.
  - Worker derives zoom range from source GSD.
  - Result is the default archive for that item+format.
  - This variant is represented in STAC (asset key `pmtiles` / `mbtiles`).
- **Non-canonical request**: set both `min_zoom` and `max_zoom`.
  - Worker generates exactly that zoom range.
  - Result is stored in S3 under a zoom-suffixed key (`_z<min>-<max>`).
  - This variant is **not** written to STAC; caller receives direct URL in API response.

| Status | Meaning                            |
| ------ | ---------------------------------- |
| 200    | Already exists, here's the URL     |
| 202    | Worker is now generating it        |
| 400    | Bad input                          |
| 404    | Item not in OAM collection         |
| 409    | Last build failed; `retry_after`   |
| 422    | Item has no COG asset              |
| 429    | Per-IP limit or global cap reached |

The endpoint is **idempotent**: re-POSTing the same request returns
`ready` once the artifact lands.

### Response examples (polling flow)

The same endpoint is used to trigger and poll job status.

#### Canonical example (no zoom params)

```http
POST /tilepacks/67ac270a43f18e3e3665bef7?format=pmtiles
```

```json
{ "status": "started" }
```

```json
{ "status": "in_progress" }
```

```json
{ "status": "ready", "url": "https://.../67ac270a43f18e3e3665bef7.pmtiles" }
```

Canonical outputs are patched into STAC assets (`pmtiles` / `mbtiles`).

If the worker died instead, polling returns `409` until the failed Job
is garbage-collected, and `retry_after` counts down to that moment:

```json
{
  "status": "failed",
  "message": "tilepack generation exceeded its time limit; retry with a lower max_zoom",
  "retry_after": 2874
}
```

The API deliberately does not retry on the caller's behalf. A build
that exceeded its deadline will exceed it again, so an automatic retry
would loop; the cooldown gives a caller time to ask for a lower
`max_zoom` instead. An operator can shorten it by deleting the failed
Job.

#### Non-canonical example (custom zoom)

```http
POST /tilepacks/67ac270a43f18e3e3665bef7?format=pmtiles&min_zoom=12&max_zoom=17
```

```json
{ "status": "started" }
```

```json
{
  "status": "ready",
  "url": "https://.../67ac270a43f18e3e3665bef7_z12-17.pmtiles"
}
```

Non-canonical outputs are served by URL in the API response and are not
written to STAC.

## Design Choices

This service runs standalone and has no auth. It can only operate on
STAC IDs in our catalogue and returns a simple 200 on repeat triggers,
with rate limiting to reduce DDoS risk.

- **Stateless API** -- S3 and STAC/pgstac are the sources of truth. No
  separate job database.
- **K8s Jobs as a task queue** -- Job state is the source of truth for
  whether a build is running, failed or done. Job names are
  deterministic, so the API looks one up before doing anything else.
- **S3 lock as a backstop** -- covers the gap between writing the lock and
  creating the Job. Its TTL must not exceed the finished Job TTL.
- **WebP q70 tiles** -- ~10x smaller than PNG, and unlike JPEG it keeps
  the alpha band, so the padding around a rotated footprint stays
  transparent instead of rendering as a black collar.
  Read by GDAL, QGIS, QField (1.6+), MapLibre and Android's decoder.
  Archives predating this are PNG and stay readable -- each archive
  declares its own encoding, so no regeneration is needed. A PMTiles
  build reuses an existing sibling MBTiles, so it inherits PNG if that
  sibling predates the switch.
- **Rate limiting** -- per-IP rate limit to protect the cluster.
- **Direct DB writes** -- the transactions API is not enabled for
  eoAPI, so the worker uses pgstac PL/pgSQL functions to update STAC
  metadata records.
- **Single replica** -- the per-IP rate limiter is in-memory.
- **Internal auth token source** -- the API validates worker bearer tokens
  from a mounted Kubernetes Secret file at request time (`INTERNAL_TOKEN_FILE`),
  with `INTERNAL_TOKEN` as rollout-safe fallback.

## Limits

All configurable via the chart's `config` values.

- Per-IP: 1 request / 10s, burst 2.
- Global concurrent jobs: 2.
- Worker deadline: 3h, after which the Job fails and the API returns 409
  for the following hour (`workerJobTTLSeconds`).
- Worker aborts before uploading if a run exceeds 150,000 tiles or
  4 GiB of encoded tiles. Retry with a lower `max_zoom`.
- Only the `openaerialmap` STAC collection is queryable.

## Tech Stack

- **API**: Go, with Postgres client to pgstac DB.
- **Worker**: Python 3.13, rio-tiler, rasterio, boto3, go-pmtiles CLI.
- **Deployment**: Helm chart for Kubernetes.

## Components

```text
cmd/api/        Go HTTP server (single binary, distroless)
internal/       config, stac, s3, k8s, ratelimit, handler
worker/         Python image: rio-tiler + go-pmtiles
chart/          Helm chart
```

The worker is a separate image so the Go API stays tiny and the
Python/GDAL toolchain isn't pulled into the request path.

## Local Dev

```sh
docker compose up --build
```

This runs only the Go API against your AWS creds and a STAC URL -- the
worker side requires a real Kubernetes cluster.

## Performance

The workload is ~85% network I/O (HTTP range reads to S3 COGs). GDAL
decoding and WebP encoding are C libraries - Python is a thin
orchestrator adding ~1ms of overhead per tile.

Per-tile cost breakdown:

1. **HTTP range read(s) to S3 COG** (~50–70ms)
2. **GDAL decode + warp/reproject** (~5–15ms)
3. **WebP encode with alpha mask** (~2–5ms)
4. **SQLite insert + Python overhead** (~<1ms)

Baseline benchmarks (8 threads, before optimisations):

| Zoom | Tiles | Time   | Per-tile |
| ---- | ----- | ------ | -------- |
| z19  | 77    | 7.0s   | 91ms     |
| z20  | 210   | 17.7s  | 84ms     |
| z21  | 840   | 67.6s  | 80ms     |
| z22  | 3245  | 236.4s | 73ms     |
| z22  | 12826 | 1077s  | 84ms     |

### What's implemented

**24 concurrent threads**. Since the bottleneck is network
I/O, higher concurrency scales near-linearly until bandwidth saturates.

| Workers      | Estimated z22 (3245 tiles) |
| ------------ | -------------------------- |
| 8            | 236s                       |
| 16           | ~125s                      |
| 24 (current) | ~90s                       |
| 32           | ~75s                       |

**Thread-local GDAL Reader pooling** - each thread keeps a single open
`Reader` for the duration of the run instead of opening/closing one per
tile. This eliminates ~5ms of GDAL Open + VSICurl header overhead per
tile (~10–15% improvement).

**HTTP connection reuse** - GDAL VSICurl is configured with
`GDAL_HTTP_MULTIPLEX`, `GDAL_HTTP_TCP_KEEPALIVE`, and
`CPL_VSIL_CURL_USE_HEAD=NO` to reuse TCP connections and avoid
redundant HEAD requests to S3.

## Usage

Generate a PMTiles archive for a STAC item:

```sh
curl -X POST "https://packager.imagery.hotosm.org/tilepacks/67ac270a43f18e3e3665bef7?format=pmtiles"
```

Poll the same endpoint until it returns `200` with a download URL
(`202` while the worker is still running, `409` if the last build
failed - terminal, stop polling).

Once complete, view the updated STAC record with the new asset:

```sh
https://api.imagery.hotosm.org/stac/collections/openaerialmap/items/67ac270a43f18e3e3665bef7
```

## Deploy

The chart lives in `./chart`. Apply it via the same flow used by the
`k8s-infra` repo for other OAM services.
