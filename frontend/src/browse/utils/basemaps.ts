import type { LayerSpecification, SourceSpecification } from "maplibre-gl";

import { BASEMAP_STYLE_URL } from "./constants";

export type Basemap = "light" | "hot";

// Glyphs and sprites are set once on the initial (empty) style so the
// density-count symbol layer can render before any basemap resolves.
// A style-based basemap that declares its own overrides them on apply.
export const BASEMAP_GLYPHS = "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf";
export const BASEMAP_SPRITE = "https://tiles.openfreemap.org/sprites/ofm_f384/ofm";

// OpenFreeMap requires attribution; the style JSON it serves carries
// none, so stamp it onto every source we lift out of it. Also shown
// unconditionally by the main map, because the mini-map renders this
// basemap whatever the main map is set to (see Map.tsx).
export const OPENFREEMAP_ATTRIBUTION =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> ' +
  '<a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">&copy; OpenMapTiles</a> ' +
  'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

const HOT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors, ' +
  "tiles by HOT, hosted by OpenStreetMap France";

// The sources and layers of one basemap, ready to be added beneath the
// OAM layers. Kept layer-scoped rather than a whole-style swap: setStyle
// would drop the footprint, density and per-image TMS layers that the
// other effects in Map.tsx add and track imperatively.
export interface BasemapSpec {
  sources: Record<string, SourceSpecification>;
  layers: LayerSpecification[];
  glyphs?: string;
  sprite?: string;
}

interface RawStyle {
  glyphs?: string;
  sprite?: string;
  sources?: Record<string, SourceSpecification>;
  layers?: LayerSpecification[];
}

const styleCache = new Map<string, Promise<BasemapSpec>>();

async function fetchStyleSpec(url: string, attribution: string): Promise<BasemapSpec> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`basemap style ${url} returned ${res.status}`);
  const style = (await res.json()) as RawStyle;
  const sources: Record<string, SourceSpecification> = {};
  for (const [id, source] of Object.entries(style.sources ?? {})) {
    // Identical strings are de-duplicated by the attribution control.
    // image/video sources have no attribution field to stamp.
    sources[id] =
      source.type === "image" || source.type === "video" ? source : { ...source, attribution };
  }
  return { sources, layers: style.layers ?? [], glyphs: style.glyphs, sprite: style.sprite };
}

function loadStyleSpec(url: string, attribution: string): Promise<BasemapSpec> {
  const cached = styleCache.get(url);
  if (cached) return cached;
  const pending = fetchStyleSpec(url, attribution).catch((err: unknown) => {
    // Drop the rejection so a later switch back can retry.
    styleCache.delete(url);
    throw err;
  });
  styleCache.set(url, pending);
  return pending;
}

function rasterSpec(tiles: string[], attribution: string): BasemapSpec {
  return {
    sources: {
      "basemap-raster": { type: "raster", tiles, tileSize: 256, attribution },
    },
    layers: [{ id: "basemap-raster", type: "raster", source: "basemap-raster" }],
  };
}

export function resolveBasemap(basemap: Basemap): Promise<BasemapSpec> {
  if (basemap === "hot") {
    return Promise.resolve(
      rasterSpec(["https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png"], HOT_ATTRIBUTION),
    );
  }
  return loadStyleSpec(BASEMAP_STYLE_URL, OPENFREEMAP_ATTRIBUTION);
}
