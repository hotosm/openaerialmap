"""Read a TIFF's grid from its first IFD, without GDAL.

Classic TIFF and BigTIFF. Anything else, or anything malformed, gives None
and the workspace is sized by bytes.
"""

import logging
import struct
from collections.abc import Callable
from typing import NamedTuple

from app.config import settings
from app.uploads.s3 import internal_client

log = logging.getLogger(__name__)

# Covers the IFD of a COG, and of most GDAL-written TIFFs, in one request.
HEAD_BYTES = 64 * 1024
MAX_ENTRIES = 4096
# Header, IFD count, IFD table and one out-of-line value.
MAX_READS = 4
MAX_BANDS = 64
# SHORT, LONG, LONG8: the types TIFF allows for these tags.
_TYPES = {3: ("H", 2), 4: ("I", 4), 16: ("Q", 8)}
WIDTH, HEIGHT, BITS, SAMPLES, EXTRA_SAMPLES = 256, 257, 258, 277, 338
PHOTOMETRIC, SAMPLE_FORMAT, GDAL_METADATA = 262, 339, 42112
_SINGLE = (WIDTH, HEIGHT, SAMPLES, PHOTOMETRIC)
_WANTED = (*_SINGLE, BITS, EXTRA_SAMPLES, SAMPLE_FORMAT)


class Grid(NamedTuple):
    """Raster dimensions, and whether convert may encode it as lossy RGB(A)."""

    width: int
    height: int
    visual: bool = False


def _parse(read: Callable[[int, int], bytes]) -> Grid:
    """Grid from `read(offset, length)`; ValueError if not a usable TIFF."""
    head = read(0, 16)
    order = {b"II": "<", b"MM": ">"}.get(head[:2])
    if order is None or len(head) < 16:
        raise ValueError("not a usable TIFF")
    magic = struct.unpack(order + "H", head[2:4])[0]
    if magic == 42:
        big, ifd = False, struct.unpack(order + "I", head[4:8])[0]
    elif magic == 43:
        big, ifd = True, struct.unpack(order + "Q", head[8:16])[0]
    else:
        raise ValueError("not a usable TIFF")
    offset, count_size, entry_size = ("Q", 8, 20) if big else ("I", 2, 12)
    inline = 8 if big else 4
    entries = struct.unpack(order + ("Q" if big else "H"), read(ifd, count_size))[0]
    if not 0 < entries <= MAX_ENTRIES:
        raise ValueError("not a usable TIFF")
    table = read(ifd + count_size, entries * entry_size)
    if len(table) < entries * entry_size:
        raise ValueError("not a usable TIFF")
    raw: dict[int, tuple[int, int, bytes]] = {}
    for i in range(entries):
        entry = table[i * entry_size : (i + 1) * entry_size]
        tag, kind = struct.unpack(order + "HH", entry[:4])
        if tag not in (*_WANTED, GDAL_METADATA):
            continue
        count = struct.unpack(order + offset, entry[4 : 4 + inline])[0]
        if tag == GDAL_METADATA:
            if tag in raw or kind != 2:  # ASCII
                raise ValueError("unusable tag")
        elif tag in raw or kind not in _TYPES:
            raise ValueError("unusable tag")
        elif count < 1 or (tag in _SINGLE and count != 1) or count > MAX_BANDS:
            raise ValueError("unusable tag")
        raw[tag] = (kind, count, entry[4 + inline :])
    if WIDTH not in raw or HEIGHT not in raw:
        raise ValueError("no grid")

    def text(tag: int) -> str:
        if tag not in raw:
            return ""
        _, count, payload = raw[tag]
        if count > HEAD_BYTES:
            raise ValueError("oversized text tag")
        if count > inline:
            payload = read(struct.unpack(order + offset, payload[:inline])[0], count)
        return payload[:count].decode("latin-1")

    def band4_alpha() -> bool:
        """As GDAL reads it: RGB(A) tags, one alpha extra sample, no override."""
        photometric = values(PHOTOMETRIC, (-1,))[0]
        if photometric not in (2, 6) or values(EXTRA_SAMPLES, ()) not in ((1,), (2,)):
            return False
        metadata = text(GDAL_METADATA).lower()
        # A character reference could spell "colorinterp" another way.
        return "colorinterp" not in metadata and "&#" not in metadata

    def values(tag: int, default: tuple[int, ...]) -> tuple[int, ...]:
        if tag not in raw:
            return default
        kind, count, payload = raw[tag]
        fmt, size = _TYPES[kind]
        if count * size > inline:
            at = struct.unpack(order + offset, payload[:inline])[0]
            payload = read(at, count * size)
        return struct.unpack(order + fmt * count, payload[: count * size])

    bands = values(SAMPLES, (1,))[0]
    bits = values(BITS, (1,))
    if not 0 < bands <= MAX_BANDS or len(bits) not in (1, bands):
        raise ValueError("not a usable TIFF")
    grid = Grid(
        width=values(WIDTH, (0,))[0],
        height=values(HEIGHT, (0,))[0],
        # GDAL decodes 1-8 bits to Byte. SampleFormat 1 is unsigned integer;
        # signed and float convert lossless.
        visual=max(bits) <= 8
        and set(values(SAMPLE_FORMAT, (1,))) == {1}
        and (bands == 3 or (bands == 4 and band4_alpha())),
    )
    if grid.width < 1 or grid.height < 1:
        raise ValueError("empty grid")
    return grid


def parse(read: Callable[[int, int], bytes]) -> Grid | None:
    """Grid from `read(offset, length)`, None if this is not a usable TIFF."""
    try:
        return _parse(read)
    except (struct.error, IndexError, ValueError):
        return None


def read_grid(key: str) -> Grid | None:
    """Grid of an uploaded object, None if it cannot be read as a TIFF."""
    client = internal_client()
    reads = 0

    def fetch(offset: int, length: int) -> bytes:
        nonlocal reads
        reads += 1
        if reads > MAX_READS:
            raise ValueError(f"more than {MAX_READS} reads")
        response = client.get_object(
            Bucket=settings.S3_BUCKET,
            Key=key,
            Range=f"bytes={offset}-{offset + length - 1}",
        )
        return response["Body"].read()

    head = fetch(0, HEAD_BYTES)

    def read(offset: int, length: int) -> bytes:
        if offset + length <= len(head):
            return head[offset : offset + length]
        return fetch(offset, length)

    grid = parse(read)
    if grid is None:
        log.info("No TIFF grid in %s; the workspace is sized by bytes", key)
    return grid
