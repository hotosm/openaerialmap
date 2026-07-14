# Tile packager microservice for MBTiles / PMTiles downloads

## Context and Problem Statement

Users regularly want an offline copy of a specific OAM image's tiles -
for field work, QGIS projects, mobile apps, or humanitarian response
in low-connectivity areas. Historically this meant either:

- Scraping the tile server (rude and slow), or
- Running a one-off local pipeline against the COG.

We want a proper way to hand out MBTiles / PMTiles archives per STAC
item that's cached, discoverable, and doesn't let anyone throw
unbounded work at our tilers.

## Considered Options

- **Do nothing**: users keep improvising. Poor UX and unfair load on
  the tile services.
- **Generate archives up front for every ingest**: wastes storage on
  imagery no one ever downloads, and roughly doubles the ingest cost.
- **On-demand service, results cached to S3 and written back into
  STAC**: only pay for what someone actually asks for, and the
  archive shows up in the catalogue like any other asset.

## Decision Outcome

Ship `backend/tilepack-api/`:

- A small **Go API** validates the STAC item id, checks S3 for an
  existing archive, and returns the URL if one exists.
- If not, it launches a **Kubernetes Job** running a Python worker
  that reads the COG with rio-tiler, renders tiles across a
  GSD-derived zoom range, writes MBTiles, and optionally converts to
  PMTiles.
- The finished archive lands next to the COG on S3 and is registered
  back into the STAC item as an asset (`pmtiles` / `mbtiles`).
- Non-canonical zoom ranges are still served but not registered in
  STAC (returned as a direct URL only).
- Returns **200** when cached, **202** while a job runs; per-IP and
  global caps prevent abuse.

### Consequences

- ✅ Per-image downloadable tile archives with no scraping.
- ✅ The archive is a proper STAC asset, so any STAC client can find
  it, not just our UI.
- ✅ Storage cost tracks actual demand, not the total imagery count.
- ✅ Contained: it's a separate service that scales on its own and
  doesn't touch the live tilers.
- ❌ The first request for an item waits for generation (a few
  minutes for large images). Every request after that is instant
  from the cache.
- ❌ More to run: an API, a worker image, Kubernetes Job permissions
  and an S3 write path to keep healthy.
- ❌ Since it's creation we decided to use Argo workflows to manage
  new imagery uploads. This does not align with that and probably
  needs a small migration.
