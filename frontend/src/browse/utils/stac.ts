import type { MultiPolygon, Polygon } from "geojson";

import { COLLECTION_ID, MY_IMAGERY_PAGE_SIZE, STAC_SEARCH_TIMEOUT_MS, STAC_URL } from "./constants";
import type { RawFeature, RawTileProperties } from "./types";

// "My imagery" reads the STAC API rather than the coverage PMTiles: the
// search is current, while the PMTiles are rebuilt on a schedule (ADR 0011).

interface StacAsset {
  href?: string;
  "file:size"?: number;
  size?: number;
}

interface StacItem {
  id: string;
  collection?: string;
  geometry: Polygon | MultiPolygon | null;
  properties?: Record<string, unknown>;
  assets?: Record<string, StacAsset>;
}

interface StacLink {
  rel: string;
  href: string;
  method?: string;
  body?: Record<string, unknown>;
  merge?: boolean;
}

// A request for the next page, as the API's `next` link describes it.
export interface PageRequest {
  href: string;
  method: string;
  body?: Record<string, unknown>;
}

export interface SearchPage {
  features: RawFeature[];
  next: PageRequest | null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}

// Port of _build_render_query in
// backend/global-mosaic/scripts/gen_coverage_vector.py.
function renderQuery(renders: unknown): string | undefined {
  const browse = (renders as { browse?: Record<string, unknown> } | null | undefined)?.browse;
  if (!browse) return undefined;
  const parts: string[] = [];
  for (const band of (browse.bidx as unknown[] | undefined) ?? []) {
    parts.push(`bidx=${Math.trunc(Number(band))}`);
  }
  for (const pair of (browse.rescale as unknown[][] | undefined) ?? []) {
    parts.push(`rescale=${encodeURIComponent(`${pair[0]},${pair[1]}`)}`);
  }
  if (browse.colormap_name) {
    parts.push(`colormap_name=${encodeURIComponent(String(browse.colormap_name))}`);
  }
  if (browse.colormap) {
    parts.push(`colormap=${encodeURIComponent(JSON.stringify(browse.colormap))}`);
  }
  if (browse.nodata != null) {
    parts.push(`nodata=${encodeURIComponent(String(browse.nodata))}`);
  }
  return parts.join("&") || undefined;
}

// Port of _extract_feature_properties in
// backend/global-mosaic/scripts/gen_coverage_vector.py, so an Item from the
// search renders exactly like its footprint from the PMTiles. Keep in sync.
export function itemToFeature(item: StacItem): RawFeature | null {
  if (!item.geometry) return null;
  const props = item.properties ?? {};
  const assets = item.assets ?? {};

  const providers = (props.providers as { name?: string }[] | undefined) ?? [];
  const instruments = (props.instruments as string[] | undefined) ?? [];
  const assetName = assets.visual ? "visual" : assets.data ? "data" : undefined;
  const visual = assetName ? assets[assetName] : undefined;

  const raw: RawTileProperties = {
    _id: item.id,
    collection: item.collection,
    title: asString(props.title),
    provider: asString(providers[0]?.name),
    platform: asString(props["oam:platform_type"]),
    sensor: asString(instruments[0]) ?? asString(props.sensor),
    gsd: asNumber(props.gsd),
    license: asString(props.license),
    acquisition_end:
      asString(props.datetime) ?? asString(props.end_datetime) ?? asString(props.start_datetime),
    thumbnail: assets.thumbnail?.href,
    uuid: visual?.href,
    tms: (assets.tms ?? assets.wmts)?.href,
    asset_name: assetName,
    render_params: renderQuery(props.renders),
    file_size: asNumber(visual?.["file:size"]) ?? asNumber(visual?.size),
    owner_id: asString(props["oam:owner_id"]),
  };
  // Like the PMTiles, leave missing values out rather than carrying undefined.
  const properties = Object.fromEntries(
    Object.entries(raw).filter(([, v]) => v !== undefined),
  ) as RawTileProperties;
  return { type: "Feature", geometry: item.geometry, properties };
}

export async function fetchPage(request: PageRequest, signal?: AbortSignal): Promise<SearchPage> {
  const timeout = AbortSignal.timeout(STAC_SEARCH_TIMEOUT_MS);
  const init: RequestInit = {
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  };
  if (request.method === "POST") {
    init.method = "POST";
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(request.body ?? {});
  }
  const res = await fetch(request.href, init);
  if (!res.ok) {
    // stac-fastapi explains a refused search in `description`.
    const err = (await res.json().catch(() => ({}))) as { description?: string };
    throw new Error(err.description || `STAC search failed (${res.status})`);
  }
  const data = (await res.json().catch(() => ({}))) as {
    features?: StacItem[];
    links?: StacLink[];
  };

  const features = (data.features ?? [])
    .map(itemToFeature)
    .filter((f): f is RawFeature => f !== null);
  const link = data.links?.find((l) => l.rel === "next");
  const next = link
    ? {
        href: link.href,
        method: (link.method ?? "GET").toUpperCase(),
        // A `merge` link carries only what changes, such as the page token.
        body: link.merge ? { ...request.body, ...link.body } : link.body,
      }
    : null;
  return { features, next };
}

// The first page of imagery owned by any of `ownerIds`, newest capture first.
export function searchByOwners(ownerIds: string[], signal?: AbortSignal): Promise<SearchPage> {
  return fetchPage(
    {
      href: `${STAC_URL}/search`,
      method: "POST",
      body: {
        // Owners only exist on uploaded imagery, which lives in one
        // collection. Naming it keeps pgstac on that partition.
        collections: [COLLECTION_ID],
        "filter-lang": "cql2-json",
        filter: { op: "in", args: [{ property: "oam:owner_id" }, ownerIds] },
        sortby: [{ field: "properties.datetime", direction: "desc" }],
        limit: MY_IMAGERY_PAGE_SIZE,
      },
    },
    signal,
  );
}
