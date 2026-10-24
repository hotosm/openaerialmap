<!-- markdownlint-disable MD013 MD025 -->

# AGENTS.md

Guidance for AI coding agents in **OpenAerialMap**.
Human maintainers are accountable for all merged changes.

---

## Project

OpenAerialMap (OAM) is an open catalogue of openly licensed aerial and drone
imagery. Contributors upload GeoTIFFs, which are validated, converted to COGs,
catalogued as STAC items, and served as tiles and a browsable map.

**Stack:** Python 3.12+ / FastAPI / PostgreSQL + PostGIS + pgstac /
React + Vite + UnoCSS / Argo Workflows / Docker Compose (dev) / Helm (k8s) /
uv / Ruff / pre-commit

---

## Structure

```text
backend/uploader-api/     # FastAPI upload API + the imagery pipeline stages
backend/uploader-api/pipeline/  # fetch / validate / metadata pipeline stages
backend/stac-api/         # STAC API service (pgstac-backed)
backend/stac-ingester/    # STAC item ingestion
backend/stactools-hotosm/ # HOTOSM stactools package (STAC item creation)
backend/tilepack-api/     # Tilepack generation API
backend/global-mosaic/    # Global mosaic build
backend/global-tms/       # Global TMS tile serving
frontend/                 # React + Vite SPA
stac-map/                 # STAC Browser deployment
chart/                    # Helm chart
tasks/                    # Justfile modules (start, test, prep, chart, k8s)
docs/                     # MkDocs documentation
```

---

## Commands

Use `just` - do not invent equivalent raw docker or pytest invocations.

```bash
just start all          # Bring up the core stack (docker compose up -d --build)
just start all-tms      # Core stack plus global TMS tiles
just start stop         # Tear down
just start logs <svc>   # Follow one service's logs
just test all           # Every unit suite (uploader, stactools, stac-extension, tilepack-api)
just test uploader      # Uploader suites only, in the built test image
just test chart         # Helm chart rendering tests, on the host
just chart build        # Lint, resolve dependencies, and package the chart
just prep machine       # Install host tooling
```

Pre-commit is mandatory - `ruff`, `ruff-format`, `uv-lock`, `pyupgrade`,
`codespell`, `oxfmt` (TS/JS), `bashate`, `shellcheck`, `markdownlint`,
`commitizen`:

```bash
uv tool install pre-commit
pre-commit install
```

---

## Decisions Already Made

Do not re-litigate these without asking a maintainer:

- **Compose file roles are distinct.** `compose.yaml` is the local stack,
  `compose.test.yaml` is the CI test harness, and `compose.e2e.yaml` is an
  overlay that points the API at a real Argo pipeline on local Talos. Do not
  merge them or move services between them.
- **Presigned uploads set `request_checksum_calculation="when_required"`.**
  botocore's default upload checksums break presigned PUTs against
  MinIO/rustfs. Every boto3 client that presigns must keep this config - see
  `backend/uploader-api/app/uploads/s3.py`.
- **Prod object storage is ACL-based.** Every write to `oin-hotosm-temp` must
  use `S3_OBJECT_ACL=public-read`; local stores use a public bucket policy.
- **pgstac is the catalogue store.** STAC items live in pgstac; do not add a
  parallel item table or an ORM layer over it.
- **Pipeline stages are separate images.** `fetch`, `validate` and `metadata`
  are distinct stages run by Argo, not one monolithic worker.

Sections that only a maintainer can fill in - approaches tried and rejected,
and the history behind them - are deliberately left short here. Ask rather
than assume, and record new decisions in `docs/`.

---

## Where AI Help Is Welcome

- Test scaffolding and fixtures
- Frontend components and styling
- Documentation and docstrings
- Boilerplate: config plumbing, Pydantic models, typing fixes
- Refactors that are tightly scoped and covered by existing tests

## Where AI Must Not Act Unsupervised

- Anything touching credentials, presigning, or bucket policy
  (`backend/uploader-api/app/uploads/`)
- Argo workflow templates and the pipeline stage contracts
- Helm chart values and templates that affect production (`chart/`)
- Database migrations and pgstac schema
- CI workflows and release/publish steps

---

## Coding Standards

- Python: type hints on public functions, Ruff-clean, no bare `except`.
- Async: do not block the event loop; no sync I/O in request handlers.
- TypeScript: no `any` to silence the compiler; formatted with `oxfmt`.
- Prefer a maintained library over a hand-rolled implementation.
- Geospatial correctness matters: be explicit about CRS, and do not assume a
  polygon is safe across the anti-meridian.

---

## Testing Standards

- New behaviour needs a test in the matching suite under `just test`.
- Tests must pass in the built image, not only on the host - CI runs them in
  the image.
- Never weaken or skip a failing test to make a change pass.

---

## Anti-Patterns

- Editing `frontend/dist/` or other build output
- Committing secrets, `.env` files, or real bucket credentials
- Adding a dependency without also updating the lockfile via `uv-lock`
- Broad reformat-the-world diffs mixed into a behavioural change
- Silently changing default values in `chart/values.yaml`

---

## Workflow

1. Read the relevant code before proposing a change.
2. Keep the diff scoped to the task; raise anything else separately.
3. Run `just test all` (or the narrowest relevant suite) and pre-commit.
4. Report what you changed, what you ran, and what you did not verify.

When uncertain, ask instead of assuming.

---

## Responsible AI Contribution Policy

- Org guidance for AI-assisted contributions: <https://responsibleai.guide>
- Declare the AI assistance level (0-5) in the PR template honestly. Never
  lower the declared level to get a PR reviewed.
- If nobody has read the result, that is level 5: open the PR as a draft.
- Do not work on issues labelled `good first issue` - they exist for humans.
- A human is accountable for every merged change.
