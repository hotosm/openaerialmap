"""Validate an uploaded raster before processing.

Require a CRS and bounded decoded size. Only visual products require uint8 RGB(A);
other types retain their native data.

Exit codes let workflow cleanup report the specific validation failure.
"""

import json
import logging
import os
import sys

import numpy as np
import rasterio

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [validate] %(message)s",
)
log = logging.getLogger("validate")

PRODUCT_TYPES = {"visual", "multispectral", "sar", "elevation", "pseudocolor"}
# Bound both grid operations and decoded memory for many-band rasters.
MAX_GIGAPIXELS = float(os.environ.get("OAM_VALIDATE_MAX_GIGAPIXELS", "2"))
MAX_DECODED_GB = float(os.environ.get("OAM_VALIDATE_MAX_DECODED_GB", "32"))


def _declared_product_type(meta_path: str | None) -> str:
    """Read the user-declared product_type from meta.json, "" if absent/invalid."""
    if not meta_path or not os.path.exists(meta_path):
        return ""
    try:
        with open(meta_path) as f:
            declared = str(json.load(f).get("product_type", "")).strip().lower()
    except (OSError, ValueError):
        return ""
    return declared if declared in PRODUCT_TYPES else ""


def validate_raster(path: str, meta_path: str | None = None) -> bool:
    """Check a raster is georeferenced, within size limits, and self-consistent."""
    with rasterio.open(path) as src:
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
            log.error("Rejected: not georeferenced (no CRS)")
            sys.exit(5)

        gigapixels = (src.width * src.height) / 1e9
        if gigapixels > MAX_GIGAPIXELS:
            log.error(
                "Rejected: %.2f gigapixels exceeds the %.2f limit",
                gigapixels,
                MAX_GIGAPIXELS,
            )
            sys.exit(6)

        bytes_per_sample = np.dtype(dtype).itemsize
        decoded_gb = (src.width * src.height * src.count * bytes_per_sample) / 1e9
        if decoded_gb > MAX_DECODED_GB:
            log.error(
                "Rejected: %.2f GB decoded (%s bands x %s, %sx%s) exceeds the "
                "%.2f GB limit",
                decoded_gb,
                src.count,
                dtype,
                src.width,
                src.height,
                MAX_DECODED_GB,
            )
            sys.exit(6)

        # Only visual data has a uint8 RGB(A) contract; other types stay native.
        declared = _declared_product_type(meta_path)
        is_uint8_rgb = dtype == "uint8" and src.count in (3, 4)
        if declared == "visual" and not is_uint8_rgb:
            log.error(
                "Rejected: product_type=visual needs 8-bit 3-4 band RGB(A), "
                "got dtype=%s bands=%s",
                dtype,
                src.count,
            )
            sys.exit(7)
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
