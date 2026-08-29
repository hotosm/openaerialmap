"""Tilepack worker.

Reads a single RGB COG referenced by an OAM STAC item and produces an
mbtiles or pmtiles archive in S3, then patches the STAC item with the
new asset (only for canonical / default-zoom runs).

Note on formats: PMTiles generation always goes via an intermediate
MBTiles file - `go-pmtiles convert` reads an MBTiles archive and
rewrites it as a PMTiles archive. There is currently no way to
stream tiles directly into a PMTiles archive from Python, so the
MBTiles step is unavoidable with this toolchain.

When a PMTiles build is requested, both the PMTiles and the
intermediate MBTiles are uploaded to S3 and registered as STAC
assets, since the MBTiles is already built at that point.

The worker is invoked as a one-shot Kubernetes Job by the tilepack-api
Go service. All inputs come from environment variables - there is no
network input from end users, so no parsing of untrusted data here.

Environment variables:
    STAC_ITEM_ID        The STAC item id (validated by the API).
    FORMAT              "mbtiles" or "pmtiles".
    COG_URL             Source COG URL (already resolved from STAC).
    OUTPUT_KEY          S3 key to write the final archive to.
    LOCK_KEY            S3 key of the lock object to delete on exit.
    MIN_ZOOM            Integer; 0 is "use default".
    MAX_ZOOM            Integer; 0 is "derive from GSD".
    CANONICAL           "true" if this run should patch STAC.
    GSD                 Source ground sample distance, metres/pixel.
                        Used to derive MAX_ZOOM when not provided.
    S3_BUCKET           Destination bucket.
    S3_PUBLIC_BASE_URL  Public URL prefix for the STAC asset href.
    INTERNAL_BASE_URL   ClusterIP URL of the tilepack-api pod.
    INTERNAL_TOKEN      Shared token for the internal asset endpoint.
"""

from __future__ import annotations

import math
import os
import shutil
import signal
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import boto3
import botocore.config
import botocore.exceptions
import httpx
import rasterio.crs
from rio_tiler.errors import TileOutsideBounds
from rio_tiler.io import Reader

MEDIA_TYPES = {
    "mbtiles": "application/vnd.mbtiles",
    "pmtiles": "application/vnd.pmtiles",
}

# ~10x smaller than PNG and, unlike JPEG, keeps alpha. MBTILES_FORMAT must
# track TILE_FORMAT: `pmtiles convert` reads that row to set the tile type.
TILE_FORMAT = "WEBP"
MBTILES_FORMAT = "webp"
WEBP_QUALITY = 70  # 34.15 dB, above the JPEG q75 the catalogue accepts

# Two ceilings, both aborting before anything reaches S3: bytes-per-tile
# spans 15-78 KiB, so tile count is a poor proxy for disk.
MAX_TILE_COUNT = int(os.environ.get("MAX_TILE_COUNT") or 150_000)
# Peak disk is ~2x this: pmtiles holds the converted copy too.
MAX_ENCODED_BYTES = int(os.environ.get("MAX_ENCODED_BYTES") or 4 * 1024**3)

# Number of concurrent tile-read threads.  The work is ~85% I/O-bound
# (HTTP range reads to S3), so higher concurrency scales near-linearly
# until network bandwidth saturates.
TILE_WORKERS = 24

# Set on a signal or a tripped cap, so queued tiles retire cheaply.
_stop_rendering = threading.Event()

TERMINATED_EXIT_CODE = 143  # 128 + SIGTERM


class Terminated(Exception):
    """Termination signal. An Exception, not SystemExit, so the existing
    ``except Exception`` handlers still delete the partial archive."""


def _install_signal_handlers() -> None:
    """Trap SIGTERM/SIGINT so the S3 lock is released on the way out.

    The worker is PID 1, where an untrapped SIGTERM is ignored outright.
    """

    def handle(signum, _frame):
        # Set first, so tile threads retire while the exception unwinds.
        _stop_rendering.set()
        raise Terminated(f"received signal {signal.Signals(signum).name}")

    signal.signal(signal.SIGTERM, handle)
    signal.signal(signal.SIGINT, handle)


# Thread-local storage for reusing GDAL dataset handles.  rio-tiler's
# Reader is not thread-safe, but each thread can safely keep its own
# open Reader for the duration of the run.  This avoids the ~5ms cost
# of a fresh GDAL Open + VSICurl header fetch on every single tile.
_thread_local = threading.local()


def env(key: str, default: str | None = None) -> str:
    value = os.environ.get(key, default)
    if value is None:
        raise SystemExit(f"missing required env var: {key}")
    return value


def derive_max_zoom_from_gsd(gsd_m: float) -> int:
    """Pick a sensible max zoom from ground sample distance.

    Web mercator pixel size at equator is roughly
        156543.03 / 2**z
    metres/pixel. Round to the nearest integer z that matches the
    source GSD, clamp to [0, 22] to avoid absurd outputs.
    """
    if gsd_m <= 0:
        return 18
    z = round(math.log2(156543.03 / gsd_m))
    return max(0, min(22, z))


def lonlat_to_tile(lon: float, lat: float, z: int) -> tuple[int, int]:
    n = 1 << z
    x = int((lon + 180.0) / 360.0 * n)
    lat_rad = math.radians(max(min(lat, 85.05112878), -85.05112878))
    y = int(
        (1.0 - math.log(math.tan(lat_rad) + 1 / math.cos(lat_rad)) / math.pi) / 2.0 * n
    )
    return max(0, min(n - 1, x)), max(0, min(n - 1, y))


def tile_ranges(bounds: tuple[float, float, float, float], min_z: int, max_z: int):
    """Yield (z, x_min, x_max, y_min, y_max) per zoom."""
    w, s, e, n = bounds
    for z in range(min_z, max_z + 1):
        x_min, y_min = lonlat_to_tile(w, n, z)
        x_max, y_max = lonlat_to_tile(e, s, z)
        yield z, x_min, x_max, y_min, y_max


def estimate_tile_count(bounds, min_z, max_z) -> int:
    total = 0
    for _, xmin, xmax, ymin, ymax in tile_ranges(bounds, min_z, max_z):
        total += (xmax - xmin + 1) * (ymax - ymin + 1)
    return total


def patch_item_asset(
    internal_base: str,
    internal_token: str,
    item_id: str,
    asset_key: str,
    asset: dict,
) -> None:
    """POST the new asset to the tilepack-api internal endpoint."""
    url = f"{internal_base.rstrip('/')}/internal/items/{item_id}/assets"
    r = httpx.post(
        url,
        json={"key": asset_key, "asset": asset},
        headers={"Authorization": f"Bearer {internal_token}"},
        timeout=30,
    )
    r.raise_for_status()


def _get_thread_reader(cog_url: str) -> Reader:
    """Return a thread-local Reader, opening one if needed.

    Each thread keeps a single open Reader for the COG URL.  This
    eliminates redundant GDAL Open calls (~5ms each) while staying
    safe - rio-tiler Readers are not shared across threads.
    """
    reader = getattr(_thread_local, "reader", None)
    if reader is None:
        reader = Reader(cog_url)
        reader.__enter__()
        _thread_local.reader = reader
    return reader


def _close_thread_readers(pool: ThreadPoolExecutor, cog_url: str) -> None:
    """Close all thread-local Readers before the pool shuts down."""

    def _close():
        reader = getattr(_thread_local, "reader", None)
        if reader is not None:
            try:
                reader.__exit__(None, None, None)
            except Exception:  # noqa: BLE001, S110
                pass
            _thread_local.reader = None

    futures = [pool.submit(_close) for _ in range(TILE_WORKERS)]
    for f in futures:
        f.result()


def _render_tile(cog_url: str, x: int, y: int, z: int) -> tuple[str, bytes | None]:
    """Fetch a single XYZ tile and return status + encoded bytes.

    Uses a thread-local Reader so each thread reuses its GDAL dataset
    handle across tiles, avoiding repeated open/close overhead.
    """
    if _stop_rendering.is_set():
        return "cancelled", None
    try:
        cog = _get_thread_reader(cog_url)
        img = cog.tile(x, y, z)
    except TileOutsideBounds:
        return "outside", None
    except Exception:  # noqa: BLE001
        return "failed", None
    # add_mask keeps alpha, so footprint padding stays transparent.
    return "ok", img.render(img_format=TILE_FORMAT, add_mask=True, quality=WEBP_QUALITY)


def generate_mbtiles(
    cog_url: str,
    out_path: Path,
    min_zoom: int,
    max_zoom: int,
) -> None:
    """Render the COG into an MBTiles archive over its native bbox."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        out_path.unlink()

    with Reader(cog_url) as cog:
        bounds = cog.get_geographic_bounds(
            rasterio.crs.CRS.from_epsg(4326)
        )  # (w, s, e, n)

    total = estimate_tile_count(bounds, min_zoom, max_zoom)
    print(
        f"tile plan: z{min_zoom}..z{max_zoom}, ~{total} tiles, bounds={bounds}",
        flush=True,
    )
    if total > MAX_TILE_COUNT:
        raise SystemExit(
            f"tile count {total} exceeds MAX_TILE_COUNT={MAX_TILE_COUNT}; "
            f"rerun with a lower max_zoom"
        )

    conn = sqlite3.connect(out_path)
    should_cleanup = False
    try:
        cur = conn.cursor()
        cur.executescript(
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
        cur.execute("INSERT INTO metadata VALUES (?, ?)", ("name", out_path.stem))
        cur.execute("INSERT INTO metadata VALUES (?, ?)", ("format", MBTILES_FORMAT))
        cur.execute(
            "INSERT INTO metadata VALUES (?, ?)",
            ("bounds", ",".join(str(b) for b in bounds)),
        )
        cur.execute("INSERT INTO metadata VALUES (?, ?)", ("minzoom", str(min_zoom)))
        cur.execute("INSERT INTO metadata VALUES (?, ?)", ("maxzoom", str(max_zoom)))

        encoded_bytes = 0
        pool = ThreadPoolExecutor(max_workers=TILE_WORKERS)
        # Cleared only on full success, so every abnormal exit cancels.
        aborting = True
        try:
            for z, xmin, xmax, ymin, ymax in tile_ranges(bounds, min_zoom, max_zoom):
                start = time.monotonic()
                futures = {}
                for x in range(xmin, xmax + 1):
                    for y in range(ymin, ymax + 1):
                        fut = pool.submit(_render_tile, cog_url, x, y, z)
                        futures[fut] = (x, y)
                written = 0
                outside = 0
                for fut in as_completed(futures):
                    x, y = futures[fut]
                    status, tile = fut.result()
                    if status == "outside":
                        outside += 1
                        continue
                    if status == "cancelled":
                        # Stop draining rather than insert a NULL blob.
                        raise Terminated("tile generation cancelled")
                    if status == "failed":
                        status, tile = _render_tile(cog_url, x, y, z)
                        if status == "outside":
                            outside += 1
                            continue
                        if status == "cancelled":
                            raise Terminated("tile generation cancelled")
                        if status == "failed":
                            should_cleanup = True
                            raise RuntimeError(
                                f"unexpected tile render failure for z={z}, "
                                f"x={x}, y={y}"
                            )
                    encoded_bytes += len(tile)
                    if encoded_bytes > MAX_ENCODED_BYTES:
                        should_cleanup = True
                        raise SystemExit(
                            f"encoded tile bytes {encoded_bytes} exceed "
                            f"MAX_ENCODED_BYTES={MAX_ENCODED_BYTES} at z{z}; "
                            f"rerun with a lower max_zoom"
                        )
                    tms_y = (1 << z) - 1 - y
                    cur.execute(
                        "INSERT OR REPLACE INTO tiles VALUES (?, ?, ?, ?)",
                        (z, x, tms_y, tile),
                    )
                    written += 1
                conn.commit()
                msg = (
                    f"z{z}: {written}/{len(futures)} tiles in "
                    f"{time.monotonic() - start:.1f}s, "
                    f"{encoded_bytes / 1024**2:.1f} MiB total"
                )
                if outside > 0:
                    msg += f", outside={outside}"
                print(msg, flush=True)
            _close_thread_readers(pool, cog_url)
            aborting = False
        finally:
            if aborting:
                # A level is queued at once, so waiting would render a
                # failed run to completion and pin every tile - an OOM.
                _stop_rendering.set()
                pool.shutdown(wait=False, cancel_futures=True)
            else:
                pool.shutdown(wait=True)
    except Exception:
        should_cleanup = True
        raise
    finally:
        try:
            conn.close()
        finally:
            if should_cleanup and out_path.exists():
                out_path.unlink(missing_ok=True)


def convert_to_pmtiles(mbtiles: Path, pmtiles: Path) -> None:
    subprocess.run(
        ["pmtiles", "convert", str(mbtiles), str(pmtiles)],
        check=True,
    )


def _patch_asset(
    internal_base: str,
    internal_token: str,
    public_base: str,
    item_id: str,
    key: str,
    fmt: str,
    min_zoom: int,
    max_zoom: int,
    file_size: int = 0,
) -> None:
    """Register a tilepack asset on the STAC item."""
    href = f"{public_base.rstrip('/')}/{key}"
    asset = {
        "href": href,
        "type": MEDIA_TYPES[fmt],
        "roles": ["tiles"],
        "title": f"{fmt.upper()} archive",
        "proj:code": 3857,
        "minzoom": min_zoom,
        "maxzoom": max_zoom,
    }
    if file_size > 0:
        asset["file:size"] = file_size
    patch_item_asset(
        internal_base,
        internal_token,
        item_id,
        asset_key=fmt,
        asset=asset,
    )
    print(
        f"callback patch succeeded: item_id={item_id} asset={fmt} key={key}",
        flush=True,
    )


def _s3_client():
    """Create an S3 client, using path-style addressing for non-AWS endpoints."""
    kwargs = {}
    if os.environ.get("AWS_ENDPOINT_URL"):
        kwargs["config"] = botocore.config.Config(s3={"addressing_style": "path"})
    return boto3.client("s3", **kwargs)


def s3_object_size(bucket: str, key: str) -> int | None:
    """Size of the key in bytes, or None if it does not exist."""
    try:
        return _s3_client().head_object(Bucket=bucket, Key=key)["ContentLength"]
    except botocore.exceptions.ClientError:
        return None


def download(bucket: str, key: str, path: Path) -> None:
    _s3_client().download_file(Bucket=bucket, Key=key, Filename=str(path))


def upload(bucket: str, key: str, path: Path, fmt: str) -> None:
    extra = {"ContentType": MEDIA_TYPES[fmt]}
    # S3-compatible stores need not implement ACL authorization, and RustFS
    # rejects a canned ACL with InvalidArgument rather than ignoring it. Those
    # buckets are made anonymously readable by bucket policy instead, so the ACL
    # is redundant there; on real AWS it is what makes the tilepack public.
    if not os.environ.get("AWS_ENDPOINT_URL"):
        extra["ACL"] = "public-read"
    _s3_client().upload_file(
        Filename=str(path),
        Bucket=bucket,
        Key=key,
        ExtraArgs=extra,
    )


def delete_lock(bucket: str, lock_key: str) -> None:
    try:
        _s3_client().delete_object(Bucket=bucket, Key=lock_key)
    except Exception as exc:  # noqa: BLE001
        print(f"warning: could not delete lock {lock_key}: {exc}", file=sys.stderr)


def main() -> int:
    _install_signal_handlers()

    # Read before anything that can fail, so the lock is always released.
    bucket = env("S3_BUCKET", "oin-hotosm-temp")
    lock_key = env("LOCK_KEY")

    item_id = fmt = "unknown"  # for the summary line in the finally
    start = time.monotonic()

    exit_code = 1
    try:
        item_id = env("STAC_ITEM_ID")
        fmt = env("FORMAT")
        cog_url = env("COG_URL")
        output_key = env("OUTPUT_KEY")
        min_zoom = int(env("MIN_ZOOM", "0"))
        max_zoom = int(env("MAX_ZOOM", "0"))
        canonical = env("CANONICAL", "false").lower() == "true"
        gsd = float(env("GSD", "0") or "0")

        public_base = env(
            "S3_PUBLIC_BASE_URL",
            "https://oin-hotosm-temp.s3.us-east-1.amazonaws.com",
        )
        internal_base = env("INTERNAL_BASE_URL")
        internal_token = env("INTERNAL_TOKEN")

        print(
            f"worker run start: item_id={item_id} format={fmt} canonical={canonical} "
            f"min_zoom={min_zoom} max_zoom={max_zoom} output_key={output_key}",
            flush=True,
        )

        if min_zoom == 0 and max_zoom == 0:
            # Default range: from z0 up to whatever the source GSD
            # supports (bounded by derive_max_zoom_from_gsd).
            max_zoom = derive_max_zoom_from_gsd(gsd)
            min_zoom = 0
            print(f"derived zoom range from gsd={gsd}: {min_zoom}..{max_zoom}")

        workdir = Path(tempfile.mkdtemp(prefix="tilepack-"))
        try:
            mbtiles_path = workdir / f"{item_id}.mbtiles"

            def register(key: str, fmt_name: str, path: Path) -> None:
                """Record an archive already in S3 as a STAC asset."""
                if not canonical:
                    return
                try:
                    _patch_asset(
                        internal_base,
                        internal_token,
                        public_base,
                        item_id,
                        key,
                        fmt_name,
                        min_zoom,
                        max_zoom,
                        path.stat().st_size,
                    )
                except Exception as exc:
                    print(
                        f"callback patch failed: item_id={item_id} "
                        f"asset={fmt_name} key={key} err={exc}",
                        file=sys.stderr,
                        flush=True,
                    )
                    raise

            def store(key: str, fmt_name: str, path: Path) -> None:
                upload(bucket, key, path, fmt_name)
                print(f"uploaded s3://{bucket}/{key}", flush=True)

            # Every archive reaches S3 before any callback runs: a failed
            # callback must not leave the requested format unbuilt.
            if fmt == "mbtiles":
                generate_mbtiles(cog_url, mbtiles_path, min_zoom, max_zoom)
                store(output_key, "mbtiles", mbtiles_path)
                register(output_key, "mbtiles", mbtiles_path)
            elif fmt == "pmtiles":
                # Reuse an existing mbtiles rather than re-rendering the COG.
                mbtiles_key = output_key.replace(".pmtiles", ".mbtiles")
                existing = s3_object_size(bucket, mbtiles_key)
                if existing is not None:
                    # Archives predating this cap can exceed ephemeral
                    # storage, and conversion needs room for a second copy.
                    if existing > MAX_ENCODED_BYTES:
                        raise SystemExit(
                            f"existing s3://{bucket}/{mbtiles_key} is {existing} bytes, "
                            f"over MAX_ENCODED_BYTES={MAX_ENCODED_BYTES}; "
                            f"rebuild the mbtiles first"
                        )
                    print(
                        f"found existing s3://{bucket}/{mbtiles_key} "
                        f"({existing / 1024**2:.1f} MiB), skipping tile generation"
                    )
                    download(bucket, mbtiles_key, mbtiles_path)
                else:
                    generate_mbtiles(cog_url, mbtiles_path, min_zoom, max_zoom)
                    store(mbtiles_key, "mbtiles", mbtiles_path)

                pmtiles_path = workdir / f"{item_id}.pmtiles"
                convert_to_pmtiles(mbtiles_path, pmtiles_path)
                store(output_key, "pmtiles", pmtiles_path)
                register(output_key, "pmtiles", pmtiles_path)
                register(mbtiles_key, "mbtiles", mbtiles_path)
            else:
                raise SystemExit(f"unknown format: {fmt}")
        finally:
            shutil.rmtree(workdir, ignore_errors=True)
        exit_code = 0
    except Terminated as exc:
        # Not re-raised: reaching the finally is what releases the lock.
        exit_code = TERMINATED_EXIT_CODE
        print(
            f"worker terminated: item_id={item_id} format={fmt} reason={exc}",
            file=sys.stderr,
            flush=True,
        )
    except SystemExit as exc:
        # Raised by env() and by the caps. Re-raised so the finally runs.
        exit_code = exc.code if isinstance(exc.code, int) else 1
        raise
    except Exception:
        exit_code = 1
        raise
    finally:
        delete_lock(bucket, lock_key)
        print(
            f"worker run end: item_id={item_id} format={fmt} exit_code={exit_code} "
            f"duration_s={time.monotonic() - start:.1f}",
            flush=True,
        )

    return exit_code


if __name__ == "__main__":
    code = main()
    if code == TERMINATED_EXIT_CODE:
        # Lock already released. Skip atexit, which joins pool threads and
        # blocks ~30s on an in-flight COG read - past the grace period.
        sys.stdout.flush()
        sys.stderr.flush()
        os._exit(code)
    raise SystemExit(code)
