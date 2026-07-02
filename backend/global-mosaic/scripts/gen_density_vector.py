#!/usr/bin/env python3
"""
Generate the OAM global density PMTiles (grid squares with per-cell image
counts) from the pgSTAC catalogue.

Rendered by chiitiler over z0-13 (see backend/global-tms). TiTiler takes
over at z14+ for real imagery, so we deliberately do not emit anything
past z13 here.
"""

import json
import logging
import math
import os
import sys
import subprocess
from datetime import datetime, timezone
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
OUTPUT_DENSITY_GEOJSON = os.getenv(
    "OUTPUT_DENSITY_GEOJSON", "/app/output/global-density.geojson"
)
OUTPUT_PMTILES = os.getenv("OUTPUT_PMTILES", "/app/output/global-coverage.pmtiles")
OUTPUT_STATS = os.getenv("OUTPUT_STATS", "/app/output/stats.json")
ZOOM_MIN = int(os.getenv("ZOOM_MIN", "0"))
# Density grid covers z0-13. z14+ is served by TiTiler (see global-tms
# nginx config) - generating past z13 would be wasted work.
ZOOM_MAX = int(os.getenv("ZOOM_MAX", "13"))

# Density grid runs the full TMS range: z0-13. Above z13, TiTiler serves
# real imagery. The previous footprint-outline layer (globalcoverage) was
# dropped - image outlines at z10-13 are too small to be visually useful,
# and the density grid gives clearer aggregate context at every zoom.
DENSITY_MAX_ZOOM = ZOOM_MAX
# z+2 gives about 4x4 cells per rendered tile without a large feature count.
DENSITY_ZOOM_OFFSET = 2
# Cap follows DENSITY_MAX_ZOOM + offset so cells scale with display zoom at
# every level (no saturation). At z13, cell_zoom=15 gives ~4x4 cells per
# tile with counts, matching oam-vibe's grid density.
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


# --- Web Mercator tile math (matches oam-vibe client-side helpers) ---
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


def get_density_features() -> None:
    """
    Query PgSTAC for OAM image centroids and pre-bin them into
    Web-Mercator tile-cell grids at multiple zoom levels. Each grid cell
    carries a `count` property (number of image centroids inside it) and
    is tagged with tippecanoe `minzoom`/`maxzoom` so it only appears at
    its target display zoom.

    Produces a newline-delimited GeoJSON that tippecanoe will pack into
    the `density` layer of the coverage PMTiles.
    """
    centroid_query = """
        SELECT ST_X(ST_Centroid(geometry)) AS lon,
               ST_Y(ST_Centroid(geometry)) AS lat
        FROM pgstac.items
        WHERE collection = %s
          AND geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)
    """
    params = [COLLECTION] + list(BBOX)

    log.info(f"Fetching OAM centroids for density grid (bbox={BBOX})...")
    centroids: list[tuple[float, float]] = []
    try:
        with connect(PG_DSN) as conn, conn.cursor() as cur:
            cur.execute(centroid_query, params)
            for lon, lat in cur:
                if lon is None or lat is None:
                    continue
                # Clamp latitude to Web Mercator's valid range
                if lat > 85.05112878 or lat < -85.05112878:
                    continue
                centroids.append((float(lon), float(lat)))
    except Exception as e:
        log.error(f"Density centroid query failed: {e}")
        raise

    log.info(f"Binning {len(centroids)} centroids into per-zoom grids...")
    Path(OUTPUT_DENSITY_GEOJSON).parent.mkdir(parents=True, exist_ok=True)
    total_cells = 0
    with open(OUTPUT_DENSITY_GEOJSON, "w") as f:
        for display_zoom in range(0, DENSITY_MAX_ZOOM + 1):
            cell_zoom = min(display_zoom + DENSITY_ZOOM_OFFSET, DENSITY_CELL_ZOOM_CAP)
            cells: dict[tuple[int, int], int] = {}
            for lon, lat in centroids:
                key = (_lon2tile(lon, cell_zoom), _lat2tile(lat, cell_zoom))
                cells[key] = cells.get(key, 0) + 1

            for (x, y), count in cells.items():
                w = _tile2lon(x, cell_zoom)
                e = _tile2lon(x + 1, cell_zoom)
                n = _tile2lat(y, cell_zoom)
                s = _tile2lat(y + 1, cell_zoom)
                clamp = {"minzoom": display_zoom, "maxzoom": display_zoom}

                # Polygon drives density-fill. Labels use the point below so
                # tile clipping does not move anchors onto cell edges.
                polygon_feature = {
                    "type": "Feature",
                    # Tippecanoe only reads zoom clamps at feature top level.
                    "tippecanoe": clamp,
                    "properties": {"count": count},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[w, n], [e, n], [e, s], [w, s], [w, n]]],
                    },
                }
                f.write(json.dumps(polygon_feature))
                f.write("\n")

                # Point drives density-count labels; style filters to Point
                # to avoid duplicate labels from the polygon.
                cx = (w + e) / 2
                cy = (n + s) / 2
                point_feature = {
                    "type": "Feature",
                    "tippecanoe": clamp,
                    "properties": {"count": count},
                    "geometry": {"type": "Point", "coordinates": [cx, cy]},
                }
                f.write(json.dumps(point_feature))
                f.write("\n")

                total_cells += 2

    log.info(
        f"Wrote {total_cells} density cells across zooms "
        f"0..{DENSITY_MAX_ZOOM} to {OUTPUT_DENSITY_GEOJSON}"
    )


def geojson_to_pmtiles() -> None:
    """
    Run tippecanoe to build the PMTiles archive with a single `density`
    layer of pre-binned grid cells (polygons for fill + points for labels).

    `--drop-densest-as-needed` is kept as a safety net for future growth,
    though the density layer is small enough that it rarely activates.
    """
    log.info("Generating density PMTiles with tippecanoe...")

    if not Path(OUTPUT_DENSITY_GEOJSON).exists():
        raise FileNotFoundError(
            f"{OUTPUT_DENSITY_GEOJSON} not found - cannot build PMTiles"
        )

    args = [
        "tippecanoe",
        "-o",
        OUTPUT_PMTILES,
        "--name=openaerialmap-global-density",
        f"--description=OAM global density grid (z{ZOOM_MIN}-{DENSITY_MAX_ZOOM})",
        f"--minimum-zoom={ZOOM_MIN}",
        f"--maximum-zoom={ZOOM_MAX}",
        "--drop-densest-as-needed",
        "-L",
        f"density:{OUTPUT_DENSITY_GEOJSON}",
    ]

    try:
        subprocess.run(args, check=True)
    except subprocess.CalledProcessError as e:
        log.error(f"Tippecanoe failed with exit code {e.returncode}")
        raise
    log.info(f"PMTiles written to {OUTPUT_PMTILES}")


def write_stats() -> None:
    """
    Query PgSTAC and write catalog stats to a small JSON file. Powers
    the OAM landing page without needing per-pageview STAC API calls.

    Reports items and sum-of-areas coverage for the OAM collection (the
    total imagery captured, not de-duplicated globe coverage), alongside
    the total number of collections in the wider catalog.
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


def upload_to_s3() -> None:
    """
    Upload the generated PMTiles and stats.json to S3 (or S3-compatible).
    Skips upload if required environment variables are not present.
    """
    endpoint = os.getenv("S3_ENDPOINT", "s3.amazonaws.com")
    bucket = os.getenv("S3_BUCKET", "oin-hotosm-temp")
    access_key = os.getenv("S3_ACCESS_KEY")
    secret_key = os.getenv("S3_SECRET_KEY")
    region = os.getenv("S3_REGION", "us-east-1")

    if not (access_key and secret_key):
        log.warning("S3 upload skipped: missing required env vars.")
        return

    client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        region=region,
        secure=True,
    )

    try:
        if not client.bucket_exists(bucket):
            log.error(f"Bucket {bucket} does not exist. Exiting upload.")
            return
    except S3Error as e:
        log.error(f"Error checking bucket: {e}")
        return

    artifacts = [
        (OUTPUT_PMTILES, "application/vnd.pmtiles"),
        (OUTPUT_STATS, "application/json"),
    ]
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
    log.info(f"Starting global density PMTiles generation (TEST_MODE={TEST_MODE})")

    if not Path(OUTPUT_PMTILES).exists():
        get_density_features()
        geojson_to_pmtiles()
    else:
        log.info(f"{OUTPUT_PMTILES} already exists, skipping generation.")

    write_stats()
    upload_to_s3()
