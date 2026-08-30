import { getRuntimeConfig } from "../../runtimeConfig";

export const API_URL = getRuntimeConfig("VITE_API_URL", "https://api.imagery.hotosm.org");

// global-data.pmtiles has footprints; global-coverage.pmtiles is density-only.
export const PMTILES_URL = getRuntimeConfig(
  "VITE_PMTILES_URL",
  "https://s3.amazonaws.com/oin-hotosm-temp/global-data.pmtiles",
);

// The pmtiles:// scheme is handled by the protocol registered in main.tsx.
export const PMTILES_SOURCE_URL = `pmtiles://${PMTILES_URL}`;

export const PMTILES_SOURCE_LAYER = "globalcoverage";

// Pre-binned, filter-aware density cells used below FOOTPRINT_MIN_ZOOM.
export const DENSITY_PMTILES_URL = getRuntimeConfig(
  "VITE_DENSITY_PMTILES_URL",
  "https://s3.amazonaws.com/oin-hotosm-temp/global-coverage.pmtiles",
);

export const DENSITY_SOURCE_URL = `pmtiles://${DENSITY_PMTILES_URL}`;

export const DENSITY_SOURCE_LAYER = "density";

// TiTiler endpoint for per-item bounds, previews, and raster tiles.
export const STAC_TITILER_URL = getRuntimeConfig(
  "VITE_STAC_TITILER_URL",
  "https://api.imagery.hotosm.org/raster",
);

// STAC root used to build browser deep links.
export const STAC_URL = getRuntimeConfig("VITE_STAC_URL", "https://api.imagery.hotosm.org/stac");

export const UPLOADER_URL = getRuntimeConfig(
  "VITE_UPLOADER_URL",
  "https://upload.imagery.hotosm.org",
);

// eoAPI serves both viewers, so they sit under the API - unless a deployment
// runs no copy of its own and borrows another's, as staging borrows prod's.
export const STAC_BROWSER_URL = getRuntimeConfig("VITE_STAC_BROWSER_URL", `${API_URL}/browser`);
export const STAC_MAP_URL = getRuntimeConfig("VITE_STAC_MAP_URL", `${API_URL}/map`);

// A borrowed viewer opens the catalog it was built against, so steer it at ours.
export const STAC_BROWSER_CATALOG_URL = STAC_BROWSER_URL.startsWith(new URL(STAC_URL).origin)
  ? `${STAC_BROWSER_URL}/`
  : `${STAC_BROWSER_URL}/external/${STAC_URL.replace(/^https?:\/\//, "")}`;

export const STAC_MAP_CATALOG_URL = `${STAC_MAP_URL}/?href=${encodeURIComponent(STAC_URL)}`;

// On-demand per-item PMTiles and MBTiles service.
export const PACKAGER_URL = getRuntimeConfig(
  "VITE_PACKAGER_URL",
  "https://packager.imagery.hotosm.org",
);

// Banner content, edited via Windmill. Unreachable or empty hides the banner.
export const ANNOUNCEMENT_URL = getRuntimeConfig(
  "VITE_ANNOUNCEMENT_URL",
  "https://d33erh71igmru9.cloudfront.net/oam.json",
);

// pgSTAC collection used in tile URLs.
export const COLLECTION_ID = "openaerialmap";

// MapLibre style JSON for the default vector basemap. OpenFreeMap's
// public instance needs no API key and sets no request limits; point
// this at a self-hosted style (OpenFreeMap or Protomaps) to drop the
// third-party dependency.
export const BASEMAP_STYLE_URL = getRuntimeConfig(
  "VITE_BASEMAP_STYLE_URL",
  "https://tiles.openfreemap.org/styles/positron",
);

// Low-zoom footprint tiles are thinned, so use density tiles below this zoom.
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
