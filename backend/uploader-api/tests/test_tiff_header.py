"""Reading a TIFF's grid from the bytes S3 serves, without GDAL."""

import struct

import pytest

from app.uploads import tiff_header


def _tiff(width, height, bands, bits, *, big=False, order="<", pad=0, extra=()):
    """A minimal TIFF: header, `pad` bytes, then one IFD with `extra` tags."""
    magic = b"II" if order == "<" else b"MM"
    off, count, entry = ("Q", "Q", 20) if big else ("I", "H", 12)
    head = magic + struct.pack(order + "H", 43 if big else 42)
    head += (
        struct.pack(order + "HHQ", 8, 0, 16 + pad)
        if big
        else struct.pack(order + "I", 8 + pad)
    )
    ifd_at = len(head) + pad
    tags = [(256, 4, [width]), (257, 4, [height]), (277, 3, [bands])]
    tags.append((258, 3, [bits] * bands))
    tags.extend(extra)
    n = len(tags)
    tail_at = ifd_at + struct.calcsize(order + count) + n * entry + (8 if big else 4)
    body, tail = b"", b""
    inline = 8 if big else 4
    for tag, kind, values in tags:
        fmt = "H" if kind == 3 else "I"
        data = values if kind == 2 else struct.pack(order + fmt * len(values), *values)
        if len(data) > inline:
            value = struct.pack(order + off, tail_at + len(tail))
            tail += data
        else:
            value = data.ljust(inline, b"\0")
        body += struct.pack(order + "HH", tag, kind)
        body += struct.pack(order + off, len(values)) + value
    ifd = struct.pack(order + count, n) + body + b"\0" * (8 if big else 4)
    return head + b"\0" * pad + ifd + tail


def _reader(blob, calls=None):
    def read(offset, length):
        if calls is not None:
            calls.append(offset)
        return blob[offset : offset + length]

    return read


@pytest.mark.parametrize("big", [False, True], ids=["classic", "bigtiff"])
@pytest.mark.parametrize("order", ["<", ">"], ids=["little", "big-endian"])
def test_the_grid_is_read_from_the_first_ifd(big, order):
    blob = _tiff(82_944, 590_848, 3, 8, big=big, order=order)
    grid = tiff_header.parse(_reader(blob))
    assert grid == (82_944, 590_848, True)


def test_an_ifd_past_the_first_read_is_fetched():
    blob = _tiff(10, 20, 1, 32, pad=200_000)
    calls = []
    assert tiff_header.parse(_reader(blob, calls)) == (10, 20, False)
    assert max(calls) > tiff_header.HEAD_BYTES


@pytest.mark.parametrize(
    "blob", [b"PK\x03\x04" + b"\0" * 64, b"", b"II*\0" + b"\0" * 12], ids=str
)
def test_anything_else_is_not_a_grid(blob):
    assert tiff_header.parse(_reader(blob)) is None


class _S3:
    def __init__(self, blob):
        self.blob, self.ranges = blob, []

    def get_object(self, Bucket, Key, Range):  # noqa: N803
        start, end = map(int, Range.removeprefix("bytes=").split("-"))
        self.ranges.append((start, end))
        body = self.blob[start : end + 1]
        return {"Body": type("B", (), {"read": lambda self: body})()}


def test_a_cog_header_costs_one_ranged_read(monkeypatch):
    s3 = _S3(_tiff(5000, 3000, 3, 8))
    monkeypatch.setattr(tiff_header, "internal_client", lambda: s3)
    assert tiff_header.read_grid("key") == (5000, 3000, True)
    assert s3.ranges == [(0, tiff_header.HEAD_BYTES - 1)]


RGB, ALPHA = (262, 3, [2]), (338, 3, [2])


def _metadata(xml: str):
    return (42112, 2, xml.encode() + b"\0")


@pytest.mark.parametrize(
    "extra",
    [
        [RGB, ALPHA],
        [(262, 3, [6]), (338, 3, [1])],  # YCbCr, associated alpha
        [RGB, ALPHA, _metadata('<Item name="STATISTICS_MEAN" sample="3">1</Item>')],
    ],
    ids=["rgb", "ycbcr", "other-metadata"],
)
def test_alpha_is_read_as_gdal_reads_it(extra):
    grid = tiff_header.parse(_reader(_tiff(100, 100, 4, 8, extra=extra)))
    assert grid.visual


@pytest.mark.parametrize(
    "extra",
    [
        [ALPHA],  # no photometric
        [RGB],  # no extra sample
        [(262, 3, [1]), ALPHA],  # gray: libtiff pads the extra samples
        [RGB, (338, 3, [0])],  # unspecified extra sample
        [
            RGB,
            ALPHA,
            _metadata(
                '<Item name="COLORINTERP" sample="3" role="colorinterp">NIR</Item>'
            ),
        ],
        [RGB, ALPHA, _metadata("<Item sample = '3' role = 'colorinterp'>NIR</Item>")],
        [RGB, ALPHA, _metadata('<Item sample="3" role="&#99;olorinterp">NIR</Item>')],
    ],
    ids=[
        "no-photometric",
        "no-extrasamples",
        "gray",
        "unspecified",
        "colorinterp",
        "colorinterp-quoted",
        "colorinterp-escaped",
    ],
)
def test_a_fourth_band_gdal_does_not_read_as_alpha_is_not_visual(extra):
    grid = tiff_header.parse(_reader(_tiff(100, 100, 4, 8, extra=extra)))
    assert grid is not None and not grid.visual


@pytest.mark.parametrize("sample_format", [2, 3])
def test_signed_or_float_bytes_are_not_visual(sample_format):
    """convert keeps int8 lossless, like any non-uint8 source."""
    blob = _tiff(100, 100, 3, 8, extra=[(339, 3, [sample_format])])
    assert not tiff_header.parse(_reader(blob)).visual


def test_an_explicit_unsigned_format_is_visual():
    blob = _tiff(100, 100, 3, 8, extra=[(339, 3, [1, 1, 1])])
    assert tiff_header.parse(_reader(blob)).visual


def test_a_repeated_tag_is_not_trusted():
    """Duplicates would otherwise each fetch an out-of-line payload."""
    blob = _tiff(100, 100, 3, 8, extra=[(256, 4, [7])])
    assert tiff_header.parse(_reader(blob)) is None


def test_a_header_that_needs_many_reads_is_given_up_on(monkeypatch):
    """A hostile IFD cannot hold a worker for thousands of requests."""
    blob = _tiff(10, 20, 1, 8, pad=500_000)
    s3 = _S3(blob)
    monkeypatch.setattr(tiff_header, "internal_client", lambda: s3)
    monkeypatch.setattr(tiff_header, "MAX_READS", 2)
    assert tiff_header.read_grid("key") is None
    assert len(s3.ranges) == 2
