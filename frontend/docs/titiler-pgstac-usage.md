# TiTiler-PgSTAC usage in the frontend

Short note on how the browse UI talks to `titiler-pgstac`.

## Per-item TMS vs the single mosaic endpoint

`titiler-pgstac` offers two ways to get tiles: a **per-item TMS**
(`/collections/{c}/items/{id}/tiles/...`) or a **mosaic** built from
a registered search. We use per-item - up to `MAX_TMS = 8` MapLibre
sources at high zoom, one per visible image.

The mosaic endpoint doesn't let us control stacking order beyond
"newest first", so we can't put the user's selected image on top at
full opacity and dim the rest. Per-item keeps that control, at the
cost of more parallel tile requests and per-item cache keys. The
zoom thresholds (`TMS_SELECTED_MIN_ZOOM=10`, `TMS_LARGE_MIN_ZOOM=12`,
`TMS_ALL_MIN_ZOOM=16`) and the `MAX_TMS` cap keep the request count
predictable.

## Why we don't use titiler-pgstac at all zooms

At world / regional zoom a single tile overlaps thousands of image
footprints, so any tiler rendering from the source COGs has to read
a lot of S3 objects per tile. That's why we split by zoom:

- **Low zoom**: the pre-built density PMTiles from `global-mosaic`,
  served from S3 (or via `global-tms` for non-PMTiles clients).
- **High zoom**: per-item TMS against `titiler-pgstac`.

See `docs/decisions/0002-global-mosaic.md` and
`docs/decisions/0003-global-tms.md`.
