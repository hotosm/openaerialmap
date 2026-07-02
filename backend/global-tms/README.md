# Global TMS Service

- For clients that can use the PMTiles global coverage generated from
  the `global-mosaic` directory, this is the most efficient.
- For clients that can't, e.g. QGIS etc, we run a raster TMS that:
  - z0-13: renders vector tiles from the PMTiles to raster PNGs (with
    density + coverage styling) via [chiitiler](https://github.com/kanahiro/chiitiler),
    fronted by nginx for CORS and PNG caching.
  - z14+: 302-redirects to TiTiler for real imagery.
  - Also offers a Martin tile server as a raw vector-tile XYZ/TMS
    endpoint (e.g. for QGIS).

The `compose.yaml` in this directory mirrors the k8s pod defined in
`chart/templates/deployment.yaml`: chiitiler shares the nginx network
namespace (via `network_mode: service:tms-nginx`) so the sidecar
loopback wiring is identical to production. The local nginx also
serves the downloaded PMTiles so chiitiler range-fetches it over HTTP,
matching how prod points at the S3-hosted object.

In production, this stack is deployed via the Helm chart in `./chart`
alongside eoAPI in the [Kubernetes cluster](https://github.com/hotosm/k8s-info).
