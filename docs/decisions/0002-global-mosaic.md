# Pre-render a global coverage mosaic as PMTiles from STAC metadata

## Context and Problem Statement

We need a way for the frontend (and any downstream client) to answer
"where is imagery available worldwide?" without hitting the STAC API
for every pan or zoom.

- OAM has ~21k images spread globally, and this grows over time.
- Rendering all footprints from a live API (+ S3 assets) on every
  viewport change would hammer the STAC database and feel sluggish.
- Non-web clients (QGIS, scripts) also want a single, cheap-to-serve
  endpoint for the global coverage picture.

The STAC catalogue already holds authoritative footprint geometry and
metadata for every image, so a coverage layer can be derived from it
rather than maintained separately.

### "Mosaic" in this MADR

The word "mosaic" is overloaded, so to be explicit:

- A **raster mosaic** stitches the actual COG pixels together across
  many images into one seamless tiled image at every zoom level. This
  is what the previous OAM stack tried to do server-side, and what
  TiTiler still does on demand at high zoom (see MADR 0003).
- A **vector coverage layer** ("vector mosaic") does not touch pixels
  at all. It carries per-image footprint polygons and metadata (title,
  provider, GSD, thumbnail URL, per-image TMS URL, etc.) so the client
  can draw the "where is imagery" picture and hand off to the real
  raster TMS when the user zooms in on a specific image.

This MADR is about the second: a pre-rendered vector coverage layer,
not a global raster mosaic.

## Considered Options

- **Aggregate on the client from the STAC API on the fly**: query cost
  grows with the viewport, and world zoom becomes unusable.
- **Server-side vector tile API from PostGIS**: another live service
  to run, and each tile still goes through the database.
- **Pre-render a global raster mosaic** (mosaic every COG at every
  zoom, e.g. via `gen_mosaic_hybrid.py`): expensive to build, OOMs on
  small pods at mid-zoom, and adds no information beyond "there is
  imagery here" at world view. High-zoom real-pixel viewing is already
  covered by on-demand TiTiler (MADR 0003), so pre-baking pixels is
  wasted work.
- **Pre-render vector PMTiles derived from STAC footprints**: build
  once and serve static objects from S3.

## Decision Outcome

Build a **vector** global coverage layer as PMTiles on a 12-hour
Kubernetes CronJob (see `backend/global-mosaic/`). The job reads
footprints from pgSTAC, runs
[tippecanoe](https://github.com/felt/tippecanoe) to produce two
independent PMTiles archives, and uploads them to S3 for public read
(see `backend/global-mosaic/scripts/gen_coverage_vector.py`).

The two archives are:

1. **`global-coverage.pmtiles`** - a `density` layer of Web-Mercator
   grid cells at z0-13 with a `count` property per cell (number of
   image centroids that fall inside). This is the "heatmap" view of
   where imagery exists at world/regional zooms. Also served through
   `global-tms` as a raster TMS for clients that don't speak PMTiles
   (e.g. QGIS).
2. **`global-data.pmtiles`** - a `globalcoverage` layer of per-image
   footprint polygons at z0-13 with rich metadata (title, provider,
   platform, GSD, sensor, license, acquisition end, thumbnail URL,
   UUID, per-image TMS URL, file size). The frontend reads this
   client-side to drive footprint outlines, sidebar cards, filters,
   and the handoff to per-image TMS - without STAC API calls.

At z14+ the frontend and `global-tms` hand off to TiTiler for real
imagery pixels; the PMTiles layers only cover the overview zooms.

Why two files rather than one:

- The density layer is a small, complete summary at world zoom - a
  single tile pull gets you the full global picture.
- The footprint layer is much larger and lossy at low zoom (see
  below), so it's only useful once the viewport is small enough to
  actually see individual images.
- Splitting them lets clients pull only what they need, and lets the
  raster TMS reuse the density file without pulling footprint
  metadata it can't render.

### Consequences

- ✅ Cheap to serve: two static files on S3, easy to put behind a CDN,
  and no database load per request.
- ✅ Fast for clients: PMTiles uses HTTP range requests, so the
  browser only pulls the tiles it needs.
- ✅ Derived straight from STAC, so there's no separate schema to keep
  in sync. The catalogue stays the source of truth.
- ✅ Reproducible: the job is deterministic and can be re-run to
  rebuild the archives from scratch.
- ✅ Cheap to build: no COG IO, no pixel mosaicking - just footprint
  geometry and metadata into tippecanoe.
- ❌ Not real-time. Newly ingested imagery only shows up after the
  next scheduled build (up to 12h later). Fine for a coverage map.
- ❌ Tippecanoe has to drop footprints at low zoom to keep each tile
  under its size budget (`--drop-densest-as-needed`), so world-view
  imagery presence comes from the pre-binned `density` layer rather
  than the raw footprints. The frontend gates footprints on
  `FOOTPRINT_MIN_ZOOM` (`frontend/src/browse/utils/constants.ts`) to
  hide this seam.
- ❌ No real pixels in these files. Anyone wanting actual imagery
  content at any zoom goes through TiTiler (MADR 0003), not this
  mosaic.
