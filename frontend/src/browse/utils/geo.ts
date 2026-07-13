import bbox from "@turf/bbox";
import { polygon } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";
import type { GeoJSONFeature, Map as MapLibreMap } from "maplibre-gl";
import { PMTILES_SOURCE_LAYER } from "./constants";

export type BBox = [number, number, number, number];

// Approximate area in sq km from a WGS84 bbox. Adequate for the
// "is this footprint large?" heuristic - no need for a full spherical
// calculation.
export function bboxAreaKm2(b: BBox): number {
  const avgLat = (b[1] + b[3]) / 2;
  const widthKm = (b[2] - b[0]) * 111.32 * Math.cos((avgLat * Math.PI) / 180);
  const heightKm = (b[3] - b[1]) * 111.32;
  return Math.abs(widthKm * heightKm);
}

export function lon2tile(lon: number, zoom: number): number {
  return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
}

export function lat2tile(lat: number, zoom: number): number {
  return Math.floor(
    ((1 -
      Math.log(
        Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180),
      ) /
        Math.PI) /
      2) *
      Math.pow(2, zoom),
  );
}

export function tile2long(x: number, z: number): number {
  return (x / Math.pow(2, z)) * 360 - 180;
}

export function tile2lat(y: number, z: number): number {
  const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

export function tileToGeoJSON(
  x: number,
  y: number,
  z: number,
): Feature<Polygon, { x: number; y: number; z: number }> {
  const w = tile2long(x, z);
  const e = tile2long(x + 1, z);
  const n = tile2lat(y, z);
  const s = tile2lat(y + 1, z);
  return polygon(
    [
      [
        [w, n],
        [e, n],
        [e, s],
        [w, s],
        [w, n],
      ],
    ],
    { x, y, z },
  );
}

// Reconstruct the full bbox of a feature from every tile fragment that
// carries its id. Tippecanoe clips features at tile boundaries, so a
// single rendered fragment often reports a smaller bbox than the real
// image extent - critical for fitBounds and image overlay positioning.
export function getFullBbox(
  map: MapLibreMap,
  featureId: string,
): { bbox: BBox; feature: GeoJSONFeature } | null {
  const frags = map.querySourceFeatures("oam-tiles", {
    sourceLayer: PMTILES_SOURCE_LAYER,
  });
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let firstFrag: GeoJSONFeature | null = null;
  for (const f of frags) {
    if (f.properties?._id !== featureId) continue;
    if (!firstFrag) firstFrag = f;
    try {
      const b = bbox(f) as BBox;
      if (b[0] < minX) minX = b[0];
      if (b[1] < minY) minY = b[1];
      if (b[2] > maxX) maxX = b[2];
      if (b[3] > maxY) maxY = b[3];
    } catch {
      // Some fragments have malformed geometry - skip.
    }
  }
  if (minX === Infinity || !firstFrag) return null;
  return { bbox: [minX, minY, maxX, maxY], feature: firstFrag };
}
