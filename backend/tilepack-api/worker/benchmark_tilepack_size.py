"""Benchmark tilepack zoom and transparent-tile policies on a real COG.

This is deliberately separate from the production worker.  It renders every
tile through the worker's rio-tiler path once, then materializes archives for
the distinct zoom policies so archive byte counts are exact without repeatedly
reading the source imagery.  It renders PNG, the encoding in use when the
recorded results were measured; the worker now writes WebP.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import platform
import shutil
import sqlite3
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any

import numpy
import rasterio
import rasterio.crs
import rio_tiler
from rasterio.io import MemoryFile
from rasterio.transform import from_bounds
from rasterio.warp import Resampling, reproject
from rio_tiler.errors import TileOutsideBounds
from rio_tiler.io import Reader

import generate

MERCATOR_MAX_LATITUDE = 85.05112878
MERCATOR_EQUATOR_RESOLUTION = 156543.03


def clamp_zoom(value: int) -> int:
    return max(0, min(22, value))


def zoom_policies(
    gsd_m: float, latitude: float
) -> tuple[dict[str, int], dict[str, float]]:
    latitude = max(-MERCATOR_MAX_LATITUDE, min(MERCATOR_MAX_LATITUDE, latitude))
    equator_float = math.log2(MERCATOR_EQUATOR_RESOLUTION / gsd_m)
    latitude_float = math.log2(
        MERCATOR_EQUATOR_RESOLUTION * math.cos(math.radians(latitude)) / gsd_m
    )
    policies = {
        "equator_round": clamp_zoom(round(equator_float)),
        "latitude_round": clamp_zoom(round(latitude_float)),
        "latitude_floor": clamp_zoom(math.floor(latitude_float)),
    }
    return policies, {
        "equator": equator_float,
        "latitude_corrected": latitude_float,
    }


def create_archive(path: Path, name: str, bounds: tuple[float, ...], max_zoom: int):
    path.unlink(missing_ok=True)
    conn = sqlite3.connect(path)
    conn.executescript(
        """
        CREATE TABLE metadata (name text, value text);
        CREATE TABLE tiles (
            zoom_level integer,
            tile_column integer,
            tile_row integer,
            tile_data blob
        );
        CREATE UNIQUE INDEX tile_index ON tiles
            (zoom_level, tile_column, tile_row);
        """
    )
    metadata = {
        "name": name,
        "format": "png",
        "bounds": ",".join(str(value) for value in bounds),
        "minzoom": "0",
        "maxzoom": str(max_zoom),
    }
    conn.executemany("INSERT INTO metadata VALUES (?, ?)", metadata.items())
    conn.commit()
    return conn


def render_tile(cog_url: str, x: int, y: int, z: int):
    started = time.perf_counter()
    try:
        image = generate._get_thread_reader(cog_url).tile(x, y, z)
    except TileOutsideBounds:
        return "outside", None, 0.0

    mask = image.mask
    empty = not mask.any()
    png = image.render(img_format="PNG", add_mask=True)
    return ("empty" if empty else "ok"), png, time.perf_counter() - started


# Tiles submitted to the pool per batch. Bounds the executor work queue and
# the completed-but-uninserted PNG bytes held in memory at once.
BATCH_SIZE = 2_000


def tile_batches(xmin: int, xmax: int, ymin: int, ymax: int, size: int):
    """Yield (x, y) pairs for one zoom level in fixed-size batches."""
    batch = []
    for x in range(xmin, xmax + 1):
        for y in range(ymin, ymax + 1):
            batch.append((x, y))
            if len(batch) == size:
                yield batch
                batch = []
    if batch:
        yield batch


def render_archives(
    source: str,
    output_dir: Path,
    name: str,
    bounds: tuple[float, ...],
    max_zoom: int,
    workers: int,
) -> tuple[dict[str, Path], list[dict[str, Any]]]:
    paths = {
        "all": output_dir / f"{name}_z0-{max_zoom}_all.mbtiles",
        "skip_empty": output_dir / f"{name}_z0-{max_zoom}_skip-empty.mbtiles",
    }
    connections = {
        policy: create_archive(path, f"{name}-{policy}", bounds, max_zoom)
        for policy, path in paths.items()
    }
    per_zoom = []
    pool = ThreadPoolExecutor(max_workers=workers)
    generate.TILE_WORKERS = workers
    try:
        for z, xmin, xmax, ymin, ymax in generate.tile_ranges(bounds, 0, max_zoom):
            started = time.perf_counter()
            counts = {"planned": 0, "outside": 0, "empty": 0, "ok": 0}
            encoded_bytes = {"all": 0, "skip_empty": 0}
            aggregate_tile_seconds = 0.0
            # A whole zoom level at once queues every tile as a future and
            # buffers the bytes until the insert loop catches up.
            for batch in tile_batches(xmin, xmax, ymin, ymax, BATCH_SIZE):
                futures = {
                    pool.submit(render_tile, source, x, y, z): (x, y) for x, y in batch
                }
                counts["planned"] += len(futures)
                for future in as_completed(futures):
                    x, y = futures[future]
                    status, png, tile_seconds = future.result()
                    counts[status] += 1
                    aggregate_tile_seconds += tile_seconds
                    if status == "outside":
                        continue
                    assert png is not None
                    tms_y = (1 << z) - 1 - y
                    connections["all"].execute(
                        "INSERT INTO tiles VALUES (?, ?, ?, ?)", (z, x, tms_y, png)
                    )
                    encoded_bytes["all"] += len(png)
                    if status != "empty":
                        connections["skip_empty"].execute(
                            "INSERT INTO tiles VALUES (?, ?, ?, ?)", (z, x, tms_y, png)
                        )
                        encoded_bytes["skip_empty"] += len(png)
                del futures
            for connection in connections.values():
                connection.commit()
            row = {
                "zoom": z,
                **counts,
                "encoded_bytes_all": encoded_bytes["all"],
                "encoded_bytes_skip_empty": encoded_bytes["skip_empty"],
                "aggregate_tile_seconds": aggregate_tile_seconds,
                "wall_seconds": time.perf_counter() - started,
            }
            per_zoom.append(row)
            print(json.dumps(row), flush=True)
        generate._close_thread_readers(pool, source)
    finally:
        pool.shutdown(wait=True)
        for connection in connections.values():
            connection.close()
    return paths, per_zoom


def subset_archive(
    source: Path,
    destination: Path,
    name: str,
    bounds: tuple[float, ...],
    max_zoom: int,
) -> None:
    conn = create_archive(destination, name, bounds, max_zoom)
    try:
        conn.execute("ATTACH DATABASE ? AS source", (str(source),))
        conn.execute(
            """
            INSERT INTO tiles
            SELECT zoom_level, tile_column, tile_row, tile_data
            FROM source.tiles
            WHERE zoom_level <= ?
            ORDER BY zoom_level, tile_column, tile_row
            """,
            (max_zoom,),
        )
        conn.commit()
        conn.execute("DETACH DATABASE source")
    finally:
        conn.close()


def archive_stats(path: Path) -> dict[str, int]:
    with sqlite3.connect(path) as conn:
        tile_count, tile_bytes = conn.execute(
            "SELECT COUNT(*), COALESCE(SUM(LENGTH(tile_data)), 0) FROM tiles"
        ).fetchone()
    return {
        "archive_bytes": path.stat().st_size,
        "tile_count": tile_count,
        "tile_data_bytes": tile_bytes,
    }


def decode_png(data: bytes) -> numpy.ndarray:
    with MemoryFile(data) as memory_file, memory_file.open() as dataset:
        return dataset.read()


def write_png(path: Path, array: numpy.ndarray) -> None:
    profile = {
        "driver": "PNG",
        "width": array.shape[2],
        "height": array.shape[1],
        "count": array.shape[0],
        "dtype": array.dtype,
    }
    with rasterio.open(path, "w", **profile) as dataset:
        dataset.write(array)


def upscale_bilinear(array: numpy.ndarray, size: int = 256) -> numpy.ndarray:
    destination = numpy.zeros((array.shape[0], size, size), dtype=array.dtype)
    reproject(
        source=array,
        destination=destination,
        src_transform=from_bounds(0, 0, 1, 1, array.shape[2], array.shape[1]),
        src_crs="EPSG:3857",
        dst_transform=from_bounds(0, 0, 1, 1, size, size),
        dst_crs="EPSG:3857",
        resampling=Resampling.bilinear,
    )
    return destination


def quality_pair(
    archive: Path,
    output_dir: Path,
    name: str,
    round_zoom: int,
    floor_zoom: int,
) -> dict[str, Any] | None:
    if round_zoom != floor_zoom + 1:
        return None

    best = None
    with sqlite3.connect(archive) as conn:
        rows = conn.execute(
            "SELECT tile_column, tile_row, tile_data FROM tiles WHERE zoom_level = ?",
            (round_zoom,),
        )
        for x, tms_y, data in rows:
            array = decode_png(data)
            alpha = array[3] if array.shape[0] >= 4 else numpy.full((256, 256), 255)
            opaque_fraction = float(numpy.count_nonzero(alpha == 255) / alpha.size)
            if opaque_fraction < 0.95:
                continue
            gray = array[:3].astype(numpy.float32).mean(axis=0)
            detail = float(
                numpy.abs(numpy.diff(gray, axis=0)).mean()
                + numpy.abs(numpy.diff(gray, axis=1)).mean()
            )
            if best is None or detail > best[0]:
                best = (detail, x, tms_y, array)
        if best is None:
            return None

        detail, x, tms_y, fine = best
        xyz_y = (1 << round_zoom) - 1 - tms_y
        parent_x = x // 2
        parent_y = xyz_y // 2
        parent_tms_y = (1 << floor_zoom) - 1 - parent_y
        parent_data = conn.execute(
            """
            SELECT tile_data FROM tiles
            WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?
            """,
            (floor_zoom, parent_x, parent_tms_y),
        ).fetchone()[0]

    parent = decode_png(parent_data)
    x_offset = (x % 2) * 128
    y_offset = (xyz_y % 2) * 128
    coarse = upscale_bilinear(
        parent[:, y_offset : y_offset + 128, x_offset : x_offset + 128]
    )
    fine_path = output_dir / f"{name}_round-z{round_zoom}.png"
    coarse_path = output_dir / f"{name}_floor-z{floor_zoom}-overscaled.png"
    write_png(fine_path, fine)
    write_png(coarse_path, coarse)

    if fine.shape[0] >= 4 and coarse.shape[0] >= 4:
        valid = (fine[3] == 255) & (coarse[3] == 255)
    else:
        valid = numpy.ones((256, 256), dtype=bool)
    difference = fine[:3, valid].astype(numpy.float64) - coarse[:3, valid].astype(
        numpy.float64
    )
    mse = float(numpy.square(difference).mean())
    # null, not inf: the result is serialised with allow_nan=False, and an
    # identical tile has no finite PSNR to report.
    psnr = None if mse == 0 else 10 * math.log10((255**2) / mse)
    return {
        "detail_score": detail,
        "fine_tile_xyz": [round_zoom, x, xyz_y],
        "round_image": str(fine_path),
        "floor_overscaled_image": str(coarse_path),
        "opaque_comparison_pixels": int(valid.sum()),
        "psnr_db": psnr,
    }


# Order-of-magnitude check for the disk preflight only, from the z22 sample.
PREFLIGHT_BYTES_PER_TILE = 71 * 1024


def preflight(args, bounds, policies: dict[str, int], render_max_zoom: int) -> int:
    """Report the render plan and refuse obviously oversized runs.

    The benchmark writes one archive per (zoom policy, empty policy) pair,
    and another set again when converting to PMTiles, so its disk footprint
    is a multiple of the production worker's.
    """
    planned = generate.estimate_tile_count(bounds, 0, render_max_zoom)
    archive_count = len(set(policies.values())) * 2
    if args.pmtiles_cli:
        archive_count *= 2
    estimate = planned * PREFLIGHT_BYTES_PER_TILE * archive_count
    free = shutil.disk_usage(args.output_dir).free
    print(
        f"preflight: {planned} tiles to z{render_max_zoom}, {archive_count} archives, "
        f"~{estimate / 1024**3:.1f} GiB estimated, {free / 1024**3:.1f} GiB free",
        flush=True,
    )
    if planned > args.max_tiles:
        print(
            f"refusing: {planned} tiles exceeds --max-tiles={args.max_tiles}",
            file=sys.stderr,
        )
        return 1
    if estimate > free and not args.skip_preflight:
        print(
            "refusing: estimated output exceeds free space; pass "
            "--skip-preflight to override",
            file=sys.stderr,
        )
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source")
    parser.add_argument("--name", required=True)
    parser.add_argument("--gsd", required=True, type=float)
    parser.add_argument("--output-dir", required=True, type=Path)
    parser.add_argument("--workers", type=int, default=24)
    parser.add_argument("--pmtiles-cli", type=Path)
    parser.add_argument(
        "--max-tiles",
        type=int,
        default=generate.MAX_TILE_COUNT,
        help="abort if the render plan exceeds this many tiles",
    )
    parser.add_argument(
        "--skip-preflight",
        action="store_true",
        help="run even if the disk estimate exceeds free space",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    with Reader(args.source) as cog:
        bounds = tuple(cog.get_geographic_bounds(rasterio.crs.CRS.from_epsg(4326)))
    center_latitude = (bounds[1] + bounds[3]) / 2
    policies, zoom_values = zoom_policies(args.gsd, center_latitude)
    render_max_zoom = max(policies.values())
    if preflight(args, bounds, policies, render_max_zoom) != 0:
        return 1
    started = time.perf_counter()
    highest_paths, per_zoom = render_archives(
        args.source,
        args.output_dir,
        args.name,
        bounds,
        render_max_zoom,
        args.workers,
    )

    archive_paths: dict[int, dict[str, Path]] = {render_max_zoom: highest_paths}
    for max_zoom in sorted(set(policies.values())):
        if max_zoom == render_max_zoom:
            continue
        archive_paths[max_zoom] = {}
        for empty_policy, source_path in highest_paths.items():
            destination = (
                args.output_dir
                / f"{args.name}_z0-{max_zoom}_{empty_policy.replace('_', '-')}.mbtiles"
            )
            subset_archive(
                source_path,
                destination,
                f"{args.name}-{empty_policy}",
                bounds,
                max_zoom,
            )
            archive_paths[max_zoom][empty_policy] = destination

    archives: dict[str, Any] = {}
    for max_zoom, empty_paths in archive_paths.items():
        for empty_policy, mbtiles_path in empty_paths.items():
            key = f"z{max_zoom}_{empty_policy}"
            entry: dict[str, Any] = {
                "max_zoom": max_zoom,
                "empty_policy": empty_policy,
                "mbtiles": str(mbtiles_path),
                **archive_stats(mbtiles_path),
            }
            if args.pmtiles_cli:
                pmtiles_path = mbtiles_path.with_suffix(".pmtiles")
                pmtiles_path.unlink(missing_ok=True)
                subprocess.run(
                    [
                        str(args.pmtiles_cli),
                        "convert",
                        str(mbtiles_path),
                        str(pmtiles_path),
                    ],
                    check=True,
                )
                subprocess.run(
                    [str(args.pmtiles_cli), "verify", str(pmtiles_path)], check=True
                )
                entry["pmtiles"] = str(pmtiles_path)
                entry["pmtiles_bytes"] = pmtiles_path.stat().st_size
            archives[key] = entry

    round_zoom = policies["latitude_round"]
    floor_zoom = policies["latitude_floor"]
    quality = quality_pair(
        archive_paths[round_zoom]["all"],
        args.output_dir,
        args.name,
        round_zoom,
        floor_zoom,
    )
    result = {
        "scene": args.name,
        "source": args.source,
        "gsd_m": args.gsd,
        "bounds": bounds,
        "center_latitude": center_latitude,
        "zoom_float": zoom_values,
        "policies": policies,
        "workers": args.workers,
        "environment": {
            "python": platform.python_version(),
            "cpu_count": os.cpu_count(),
            "rasterio": rasterio.__version__,
            "rio_tiler": rio_tiler.__version__,
        },
        "per_zoom": per_zoom,
        "archives": archives,
        "quality": quality,
        "total_wall_seconds": time.perf_counter() - started,
    }
    result_path = args.output_dir / f"{args.name}.json"
    result_path.write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    print(f"wrote {result_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
