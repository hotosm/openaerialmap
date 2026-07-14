import type { DatePreset, Filters, ResolutionPreset } from "./types";

export interface ViewState {
  center: [number, number];
  zoom: number;
}

// Any of {lat, lon, zoom} outside their real-world range is treated as
// a bad param (typo, tampered URL, share-link corruption) rather than
// silently clamped - we prefer the caller's defaults over a partially
// valid partial-view. MapLibre also rejects out-of-range setCenter, so
// pushing bad values through would surface as a runtime error later.
export function readInitialView(fallback: ViewState): ViewState {
  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get("lat") ?? "");
  const lon = parseFloat(params.get("lon") ?? "");
  const zoom = parseFloat(params.get("zoom") ?? "");
  if (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    Number.isFinite(zoom) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    zoom >= 0 &&
    zoom <= 22
  ) {
    return { center: [lon, lat], zoom };
  }
  return fallback;
}

const VALID_DATE_PRESETS: DatePreset[] = ["", "week", "month", "year"];
const VALID_RESOLUTION_PRESETS: ResolutionPreset[] = [
  "",
  "lt05",
  "05to2",
  "2to10",
  "gt10",
];
const VALID_PLATFORMS = ["", "satellite", "uav", "aircraft"];
// License filter values are matched substring-wise against feature
// licenses (see buildFilter). Confine them to the exact strings the UI
// can emit so a rogue URL can't inject an arbitrary substring into the
// filter expression.
const VALID_LICENSES = ["", "CC-BY 4.0", "CC BY-NC 4.0", "CC BY-SA 4.0"];

export function readInitialFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  const rawDate = params.get("date") || "";
  const date = (VALID_DATE_PRESETS as string[]).includes(rawDate)
    ? (rawDate as DatePreset)
    : "";
  const rawRes = params.get("resolution") || "";
  const resolution = (VALID_RESOLUTION_PRESETS as string[]).includes(rawRes)
    ? (rawRes as ResolutionPreset)
    : "";
  const rawPlatform = params.get("platform") || "";
  const platform = VALID_PLATFORMS.includes(rawPlatform) ? rawPlatform : "";
  const rawLicense = params.get("license") || "";
  const license = VALID_LICENSES.includes(rawLicense) ? rawLicense : "";
  return { date, platform, resolution, license };
}

export function readSelectedId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("selected_id");
}

function replaceParams(mutator: (p: URLSearchParams) => void): void {
  const params = new URLSearchParams(window.location.search);
  mutator(params);
  const qs = params.toString();
  const url = qs
    ? `${window.location.pathname}?${qs}`
    : window.location.pathname;
  window.history.replaceState({}, "", url);
}

export function writeView(center: [number, number], zoom: number): void {
  replaceParams((p) => {
    p.set("lat", center[1].toFixed(4));
    p.set("lon", center[0].toFixed(4));
    p.set("zoom", zoom.toFixed(1));
  });
}

export function writeSelectedId(id: string | null): void {
  replaceParams((p) => {
    if (id) p.set("selected_id", id);
    else p.delete("selected_id");
  });
}

export function writeFilters(f: Filters): void {
  replaceParams((p) => {
    (["date", "platform", "resolution", "license"] as const).forEach((key) => {
      if (f[key]) p.set(key, f[key]);
      else p.delete(key);
    });
  });
}
