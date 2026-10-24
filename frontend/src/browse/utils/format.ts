import { COLLECTION_ID } from "./constants";
import type { ImageFeature, RawTileProperties } from "./types";
import type { GeoJSONFeature } from "maplibre-gl";

export function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return "Unknown";
  const gb = 1073741824;
  const mb = 1048576;
  if (bytes >= gb) return `${(bytes / gb).toFixed(2)} GB`;
  return `${Math.round(bytes / mb)} MB`;
}

export function toSentenceCase(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Sensor names are a mix of prose ("dji phantom 4") and instrument
// designators ("WV02", "GE01", "LG04"). Sentence-casing the latter turns
// WorldView-2 into "Wv02", so leave any token that carries a digit or is
// already all-caps alone and only tidy the prose.
export function formatSensor(sensor: string | null | undefined): string {
  if (!sensor) return "Unknown Sensor";
  const isDesignator = (t: string) => /\d/.test(t) || (t.length <= 5 && t === t.toUpperCase());
  return sensor
    .split(/\s+/)
    .map((t, i) => (isDesignator(t) ? t : i === 0 ? toSentenceCase(t) : t.toLowerCase()))
    .join(" ");
}

export function formatPlatform(plat: string | null | undefined): string {
  if (!plat) return "Unknown";
  const lower = plat.toLowerCase();
  if (lower === "uav" || lower === "drone") return "Drone";
  return toSentenceCase(plat);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString || dateString === "Unknown Date") return "Unknown Date";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Map from the raw PMTiles vector feature to the shape components expect.
// Called on both viewport (`querySourceFeatures`) and click hits, so keep
// it cheap.
export function transformFeature(mvtFeature: GeoJSONFeature): ImageFeature {
  const p = mvtFeature.properties as unknown as RawTileProperties;
  return {
    type: "Feature",
    geometry: mvtFeature.geometry as ImageFeature["geometry"],
    properties: {
      id: p._id,
      collection: p.collection || COLLECTION_ID,
      uuid: p.uuid || null,
      title: p.title || "Untitled Image",
      provider: p.provider || "Unknown",
      thumbnail: p.thumbnail || null,
      // Match the backend's `visual` fallback for legacy footprints.
      assetName: p.asset_name || "visual",
      renderParams: p.render_params || null,
      date: p.acquisition_end || "Unknown Date",
      platform: (p.platform || "unknown").toLowerCase(),
      sensor: p.sensor || "Unknown Sensor",
      gsd: p.gsd != null ? `${Number(p.gsd).toFixed(2)} m` : "N/A",
      file_size: formatFileSize(p.file_size),
      license: p.license || "Unknown License",
      acquisition_end: p.acquisition_end || null,
    },
  };
}
