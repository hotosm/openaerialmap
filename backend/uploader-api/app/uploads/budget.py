"""Upper bound on the disk a visual (JPEG) conversion needs beyond its input."""

import math

COG_BLOCK = 512
# GDAL's overview temp block: convert reads through a VRT, so the source's
# tiling is never inherited. Pinning GDAL_TIFF_OVR_BLOCKSIZE retiles the COG.
TEMP_BLOCK = 128
# RGB plus the mask band.
PIXEL_BYTES = 4
# JPEG q90 of pure noise measured 0.19 of raw; half leaves margin.
JPEG_FACTOR = 0.5
# The temp is raw; a ZSTD temp (an older convert image) measured up to 1.46x.
TEMP_FACTOR = 1.5
TILE_OVERHEAD = 1024  # TIFF tags and offsets, per tile


def _levels(width: int, height: int):
    """Full resolution, then each COG overview until one block holds it."""
    while True:
        yield width, height
        if max(width, height) <= COG_BLOCK:
            return
        width, height = math.ceil(width / 2), math.ceil(height / 2)


def _tiled(width: int, height: int, block: int) -> int:
    """Bytes for a raw level stored in whole blocks, as GDAL allocates them."""
    tiles = math.ceil(width / block) * math.ceil(height / block)
    return tiles * (block * block * PIXEL_BYTES + TILE_OVERHEAD)


def conversion_bytes(width: int, height: int) -> float:
    """Worst-case JPEG COG plus raw overview temp for this grid."""
    levels = list(_levels(width, height))
    cog = sum(_tiled(w, h, COG_BLOCK) for w, h in levels)
    temp = sum(_tiled(w, h, TEMP_BLOCK) for w, h in levels[1:])
    return cog * JPEG_FACTOR + temp * TEMP_FACTOR
