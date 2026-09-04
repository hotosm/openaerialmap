<!-- markdownlint-disable MD013 -->

# Elevation

OAM indexes the Copernicus GLO-30 Digital Surface Model so TiTiler can serve
elevation from the source Cloud Optimized GeoTIFFs. The files are not copied.

## Ingestion

[`glo30.py`](https://github.com/hotosm/openaerialmap/tree/main/backend/stactools-hotosm/src/stactools/hotosm/glo30.py)
reads Items from Earth Search, rewrites their asset HREFs, and loads them into
PgSTAC. It does not use `opendata.OpenDataCatalog` because that path adds OAM
imagery fields and a `visual` asset.

Earth Search publishes `s3://copernicus-dem-30m/...` HREFs. They are rewritten
to anonymous HTTPS for the raster service, while the S3 HREF is retained as an
alternate asset.

GLO-30 is a static release, so ingestion is a one-off Job. It upserts the
Collection first and then all 26,450 Items; rerunning repairs a partial load.
The manifests are in the
[k8s-infra repository](https://github.com/hotosm/k8s-infra/tree/main/apps/oam/jobs).

ArgoCD applies it on the next sync; delete the Job to re-run it.

```bash
kubectl -n oam logs -f job/stac-ingest-glo30
```

Use `--bbox MINX MINY MAXX MAXY` for a smaller test ingest:

```bash
hotosm sync-glo30 --bbox 85.0 27.0 88.0 29.0
```

Upserts do not delete renamed or old Items. If the upstream ID scheme
changes, remove the old Collection Items before reingesting.

## Raster endpoints

Crop an area to GeoTIFF:

```http
GET /raster/collections/cop-dem-glo-30/bbox/{minx},{miny},{maxx},{maxy}.tif
    ?assets=data&width={w}&height={h}&return_mask=false
```

The source grid is EPSG:4326 with 1/3600-degree pixels. Snap the bbox and output
dimensions to that grid to avoid resampling. `return_mask=false` omits the
otherwise-added alpha band.

Serve Terrarium tiles for a MapLibre `raster-dem` source:

```http
GET /raster/collections/cop-dem-glo-30/tiles/WebMercatorQuad/{z}/{x}/{y}.png
    ?assets=data&algorithm=terrarium
```

## Caveats

- Ocean pixels are `0`, not nodata.
- A cold multi-tile crop can hit PgSTAC's search `time_limit`.
- Availability depends on the public Copernicus AWS bucket.
