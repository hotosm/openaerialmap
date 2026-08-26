import { getOptionalRuntimeConfig, getRuntimeConfig } from "../../runtimeConfig";

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

// STAC Browser root for item metadata pages.
export const STAC_BROWSER_URL = getRuntimeConfig(
  "VITE_STAC_BROWSER_URL",
  "https://api.imagery.hotosm.org/browser",
);

// On-demand per-item PMTiles and MBTiles service.
export const PACKAGER_URL = getRuntimeConfig(
  "VITE_PACKAGER_URL",
  "https://packager.imagery.hotosm.org",
);

// pgSTAC collection used in tile URLs.
export const COLLECTION_ID = "openaerialmap";

// The satellite basemap is hidden when this is unset.
export const MAPBOX_TOKEN: string | undefined = getOptionalRuntimeConfig("VITE_MAPBOX_TOKEN");

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
