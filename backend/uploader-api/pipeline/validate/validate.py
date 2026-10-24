"""Validate an uploaded raster before processing.

Require a CRS and a plausible grid. Only visual products require uint8 RGB(A);
other types retain their native data.

Exit codes let workflow cleanup report the specific validation failure, and the
reason file beside them carries the numbers.
"""

import json
import logging
import os
import re
import sys
from typing import NoReturn

import numpy as np
import rasterio
import rasterio.errors
from rasterio.enums import ColorInterp

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [validate] %(message)s",
)
log = logging.getLogger("validate")

# By name, because GDAL would otherwise open whatever the bytes turn out to be,
# and a VRT named input.tif can point its source band at another file or a URL.
READ_DRIVER = "GTiff"

PRODUCT_TYPES = {"visual", "multispectral", "sar", "elevation", "pseudocolor"}

# The input never arrived, which is our fault and not the file's. EX_TEMPFAIL,
# so the step's retryStrategy retries it; every other code here is a rejection.
EXIT_INPUT_MISSING = 75

# Every step reads in blocks or decimated windows, so these bound disk, not
# memory: the workspace has to hold the input plus a worst-case incompressible
# COG. Derived from the PVC in workflow-template.yaml. 0 disables either check.
MAX_DECODED_GB = float(os.environ.get("OAM_VALIDATE_MAX_DECODED_GB", "130"))
MAX_GIGAPIXELS = float(os.environ.get("OAM_VALIDATE_MAX_GIGAPIXELS", "0"))
# JPEG q90 needs 0.9x decoded size: 0.6 of the 1.5x lossless budget.
# Measured peak: 0.72-0.83x. GDAL's overview temp stays lossless ZSTD.
LOSSY_DISK_FACTOR = 0.6

# Cleanup reports this verbatim; without it the uploader only gets the exit
# code mapped to a fixed sentence. The API truncates at 300.
REASON_PATH = os.environ.get("OAM_VALIDATE_REASON_PATH", "/data/validation-error.txt")
MAX_REASON_CHARS = 300


def _reject(code: int, reason: str) -> NoReturn:
    """Log why, leave the reason for cleanup to report, and exit."""
    log.error("Rejected: %s", reason)
    # Cleanup interpolates this through shell into a JSON payload.
    safe = re.sub(r"[^\x20-\x7e]", " ", reason).replace("\\", " ").replace('"', "'")
    try:
        with open(REASON_PATH, "w") as f:
            f.write(safe[:MAX_REASON_CHARS])
    except OSError:
        log.warning("Could not write %s; cleanup falls back to the code", REASON_PATH)
    sys.exit(code)


def _declared_product_type(meta_path: str | None) -> str:
    """Read product_type from meta.json; return an empty string on failure."""
    if not meta_path or not os.path.exists(meta_path):
        return ""
    try:
        with open(meta_path) as f:
            return str(json.load(f).get("product_type", "")).strip().lower()
    except (OSError, ValueError, AttributeError):
        return ""


def _converts_lossy(src: rasterio.DatasetReader, declared: str) -> bool:
    """Match convert._lossy_visual to budget for the output codec."""
    if src.dtypes[0] != "uint8":
        return False
    if src.count == 4 and src.colorinterp[3] != ColorInterp.alpha:
        return False
    return src.count in (3, 4) and declared in ("", "visual")


def validate_raster(path: str, meta_path: str | None = None) -> bool:
    """Check a raster is georeferenced, within size limits, and self-consistent."""
    try:
        src = rasterio.open(path, driver=READ_DRIVER)
    except rasterio.errors.RasterioIOError as err:
        # GDAL raises this for "no such file" as readily as for "not a TIFF".
        if not os.path.exists(path):
            log.error("%s is missing: the fetch step's output never arrived", path)
            _reject(
                EXIT_INPUT_MISSING,
                "The imagery did not reach the validation step; please try again.",
            )
        log.error("%s could not be read as a GeoTIFF: %s", path, err)
        _reject(8, "This file is not a GeoTIFF.")
    with src:
        dtype = src.dtypes[0]
        log.info(
            "Validating %s: crs=%s bands=%s dtype=%s size=%sx%s colorinterp=%s",
            path,
            src.crs,
            src.count,
            dtype,
            src.width,
            src.height,
            [ci.name for ci in src.colorinterp],
        )
        if src.crs is None:
            _reject(5, "Not georeferenced: the GeoTIFF declares no CRS.")

        # Unknown product types use lossless conversion.
        raw_declared = _declared_product_type(meta_path)
        declared = raw_declared if raw_declared in PRODUCT_TYPES else ""

        gigapixels = (src.width * src.height) / 1e9
        if MAX_GIGAPIXELS and gigapixels > MAX_GIGAPIXELS:
            _reject(
                6,
                f"Image too large: {gigapixels:.2f} gigapixels "
                f"({src.width} x {src.height}) is over the {MAX_GIGAPIXELS:g} "
                "gigapixel limit.",
            )

        bytes_per_sample = np.dtype(dtype).itemsize
        decoded_gb = (src.width * src.height * src.count * bytes_per_sample) / 1e9
        max_decoded_gb = MAX_DECODED_GB
        if _converts_lossy(src, raw_declared):
            max_decoded_gb = round(MAX_DECODED_GB / LOSSY_DISK_FACTOR, 1)
        if max_decoded_gb and decoded_gb > max_decoded_gb:
            _reject(
                6,
                f"Image too large: {decoded_gb:.1f} GB decoded "
                f"({src.width} x {src.height}, {src.count} band(s), {dtype}) is "
                f"over the {max_decoded_gb:g} GB limit.",
            )
        log.info(
            "Size accepted: %.2f gigapixels, %.1f GB decoded", gigapixels, decoded_gb
        )

        # Only visual data has a uint8 RGB(A) contract; other types stay native.
        is_uint8_rgb = dtype == "uint8" and src.count in (3, 4)
        if declared == "visual" and not is_uint8_rgb:
            _reject(
                7,
                "Declared product_type=visual needs 8-bit 3-4 band RGB(A); this "
                f"file is {dtype} with {src.count} band(s).",
            )
        if not declared and not is_uint8_rgb:
            log.warning(
                "No product_type declared for non-RGB data; metadata.py will "
                "auto-detect and render accordingly."
            )
    return True


if __name__ == "__main__":
    meta = sys.argv[2] if len(sys.argv) > 2 else None
    try:
        validate_raster(sys.argv[1], meta)
        log.info("Raster valid")
    except SystemExit:
        raise
    except Exception:
        log.exception("Validation failed")
        sys.exit(1)
