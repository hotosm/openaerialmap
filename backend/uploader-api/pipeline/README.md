# OAM upload processing pipeline (Argo Workflows)

Processes an uploaded raster into a registered STAC item:

```text
download → validate → convert (COG) → metadata ─┐
                              └→ upload-cog ─────┴→ upload-meta → register
```

Runs in the dedicated, **namespace-scoped `oam` Argo install** (separate from the
ODM controller). `uploader-api` submits a `Workflow` referencing
`geotiff-processing-template` on upload completion; each step reports progress
back to `uploader-api` via the per-upload callback token.

## Steps

- **`validate`** (`uploader-validate`): product-type-aware checks for CRS, size,
  and content versus the declared type (exit 5/6/7).
- **`convert`** (`uploader-convert`): raster to native-dtype lossless COG using
  the GDAL COG driver; verifies losslessness and COG layout.
- **`metadata`** (`uploader-metadata`): builds the OAM STAC item with
  **`stactools-hotosm`**, including original and COG assets, checksums,
  per-type render parameters, and a thumbnail.
- **`register`** (`uploader-register`): posts the item to the token-guarded
  uploader-api internal register endpoint; the API writes to pgstac without the
  STAC transactions API.

`download` / `upload-*` / `cleanup` use `amazon/aws-cli`; `report-status` uses
`curlimages/curl`.

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

The `metadata` step builds the item with `stactools.hotosm.create_item` pinned to
the **same `stactools-hotosm` revision** (`v0.2.1`) as `backend/stac-ingester`,
so user-uploaded and bulk-ingested items carry an identical OAM extension.

## Deploying

This template is the single source of truth and is applied into the `oam`
namespace **separately** from the helm chart (the chart deliberately does not
carry a copy, to avoid drift). The deploy pipeline, or a manual apply, installs
it. Step images are built + pushed by CI. AWS credentials come from the
`oam-uploader-s3` Secret; the S3 endpoint is passed per-run via the `awsurl`
parameter.

```bash
# manual apply (dev)
argo template create workflow-template.yaml -n oam
```
