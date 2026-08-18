# Using OAM Imagery

Three ways to pull OAM imagery into another application, depending on
what you need.

All endpoints below send `Access-Control-Allow-Origin: *`, including on
redirects, so they work from browser JavaScript.

> The old `tiles.openaerialmap.org` service is deprecated. It does not
> send CORS headers on its redirect, so it fails in clients that fetch
> tiles with `fetch()` (Rapid, for example). Use the URLs below instead.

## Global mosaic TMS

A plain XYZ raster endpoint for clients that can't read PMTiles, such as
QGIS, JOSM and iD:

```text
https://global.imagery.hotosm.org/{z}/{x}/{y}.png
```

- z0-13 renders the coverage grid, squares labelled with the number of
  images in each cell.
- z14+ redirects to TiTiler and serves the real imagery.

## Global coverage PMTiles

For clients that support PMTiles, read the coverage archive directly.
This avoids the raster round trip and lets you restyle the footprints:

```text
https://s3.amazonaws.com/oin-hotosm-temp/global-coverage.pmtiles
```

The archive has a single vector layer, `density`, covering z0-13. Each
feature is a grid square with an image count.

In MapLibre, register the PMTiles protocol first:

```js
import { Protocol } from "pmtiles";

maplibregl.addProtocol("pmtiles", new Protocol().tile);

map.addSource("oam-coverage", {
  type: "vector",
  url: "pmtiles://https://s3.amazonaws.com/oin-hotosm-temp/global-coverage.pmtiles",
});
```

The archive is regenerated every 12 hours.

## Tiles for one image

To render a single image rather than the mosaic, use the per-item TiTiler
endpoint with that image's STAC item ID:

```text
https://api.imagery.hotosm.org/raster/collections/openaerialmap/items/{item_id}/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=visual
```

For example, the Freetown 2025 dataset:

```text
https://api.imagery.hotosm.org/raster/collections/openaerialmap/items/68beefef128fd7aac0cd73ec/tiles/WebMercatorQuad/{z}/{x}/{y}?assets=visual&nodata=0
```

Add `&nodata=0` for older images, which have black borders otherwise.

To find an item ID, search the catalog in
[STAC Browser](https://api.imagery.hotosm.org/browser/) or query
`https://api.imagery.hotosm.org/stac/search` directly. The ID is the last
part of the item URL.

To combine a few specific images into one layer, use the mosaic endpoint
with a comma separated `ids` list instead:

```text
https://api.imagery.hotosm.org/raster/collections/openaerialmap/tiles/WebMercatorQuad/{z}/{x}/{y}?ids=68beefef128fd7aac0cd73ec,688666a220cfbaea039c043b&assets=visual
```

The same endpoint accepts `bbox` and `datetime` filters. See the
[API docs](https://hotosm.github.io/swagger/?url=https://api.imagery.hotosm.org/raster/api)
for the full parameter list.
