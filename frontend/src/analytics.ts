// Matomo usage tracking, cookieless. No-op unless VITE_MATOMO_URL and
// VITE_MATOMO_SITE_ID are both set.
import { getOptionalRuntimeConfig } from "./runtimeConfig";

type PaqEntry = (string | boolean)[];

declare global {
  interface Window {
    _paq?: PaqEntry[];
  }
}

// Only an http(s) URL may become a <script src>.
function readMatomoUrl(): string | undefined {
  const raw = getOptionalRuntimeConfig("VITE_MATOMO_URL") ?? "";
  return /^https?:\/\//.test(raw) ? raw.replace(/\/+$/, "") : undefined;
}

const MATOMO_URL = readMatomoUrl();
const MATOMO_SITE_ID = getOptionalRuntimeConfig("VITE_MATOMO_SITE_ID");

const enabled = Boolean(MATOMO_URL && MATOMO_SITE_ID);

function push(entry: PaqEntry): void {
  if (!enabled) return;
  (window._paq = window._paq || []).push(entry);
}

export function initAnalytics(): void {
  if (!enabled) return;
  push(["disableCookies"]);
  push(["setDoNotTrack", true]);
  push(["alwaysUseSendBeacon"]);
  push(["setTrackerUrl", `${MATOMO_URL}/matomo.php`]);
  push(["setSiteId", MATOMO_SITE_ID as string]);
  push(["setCustomUrl", reportableUrl()]);
  push(["trackPageView"]);
  const script = document.createElement("script");
  script.async = true;
  script.src = `${MATOMO_URL}/matomo.js`;
  document.head.appendChild(script);
}

// Map position is dropped so Pages groups by filters and selection, not viewport.
function reportableUrl(): string {
  const url = new URL(window.location.href);
  ["lat", "lon", "zoom"].forEach((k) => url.searchParams.delete(k));
  url.hash = "";
  return url.toString();
}

// Browse keeps its state in the query string; call after a change worth a page view.
export function trackVirtualPageView(): void {
  if (!enabled) return;
  push(["setCustomUrl", reportableUrl()]);
  push(["setDocumentTitle", document.title]);
  push(["trackPageView"]);
}

export function trackEvent(
  category: "imagery" | "browse" | "navigation",
  action: string,
  name?: string,
): void {
  push(name ? ["trackEvent", category, action, name] : ["trackEvent", category, action]);
}
