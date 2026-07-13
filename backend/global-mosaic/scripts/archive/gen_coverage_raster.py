#!/usr/bin/env python3
"""
Generate a PMTiles archive containing *partial-coverage* translucent grey tiles
for zooms ZOOM_MIN-ZOOM_MAX by rasterizing PgSTAC footprints into each tile.

NOTE we do not use this, as it's too memory inefficient for now.
NOTE it could be optimised to run batches of tiles, and not load
NOTE the job list in memory, instead using an iterator and yield.

Workflow:
 - Queries pgstac.items for a collection inside a bbox (or global by default)
 - Builds a spatial index (STRtree) of footprints
 - Iterates tiles per-zoom and rasterizes overlapping footprints into a 256x256 tile
 - Writes only tiles that have any coverage (non-empty mask) into PMTiles
    - Parallel tile rasterization per zoom level
    - Batch PMTiles writes for efficiency
 - PMTiles deduplicates identical tiles internally (so identical grey tiles will
   be stored only once)
 - Uploads the resulting PMTiles to S3

Config (env):
 - PG_DSN or PGHOST/PGUSER/PGPASSWORD/PGPORT/PGDATABASE for pgstac
 - COLLECTION (default: openaerialmap) from eoAPI STAC
 - TILE_SIZE (default: 256)
 - ZOOM_MIN (default: 0)
 - ZOOM_MAX (default: 15)
 - OUTPUT_PM (default: /app/output/global-coverage.pmtiles)
 - S3_ACCESS_KEY, S3_SECRET_KEY, (optional S3_ENDPOINT, S3_BUCKET, S3_REGION)
 - TEST_MODE (if set uses small test bbox)
 - LOG_LEVEL (DEBUG/INFO)
"""

import json
import logging
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Tuple
from concurrent.futures import ProcessPoolExecutor, as_completed
from multiprocessing import cpu_count

import numpy as np
import affine
import mercantile
from psycopg import connect
from shapely.geometry import shape, box, Polygon
from shapely.strtree import STRtree
from shapely.ops import unary_union
from rasterio import features
from rio_tiler.utils import render
from pmtiles.writer import write
from pmtiles.tile import zxy_to_tileid, TileType, Compression
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
OUTPUT_PM = os.getenv("OUTPUT_PM", "/app/output/global-coverage.pmtiles")
TILE_SIZE = int(os.getenv("TILE_SIZE", "256"))
ZOOM_MIN = int(os.getenv("ZOOM_MIN", "0"))
ZOOM_MAX = int(os.getenv("ZOOM_MAX", "15"))

TEST_MODE = bool(os.getenv("TEST_MODE", False))
BBOX: tuple[float, float, float, float] = (
    (-20.0, 0.0, 10.0, 30.0)  # large text bbox
    # (-14.00, 4.00, -8.00, 10.00) # small test bbox
    if TEST_MODE
    else (-180.0, -85.05112878, 180.0, 85.05112878)
)

logging.basicConfig(
    stream=sys.stdout,
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s: %(message)s",
)
log = logging.getLogger("gen_mosaic")


@dataclass
class TileJob:
    z: int
    x: int
    y: int


# NOTE: this global is intentionally set by the worker initializer to avoid
# pickling 'geoms' for every single task.
GEOMS: Optional[List[Polygon]] = None


def _init_worker(geoms: List[Polygon]) -> None:
    """
    Run in worker process at start. Stores the geoms list in a module-level
    global to avoid re-pickling for each task.
    """
    global GEOMS
    GEOMS = geoms


def get_features() -> List[dict]:
    """
    Query PgSTAC for imagery features in BBOX.
    Returns list of dicts: {"geometry": shapely.geometry, "url": <asset url or None>, "id": <id>}
    """
    where_bbox = "AND geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
    params = [COLLECTION] + list(BBOX)

    query = f"""
        SELECT id::text AS id,
               content->'assets'->'visual'->>'href' AS url,
               ST_AsGeoJSON(geometry) AS geom
        FROM pgstac.items
        WHERE collection = %s
        {where_bbox}
        ORDER BY (content->>'datetime')::timestamptz DESC;
    """

    log.info(f"Querying PgSTAC for features (bbox={BBOX})...")
    features_list: List[dict] = []
    try:
        with connect(PG_DSN) as conn, conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
    except Exception as e:
        log.error(f"PgSTAC query failed: {e}")
        raise

    for id_, url, geom in rows:
        if geom is None:
            continue
        try:
            geom_obj = shape(json.loads(geom))
            features_list.append({"geometry": geom_obj, "url": url, "id": id_})
        except Exception as e:
            log.warning(f"Failed to parse geometry for {id_}: {e}")

    log.info(f"Found {len(features_list)} items in pgSTAC for bbox")
    return features_list


def make_partial_coverage_tile(
    tile_bounds: tuple[float, float, float, float],
    geoms: list[Polygon],
    color: tuple[int, int, int, int] = (128, 128, 128, 102),
    tile_size: int = 256,
) -> Optional[bytes]:
    """
    Create a PNG tile (tile_size x tile_size) with translucent coverage where imagery exists,
    transparent elsewhere. Returns PNG bytes, or None if no coverage.
    """
    if not geoms:
        return None

    west, south, east, north = tile_bounds
    transform = affine.Affine(
        (east - west) / tile_size, 0, west, 0, (south - north) / tile_size, north
    )

    try:
        mask = features.rasterize(
            [(geom, 1) for geom in geoms],
            out_shape=(tile_size, tile_size),
            transform=transform,
            fill=0,
            all_touched=True,
            dtype="uint8",
        )
    except Exception as e:
        log.error(f"Rasterization failed for bounds={tile_bounds}: {e}")
        return None

    if not np.any(mask):
        return None

    arr = np.zeros((tile_size, tile_size, 4), dtype=np.uint8)
    r, g, b, a = color
    arr[mask == 1, 0] = r
    arr[mask == 1, 1] = g
    arr[mask == 1, 2] = b
    arr[mask == 1, 3] = a

    return render(arr.transpose(2, 0, 1), img_format="PNG")


def process_tile(
    z: int, tile: mercantile.Tile, candidate_indices: list[int], tile_size: int
) -> Optional[tuple[int, bytes]]:
    """
    Process a single tile: clip + simplify + rasterize.
    Note: this runs in worker processes. It uses global GEOMS which is set via initializer.
    """
    global GEOMS

    tile_bounds = mercantile.bounds(tile)
    tile_geom = box(*tile_bounds)

    pixel_size = (tile_bounds[2] - tile_bounds[0]) / tile_size
    clipped_simplified = []

    # Iterate only candidate indices passed from main process (do not re-query STRtree)
    for idx in candidate_indices:
        geom = GEOMS[idx]
        if geom.intersects(tile_geom):
            clipped = geom.intersection(tile_geom)
            if not clipped.is_empty:
                clipped_simplified.append(
                    clipped.simplify(pixel_size, preserve_topology=True)
                )

    if not clipped_simplified:
        return None

    data = make_partial_coverage_tile(
        tile_bounds, clipped_simplified, tile_size=tile_size
    )
    if data:
        return (zxy_to_tileid(tile.z, tile.x, tile.y), data)
    return None


def generate_partial_coverage_pmtiles() -> None:
    features = get_features()
    if not features:
        log.warning("No features found - nothing to do.")
        return

    geoms = [f["geometry"] for f in features]
    tree = STRtree(geoms)

    overall_bounds = unary_union(geoms).bounds
    log.info(f"Overall feature bounds: {overall_bounds}")

    header = {
        "version": 3,
        "tile_type": TileType.PNG,
        "tile_compression": Compression.NONE,
    }
    metadata = {
        "name": f"{COLLECTION}-coverage",
        "bounds": list(overall_bounds),
        "minzoom": ZOOM_MIN,
        "maxzoom": ZOOM_MAX,
        "description": f"OpenAerialMap global coverage tiles (z{ZOOM_MIN}-{ZOOM_MAX}) for {COLLECTION}",
    }

    Path(OUTPUT_PM).parent.mkdir(parents=True, exist_ok=True)
    start_time = time.time()
    total_written = 0

    with write(OUTPUT_PM) as writer:
        for z in range(ZOOM_MIN, ZOOM_MAX + 1):
            tiles = list(mercantile.tiles(*overall_bounds, [z]))
            total_tiles = len(tiles)
            log.info(f"Processing zoom {z}: {total_tiles} candidate tiles")

            # Find tiles that have any geometry candidate in tree
            tasks: List[Tuple[mercantile.Tile, List[int]]] = []
            for tile in tiles:
                tile_geom = box(*mercantile.bounds(tile))
                candidate_indices = tree.query(tile_geom)
                # Generate if there is a match
                if len(candidate_indices) > 0:
                    tasks.append((tile, candidate_indices))

            skipped_tiles = total_tiles - len(tasks)
            log.info(
                f"Zoom {z}: {len(tasks)} tiles to process ({100 - (skipped_tiles / total_tiles) * 100:.1f}% coverage)"
            )

            if not tasks:
                continue

            # Leave one core spare for main thread + IO
            max_workers = max(1, min(cpu_count() - 1, len(tasks)))
            log.debug(f"Using {max_workers} worker processes for zoom {z}")

            zoom_start_time = time.time()
            completed_tasks = 0
            tiles_written_this_zoom = 0
            last_log_time = zoom_start_time

            with ProcessPoolExecutor(
                max_workers=max_workers, initializer=_init_worker, initargs=(geoms,)
            ) as exe:
                futures = [
                    exe.submit(process_tile, z, tile, candidate_indices, TILE_SIZE)
                    for tile, candidate_indices in tasks
                ]

                for fut in as_completed(futures):
                    completed_tasks += 1
                    current_time = time.time()

                    try:
                        result = fut.result()
                    except Exception as e:
                        log.exception(f"Tile processing failed (zoom {z}): {e}")
                        result = None

                    if result:
                        writer.write_tile(*result)
                        total_written += 1
                        tiles_written_this_zoom += 1

                    # Log every 30 seconds or on completion
                    if (current_time - last_log_time) >= 30 or completed_tasks == len(
                        tasks
                    ):
                        progress_pct = (completed_tasks / len(tasks)) * 100.0
                        elapsed = current_time - zoom_start_time
                        rate = completed_tasks / elapsed if elapsed > 0 else 0
                        eta = (len(tasks) - completed_tasks) / rate if rate > 0 else 0

                        eta_str = f"{eta / 60:.1f}m" if eta > 60 else f"{eta:.1f}s"

                        log.info(
                            f"Zoom {z}: {progress_pct:.1f}% | "
                            f"{completed_tasks}/{len(tasks)} tasks | "
                            f"{tiles_written_this_zoom} tiles written | "
                            f"rate {rate:.1f}/sec | "
                            f"ETA {eta_str}"
                        )
                        last_log_time = current_time

            zoom_elapsed = time.time() - zoom_start_time
            log.info(
                f"Zoom {z} complete: {tiles_written_this_zoom} tiles written in {zoom_elapsed / 60.0:.1f} min"
            )

        writer.finalize(header=header, metadata=metadata)

    elapsed_total = time.time() - start_time
    log.info(f"PMTiles archive written: {OUTPUT_PM}")
    log.info(f"Total processing time: {elapsed_total / 60.0:.1f} min")
    log.info(f"Total tiles written: {total_written}")


def upload_to_s3() -> None:
    endpoint = os.getenv("S3_ENDPOINT", "s3.amazonaws.com")
    bucket = os.getenv("S3_BUCKET", "oin-hotosm-temp")
    access_key = os.getenv("S3_ACCESS_KEY")
    secret_key = os.getenv("S3_SECRET_KEY")
    region = os.getenv("S3_REGION", "us-east-1")
    pmtiles_obj_key = Path(OUTPUT_PM).name

    if not (bucket and access_key and secret_key):
        log.warning(
            "S3 upload skipped: missing required env vars (S3_BUCKET/S3_ACCESS_KEY/S3_SECRET_KEY)"
        )
        return

    client = Minio(
        endpoint,
        access_key=access_key,
        secret_key=secret_key,
        region=region,
        secure=True,
    )

    try:
        log.info(f"Checking the bucket {bucket} exists")
        if not client.bucket_exists(bucket):
            log.exception(f"Bucket {bucket} does not exist. Exiting")
            return
    except S3Error as e:
        log.error(f"Error checking bucket: {e}")
        return

    log.info(f"Uploading {OUTPUT_PM} to s3://{bucket}/{pmtiles_obj_key}")
    try:
        client.fput_object(
            bucket,
            pmtiles_obj_key,
            OUTPUT_PM,
            content_type="application/vnd.pmtiles",
            metadata={"x-amz-acl": "public-read"},
        )
        log.info(f"Upload complete: s3://{bucket}/{pmtiles_obj_key}")
    except S3Error as e:
        log.error(f"S3 upload failed: {e}")


if __name__ == "__main__":
    if Path(OUTPUT_PM).exists():
        log.info(f"PMTiles archive at {OUTPUT_PM} already exists, skipping generation")
    else:
        log.info(f"Starting global coverage PMTiles generation (TEST_MODE={TEST_MODE})")
        generate_partial_coverage_pmtiles()

    upload_to_s3()
