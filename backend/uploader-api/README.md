# OAM Uploader API

Backend and server-rendered UI for uploading imagery to OpenAerialMap, hosted at
`upload.imagery.hotosm.org`.

This started as a UC Berkeley "Code for Good" cohort coding challenge, and was
built out from there.

It's a **Litestar + htmx + psycopg (raw SQL)** service, following the same pattern
as [field-tm](https://github.com/hotosm/field-tm), with shared **HOT auth**
(Hanko). Large GeoTIFFs upload straight from the browser to S3 with presigned
multipart URLs. When an upload finishes, the API submits an **Argo Workflow** (in
the `oam` namespace) that validates the file, converts it to a COG, extracts
metadata, and registers it with the existing `stac-api`.

## Architecture

```text
browser ──multipart PUT──▶ S3 / rustfs
   │                          ▲
   │ presign / complete       │ fetch
   ▼                          │
uploader-api ──submit──▶ Argo workflow:
   fetch → validate → COG → metadata → register ──▶ stac-api
   ▲                                                    │
   └──── status callback (X-Internal-Token) ◀───────────┘
```

Browser uploads go directly to S3; remote uploads provide a `source_url` that
the pipeline fetches. See
[Integrating an external system](#integrating-an-external-system).

- **`app/uploads/`**: upload lifecycle, storage/catalogue clients, Argo trigger,
  and workflow callbacks.
- **`app/htmx/`**: the server-rendered pages (upload, profile).
- **`app/db/`**: psycopg pool plus `users` / `uploads` models (raw SQL).
- **`app/auth/`**: thin wrappers over `hotosm-auth[litestar]`.
- **`pipeline/`**: the five Argo step images (fetch, validate, convert, metadata,
  register), sharing one uv lockfile so GDAL/rasterio match across them.
- **`migrations/`**: plain SQL applied by `migrate-entrypoint.sh` (psql), run once
  before the app. Baseline in `migrations/init/0-main.sql`, tracked in a
  `_migrations` table.

State lives in a dedicated `oam_uploader` Postgres database, separate from the
pgstac catalogue. A `users` table mirrors the auth `sub`, and an `uploads` table
holds per-job status. Status only moves forward, and each upload has a callback
token that stops working once the job finishes.

## Local development

The `compose.yaml` here is a self-contained stack (API, migrations, Postgres, and
an S3 via rustfs), so you can test an upload end to end without the rest of OAM.
The repo-root `compose.yaml` extends these services and repoints them at the
shared rustfs and stac-api.

```bash
# Standalone stack (easiest for working on the uploader):
docker compose up --build
# open http://localhost:8090  (AUTH_PROVIDER=disabled gives you a local-admin user)

# Push a real multipart upload through it (no browser, so no S3 CORS needed):
python scripts/test-upload.py path/to/image.tif
# then check http://localhost:8090/  under "Your uploads"
```

With `ARGO_ENABLED=false` (the compose default), uploads land in S3 and get
recorded, but no workflow runs, since there's no cluster. The upload shows as
`Uploaded`. To run the real pipeline, use the Talos harness below.

## End-to-end testing (Talos + Argo)

The repo-root `just` recipes spin up a local Talos-in-Docker cluster with Argo,
apply the `WorkflowTemplate`, and run an upload through the whole pipeline. Run
these from the **repo root** (needs docker; talosctl / kubectl / jq install on
demand):

```bash
just test cluster-init      # Talos cluster + Argo + template + secret
just test uploader-e2e      # start services, push an upload, wait for register
#   just test uploader-e2e path/to/image.tif   # your own GeoTIFF (else a sample)
just k8s cluster-destroy    # tear down
```

Two ways to drive the same setup:

- `just test uploader-e2e` runs it headless: push an upload, poll until
  `Succeeded`, tear down. This is the CI-style path.
- `just test dev-cluster` brings the stack up and leaves it running, so you can
  upload through the **UI** at <http://localhost:8090> and watch it go from
  Processing to Succeeded. Stop it with `docker compose ... down`.

The overlay (`compose.e2e.yaml`) runs the API with `ARGO_ENABLED=true` and host
networking so it can reach the Talos API. Workflow pods reach S3, STAC, and the
status callback via the Talos gateway IP (the recipe sets this). Both recipes
build the four `pipeline/` images locally, so you always test your current code,
not the published `ghcr.io` images.

Dependencies use [uv](https://docs.astral.sh/uv/):

```bash
uv sync --all-groups
# Migrations don't run on app startup. Apply them once before running outside compose:
MIGRATIONS_DIR=./migrations DB_HOST=localhost DB_USER=oam \
  DB_PASSWORD=oam DB_NAME=oam_uploader \
  ./migrate-entrypoint.sh
uv run uvicorn app.main:app --reload --port 8080
```

Config is via environment variables. See `.env.example`.

## Integrating an external system

A partner can prefill the upload form without exchanging API tokens: send the
signed-in user to `/` with values in the URL fragment, for example
`/#title=Ward+5&source_url=…`. Supported fields are `title`, `provider`,
`platform`, `license`, `acquisition_start`, `acquisition_end`, `sensor`,
`contact`, `product_type`, `source_url`, `external_id`, and `external_url`.

Use a fragment rather than a query string so a presigned URL never reaches
server or ingress logs. The page removes prefill data from the address bar after
reading it.

`source_url` must be a public HTTPS URL whose expiry covers queueing and
transfer. After the user confirms, the pipeline downloads the TIFF and clears
the URL from the database.

Remote fetching is guarded against SSRF and unsafe content:

- every resolved address and redirect must be public;
- embedded credentials, non-HTTPS URLs, non-TIFF content, and oversized files
  are rejected;
- production should enable `workflowNetworkPolicy` as a second layer;
- `FETCH_ALLOW_PRIVATE_HOSTS=true` is only for local and e2e testing.

`external_id` is an opaque idempotency key, conventionally `<source>:<id>`.
Active and successful uploads reserve it; failed uploads may be retried. Resolve
it with `GET /api/v1/uploads/lookup?external_id=…`. `external_url` becomes the
published STAC `via` link, while `source_url` is never published. The upload ID
is also the STAC item ID.

The pipeline warns, but does not reject, when the original file's checksum is
already published.

## What's done

- The Litestar service: DB layer, auth deps, S3 multipart and Argo routes, upload
  and profile pages.
- `pipeline/`: the `WorkflowTemplate` and five step images. Metadata uses
  `stactools-hotosm` from `backend/stactools-hotosm`, the same source tree as
  `backend/stac-ingester`.
- `chart/`: Helm chart with namespace-scoped Argo RBAC (a Role, no ClusterRole),
  Deployment, Service, and Ingress for `upload.imagery.hotosm.org`.
- CI: image builds plus a PR gate (`backend-uploader-test.yml`) running
  `just test all` (unit tests per component in their images). Lint is on
  pre-commit.ci. The chart can provision the S3 credentials secret
  (`s3Secret.create`), which the pipeline steps read too.

## Production bucket setup

Configure these bucket-wide settings outside the application:

- CORS must allow the uploader origin and expose `ETag` for multipart uploads.
- A lifecycle rule should abort incomplete multipart uploads after seven days.

When updating lifecycle configuration, preserve existing retention and tiering
rules: `PutBucketLifecycleConfiguration` replaces the complete configuration.

## Follow-ups

- **Immutable deploy**: set `PIPELINE_IMAGE_TAG` to the built git SHA in prod. The
  `WorkflowTemplate` already reads it via the `image-tag` parameter; the template
  is still applied separately by the deploy pipeline. CI must publish SHA tags.
- **Global workflow concurrency**: set Argo `namespaceParallelism` and a storage
  `ResourceQuota`; each active workflow can hold a 300Gi volume.
- **Workflow-pod hardening**: evaluate `readOnlyRootFilesystem` and a sandboxed
  runtime such as gVisor.
- **Strict STAC validation**: publish an OAM extension schema for the `oam:*`
  fields, then turn on `STAC_STRICT_EXTENSIONS`.
- **Integration gate**: run the Talos/Argo/S3/pgstac e2e in CI. It's manual for
  now (`just test uploader-e2e`).
