# stac-browser

The [STAC Browser](https://github.com/radiantearth/stac-browser) image with one
addition: raster item pages get **Open in iD**, **Open in JOSM** and an **XYZ
tile URL** link, built from the same TiTiler endpoint and render parameters as
the OAM Browse page (hotosm/openaerialmap#323).

Upstream writes `runtime-config.js` from `SB_*` environment variables at
container start. `50-oam-links.sh` runs right after and appends
`oam-links.js`, which registers a `preprocessSTAC` hook. Upstream's image,
nginx config and `SB_*` handling are untouched, so the eoAPI Helm chart only
needs `browser.image` pointed at this image.

<!-- markdownlint-disable -->

| Variable          | Default                                            | Purpose                                       |
| ----------------- | -------------------------------------------------- | --------------------------------------------- |
| `SB_*`            | upstream                                           | all STAC Browser options, unchanged           |
| `OAM_TITILER_URL` | `SB_catalogUrl` with `/stac` replaced by `/raster` | TiTiler-pgSTAC base URL for the tile template |

<!-- markdownlint-restore -->

```sh
docker build -t oam-stac-browser backend/stac-browser
docker run --rm -p 8080:8080 \
    -e SB_catalogUrl=https://api.imagery.hotosm.org/stac \
    oam-stac-browser
curl -s localhost:8080/runtime-config.js
```
