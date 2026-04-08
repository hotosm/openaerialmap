"""Tilepack worker.

Reads a single RGB COG referenced by an OAM STAC item and produces an
mbtiles or pmtiles archive in S3, then patches the STAC item with the
new asset (only for canonical / default-zoom runs).

Note on formats: PMTiles generation always goes via an intermediate
MBTiles file — `go-pmtiles convert` reads an MBTiles archive and
rewrites it as a PMTiles archive. There is currently no way to
stream tiles directly into a PMTiles archive from Python, so the
MBTiles step is unavoidable with this toolchain.

TODO: when a PMTiles build is requested, we currently throw the
intermediate MBTiles file away. If S3 storage ever stops being a
concern we could upload both in the same run for ~zero extra work,
so a single canonical request gives downstream consumers both
formats. PMTiles is much more useful in practice (range-readable
over HTTPS, no server needed), so for now we default to generating
MBTiles on-demand only — that is, only when the caller explicitly
asks for `format=mbtiles`.

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
import sqlite3
import subprocess
import sys
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import boto3
import httpx
from rio_tiler.errors import TileOutsideBounds
from rio_tiler.io import Reader

# Hard ceiling on the total number of tiles any single run may
# generate. With 256x256 PNGs this bounds worst-case runtime and
# output file size. If exceeded the worker exits before touching S3
# and tells the caller (via logs) to pass a lower max_zoom.
MAX_TILE_COUNT = 500_000

# Number of concurrent tile reads. COG range reads are IO-bound so
# modest parallelism is a significant win without hammering GDAL's
# internal state (rio-tiler opens a Reader per call inside workers).
TILE_WORKERS = 8


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
    z = int(round(math.log2(156543.03 / gsd_m)))
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


def _render_tile(cog_url: str, x: int, y: int, z: int) -> bytes | None:
    """Fetch a single XYZ tile and return the PNG bytes, or None.

    Each call opens its own Reader because rio-tiler's Reader is not
    thread-safe - threading only pays off because the expensive bit is
    the HTTP range reads, not the cheap per-call object setup.
    """
    try:
        with Reader(cog_url) as cog:
            img = cog.tile(x, y, z)
    except TileOutsideBounds:
        return None
    except Exception as exc:  # noqa: BLE001
        print(f"tile {z}/{x}/{y} failed: {exc}", file=sys.stderr)
        return None
    # OAM imagery is 3-band RGB. Render as RGBA PNG so transparent
    # pixels (padding around the actual footprint) come through.
    return img.render(img_format="PNG", add_mask=True)


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
        bounds = cog.geographic_bounds  # (w, s, e, n)

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
        cur.execute("INSERT INTO metadata VALUES (?, ?)", ("format", "png"))
        cur.execute(
            "INSERT INTO metadata VALUES (?, ?)",
            ("bounds", ",".join(str(b) for b in bounds)),
        )
        cur.execute("INSERT INTO metadata VALUES (?, ?)", ("minzoom", str(min_zoom)))
        cur.execute("INSERT INTO metadata VALUES (?, ?)", ("maxzoom", str(max_zoom)))

        with ThreadPoolExecutor(max_workers=TILE_WORKERS) as pool:
            for z, xmin, xmax, ymin, ymax in tile_ranges(bounds, min_zoom, max_zoom):
                start = time.monotonic()
                futures = {}
                for x in range(xmin, xmax + 1):
                    for y in range(ymin, ymax + 1):
                        fut = pool.submit(_render_tile, cog_url, x, y, z)
                        futures[fut] = (x, y)
                written = 0
                for fut in as_completed(futures):
                    x, y = futures[fut]
                    png = fut.result()
                    if png is None:
                        continue
                    tms_y = (1 << z) - 1 - y
                    cur.execute(
                        "INSERT OR REPLACE INTO tiles VALUES (?, ?, ?, ?)",
                        (z, x, tms_y, png),
                    )
                    written += 1
                conn.commit()
                print(
                    f"z{z}: {written}/{len(futures)} tiles in "
                    f"{time.monotonic() - start:.1f}s",
                    flush=True,
                )
    finally:
        conn.close()


def convert_to_pmtiles(mbtiles: Path, pmtiles: Path) -> None:
    subprocess.run(
        ["pmtiles", "convert", str(mbtiles), str(pmtiles)],
        check=True,
    )


def upload(bucket: str, key: str, path: Path, content_type: str) -> None:
    s3 = boto3.client("s3")
    s3.upload_file(
        Filename=str(path),
        Bucket=bucket,
        Key=key,
        ExtraArgs={"ContentType": content_type},
    )


def delete_lock(bucket: str, lock_key: str) -> None:
    try:
        boto3.client("s3").delete_object(Bucket=bucket, Key=lock_key)
    except Exception as exc:  # noqa: BLE001
        print(f"warning: could not delete lock {lock_key}: {exc}", file=sys.stderr)


def main() -> int:
    item_id = env("STAC_ITEM_ID")
    fmt = env("FORMAT")
    cog_url = env("COG_URL")
    output_key = env("OUTPUT_KEY")
    lock_key = env("LOCK_KEY")
    min_zoom = int(env("MIN_ZOOM", "0"))
    max_zoom = int(env("MAX_ZOOM", "0"))
    canonical = env("CANONICAL", "false").lower() == "true"
    gsd = float(env("GSD", "0") or "0")

    bucket = env("S3_BUCKET", "oin-hotosm-temp")
    public_base = env(
        "S3_PUBLIC_BASE_URL",
        "https://oin-hotosm-temp.s3.us-east-1.amazonaws.com",
    )
    internal_base = env("INTERNAL_BASE_URL")
    internal_token = env("INTERNAL_TOKEN")

    try:
        if min_zoom == 0 and max_zoom == 0:
            # Default range: from z0 up to whatever the source GSD
            # supports (bounded by derive_max_zoom_from_gsd).
            max_zoom = derive_max_zoom_from_gsd(gsd)
            min_zoom = 0
            print(f"derived zoom range from gsd={gsd}: {min_zoom}..{max_zoom}")

        workdir = Path(tempfile.mkdtemp(prefix="tilepack-"))
        try:
            mbtiles_path = workdir / f"{item_id}.mbtiles"
            generate_mbtiles(cog_url, mbtiles_path, min_zoom, max_zoom)

            if fmt == "mbtiles":
                final_path = mbtiles_path
                content_type = "application/vnd.mbtiles"
            elif fmt == "pmtiles":
                final_path = workdir / f"{item_id}.pmtiles"
                convert_to_pmtiles(mbtiles_path, final_path)
                content_type = "application/vnd.pmtiles"
            else:
                raise SystemExit(f"unknown format: {fmt}")

            upload(bucket, output_key, final_path, content_type)
            print(f"uploaded s3://{bucket}/{output_key}")

            if canonical:
                href = f"{public_base.rstrip('/')}/{output_key}"
                patch_item_asset(
                    internal_base,
                    internal_token,
                    item_id,
                    asset_key=f"tilepack_{fmt}",
                    asset={
                        "href": href,
                        "type": content_type,
                        "roles": ["tiles"],
                        "title": f"{fmt.upper()} archive",
                    },
                )
                print("patched STAC item asset")
        finally:
            shutil.rmtree(workdir, ignore_errors=True)
    finally:
        delete_lock(bucket, lock_key)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
