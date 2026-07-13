# Global Mosaic Scripts

Deployed: `gen_coverage_vector.py`. Everything else is kept for
reference under `archive/`.

## `gen_coverage_vector.py`

Produces **two independent PMTiles files** in sequence, each carrying
a single layer:

1. **`global-coverage.pmtiles`** (`density` layer) - Web-Mercator grid
   cells at z0-13 with a `count` property per cell (image centroids
   inside). Consumed by chiitiler / the global-tms nginx pipeline for
   the standalone TMS. Filename preserved from the prior
   density-only generator so `backend/global-tms` needs no changes.

2. **`global-data.pmtiles`** (`globalcoverage` layer) - per-image
   polygon footprints (z0-13) with rich metadata (title, provider,
   platform, gsd, sensor, license, acquisition_end, thumbnail, uuid,
   tms, file_size). The frontend reads this layer client-side to
   drive sidebar cards, filters, and TMS handoff without any STAC
   API calls.

z14+ is served by TiTiler via the global-tms nginx routing.

### Low-zoom tiles are a simplified representation

`--drop-densest-as-needed` makes the `globalcoverage` layer lossy at
low zoom: at z0-z7 all ~21k footprints can't fit within tippecanoe's
per-tile byte budget, so some are dropped. The frontend hides this by
gating footprints and the sidebar on `FOOTPRINT_MIN_ZOOM` (see
`frontend/src/browse/utils/constants.ts`); at higher zooms tiles are
small enough geographically that drop-densest rarely fires. Low zooms
use the pre-binned `density` layer from `global-coverage.pmtiles`,
whose counts are authoritative.

Do not "fix" this by raising `--maximum-tile-bytes` - packing all 21k
rich footprints into a z0 tile is a multi-MB download for no
user-visible benefit (individual footprints are dots at world view).

Stages run in ascending order of cost so a failure or timeout in a
later stage never leaves a downstream service without a fresh input:

1. `stats.json` (landing page)
2. `global-coverage.pmtiles` density grid (global-tms)
3. `global-data.pmtiles` footprints (frontend browser)

Each stage uploads to S3 before the next one begins.

## Archived (`archive/`)

**4. `gen_density_vector.py`** - density-only PMTiles (single `density`
layer). Superseded by `gen_coverage_vector.py`, which produces the
same density file alongside a footprint archive for the frontend.

**3. `gen_coverage_raster.py`** - rasterises footprints into grey PNG
tiles. Archived: server-side raster is expensive, no aggregation info,
and vector-in-pmtiles is more flexible for downstream clients.

**2. `gen_mosaic_hybrid.py`** - grey coverage at z0-10 + real
TiTiler-baked mosaic z11-14, following konturio/oam-mosaic-map.
Archived: TiTiler mosaicking at mid zoom OOMed the 2c/2GB pod, and
z14+ TiTiler handoff on the live TMS covers the "real imagery"
case anyway.

**1. `gen_mosaic_manual.py`** - manual COG selection and stitching in
Python. Archived: reinvents TiTiler, worse per-COG IO.

Notable bug found in earlier iterations: the per-feature `tippecanoe`
clamp lived inside `properties`, where tippecanoe silently ignores it.
Every density cell ended up at every zoom → "squares within squares"
and multi-hour gen runs. Fix is to put `tippecanoe` at the feature
top level.

## Files

- `gen_coverage_vector.py`: deployed; two PMTiles archives (density +
  footprints).
- `archive/gen_density_vector.py`: Archived; density-only PMTiles.
- `archive/gen_coverage_raster.py`: Archived; rasterised grey coverage
  PMTiles.
- `archive/gen_mosaic_hybrid.py`: Archived; coverage z0-10 + mosaic
  z11-14.
- `archive/gen_mosaic_manual.py`: Archived; manual COG stitching.
