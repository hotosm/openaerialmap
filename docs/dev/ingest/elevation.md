<!-- markdownlint-disable MD013 -->

# Elevation

OAM indexes the Copernicus GLO-30 Digital Surface Model. The source Cloud
Optimized GeoTIFFs are not copied; PgSTAC only stores metadata and links to
them.

## Ingestion

[`glo30.py`](https://github.com/hotosm/openaerialmap/tree/main/backend/stactools-hotosm/src/stactools/hotosm/glo30.py)
reads Items from Earth Search, updates their asset URLs, then loads them into
PgSTAC. It has its own ingestion path because GLO-30 is elevation data, not
imagery.

Earth Search uses `s3://copernicus-dem-30m/...` asset URLs. OAM changes the
main URL to public HTTPS for the raster service and keeps the S3 URL as an
alternate.

GLO-30 is a static release, so ingestion uses a one-off Job. The Job upserts
the Collection, followed by all 26,450 Items. It is safe to rerun after a
partial load.

The manifests are in the
[k8s-infra repository](https://github.com/hotosm/k8s-infra/tree/main/apps/oam/jobs).

ArgoCD creates the Job on its next sync. Delete the existing Job before
running it again.

```bash
kubectl -n oam logs -f job/stac-ingest-glo30
```

Use `--bbox MINX MINY MAXX MAXY` for a smaller test ingest:

```bash
hotosm sync-glo30 --bbox 85.0 27.0 88.0 29.0
```

An upsert does not delete old or renamed Items. If upstream IDs change, remove
the old Collection Items before running ingestion again.

## Raster endpoints

Crop an area to GeoTIFF:

```http
GET /raster/collections/cop-dem-glo-30/bbox/{minx},{miny},{maxx},{maxy}.tif
    ?assets=data&width={w}&height={h}&return_mask=false
```

The source grid is EPSG:4326 with 1/3600-degree pixels. Align the bbox and
output dimensions to that grid to avoid resampling. `return_mask=false` omits
the extra alpha band.

Serve Terrarium tiles for a MapLibre `raster-dem` source:

```http
GET /raster/collections/cop-dem-glo-30/tiles/WebMercatorQuad/{z}/{x}/{y}.png
    ?assets=data&algorithm=terrarium
```

## Caveats

- Ocean pixels are `0`, not nodata.
- A cold multi-tile crop can hit PgSTAC's search `time_limit`.
- Availability depends on the public Copernicus AWS bucket.
