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
