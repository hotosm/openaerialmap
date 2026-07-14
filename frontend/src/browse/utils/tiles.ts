import { COLLECTION_ID, STAC_TITILER_URL } from "./constants";
import type { RawTileProperties } from "./types";

// Build a TiTiler-PgSTAC tile URL template MapLibre can consume for a
// single STAC item. The item id is guaranteed to exist for every
// footprint (it comes straight from pgSTAC and drives the whole PMTiles
// pipeline); `asset_name` is emitted by the backend generator and falls
// back to `visual` because that's what every current OAM item uses.
//
// Note: this replaces the previous S3-path synthesis that assumed the
// COG lived at `oin-hotosm-temp.s3.us-east-1.amazonaws.com/...` and
// went through a legacy tiles.openaerialmap.org 302 redirect. The pgstac
// endpoint resolves the COG via the catalog, so bucket moves or asset
// renames only need to be reflected in the ingester.
export function getTmsUrl(p: RawTileProperties): string | null {
  if (!p._id) return null;
  const asset = p.asset_name || "visual";
  return (
    `${STAC_TITILER_URL}/collections/${COLLECTION_ID}/items/${p._id}` +
    `/tiles/WebMercatorQuad/{z}/{x}/{y}@1x?assets=${asset}&nodata=0`
  );
}

// Query param avoids browser cache conflict with sidebar <img> tags,
// which fetch the same thumbnail without CORS.
export function thumbUrl(url: string | null | undefined): string | null {
  return url ? `${url}?x-map=1` : null;
}

// Fetch the STAC item's bounds (WGS84) from TiTiler-PgSTAC. Used to
// bound the MapLibre raster source so we only request tiles where the
// image actually has data - prevents 404 floods when panning outside
// the image extent. Cached per item id in the caller's map.
//
// Cache entry shapes:
//   number[]          - resolved bounds, ready to use
//   "fetching"        - request in flight, dedupe
//   { failedAt: ms }  - last attempt failed, retry after COG_FAILURE_TTL
//
// See ItemBoundsCache below for the LRU wrapper.
export type ItemBoundsEntry = number[] | "fetching" | { failedAt: number };

export const COG_BOUNDS_CACHE_MAX = 500;
export const COG_BOUNDS_FAILURE_TTL_MS = 30_000;

// Small LRU with size cap. `insertion order = LRU order` in JS Maps,
// so we delete + re-set on read to promote entries. Cheap enough for
// the ~500-item budget; avoids pulling in an LRU dep.
export class ItemBoundsCache {
  private map = new Map<string, ItemBoundsEntry>();

  get(id: string): ItemBoundsEntry | undefined {
    const entry = this.map.get(id);
    if (entry === undefined) return undefined;
    // Refresh recency
    this.map.delete(id);
    this.map.set(id, entry);
    return entry;
  }

  set(id: string, entry: ItemBoundsEntry): void {
    if (this.map.has(id)) this.map.delete(id);
    this.map.set(id, entry);
    while (this.map.size > COG_BOUNDS_CACHE_MAX) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  delete(id: string): void {
    this.map.delete(id);
  }

  // A failed lookup is considered "cache miss" once its TTL expires so
  // a transient TiTiler blip doesn't permanently blank an item's TMS
  // overlay. Callers should treat this as "not cached, please fetch".
  isFresh(entry: ItemBoundsEntry): boolean {
    if (Array.isArray(entry)) return true;
    if (entry === "fetching") return true;
    return Date.now() - entry.failedAt < COG_BOUNDS_FAILURE_TTL_MS;
  }
}

export function fetchItemBounds(
  cache: ItemBoundsCache,
  itemId: string,
  assetName: string | undefined,
  onLoad: () => void,
  isUnmounted: () => boolean,
): void {
  const existing = cache.get(itemId);
  if (existing !== undefined && cache.isFresh(existing)) return;
  cache.set(itemId, "fetching");
  const asset = assetName || "visual";
  const url = `${STAC_TITILER_URL}/collections/${COLLECTION_ID}/items/${itemId}/bounds?assets=${asset}`;
  fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (isUnmounted()) return;
      if (Array.isArray(data?.bounds) && data.bounds.length === 4) {
        cache.set(itemId, data.bounds as number[]);
        onLoad();
      } else {
        cache.set(itemId, { failedAt: Date.now() });
      }
    })
    .catch(() => {
      if (isUnmounted()) return;
      cache.set(itemId, { failedAt: Date.now() });
    });
}
