# Global Mosaic Scripts

Shipping: `gen_density_vector.py`. Everything else is kept for reference.

## `gen_density_vector.py`

Emits a PMTiles archive with one `density` layer: Web-Mercator grid
cells at z0-13 with a `count` property per cell (image centroids inside).
Each cell is emitted twice - a Polygon for fill, and a Point at the
cell centre for the label (so labels don't drift onto tile boundaries
when tippecanoe clips the polygon).

z14+ is served by TiTiler via the global-tms nginx routing.

Runs in ~3 min on 2c/2GB, single-digit MB output.

## Retired

**4. `gen_coverage_vector.py`** - dual `globalcoverage` + `density`
layers. Retired because image-footprint outlines are illegible at
z10-13 and the density grid gives clearer aggregate context at every
zoom. Kept alongside `gen_density_vector.py` so the diff is trivial.

Notable bug found here: the per-feature `tippecanoe` clamp lived inside
`properties`, where tippecanoe silently ignores it. Every density cell
ended up at every zoom → "squares within squares" and multi-hour gen
runs. Fix is to put `tippecanoe` at the feature top level.

**3. `gen_coverage_raster.py`** - rasterises footprints into grey PNG
tiles. Retired: server-side raster is expensive, no aggregation info,
and vector-in-pmtiles is more flexible for downstream clients.

**2. `gen_mosaic_hybrid.py`** - grey coverage at z0-10 + real
TiTiler-baked mosaic z11-14, following konturio/oam-mosaic-map. Retired:
TiTiler mosaicking at mid zoom OOMed the 2c/2GB pod, and z14+ TiTiler
handoff on the live TMS covers the "real imagery" case anyway.

**1. `gen_mosaic_manual.py`** - manual COG selection and stitching in
Python. Retired: reinvents TiTiler, worse per-COG IO.

## Files

- `gen_density_vector.py`: shipping; PMTiles `density` layer, z0-13.
- `gen_coverage_vector.py`: reference; PMTiles `globalcoverage` + `density`.
- `gen_coverage_raster.py`: retired; rasterised grey coverage PMTiles.
- `gen_mosaic_hybrid.py`: retired; coverage z0-10 + mosaic z11-14.
- `gen_mosaic_manual.py`: retired; manual COG stitching.
