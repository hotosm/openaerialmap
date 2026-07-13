import type { DatePreset, Filters } from "./types";

export interface ViewState {
  center: [number, number];
  zoom: number;
}

export function readInitialView(fallback: ViewState): ViewState {
  const params = new URLSearchParams(window.location.search);
  const lat = parseFloat(params.get("lat") ?? "");
  const lon = parseFloat(params.get("lon") ?? "");
  const zoom = parseFloat(params.get("zoom") ?? "");
  if (!isNaN(lat) && !isNaN(lon) && !isNaN(zoom)) {
    return { center: [lon, lat], zoom };
  }
  return fallback;
}

const VALID_DATE_PRESETS: DatePreset[] = ["", "week", "month", "year"];

export function readInitialFilters(): Filters {
  const params = new URLSearchParams(window.location.search);
  const rawDate = params.get("date") || "";
  const date = (VALID_DATE_PRESETS as string[]).includes(rawDate)
    ? (rawDate as DatePreset)
    : "";
  return {
    date,
    platform: params.get("platform") || "",
    license: params.get("license") || "",
  };
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
    (["date", "platform", "license"] as const).forEach((key) => {
      if (f[key]) p.set(key, f[key]);
      else p.delete(key);
    });
  });
}
