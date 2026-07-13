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
      uuid: p.uuid || null,
      title: p.title || "Untitled Image",
      provider: p.provider || "Unknown",
      thumbnail: p.thumbnail || null,
      // Default to `visual` - the only asset key observed across live
      // OAM items; the backend enforces the same fallback.
      assetName: p.asset_name || "visual",
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
