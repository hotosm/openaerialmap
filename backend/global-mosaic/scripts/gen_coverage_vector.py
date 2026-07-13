#!/usr/bin/env python3
"""
Generate the OAM global PMTiles archives from the pgSTAC catalogue.

Produces two independent PMTiles files:

- ``global-coverage.pmtiles`` (``density`` layer): Web-Mercator grid
  cells at z0-13 with a ``count`` property per cell. Rendered by
  chiitiler over z0-13 (see ``backend/global-tms``). TiTiler takes
  over at z14+ for real imagery, so we deliberately do not emit
  anything past z13 here.

- ``global-data.pmtiles`` (``globalcoverage`` layer): per-image
  polygon footprints at z0-13 with rich metadata (title, provider,
  platform, gsd, sensor, license, acquisition_end, thumbnail, uuid,
  tms, file_size). The frontend reads this layer client-side
  to drive sidebar cards, filters, and TMS handoff without any STAC
  API calls.

Artifacts are produced and uploaded in ascending order of cost so
a failure in a later stage never leaves a downstream service without
a fresh input:

  1. ``stats.json`` (landing page)
  2. ``global-coverage.pmtiles`` density grid (global-tms)
  3. ``global-data.pmtiles`` footprints (frontend browser)
"""

import json
import logging
import math
import os
import sys
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Tuple
from psycopg import connect
from minio import Minio
from minio.error import S3Error


PG_DSN = os.getenv("PG_DSN")
if not PG_DSN:
    PGHOST = os.getenv("PGHOST")
    PGUSER = os.getenv("PGUSER")
    PGPASSWORD = os.getenv("PGPASSWORD")
    PGPORT = int(os.getenv("PGPORT", 5432))
    PGDATABASE = os.getenv("PGDATABASE", "eoapi")

    if not (PGHOST and PGUSER and PGPASSWORD):
        raise ValueError("Must set either PG_DSN, or (PGHOST,PGUSER,PGPASSWORD)")

    PG_DSN = f"postgresql://{PGUSER}:{PGPASSWORD}@{PGHOST}:{PGPORT}/{PGDATABASE}"

COLLECTION = os.getenv("COLLECTION", "openaerialmap")

# Density (grid cells) - filename is preserved for the global-tms
# pipeline which points at s3://oin-hotosm-temp/global-coverage.pmtiles.
OUTPUT_DENSITY_GEOJSON = os.getenv(
    "OUTPUT_DENSITY_GEOJSON", "/app/output/global-density.geojson"
)
OUTPUT_DENSITY_PMTILES = os.getenv(
    "OUTPUT_DENSITY_PMTILES", "/app/output/global-coverage.pmtiles"
)

# Footprints (per-image polygons with rich metadata) - powers the
# frontend. Named "data" to distinguish from the density aggregation.
OUTPUT_FOOTPRINTS_GEOJSON = os.getenv(
    "OUTPUT_FOOTPRINTS_GEOJSON", "/app/output/global-data.geojson"
)
OUTPUT_FOOTPRINTS_PMTILES = os.getenv(
    "OUTPUT_FOOTPRINTS_PMTILES", "/app/output/global-data.pmtiles"
)

OUTPUT_STATS = os.getenv("OUTPUT_STATS", "/app/output/stats.json")
ZOOM_MIN = int(os.getenv("ZOOM_MIN", "0"))
# Both archives cover z0-13. z14+ is served by TiTiler.
ZOOM_MAX = int(os.getenv("ZOOM_MAX", "13"))

# Density grid runs the full TMS range: z0-13. Above z13, TiTiler serves
# real imagery.
DENSITY_MAX_ZOOM = ZOOM_MAX
# Offset = 4 produces ~16x16 cells per rendered tile. At display z0
# that's a 256-cell world grid (each cell ~1250 km wide), fine enough
# that regions without imagery show as visible gaps instead of being
# swallowed by a handful of oversized 5000 km squares. At display z9+
# the cap below clamps cell_zoom to a fixed resolution so cells don't
# keep shrinking indefinitely.
DENSITY_ZOOM_OFFSET = 4
# Cap follows DENSITY_MAX_ZOOM + offset so cells scale with display zoom
# at every level (no saturation).
DENSITY_CELL_ZOOM_CAP = DENSITY_MAX_ZOOM + DENSITY_ZOOM_OFFSET

TEST_MODE = os.getenv("TEST_MODE", "").lower() in {"true", "1", "yes"}

BBOX: Tuple[float, float, float, float] = (
    (-20.0, 0.0, 10.0, 30.0)  # large test bbox
    if TEST_MODE
    else (-180.0, -85.05112878, 180.0, 85.05112878)
)


logging.basicConfig(
    stream=sys.stdout,
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s: %(message)s",
)
log = logging.getLogger("gen_mosaic")


# --- Web Mercator tile math (matches the client-side helpers) ---
def _lon2tile(lon: float, zoom: int) -> int:
    return int(math.floor((lon + 180.0) / 360.0 * (1 << zoom)))


def _lat2tile(lat: float, zoom: int) -> int:
    rad = math.radians(lat)
    return int(
        math.floor(
            (1.0 - math.log(math.tan(rad) + 1.0 / math.cos(rad)) / math.pi)
            / 2.0
            * (1 << zoom)
        )
    )


def _tile2lon(x: int, zoom: int) -> float:
    return x / (1 << zoom) * 360.0 - 180.0


def _tile2lat(y: int, zoom: int) -> float:
    n = math.pi - 2.0 * math.pi * y / (1 << zoom)
    return math.degrees(math.atan(math.sinh(n)))


# =====================================================================
# DENSITY
# =====================================================================


# Bucket keys must match the frontend filter values in
# frontend/src/browse/utils/filters.ts (densityCountKey). Any change
# here needs a matching change on the client.
PLATFORM_BUCKETS = {
    "uav": "count_uav",
    "drone": "count_uav",
    "satellite": "count_satellite",
}
# Anything not in PLATFORM_BUCKETS (including null / unknown) rolls up
# into the "aircraft" bucket, which the frontend surfaces as "Other".
PLATFORM_DEFAULT_BUCKET = "count_aircraft"


def _license_bucket(license_str: str | None) -> str | None:
    """
    Map a raw STAC license string onto one of the three buckets the
    frontend filter offers. Returns None for licenses that don't match
    any bucket (unknown / non-CC) so those images don't inflate any
    filtered count.
    """
    if not license_str:
        return None
    norm = license_str.replace(" ", "").replace("-", "").lower()
    if "nc" in norm:
        return "count_lic_by_nc"
    if "sa" in norm:
        return "count_lic_by_sa"
    if "by" in norm:
        return "count_lic_by"
    return None


def _date_buckets(acq_ts: datetime | None, now: datetime) -> list[str]:
    """
    Bucket an image's acquisition timestamp into:
      - `count_year_YYYY` (always, if a valid date)
      - `count_last_7d` / `count_last_30d` (moving windows relative to
        `now` at generation time)

    Moving windows are frozen at generation time - the client's "Past
    Week" preset really means "past week relative to the last pmtiles
    build". Small drift (up to a day between builds) is acceptable and
    documented in the frontend filter tooltip.
    """
    if not acq_ts:
        return []
    if acq_ts.tzinfo is None:
        acq_ts = acq_ts.replace(tzinfo=timezone.utc)
    keys = [f"count_year_{acq_ts.year}"]
    delta = now - acq_ts
    if timedelta(0) <= delta <= timedelta(days=7):
        keys.append("count_last_7d")
    if timedelta(0) <= delta <= timedelta(days=30):
        keys.append("count_last_30d")
    return keys


def _image_buckets(
    platform: str | None,
    license_str: str | None,
    acq_ts: datetime | None,
    now: datetime,
) -> tuple[str, ...]:
    """
    All bucket keys an image increments. Kept as a tuple so the inner
    binning loop just iterates without allocating a new list per image.
    """
    buckets: list[str] = []
    plat = (platform or "").lower()
    buckets.append(PLATFORM_BUCKETS.get(plat, PLATFORM_DEFAULT_BUCKET))
    lb = _license_bucket(license_str)
    if lb:
        buckets.append(lb)
    buckets.extend(_date_buckets(acq_ts, now))
    return tuple(buckets)


def get_density_features() -> None:
    """
    Query PgSTAC for OAM image centroids + bboxes and pre-bin them into
    Web-Mercator tile-cell grids at multiple zoom levels. Each grid cell
    carries:

    - `count`: total number of image centroids inside the cell
    - `bboxW/S/E/N`: union of contained-image bboxes, so clicking the
      cell in the frontend can `fitBounds` to where the imagery actually
      is (rather than to the whole cell, which is mostly empty for
      clusters in a corner).
    - Optional per-filter breakdown counts (only emitted when >0):
        - `count_uav`, `count_satellite`, `count_aircraft`
        - `count_lic_by`, `count_lic_by_nc`, `count_lic_by_sa`
        - `count_year_YYYY` (one per year of imagery present)
        - `count_last_7d`, `count_last_30d`
      These let the frontend show accurate filtered counts at world
      zoom by reading e.g. `count_uav` instead of the total `count`.
      See frontend/src/browse/utils/filters.ts (densityCountKey).

    Each cell is tagged with tippecanoe `minzoom`/`maxzoom` so it only
    appears at its target display zoom.
    """
    # ST_XMin/XMax/YMin/YMax return the polygon extent; we aggregate
    # those per cell instead of just centroids so click-to-zoom lands
    # on the imagery rather than the cell corner.
    #
    # NB: the STAC ingester (stactools-hotosm) writes the platform value
    # under `oam:platform_type`, not the bare `platform` key. Reading the
    # wrong key returns NULL for every item and lumps everything into
    # `count_aircraft`, so the frontend's satellite/uav filters match
    # nothing.
    centroid_query = """
        SELECT ST_X(ST_Centroid(geometry)) AS lon,
               ST_Y(ST_Centroid(geometry)) AS lat,
               ST_XMin(geometry) AS xmin,
               ST_YMin(geometry) AS ymin,
               ST_XMax(geometry) AS xmax,
               ST_YMax(geometry) AS ymax,
               content->'properties'->>'oam:platform_type' AS platform,
               COALESCE(
                   content->'properties'->>'license',
                   content->>'license'
               ) AS license,
               COALESCE(
                   (content->'properties'->>'datetime')::timestamptz,
                   (content->'properties'->>'end_datetime')::timestamptz,
                   (content->'properties'->>'start_datetime')::timestamptz
               ) AS acq_ts
        FROM pgstac.items
        WHERE collection = %s
          AND geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
    """
    params = [COLLECTION] + list(BBOX)

    log.info(f"Fetching OAM centroids + bboxes for density grid (bbox={BBOX})...")
    now = datetime.now(timezone.utc)
    # Each record: (lon, lat, xmin, ymin, xmax, ymax, buckets)
    records: list[tuple[float, float, float, float, float, float, tuple[str, ...]]] = []
    try:
        with connect(PG_DSN) as conn, conn.cursor() as cur:
            cur.execute(centroid_query, params)
            for lon, lat, xmin, ymin, xmax, ymax, platform, license_str, acq_ts in cur:
                if lon is None or lat is None:
                    continue
                # Clamp latitude to Web Mercator's valid range
                if lat > 85.05112878 or lat < -85.05112878:
                    continue
                records.append(
                    (
                        float(lon),
                        float(lat),
                        float(xmin),
                        float(ymin),
                        float(xmax),
                        float(ymax),
                        _image_buckets(platform, license_str, acq_ts, now),
                    )
                )
    except Exception as e:
        log.error(f"Density centroid query failed: {e}")
        raise

    log.info(f"Binning {len(records)} images into per-zoom grids...")
    Path(OUTPUT_DENSITY_GEOJSON).parent.mkdir(parents=True, exist_ok=True)
    total_cells = 0
    with open(OUTPUT_DENSITY_GEOJSON, "w") as f:
        for display_zoom in range(0, DENSITY_MAX_ZOOM + 1):
            cell_zoom = min(display_zoom + DENSITY_ZOOM_OFFSET, DENSITY_CELL_ZOOM_CAP)
            # cell key -> [count, xmin, ymin, xmax, ymax, buckets_dict].
            # Mutating a list in the dict is cheaper than allocating
            # tuples each update - this loop runs ~21k × 14 zooms = ~300k
            # times.
            cells: dict[tuple[int, int], list] = {}
            for lon, lat, xmin, ymin, xmax, ymax, buckets in records:
                key = (_lon2tile(lon, cell_zoom), _lat2tile(lat, cell_zoom))
                acc = cells.get(key)
                if acc is None:
                    acc = cells[key] = [1, xmin, ymin, xmax, ymax, {}]
                else:
                    acc[0] += 1
                    if xmin < acc[1]:
                        acc[1] = xmin
                    if ymin < acc[2]:
                        acc[2] = ymin
                    if xmax > acc[3]:
                        acc[3] = xmax
                    if ymax > acc[4]:
                        acc[4] = ymax
                bkt = acc[5]
                for bk in buckets:
                    bkt[bk] = bkt.get(bk, 0) + 1

            for (x, y), (count, bw, bs, be, bn, bkt) in cells.items():
                w = _tile2lon(x, cell_zoom)
                e = _tile2lon(x + 1, cell_zoom)
                n = _tile2lat(y, cell_zoom)
                s = _tile2lat(y + 1, cell_zoom)
                clamp = {"minzoom": display_zoom, "maxzoom": display_zoom}

                # 4dp ≈ 11m at the equator; plenty for a fitBounds
                # target, keeps the tile payload lean.
                props = {
                    "count": int(count),
                    "bboxW": round(bw, 4),
                    "bboxS": round(bs, 4),
                    "bboxE": round(be, 4),
                    "bboxN": round(bn, 4),
                    # Breakdown counts. Only non-zero buckets are
                    # emitted so tippecanoe doesn't pack empty keys.
                    **bkt,
                }

                # Polygon drives density-fill and the click target.
                # Labels use the point below so tile clipping does not
                # move anchors onto cell edges.
                polygon_feature = {
                    "type": "Feature",
                    # Tippecanoe only reads zoom clamps at feature top level.
                    "tippecanoe": clamp,
                    "properties": props,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[w, n], [e, n], [e, s], [w, s], [w, n]]],
                    },
                }
                f.write(json.dumps(polygon_feature))
                f.write("\n")

                # Point drives density-count labels. Carries the same
                # breakdown counts so the label can swap to a filtered
                # value without a second source lookup.
                cx = (w + e) / 2
                cy = (n + s) / 2
                point_feature = {
                    "type": "Feature",
                    "tippecanoe": clamp,
                    "properties": {"count": int(count), **bkt},
                    "geometry": {"type": "Point", "coordinates": [cx, cy]},
                }
                f.write(json.dumps(point_feature))
                f.write("\n")

                total_cells += 2

    log.info(
        f"Wrote {total_cells} density cells across zooms "
        f"0..{DENSITY_MAX_ZOOM} to {OUTPUT_DENSITY_GEOJSON}"
    )


def density_to_pmtiles() -> None:
    """
    Run tippecanoe to build the density PMTiles archive with a single
    `density` layer of pre-binned grid cells (polygons for fill + points
    for labels).
    """
    log.info("Generating density PMTiles with tippecanoe...")

    if not Path(OUTPUT_DENSITY_GEOJSON).exists():
        raise FileNotFoundError(
            f"{OUTPUT_DENSITY_GEOJSON} not found - cannot build PMTiles"
        )

    args = [
        "tippecanoe",
        "-o",
        OUTPUT_DENSITY_PMTILES,
        "--force",
        "--name=openaerialmap-global-density",
        f"--description=OAM global density grid (z{ZOOM_MIN}-{DENSITY_MAX_ZOOM})",
        f"--minimum-zoom={ZOOM_MIN}",
        f"--maximum-zoom={ZOOM_MAX}",
        "--drop-densest-as-needed",
        # Progress bar uses \r updates that k8s log streams turn into
        # thousands of separate lines, drowning out real messages.
        "--no-progress-indicator",
        "-L",
        f"density:{OUTPUT_DENSITY_GEOJSON}",
    ]

    try:
        subprocess.run(args, check=True)
    except subprocess.CalledProcessError as e:
        log.error(f"Tippecanoe (density) failed with exit code {e.returncode}")
        raise
    log.info(f"Density PMTiles written to {OUTPUT_DENSITY_PMTILES}")


# =====================================================================
# FOOTPRINTS (powers the frontend)
# =====================================================================


def _extract_feature_properties(feature_id: str, content: dict) -> dict:
    """
    Flatten STAC Item content into the minimal property set the browser
    consumes. Missing fields are omitted so tippecanoe doesn't emit
    null-valued keys into every tile.

    Kept in one place because the same field names are read on the
    client (see frontend/src/browse/utils/format.ts).
    """
    props = content.get("properties") or {}
    assets = content.get("assets") or {}

    providers = props.get("providers") or content.get("providers") or []
    provider_name = providers[0].get("name") if providers else None

    instruments = props.get("instruments") or []
    sensor = instruments[0] if instruments else props.get("sensor")

    # Prefer `visual` (STAC convention for a display-ready COG); fall
    # back to `data` (OAM's older naming) so we still produce a URL for
    # legacy items. The chosen name has to be threaded through to the
    # frontend so it can call TiTiler-pgstac with the right `?assets=`
    # query param.
    if assets.get("visual"):
        asset_name = "visual"
    elif assets.get("data"):
        asset_name = "data"
    else:
        asset_name = None
    visual = assets.get(asset_name) if asset_name else {}

    thumbnail = assets.get("thumbnail") or {}
    tms_asset = assets.get("tms") or assets.get("wmts") or {}

    # file:size is the STAC file extension; fall back to a bare `size`
    # if the ingester wrote that instead.
    file_size = visual.get("file:size") or visual.get("size")

    # `_id` (not `id`) is the property key the browser expects - it
    # uses MapLibre's `promoteId: '_id'` to hoist this into feature.id,
    # which is required for expression filters like ['==', '_id', ...].
    # See frontend/src/browse/components/Map.tsx.
    out = {
        "_id": feature_id,
        "title": props.get("title"),
        "provider": provider_name,
        "platform": props.get("oam:platform_type"),
        "sensor": sensor,
        "gsd": props.get("gsd"),
        "license": props.get("license") or content.get("license"),
        # Frontend reads `acquisition_end` (matches OAM legacy naming);
        # datetime is the canonical STAC field.
        "acquisition_end": (
            props.get("datetime")
            or props.get("end_datetime")
            or props.get("start_datetime")
        ),
        "thumbnail": thumbnail.get("href"),
        # `uuid` carries the visual COG's S3 path. Kept for the
        # GeoTIFF-download link on each card and as a debug reference;
        # tile URLs go through TiTiler-pgstac via `_id` + `asset_name`.
        "uuid": visual.get("href"),
        "tms": tms_asset.get("href"),
        # Which asset name the frontend should pass to TiTiler-pgstac's
        # `?assets=` query param. Usually `visual`, occasionally `data`
        # on older items.
        "asset_name": asset_name,
        "file_size": file_size,
    }

    # Strip nulls so tippecanoe doesn't bloat tiles with empty keys.
    return {k: v for k, v in out.items() if v is not None}


def get_footprint_features() -> None:
    """
    Query PgSTAC for imagery features and write them as
    newline-delimited GeoJSON with per-image metadata that the browser
    can render sidebar cards and filter on without any STAC API calls.
    """
    where_bbox = "AND geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
    params = [COLLECTION] + list(BBOX)

    query = f"""
        SELECT
            id::text AS id,
            ST_AsGeoJSON(geometry) AS geom,
            content
        FROM pgstac.items
        WHERE collection = %s
        {where_bbox}
        ORDER BY (content->>'datetime')::timestamptz DESC;
    """

    log.info(f"Querying PgSTAC for footprints (bbox={BBOX})...")
    Path(OUTPUT_FOOTPRINTS_GEOJSON).parent.mkdir(parents=True, exist_ok=True)
    row_count = 0
    try:
        with (
            connect(PG_DSN) as conn,
            conn.cursor() as cur,
            open(OUTPUT_FOOTPRINTS_GEOJSON, "w") as f,
        ):
            cur.execute(query, params)
            for row in cur:
                feature_id, geom_json, content = row
                if not geom_json:
                    continue
                try:
                    geom = json.loads(geom_json)
                    properties = _extract_feature_properties(feature_id, content or {})
                    feature = {
                        "type": "Feature",
                        "geometry": geom,
                        "properties": properties,
                    }
                    f.write(json.dumps(feature))
                    f.write("\n")
                    row_count += 1
                except json.JSONDecodeError:
                    log.warning(f"Invalid geometry for {feature_id}, skipping.")
    except Exception as e:
        log.error(f"Footprint query failed: {e}")
        raise

    log.info(f"Wrote {row_count} footprints to {OUTPUT_FOOTPRINTS_GEOJSON}")


def footprints_to_pmtiles() -> None:
    """
    Run tippecanoe to build the footprints PMTiles archive with a single
    `globalcoverage` layer of per-image polygons + metadata.

    `--drop-densest-as-needed` is deliberate: at z0-z2 the coverage
    layer would otherwise pack all ~21k footprints (~17 MB of rich
    metadata) into a handful of tiles, blowing past the ~500 KB
    tile-size limit. Drop-densest picks the densest features and skips
    them until the tile fits, so it only activates at low zooms where
    tiles are geographically huge.

    Consequence: the archive is NOT a lossless copy of the catalogue
    at every zoom. Low-zoom tiles carry only a subset. This is a
    deliberate tradeoff - see `README.md` (`Low-zoom tiles are a
    simplified representation`) and the block comment on
    `FOOTPRINT_MIN_ZOOM` in
    `frontend/src/browse/utils/constants.ts` for the full context.
    The frontend gates its sidebar / footprint layer on
    `FOOTPRINT_MIN_ZOOM = 8` to hide the truncation, since above ~z8
    per-tile density is low enough that drop-densest rarely fires and
    the tile data is effectively complete for the viewport. Low zooms
    are handled by the separate `density` layer in
    `global-coverage.pmtiles`, whose counts are pre-binned from all
    ~21k centroids and are authoritative.
    """
    log.info("Generating footprints PMTiles with tippecanoe...")

    if not Path(OUTPUT_FOOTPRINTS_GEOJSON).exists():
        raise FileNotFoundError(
            f"{OUTPUT_FOOTPRINTS_GEOJSON} not found - cannot build PMTiles"
        )

    args = [
        "tippecanoe",
        "-o",
        OUTPUT_FOOTPRINTS_PMTILES,
        "--force",
        "--name=openaerialmap-global-data",
        f"--description=OAM per-image footprints with metadata (z{ZOOM_MIN}-{ZOOM_MAX})",
        f"--minimum-zoom={ZOOM_MIN}",
        f"--maximum-zoom={ZOOM_MAX}",
        "--drop-densest-as-needed",
        "--no-progress-indicator",
        "-L",
        f"globalcoverage:{OUTPUT_FOOTPRINTS_GEOJSON}",
    ]

    try:
        subprocess.run(args, check=True)
    except subprocess.CalledProcessError as e:
        log.error(f"Tippecanoe (footprints) failed with exit code {e.returncode}")
        raise
    log.info(f"Footprints PMTiles written to {OUTPUT_FOOTPRINTS_PMTILES}")


# =====================================================================
# STATS + S3
# =====================================================================


def write_stats() -> None:
    """
    Query PgSTAC and write catalog stats to a small JSON file. Powers
    the OAM landing page without needing per-pageview STAC API calls.
    """
    log.info("Computing catalog stats...")

    oam_query = """
        SELECT
            COUNT(*)::bigint AS items,
            COALESCE(SUM(ST_Area(geometry::geography)) / 1e6, 0)::double precision
                AS area_km2,
            MAX(COALESCE(
                (content->>'datetime')::timestamptz,
                (content->>'start_datetime')::timestamptz
            )) AS latest_capture
        FROM pgstac.items
        WHERE collection = %s
    """
    catalog_query = """
        SELECT
            (SELECT COUNT(*)::bigint FROM pgstac.items) AS total_items,
            (SELECT COUNT(*)::bigint FROM pgstac.collections) AS collections
    """

    try:
        with connect(PG_DSN) as conn, conn.cursor() as cur:
            cur.execute(oam_query, [COLLECTION])
            items, area_km2, latest = cur.fetchone()

            cur.execute(catalog_query)
            total_items, total_collections = cur.fetchone()
    except Exception as e:
        log.error(f"Stats query failed: {e}")
        raise

    stats = {
        "generated_at": datetime.now(timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "collection": COLLECTION,
        "items": int(items),
        "area_km2": round(area_km2),
        "latest_capture": (
            latest.isoformat().replace("+00:00", "Z") if latest else None
        ),
        "catalog": {
            "total_items": int(total_items),
            "collections": int(total_collections),
        },
    }

    Path(OUTPUT_STATS).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_STATS, "w") as f:
        json.dump(stats, f, indent=2)
    log.info(f"Stats written to {OUTPUT_STATS}: {stats}")


def _s3_client() -> Minio | None:
    endpoint = os.getenv("S3_ENDPOINT", "s3.amazonaws.com")
    access_key = os.getenv("S3_ACCESS_KEY")
    secret_key = os.getenv("S3_SECRET_KEY")
    region = os.getenv("S3_REGION", "us-east-1")

    if not (access_key and secret_key):
        log.warning("S3 upload skipped: missing required env vars.")
        return None

    return Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        region=region,
        secure=True,
    )


def upload_artifacts(artifacts: list[tuple[str, str]]) -> None:
    """
    Upload a list of (local_path, content_type) pairs to the OAM S3
    bucket, keying by basename. Silently no-ops if S3 creds are missing
    (useful for local runs) or if the file doesn't exist (the caller may
    invoke this after a failed generation step).
    """
    client = _s3_client()
    if client is None:
        return

    bucket = os.getenv("S3_BUCKET", "oin-hotosm-temp")
    try:
        if not client.bucket_exists(bucket):
            log.error(f"Bucket {bucket} does not exist. Exiting upload.")
            return
    except S3Error as e:
        log.error(f"Error checking bucket: {e}")
        return

    for path, content_type in artifacts:
        if not Path(path).exists():
            log.warning(f"Skipping upload of {path}: file not found")
            continue
        obj_key = Path(path).name
        log.info(f"Uploading {path} to s3://{bucket}/{obj_key}")
        try:
            client.fput_object(
                bucket,
                obj_key,
                path,
                content_type=content_type,
                metadata={"x-amz-acl": "public-read"},
            )
            log.info(f"Upload complete: s3://{bucket}/{obj_key}")
        except S3Error as e:
            log.error(f"S3 upload failed for {path}: {e}")


if __name__ == "__main__":
    log.info(f"Starting global PMTiles generation (TEST_MODE={TEST_MODE})")

    # Stages run in ascending order of cost / descending order of
    # blast-radius-if-stale: cheap+critical artifacts land on S3 first
    # so a failure or timeout in a later stage never leaves a downstream
    # service without a fresh input.

    # --- Stage 1: stats (tiny JSON, powers landing page) --------------
    write_stats()
    upload_artifacts([(OUTPUT_STATS, "application/json")])

    # --- Stage 2: density (small PMTiles, TMS-critical) ---------------
    if not Path(OUTPUT_DENSITY_PMTILES).exists():
        get_density_features()
        density_to_pmtiles()
    else:
        log.info(f"{OUTPUT_DENSITY_PMTILES} already exists, skipping density gen.")
    upload_artifacts([(OUTPUT_DENSITY_PMTILES, "application/vnd.pmtiles")])

    # --- Stage 3: footprints (larger PMTiles, powers frontend) --------
    if not Path(OUTPUT_FOOTPRINTS_PMTILES).exists():
        get_footprint_features()
        footprints_to_pmtiles()
    else:
        log.info(f"{OUTPUT_FOOTPRINTS_PMTILES} already exists, skipping footprint gen.")
    upload_artifacts([(OUTPUT_FOOTPRINTS_PMTILES, "application/vnd.pmtiles")])
