"""Convert rasters to Cloud-Optimized GeoTIFFs.

GDAL's COG driver builds overviews without an intermediate file and preserves
native data types. TiTiler renders browse imagery from this analysis copy.

Full-resolution checksums detect pixel changes, and the COG layout is validated.
"""

import datetime as dt
import json
import logging
import os
import sys

import rasterio
from rasterio.shutil import copy as rio_copy

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [convert] %(message)s",
)
log = logging.getLogger("convert")

# ZSTD balances lossless compression with read speed in the OAM stack.
COMPRESS = os.environ.get("COG_COMPRESS", "ZSTD")
# Level 16 is near ZSTD's compression-ratio knee; local tests use 6 for speed.
LEVEL = os.environ.get("COG_LEVEL", "16")
BLOCKSIZE = os.environ.get("COG_BLOCKSIZE", "512")
# "average" gives smoother zoomed-out imagery than nearest.
OVERVIEW_RESAMPLING = os.environ.get("COG_OVERVIEW_RESAMPLING", "average")
NUM_THREADS = os.environ.get("COG_NUM_THREADS", "ALL_CPUS")
# Rebuild uploaded overviews to keep derivatives consistent.
OVERVIEWS = os.environ.get("COG_OVERVIEWS", "IGNORE_EXISTING")
GDAL_CACHEMAX = os.environ.get("COG_GDAL_CACHEMAX", "512")  # MB (values <100000)
VERIFY = os.environ.get("COG_VERIFY", "on").lower() != "off"
VALIDATE = os.environ.get("COG_VALIDATE", "on").lower() != "off"
# GDAL scratch dir; on the workspace volume in-cluster, overridable for tests.
TMPDIR = os.environ.get("CPL_TMPDIR", "/data/tmp")
# Stamped into the STAC processing provenance; CI injects the git ref.
PIPELINE_VERSION = os.environ.get("OAM_PIPELINE_VERSION", "dev")


def _predictor_for(dtype: str) -> str:
    """COG predictor: floating-point differencing for float data, else horizontal."""
    return "FLOATING_POINT" if dtype.startswith(("float", "complex")) else "STANDARD"


def _verify_lossless(src_path: str, dst_path: str) -> None:
    """Fail on changed full-resolution GDAL checksums.

    GDAL checksums are 16-bit smoke tests, not cryptographic proof.
    """
    with rasterio.open(src_path) as src, rasterio.open(dst_path) as dst:
        if src.count != dst.count:
            raise ValueError(f"band count changed: {src.count} -> {dst.count}")
        for b in range(1, src.count + 1):
            s, d = src.checksum(b), dst.checksum(b)
            if s != d:
                raise ValueError(f"band {b} checksum mismatch: {s} != {d} (lossy)")
    log.info("Checksum verification passed (all band checksums match)")


def _validate_cog(dst_path: str) -> None:
    """Fail if the output is not a valid COG (rio-cogeo / GDAL layout check)."""
    from rio_cogeo.cogeo import cog_validate

    valid, errors, warnings = cog_validate(dst_path, quiet=True)
    for w in warnings:
        log.warning("COG validator: %s", w)
    if not valid:
        raise ValueError(f"output is not a valid COG: {errors}")
    log.info("COG layout validation passed")


def _write_provenance(dst_path: str, predictor: str) -> None:
    """Write conversion details for metadata.py to add to the STAC item.

    Capture versions here because this image performs the conversion.
    """
    prov = {
        # RFC 3339 with a trailing Z (the STAC convention) rather than +00:00.
        "created_at": dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "software": {
            "oam-uploader-convert": PIPELINE_VERSION,
            "rasterio": rasterio.__version__,
            "GDAL": rasterio.__gdal_version__,
        },
        "cog_options": {
            "compress": COMPRESS,
            "level": LEVEL if COMPRESS.upper() in ("ZSTD", "LERC_ZSTD") else None,
            "predictor": predictor,
            "blocksize": BLOCKSIZE,
            "overview_resampling": OVERVIEW_RESAMPLING,
        },
    }
    with open(f"{dst_path}.json", "w") as f:
        json.dump(prov, f)


def convert_to_cog(src_path: str, dst_path: str) -> None:
    """Translate a raster into a COG in a single pass (GDAL COG driver)."""
    src_mb = os.path.getsize(src_path) / 1e6 if os.path.exists(src_path) else -1
    with rasterio.open(src_path) as src:
        dtype = src.dtypes[0]
    predictor = os.environ.get("COG_PREDICTOR", _predictor_for(dtype))
    log.info(
        "Converting %s (%.1f MB, dtype=%s) -> %s [COG driver, compress=%s level=%s "
        "predictor=%s]",
        src_path,
        src_mb,
        dtype,
        dst_path,
        COMPRESS,
        LEVEL,
        predictor,
    )
    os.makedirs(TMPDIR, exist_ok=True)

    creation = {
        "compress": COMPRESS,
        "predictor": predictor,
        "blocksize": BLOCKSIZE,
        "overviews": OVERVIEWS,
        "overview_resampling": OVERVIEW_RESAMPLING,
        "bigtiff": "IF_SAFER",
        "num_threads": NUM_THREADS,
    }
    # LEVEL only applies to ZSTD / LERC_ZSTD in the COG driver.
    if COMPRESS.upper() in ("ZSTD", "LERC_ZSTD"):
        creation["level"] = LEVEL

    # Talos-in-Docker misreports free space, so only local tests disable the guard.
    # Production stores scratch data here and retains GDAL's default check.
    env = {
        "GDAL_NUM_THREADS": NUM_THREADS,
        "GDAL_CACHEMAX": int(GDAL_CACHEMAX),  # rasterio.Env wants an int here
        "CPL_TMPDIR": TMPDIR,
    }
    with rasterio.Env(**env):
        rio_copy(src_path, dst_path, driver="COG", **creation)

    if VERIFY:
        _verify_lossless(src_path, dst_path)
    if VALIDATE:
        _validate_cog(dst_path)
    _write_provenance(dst_path, predictor)


if __name__ == "__main__":
    try:
        convert_to_cog(sys.argv[1], sys.argv[2])
        log.info("COG written to %s", sys.argv[2])
    except Exception:
        log.exception("COG conversion failed")
        sys.exit(1)
