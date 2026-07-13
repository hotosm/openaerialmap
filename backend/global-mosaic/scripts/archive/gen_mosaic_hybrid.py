#!/usr/bin/env python3
"""
FIXME note we don't use this script for now, instead simply creating a
FIXME coverage map of grey tiles.

Generate a PMTiles archive at /app/output/global-mosaic.pmtiles by:
 1. Querying PgSTAC for imagery footprints within a bbox
 2. Generating grey coverage tiles (z 0-10) by rasterizing footprints into the tile
 3. Downloading real tiles for z 11-14 from TiTiler and inserting into PMTiles
 - Skipping z > 14 (these are served upstream by TiTiler directly)

Configuration (env):
 - PG_DSN: Postgres DSN for PgSTAC (e.g. postgresql://user:pass@host:port/db)
 - COLLECTION: collection name in pgstac.items (default: "openaerialmap")
 - TILE_URL_TEMPLATE: tile URL template with {z},{x},{y},{collection} e.g.
     https://.../raster/collections/{collection}/tiles/WebMercatorQuad/
     {z}/{x}/{y}.png?assets=visual&bidx=1&bidx=2&bidx=3
 - THREADS: number of concurrent HTTP workers (default 16)
 - HTTP_TIMEOUT: request timeout seconds (default 30)
 - RETRIES: per-tile retries (default 2)
 - TEST_MODE: if set => uses small BBOX; otherwise global BBOX
 - LOG_LEVEL: the log level to use, from "DEBUG" or "INFO"
 - BATCH_FACTOR: number of concurrent tasks per thread to keep in flight (default 5)
"""

import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import dataclass
from typing import Optional, Iterable
from pathlib import Path
from urllib.parse import quote_plus

import aiohttp
import mercantile
import numpy as np
import affine
from psycopg import connect
from shapely.geometry import shape, box
from shapely.strtree import STRtree
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

    PG_DSN = f"postgresql://{quote_plus(PGUSER)}:{quote_plus(PGPASSWORD)}@{PGHOST}:{PGPORT}/{PGDATABASE}"

COLLECTION = os.getenv("COLLECTION", "openaerialmap")
TILE_URL_TEMPLATE = os.getenv(
    "TILE_URL_TEMPLATE",
    "https://api.imagery.hotosm.org/raster/collections"
    "/{collection}/tiles/WebMercatorQuad/{z}/{x}/{y}.png?assets=visual&bidx=1&bidx=2&bidx=3",
)

THREADS = int(os.getenv("THREADS", "16"))
HTTP_TIMEOUT = int(os.getenv("HTTP_TIMEOUT", "30"))
RETRIES = int(os.getenv("RETRIES", "2"))

TEST_MODE = bool(os.getenv("TEST_MODE", False))
BBOX: tuple[float, float, float, float] = (
    (-20.0, 0.0, 10.0, 30.0)
    if TEST_MODE
    else (-180.0, -85.05112878, 180.0, 85.05112878)
)

OUTPUT_PM = os.getenv("OUTPUT_PM", "/app/output/global-mosaic.pmtiles")
ERROR_LOG_FILE = Path(OUTPUT_PM).parent / "global_mosaic_error.log"
TILE_SIZE = int(os.getenv("TILE_SIZE", "256"))

ZOOM_MIN = int(os.getenv("ZOOM_MIN", "0"))
ZOOM_MAX = int(os.getenv("ZOOM_MAX", "14"))  # produce coverage 0-10; tiles 11-14

# memory / concurrency tuning
BATCH_FACTOR = int(
    os.getenv("BATCH_FACTOR", "5")
)  # number of tasks per thread to keep in flight
MAX_INFLIGHT = max(THREADS * BATCH_FACTOR, 16)
LOG_EVERY = int(os.getenv("LOG_EVERY", "500"))

# Setup main progress logger
logging.basicConfig(
    stream=sys.stdout,
    level=os.getenv("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s: %(message)s",
)
log = logging.getLogger("gen_mosaic")

# Setup separate error log (to file)
error_log = logging.getLogger("gen_mosaic.errors")
error_log.setLevel(logging.WARNING)
err_handler = logging.FileHandler(ERROR_LOG_FILE, mode="w")
err_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s: %(message)s"))
error_log.addHandler(err_handler)
error_log.propagate = False  # prevent going to stdout


@dataclass
class TileJob:
    z: int
    x: int
    y: int


def get_features() -> list[dict]:
    """
    Query PgSTAC for imagery features in BBOX (synchronous).
    Returns list of dicts: {"geometry": shapely.geometry, "url": <asset url or None>, "id": <id>}
    """
    where_bbox = ""
    params = [COLLECTION]
    where_bbox = "AND geometry && ST_MakeEnvelope(%s, %s, %s, %s, 4326)"
    params.extend(BBOX)

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
    features: list[dict] = []
    with connect(PG_DSN) as conn, conn.cursor() as cur:
        cur.execute(query, params)
        rows = cur.fetchall()

    for id_, url, geom in rows:
        if geom is None:
            continue
        try:
            geom_json = json.loads(geom)
            geom_obj = shape(geom_json)
            features.append({"geometry": geom_obj, "url": url, "id": id_})
        except Exception as e:
            log.warning(f"Failed to parse geometry for {id_}: {e}")

    log.info(f"Found {len(features)} items in pgSTAC for bbox")
    return features


def iter_tiles_for_zoom(features_tree: STRtree, z: int) -> Iterable[mercantile.Tile]:
    """
    Yield tiles at zoom z that intersect any feature in the provided spatial index.
    Iterate per zoom level, avoiding building whole list in memory.
    """
    for tile in mercantile.tiles(*BBOX, [z]):
        tile_geom = box(*mercantile.bounds(tile))
        if len(features_tree.query(tile_geom)) > 0:
            yield tile


def make_coverage_tile_for_geom(
    tile_bounds: tuple[float, float, float, float],
    geoms: list,  # list of shapely geometries
    color: tuple[int, int, int, int] = (128, 128, 128, 102),
) -> bytes:
    """
    Create a PNG tile (256x256) with translucent coverage where imagery exists,
    transparent elsewhere. Returns PNG bytes.
    """
    if not geoms:
        arr = np.zeros((TILE_SIZE, TILE_SIZE, 4), dtype=np.uint8)
        return render(arr.transpose(2, 0, 1), img_format="PNG")

    west, south, east, north = tile_bounds
    transform = affine.Affine(
        (east - west) / TILE_SIZE, 0, west, 0, (south - north) / TILE_SIZE, north
    )

    mask = features.rasterize(
        [(geom, 1) for geom in geoms],
        out_shape=(TILE_SIZE, TILE_SIZE),
        transform=transform,
        fill=0,
        all_touched=True,
        dtype="uint8",
    )

    arr = np.zeros((TILE_SIZE, TILE_SIZE, 4), dtype=np.uint8)
    r, g, b, a = color
    arr[mask == 1, 0] = r
    arr[mask == 1, 1] = g
    arr[mask == 1, 2] = b
    arr[mask == 1, 3] = a

    return render(arr.transpose(2, 0, 1), img_format="PNG")


async def fetch_tile_bytes(
    session: aiohttp.ClientSession, url: str, timeout: int, retries: int
) -> Optional[bytes]:
    """
    Fetch single tile as bytes. Return None for missing (404) or non-200.
    Retries transient network/server errors.
    """
    attempt = 0
    while attempt <= retries:
        try:
            async with session.get(url, timeout=timeout) as resp:  # type: ignore
                if resp.status == 200:
                    return await resp.read()
                if resp.status == 404:
                    log.debug(f"Tile not found (404): {url}")
                    return None
                if 500 <= resp.status < 600:
                    error_log.warning(
                        f"Server error {resp.status} for {url} (attempt {attempt + 1}/{retries})"
                    )
                else:
                    error_log.warning(f"Unexpected status {resp.status} for {url}")
                    return None
        except asyncio.CancelledError:
            raise
        except Exception as e:
            error_log.warning(
                f"Error fetching {url}: {e} (attempt {attempt + 1}/{retries})"
            )

        attempt += 1
        await asyncio.sleep(0.5 * attempt)

    error_log.error(f"Failed to fetch {url} after {retries} attempts")
    return None


def generate_mosaic() -> None:
    """
    Main entrypoint (synchronous). Queries PG, builds tile list per-zoom (streamed), and writes PMTiles.
    Uses a memory-bounded asyncio pattern to download 11-14 tiles concurrently while keeping a small window of work in memory.
    """
    features = get_features()
    if not features:
        log.warning("No features found - nothing to do.")
        return

    geoms = [f["geometry"] for f in features]
    tree = STRtree(geoms)

    # estimate total tiles (light-weight iteration)
    total_estimated_tiles = 0
    for z in range(ZOOM_MIN, ZOOM_MAX + 1):
        cnt = sum(1 for _ in iter_tiles_for_zoom(tree, z))
        total_estimated_tiles += cnt
    log.info(
        f"Estimated total tiles to render (z {ZOOM_MIN}-{ZOOM_MAX}): {total_estimated_tiles}"
    )

    header = {
        "version": 3,
        "tile_type": TileType.PNG,
        "tile_compression": Compression.NONE,
    }
    metadata = {
        "name": COLLECTION,
        "bounds": list(BBOX),
        "minzoom": ZOOM_MIN,
        "maxzoom": ZOOM_MAX,
        "description": f"Global mosaic (coverage z0-10; tiles z11-14) from {COLLECTION}",
    }

    start_time = time.time()
    processed = 0
    written = 0
    skipped = 0

    with write(OUTPUT_PM) as writer:
        # Part A: coverage tiles (z 0-10)
        for z in sorted(range(ZOOM_MIN, min(10, ZOOM_MAX) + 1)):
            log.info(f"Processing coverage zoom {z}")
            # iterate directly to avoid building large lists for higher zooms
            for tile in iter_tiles_for_zoom(tree, z):
                tile_geom = box(*mercantile.bounds(tile))
                candidate_idx = tree.query(tile_geom)
                if len(candidate_idx) == 0:
                    data = make_coverage_tile_for_geom(mercantile.bounds(tile), [])
                else:
                    covered_geoms = [tree.geometries[i] for i in candidate_idx]
                    data = make_coverage_tile_for_geom(
                        mercantile.bounds(tile), covered_geoms
                    )

                writer.write_tile(zxy_to_tileid(tile.z, tile.x, tile.y), data)
                written += 1
                processed += 1
                if processed % LOG_EVERY == 0:
                    log.info(
                        f"Processed {processed}/{total_estimated_tiles} (written={written} skipped={skipped})"
                    )

        # Part B: TiTiler tiles (z 11-14) - streaming, bounded concurrency
        download_zoom_range = [z for z in range(11, min(ZOOM_MAX, 14) + 1)]
        if download_zoom_range:
            log.info(
                f"Downloading tiles for zooms {download_zoom_range} using {THREADS} workers (max inflight={MAX_INFLIGHT})"
            )

            # create a dedicated event loop for downloads
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            async def downloads_coroutine():
                nonlocal processed, written, skipped

                connector = aiohttp.TCPConnector(limit_per_host=max(2, THREADS))
                timeout = aiohttp.ClientTimeout(total=HTTP_TIMEOUT)

                # semaphore to bound concurrent http requests + write tasks
                sem = asyncio.Semaphore(MAX_INFLIGHT)

                async with aiohttp.ClientSession(
                    connector=connector, timeout=timeout
                ) as session:

                    async def process_tile(tile: mercantile.Tile):
                        nonlocal processed, written, skipped
                        async with sem:
                            url = TILE_URL_TEMPLATE.format(
                                collection=COLLECTION, z=tile.z, x=tile.x, y=tile.y
                            )
                            data = await fetch_tile_bytes(
                                session, url, HTTP_TIMEOUT, RETRIES
                            )
                            tid = zxy_to_tileid(tile.z, tile.x, tile.y)

                            if data:
                                # write in threadpool to avoid blocking event loop
                                await loop.run_in_executor(
                                    None, writer.write_tile, tid, data
                                )
                                written += 1
                            else:
                                # fallback coverage tile generated synchronously off the event loop
                                tile_geom = box(*mercantile.bounds(tile))
                                candidate_idx = tree.query(tile_geom)
                                if len(candidate_idx) == 0:
                                    fallback = make_coverage_tile_for_geom(
                                        mercantile.bounds(tile), []
                                    )
                                else:
                                    covered_geoms = [
                                        tree.geometries[i] for i in candidate_idx
                                    ]
                                    fallback = make_coverage_tile_for_geom(
                                        mercantile.bounds(tile), covered_geoms
                                    )
                                await loop.run_in_executor(
                                    None, writer.write_tile, tid, fallback
                                )
                                written += 1

                            processed += 1
                            if processed % LOG_EVERY == 0:
                                log.info(
                                    f"Processed {processed}/{total_estimated_tiles} (written={written} skipped={skipped})"
                                )

                    # process tiles zoom-by-zoom, creating only small batches of tasks
                    for z in download_zoom_range:
                        log.info(f"Queueing download tasks for zoom {z}")
                        tasks: list[asyncio.Task] = []
                        count = 0
                        for tile in iter_tiles_for_zoom(tree, z):
                            task = asyncio.create_task(process_tile(tile))
                            tasks.append(task)
                            count += 1

                            # keep only a small window of tasks in memory
                            if len(tasks) >= MAX_INFLIGHT:
                                # wait for the first batch to complete before adding more
                                await asyncio.gather(*tasks)
                                tasks.clear()

                        # wait remaining tasks for this zoom
                        if tasks:
                            await asyncio.gather(*tasks)
                            tasks.clear()

                        log.info(f"Finished zoom {z}")

            try:
                loop.run_until_complete(downloads_coroutine())
            finally:
                loop.close()

        writer.finalize(header, metadata)

    elapsed = time.time() - start_time
    log.info(f"PMTiles archive written: {OUTPUT_PM}")
    log.info(f"Total processing time: {elapsed:.1f} s ({elapsed / 60.0:.1f} min)")
    log.info(f"Tiles processed: {processed} (written={written} skipped={skipped})")


def upload_to_s3():
    endpoint = os.getenv("S3_ENDPOINT", "s3.amazonaws.com")
    bucket = os.getenv("S3_BUCKET", "oin-hotosm-temp")
    access_key = os.getenv("S3_ACCESS_KEY")
    secret_key = os.getenv("S3_SECRET_KEY")
    region = os.getenv("S3_REGION", "us-east-1")
    pmtiles_obj_key = Path(OUTPUT_PM).name
    error_log_obj_key = Path(ERROR_LOG_FILE).name

    if not all([endpoint, bucket, access_key, secret_key]):
        log.warning("S3 upload skipped: missing required env vars.")
        return

    log.debug(f"Initialising Minio client for {endpoint}")
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

    if ERROR_LOG_FILE.exists():
        log.info(f"Uploading {ERROR_LOG_FILE} to s3://{bucket}/{error_log_obj_key}")
        try:
            client.fput_object(
                bucket,
                error_log_obj_key,
                ERROR_LOG_FILE,
                content_type="text/plain",
                metadata={"x-amz-acl": "public-read"},
            )
            log.info(f"Upload complete: s3://{bucket}/{error_log_obj_key}")
        except S3Error as e:
            log.error(f"S3 upload failed: {e}")


if __name__ == "__main__":
    if Path(OUTPUT_PM).exists():
        log.info(
            f"PMTiles archive at {OUTPUT_PM} already exists, skipping straight to upload"
        )
    else:
        log.info(f"Starting PMTiles generation (TEST_MODE={TEST_MODE})")
        generate_mosaic()

    upload_to_s3()
