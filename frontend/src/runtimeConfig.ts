// config.js supplies deployed values; Vite env vars support local development.

type RuntimeConfigKey =
  | "VITE_API_URL"
  | "VITE_PMTILES_URL"
  | "VITE_DENSITY_PMTILES_URL"
  | "VITE_STAC_TITILER_URL"
  | "VITE_STAC_URL"
  | "VITE_STAC_BROWSER_URL"
  | "VITE_UPLOADER_URL"
  | "VITE_PACKAGER_URL"
  | "VITE_BASEMAP_STYLE_URL"
  | "VITE_ANNOUNCEMENT_URL";

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Partial<Record<RuntimeConfigKey, string>>;
  }
}

export function getOptionalRuntimeConfig(key: RuntimeConfigKey): string | undefined {
  if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__?.[key]) {
    return window.__RUNTIME_CONFIG__[key];
  }
  const viteValue = import.meta.env[key];
  if (viteValue) return viteValue as string;
  return undefined;
}

export function getRuntimeConfig(key: RuntimeConfigKey, fallback: string): string {
  return getOptionalRuntimeConfig(key) ?? fallback;
}
