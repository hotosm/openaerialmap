#!/usr/bin/env python3
"""
Generate a tiny conformant GeoTIFF for local E2E testing.

Produces a georeferenced (EPSG:4326), 3-band, uint8 GeoTIFF - the minimum the
pipeline's `validate` step accepts (CRS present, <=4 bands, 8-bit). Requires
`rasterio` + `numpy` (installed on the fly by the `just test e2e` recipe).

Usage:
    python scripts/make_sample_tif.py [output.tif]
"""

import sys

import numpy as np
import rasterio
from rasterio.transform import from_bounds


def main() -> int:
    """Write a small valid RGB uint8 GeoTIFF to the given path."""
    out = sys.argv[1] if len(sys.argv) > 1 else "oam-sample.tif"
    width = height = 256
    data = (np.random.rand(3, height, width) * 255).astype("uint8")
    transform = from_bounds(-0.1, -0.1, 0.1, 0.1, width, height)
    with rasterio.open(
        out,
        "w",
        driver="GTiff",
        height=height,
        width=width,
        count=3,
        dtype="uint8",
        crs="EPSG:4326",
        transform=transform,
    ) as dst:
        dst.write(data)
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
