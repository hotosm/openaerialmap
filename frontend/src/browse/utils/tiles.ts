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
export function fetchItemBounds(
  cache: Map<string, number[] | "fetching">,
  itemId: string,
  assetName: string | undefined,
  onLoad: () => void,
): void {
  if (cache.has(itemId)) return;
  cache.set(itemId, "fetching");
  const asset = assetName || "visual";
  const url = `${STAC_TITILER_URL}/collections/${COLLECTION_ID}/items/${itemId}/bounds?assets=${asset}`;
  fetch(url)
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (Array.isArray(data?.bounds) && data.bounds.length === 4) {
        cache.set(itemId, data.bounds as number[]);
        onLoad();
      } else {
        cache.delete(itemId);
      }
    })
    .catch(() => cache.delete(itemId));
}
