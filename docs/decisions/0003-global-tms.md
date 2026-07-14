# Standalone Global TMS service with PMTiles + TiTiler handoff

## Context and Problem Statement

Not every OAM client can consume PMTiles. QGIS, older web maps, and
various analysis tools only speak plain XYZ/TMS raster tiles. We still
want them to answer two different user questions from a single TMS
endpoint:

1. **"Where is imagery?"** - at world/regional zooms the user is
   trying to locate coverage, not read pixels.
2. **"What does this specific area actually look like?"** - once
   zoomed in on a spot with coverage, the user wants real imagery as a
   base layer.

The tricky bit is that these two questions have very different costs
if you answer them the same way. At low zoom, one world-view tile can
overlap thousands of image footprints, and any renderer that pulls
from the source COGs has to reach into a lot of S3 objects to build
that single tile. The cost is in the data volume, not the tiler -
titiler-pgstac, a hand-rolled service, or anything else all hit the
same wall at world zoom.

## Considered Options

- **All zooms via titiler-pgstac**: simplest, but at low zoom each
  tile fans out to a huge set of COGs on S3; latency and cost climb
  with viewport image count. Fine at high zoom, unusable at world.
- **A hand-rolled Python raster service**: same S3 fan-out problem,
  plus another codebase to keep alive.
- **Split-zoom composite**: answer the two user questions with two
  different data sources joined at a zoom threshold. Serve a
  pre-baked vector density layer as raster at low zoom (cheap, no
  COG reads), and hand off to titiler-pgstac at high zoom (COG reads
  are bounded to the small number of images actually in view).

## Decision Outcome

Ship a small `global-tms` service (see `backend/global-tms/`) built
around a **split-zoom** design. The zoom axis is what makes this
performant: we deliberately serve different content on either side of
z13/z14, matching each zoom range to the cheapest source that answers
the user's question at that scale.

- **z0-13 - vector density → PNG.** Requests are rendered from the
  pre-baked density PMTiles (MADR 0002) into PNGs by
  [chiitiler](https://github.com/kanahiro/chiitiler). No source COGs
  are touched. The tile shows where imagery exists (grid cells shaded
  by image count), which is what the user actually needs at these
  zooms.
- **z14+ - real imagery via titiler-pgstac.** Requests are HTTP 302
  redirected to titiler-pgstac, which mosaics the underlying COGs on
  the fly. Because the tile is small geographically, only a handful of
  COGs overlap it, so per-tile cost stays bounded.

Around this core are:

- nginx in front for CORS, PNG caching, static PMTiles hosting, and
  the z-based routing itself,
- a Martin server exposing the same vector tiles for clients that
  prefer XYZ vector over raster.

Deployed via a Helm chart alongside eoAPI.

### The tradeoff

There is no zoom level at which this endpoint serves a "true global
raster mosaic" (real pixels stitched across the whole world). That's
by design: producing such a mosaic would require pre-baking or live
mosaicking every COG at every zoom, both of which we ruled out in
MADR 0002. Instead, at low zoom the user sees where imagery is, and at
high zoom they see the imagery itself. We lose the "pretty world map
made of drone pixels" view; we keep the two things users actually do
with the map (locate coverage, then inspect it) and pay very little
for either.

### Consequences

- ✅ One TMS URL covers both user questions, with a clean handoff
  between zoom levels.
- ✅ Cheap at low zoom: PNGs render from the static PMTiles and cache
  in nginx. Below z14 we don't touch the source COGs at all.
- ✅ Bounded cost at high zoom: each tile only intersects a small
  number of COGs, so titiler-pgstac fan-out stays manageable.
- ✅ Works everywhere: QGIS, Leaflet, OpenLayers and friends get a
  plain raster endpoint with no PMTiles support needed.
- ✅ Reuses off-the-shelf pieces (chiitiler, titiler-pgstac, nginx,
  Martin) instead of writing something bespoke.
- ❌ Not a seamless world-scale raster. At z13 the user sees a density
  grid; at z14 they see real pixels. That transition is visible.
- ❌ More services to run than a single tiler: chiitiler, nginx and
  Martin, plus a redirect rule that has to track titiler-pgstac's URL
  scheme.
- ❌ The z13/z14 boundary can show as a visible seam if styling drifts
  between the density grid and the imagery layer. Acceptable because
  this path is a fallback for non-PMTiles clients, not the primary
  web UI.
