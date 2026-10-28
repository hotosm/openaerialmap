// Matomo usage tracking, cookieless, loaded through the shared <hot-tracking>
// element. No-op unless VITE_MATOMO_URL and VITE_MATOMO_SITE_ID are both set.
import "@hotosm/ui/dist/components/tracking/tracking.js";
import { getOptionalRuntimeConfig } from "./runtimeConfig";

// window._paq is declared by @hotosm/ui.
type PaqEntry = (string | boolean)[];

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
  push(["setCustomUrl", reportableUrl()]);
  if (document.referrer) push(["setReferrerUrl", reportableUrl(document.referrer)]);
  // showConsent is a property; the attribute defaults to on.
  const el = document.createElement("hot-tracking");
  el.setAttribute("site-id", MATOMO_SITE_ID as string);
  el.setAttribute("domain", window.location.hostname);
  el.matomoURL = MATOMO_URL as string;
  el.showConsent = false;
  document.body.appendChild(el);
}

// Map position is dropped so Pages groups by filters and selection, not viewport.
function reportableUrl(href = window.location.href): string {
  const url = new URL(href);
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
