# OAM upload processing pipeline (Argo Workflows)

Processes an uploaded raster into a registered STAC item:

```text
fetch → validate → convert (COG) → metadata ─┐
                           └→ upload-cog ─────┴→ upload-meta → register
```

Runs in the dedicated, **namespace-scoped `oam` Argo install** (separate from the
ODM controller). `uploader-api` submits a `Workflow` referencing
`geotiff-processing-template` on upload completion; each step reports progress
back to `uploader-api` via the per-upload callback token.

## Steps

- **`fetch`** (`uploader-fetch`): gets the imagery onto the workspace volume and
  writes `/data/input.tif` and `/data/meta.json`. It copies browser uploads from
  S3 or downloads a remote `source_url`, then reports the original checksum.
- **`validate`** (`uploader-validate`): product-type-aware checks for CRS, size,
  content, and GeoTIFF format (exit 5/6/7/8).
- **`convert`** (`uploader-convert`): raster to native-dtype lossless COG using
  the GDAL COG driver; verifies losslessness and COG layout.
- **`metadata`** (`uploader-metadata`): builds the OAM STAC item with
  **`stactools-hotosm`**, including original and COG assets, checksums,
  per-type render parameters, and a thumbnail.
- **`register`** (`uploader-register`): posts the item to the token-guarded
  uploader-api internal register endpoint; the API writes to pgstac without the
  STAC transactions API.

`upload-*` / `cleanup` / `purge-objects` use `amazon/aws-cli`; `report-status`
uses `curlimages/curl`. Steps run unprivileged without Kubernetes API tokens.

Metadata and source URLs are fetched through the token-guarded API, not exposed
as workflow parameters. `fetch` validates every redirect and returns 75 only
for transient errors, which are the only failures Argo retries.

## Ingestion policy

OAM accepts **any georeferenced raster**, not only 8-bit RGB orthophotos. Per
upload, the item carries up to three tracks:

- **`original`** - the unmodified upload, kept as-is for archival / recovery. A
  STAC asset is only a pointer, so cataloging it does not alter the bytes.
- **`visual`** (the COG) - a lossless, single-pass COG in the source's **native**
  dtype and band count (never downcast). This is the analysis-ready, byte-range
  asset; losslessness is verified against the source per band.
- **2D display** - rendered on demand by titiler from the COG using the
  `renders` params written per `oam:product_type` (`visual` shown as-is;
  `multispectral`/`sar`/`elevation`/`pseudocolor` get band selection, rescale and
  colormap). No baked 8-bit browse file - only a thumbnail for the catalog card.

The user declares `product_type` on upload; `metadata.py` auto-detects if omitted.
**3D display (terrain drape for DEMs)** is a future opt-in - the plan is
terrain-RGB PMTiles + MapLibre, matching the existing browse-map stack - and is
not part of ingestion.

## Size limits

The API caps an upload at `MAX_UPLOAD_BYTES` (100 GiB), enforced again on the
way in as the `max-fetch-bytes` workflow parameter. Nothing after that is bound
by pixel count - GDAL reads in blocks, `metadata` reads decimated windows - so
`validate`'s remaining job is to reject, before six hours of conversion, an
upload that cannot fit its workspace volume.

That volume is sized per upload. `uploader-api` reads the object's real size,
scales it by `WORKSPACE_MULTIPLIER` between `WORKSPACE_MIN_GIB` and
`WORKSPACE_MAX_GIB`, and submits the claim with the Workflow - Argo takes no
parameter in a PVC size, so it replaces the whole `volumeClaimTemplates` entry.
A remote source has no size until it has been fetched and gets the ceiling.
`WORKSPACE_STORAGE_CLASS` must reclaim on delete: HOTOSM's default `gp3` is
`Retain`, so leaving it unset leaves one EBS volume behind per run.

`WORKSPACE_MULTIPLIER` buys the decode ratio the volume will tolerate, because
compressed bytes do not predict decoded ones - a JPEG-in-TIFF ortho reaches
10:1. Overhead takes the rest of it, so 17x delivers 10:1 and not 17:1. That
holds up to a 60 GiB upload, past which `WORKSPACE_MAX_GIB` binds first and the
ratio degrades to 5.8:1 at the 100 GiB ceiling; raise the cap to extend it. Too
tight a ratio here rejects real imagery, which is the bug this replaced.

`max-decoded-gb` follows from that volume rather than being chosen: the run
holds the input, its COG and GDAL's overview temp on one disk, and a lossless
COG of incompressible pixels is the size of the decoded raster. `COG_TEMP_FACTOR`
budgets half the output for temp against GDAL's estimated third, and
`WORKSPACE_USABLE` keeps 5% back for ext4 metadata and the small sidecar files.

| Parameter | Default | Env in the step |
| --- | --- | --- |
| `max-decoded-gb` | computed (`150` fallback) | `OAM_VALIDATE_MAX_DECODED_GB` |
| `max-gigapixels` | `0` (off) | `OAM_VALIDATE_MAX_GIGAPIXELS` |

The template's own values are the fallback for a submission that does not come
from the API, and are fixed at the largest upload allowed.

A rejection writes its reason to `/data/validation-error.txt` and `cleanup`
reports that verbatim; the exit-code map there is only a fallback.

## Convergence with the bulk ingester

The `metadata` step builds the item with `stactools.hotosm.create_item` from
`backend/stactools-hotosm`, the **same source tree** as `backend/stac-ingester`,
so user-uploaded and bulk-ingested items carry an identical OAM extension. Both
take it as a path dependency, so there is no revision to keep in step - see
[ADR 0008](../../../docs/decisions/0008-stactools-into-monorepo.md).

That path dependency has to live inside the build context, so the raster steps
build from `backend/` rather than from this directory:

```bash
docker build -f backend/uploader-api/pipeline/metadata/Dockerfile \
    --target prod backend
```

`register` is stdlib-only and still builds from its own directory.

## Deploying

This template is the single source of truth and is applied into the `oam`
namespace **separately** from the helm chart (the chart deliberately does not
carry a copy, to avoid drift). The deploy pipeline, or a manual apply, installs
it. Step images are built + pushed by CI.

The `aws-cli` steps read `S3_ACCESS_KEY` / `S3_SECRET_KEY` from the
`oam-s3-creds` Secret. Keep its name and keys aligned with the chart. The S3
endpoint and region are workflow parameters.

```bash
# manual apply (dev)
argo template create workflow-template.yaml -n oam
```
