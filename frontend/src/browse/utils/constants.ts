// Runtime configuration. All map endpoints come from Vite env vars so
// the same build can point at prod, staging, or a local docker stack.
// See frontend/Dockerfile for the corresponding ARG/ENV entries.

// global-data.pmtiles carries the per-image footprint layer
// (`globalcoverage`) with rich metadata. Rendered at zoom
// >= FOOTPRINT_MIN_ZOOM. Do not point this at global-coverage.pmtiles
// - that file is density-only and drives the standalone TMS.
export const PMTILES_URL =
  import.meta.env.VITE_PMTILES_URL ??
  "https://s3.amazonaws.com/oin-hotosm-temp/global-data.pmtiles";

// MapLibre needs the pmtiles:// scheme so the Protocol handler
// (registered in main.tsx) can intercept the request.
export const PMTILES_SOURCE_URL = `pmtiles://${PMTILES_URL}`;

// Layer name in the PMTiles archive. Matches the `-L globalcoverage:...`
// argument in backend/global-mosaic/scripts/gen_coverage_vector.py.
export const PMTILES_SOURCE_LAYER = "globalcoverage";

// global-coverage.pmtiles carries the pre-binned `density` layer:
// count-labelled grid cells at z0-13 with an aggregated image bbox per
// cell. Rendered below FOOTPRINT_MIN_ZOOM to give users an accurate
// "where is imagery" view - counts are computed from all ~21k images
// pre-tippecanoe and so are authoritative (unlike a client-side
// re-cluster of the drop-densest'd footprint tiles).
//
// Each cell also carries per-filter breakdown counts (platform,
// license, year, moving date windows) so filtered views at world zoom
// can display accurate counts without any client-side re-aggregation.
// See gen_coverage_vector.py and utils/filters.ts::densityCountExpr.
//
// Shared with backend/global-tms which reads the same file over its
// nginx pipeline. Splitting the two archives means the browser doesn't
// pull the ~60 MB footprint file just to render grid squares at world
// view, and lets the two producers ship independently.
export const DENSITY_PMTILES_URL =
  import.meta.env.VITE_DENSITY_PMTILES_URL ??
  "https://s3.amazonaws.com/oin-hotosm-temp/global-coverage.pmtiles";

export const DENSITY_SOURCE_URL = `pmtiles://${DENSITY_PMTILES_URL}`;

// Matches the `-L density:...` argument in the backend generator.
export const DENSITY_SOURCE_LAYER = "density";

// TiTiler-PgSTAC endpoint that fronts the STAC catalog. All per-image
// tile URLs and COG bounds lookups go through `/collections/{c}/items/
// {id}/...` - no S3 paths or bucket names hardcoded in the client, and
// no CORS proxy needed (the eoapi ingress serves Access-Control-Allow-
// Origin: *). Explicit list of the endpoints we use:
//
//   GET /collections/{c}/items/{id}/tiles/WebMercatorQuad/{z}/{x}/{y}@1x
//     - full-res raster tiles (getTmsUrl)
//   GET /collections/{c}/items/{id}/bounds
//     - WGS84 bounds, drives MapLibre raster source bounds so we don't
//       request tiles outside the image extent (fetchItemBounds)
export const STAC_TITILER_URL =
  import.meta.env.VITE_STAC_TITILER_URL ??
  "https://api.imagery.hotosm.org/raster";

// STAC catalog root. Used to build deep-links into STAC Browser, which
// consumes /stac item URLs via its #/external/ fragment.
export const STAC_URL =
  import.meta.env.VITE_STAC_URL ?? "https://api.imagery.hotosm.org/stac";

// STAC Browser root. Renders a nicer per-item metadata page than the
// raw JSON at STAC_URL. Item deep-links are built as
// `${STAC_BROWSER_URL}/#/external/<STAC_URL without protocol>/...`.
export const STAC_BROWSER_URL =
  import.meta.env.VITE_STAC_BROWSER_URL ??
  "https://api.imagery.hotosm.org/browser";

// Tilepack packager service. Generates on-demand PMTiles / MBTiles
// archives for a single STAC item. The POST endpoint is idempotent:
// returns 200 + URL if the archive already exists, 202 while the
// worker is still generating. See backend/tilepack-api.
export const PACKAGER_URL =
  import.meta.env.VITE_PACKAGER_URL ?? "https://packager.imagery.hotosm.org";

// Collection id in pgSTAC. Baked into the tile URLs above. Kept as a
// const so a future re-org can move it in one place.
export const COLLECTION_ID = "openaerialmap";

// Optional; if unset the satellite basemap is hidden from the switcher.
export const MAPBOX_TOKEN: string | undefined = import.meta.env
  .VITE_MAPBOX_TOKEN;

// Zoom / area thresholds for footprint / preview / TMS layer handoff.

// The minimum zoom at which we render individual image footprints and
// populate the sidebar list. Below this zoom the map shows the density
// grid instead - filter-aware via pre-baked bucket counts, see
// gen_coverage_vector.py.
//
// This threshold exists because the `globalcoverage` layer in
// global-data.pmtiles is NOT a lossless copy of the STAC catalogue at
// every zoom. Tippecanoe applies `--drop-densest-as-needed` so each
// vector tile stays under its size budget (default ~500 KB), which
// means low-zoom tiles carry only a subset of the ~21k footprints. At
// z0 all footprints have to fit into a single tile; even at z2-z4 the
// per-tile budget forces significant drops. Above ~z8 tiles are small
// enough geographically that drop-densest rarely fires and the tile
// data is effectively complete for the viewport.
//
// Concretely: reading `map.querySourceFeatures(...)` below this zoom
// returns a truncated, zoom-dependent subset that is unstable across
// zoom levels (pan/zoom will change the "count in view"). We gate the
// sidebar on this so users see a "zoom in to see images" prompt
// instead of a misleading count. Grid clustering at low zoom has the
// same limitation - the map's density grid squares are what users
// should trust at world view for "where is imagery available".
export const FOOTPRINT_MIN_ZOOM = 8;

export const LARGE_IMAGE_THRESHOLD_SQ_KM = 50;
export const TMS_LARGE_MIN_ZOOM = 12;
export const TMS_ALL_MIN_ZOOM = 16;
export const TMS_SELECTED_MIN_ZOOM = 10;
export const MAX_TMS = 8;
export const MAX_PREVIEWS = 25;
export const SIDEBAR_PAGE_SIZE = 10;

export const DEFAULT_CENTER: [number, number] = [0, 20];
export const DEFAULT_ZOOM = 2;
