import type { Feature, Polygon, MultiPolygon } from "geojson";

// Shape produced by transformFeature() - sidebar / card / TMS lookup
// all read from these keys.
export interface ImageProperties {
  id: string;
  uuid: string | null;
  title: string;
  provider: string;
  thumbnail: string | null;
  // Asset key TiTiler-PgSTAC should serve tiles from (defaults to
  // 'visual'). Threaded from the PMTiles feature so newer ingester
  // conventions can override without a frontend deploy.
  assetName: string;
  date: string;
  platform: string;
  sensor: string;
  gsd: string;
  file_size: string;
  license: string;
  acquisition_end: string | null;
}

export type ImageFeature = Feature<Polygon | MultiPolygon, ImageProperties>;

// Raw properties as they arrive from the PMTiles vector tile. Written
// by backend/global-mosaic/scripts/gen_coverage_vector.py; keep in sync.
export interface RawTileProperties {
  _id: string;
  uuid?: string;
  title?: string;
  provider?: string;
  thumbnail?: string;
  tms?: string;
  asset_name?: string;
  acquisition_end?: string;
  platform?: string;
  sensor?: string;
  gsd?: number;
  file_size?: number;
  license?: string;
}

export type DatePreset = "" | "week" | "month" | "year";

export interface Filters {
  // Date is a preset picker rather than a free-form range so the
  // density grid can look up a matching pre-baked count bucket at
  // world zoom (see backend/global-mosaic/scripts/gen_coverage_vector.py
  // and utils/filters.ts::densityCountExpr).
  date: DatePreset;
  platform: string;
  license: string;
}

export const EMPTY_FILTERS: Filters = {
  date: "",
  platform: "",
  license: "",
};

// True when any filter field is set. Used to swap the density layer
// paint/layout to a filtered-count expression (see Map.tsx section 4).
export function hasActiveFilters(f: Filters): boolean {
  return !!(f.date || f.platform || f.license);
}
