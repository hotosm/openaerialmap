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
   │ presign / complete       │ download
   ▼                          │
uploader-api ──submit──▶ Argo workflow:
   validate → COG → metadata → register ──▶ stac-api
   ▲                                             │
   └──── status callback (X-Internal-Token) ◀────┘
```

- **`app/uploads/`**: S3 multipart lifecycle, Argo trigger, status callback.
- **`app/htmx/`**: the server-rendered pages (upload, profile).
- **`app/db/`**: psycopg pool plus `users` / `uploads` models (raw SQL).
- **`app/auth/`**: thin wrappers over `hotosm-auth[litestar]`.
- **`pipeline/`**: the four Argo step images (validate, convert, metadata,
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

The overlay (`compose.test.yaml`) runs the API with `ARGO_ENABLED=true` and host
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

## What's done

- The Litestar service: DB layer, auth deps, S3 multipart and Argo routes, upload
  and profile pages.
- `pipeline/`: the `WorkflowTemplate` and four step images. Metadata and register
  use `stactools-hotosm` (the same revision as `backend/stac-ingester`).
- `chart/`: Helm chart with namespace-scoped Argo RBAC (a Role, no ClusterRole),
  Deployment, Service, and Ingress for `upload.imagery.hotosm.org`.
- CI: image builds plus a PR gate (`backend-uploader-checks.yml`) running ruff and
  the app and pipeline unit tests. Auth wiring and production configuration are
  in place, and the chart can provision the workflow S3 secret
  (`workflowS3Secret.create`).

## Follow-ups

- **Immutable deploy**: set `PIPELINE_IMAGE_TAG` to the built git SHA in prod. The
  `WorkflowTemplate` already reads it via the `image-tag` parameter; the template
  is still applied separately by the deploy pipeline.
- **Global workflow concurrency**: the per-user cap is in the API. Set the Argo
  controller's `parallelism` / `namespaceParallelism` at install time to bound
  total concurrent workflows, and so PVC usage, across the cluster.
- **Workflow-pod hardening**: non-root, dropped capabilities, a narrowly scoped
  ServiceAccount, and NetworkPolicies. Seccomp is already set.
- **Strict STAC validation**: publish an OAM extension schema for the `oam:*`
  fields, then turn on `STAC_STRICT_EXTENSIONS`.
- **Integration gate**: run the Talos/Argo/S3/pgstac e2e in CI. It's manual for
  now (`just test uploader-e2e`).
