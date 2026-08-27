"""Tests for transparent nodata in generated thumbnails."""

import metadata
import numpy as np
import rasterio
from rasterio.enums import ColorInterp
from rasterio.transform import from_origin

SIZE = 120
TRANSFORM = from_origin(300000, 3100000, 0.05, 0.05)
CRS = "EPSG:32645"


def _collar(shape=(SIZE, SIZE)):
    """Return a valid centre with an invalid border."""
    valid = np.zeros(shape, dtype=bool)
    valid[20:-20, 20:-20] = True
    return valid


def _write(path, data, **kwargs):
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=data.shape[2],
        height=data.shape[1],
        count=data.shape[0],
        dtype=data.dtype.name,
        crs=CRS,
        transform=TRANSFORM,
        **kwargs,
    ) as dst:
        dst.write(data)
        if data.shape[0] == 4:
            dst.colorinterp = [
                ColorInterp.red,
                ColorInterp.green,
                ColorInterp.blue,
                ColorInterp.alpha,
            ]
    return path


def _thumbnail(tmp_path, src_path, product_type=""):
    """Generate a thumbnail from a test raster."""
    out = tmp_path / "thumbnail.png"
    with rasterio.open(src_path, driver="GTiff") as src:
        ptype, _ = metadata._resolve_product_type({"product_type": product_type}, src)
        bands = metadata._band_info(src)
        _, _, rescale, thumb, alpha = metadata._browse(src, ptype, bands)
        metadata._write_thumbnail(thumb, alpha, out)
    return out, rescale


def _rgba16(tmp_path):
    """Create a 16-bit RGBA test raster."""
    valid = _collar()
    # Use a ramp so the percentile stretch is meaningful.
    ramp = np.linspace(3000, 12000, SIZE * SIZE).reshape(SIZE, SIZE)
    rgb = np.repeat(ramp.astype("uint16")[None], 3, axis=0)
    rgb[:, ~valid] = 0
    alpha = np.where(valid, 65535, 0).astype("uint16")
    return _write(tmp_path / "rgba16.tif", np.concatenate([rgb, alpha[None]]))


def test_sixteen_bit_rgba_writes_four_band_png(tmp_path):
    """RGBA input produces a valid four-band PNG."""
    out, _ = _thumbnail(tmp_path, _rgba16(tmp_path))
    with rasterio.open(out) as png:
        assert png.count == 4
        assert png.colorinterp[3] == ColorInterp.alpha
        assert png.dtypes[0] == "uint8"
        mask = png.read(4)
    assert mask[0, 0] == 0
    assert mask[SIZE // 2, SIZE // 2] == 255


def test_stretch_ignores_masked_pixels(tmp_path):
    """Masked zeros do not affect the colour stretch."""
    _, rescale = _thumbnail(tmp_path, _rgba16(tmp_path))
    assert rescale is not None
    for lo, _ in rescale:
        assert lo > 1000


def test_fully_valid_raster_stays_three_band(tmp_path):
    """Fully valid RGB input does not gain an alpha band."""
    data = np.full((3, SIZE, SIZE), 200, dtype="uint8")
    out, _ = _thumbnail(tmp_path, _write(tmp_path / "rgb.tif", data))
    with rasterio.open(out) as png:
        assert png.count == 3
        assert ColorInterp.alpha not in png.colorinterp


def test_nodata_border_gives_alpha_without_an_alpha_band(tmp_path):
    """Declared nodata produces an alpha band."""
    valid = _collar()
    data = np.full((3, SIZE, SIZE), 200, dtype="uint8")
    data[:, ~valid] = 0
    out, _ = _thumbnail(tmp_path, _write(tmp_path / "rgb_nodata.tif", data, nodata=0))
    with rasterio.open(out) as png:
        assert png.count == 4
        assert png.read(4)[0, 0] == 0


def test_single_band_elevation_gets_grey_plus_alpha(tmp_path):
    """Single-band data writes gray plus alpha."""
    valid = _collar()
    dem = np.where(valid, 1500.0, -9999.0).astype("float32")
    src = _write(tmp_path / "dem.tif", dem[None], nodata=-9999.0)
    out, _ = _thumbnail(tmp_path, src, product_type="elevation")
    with rasterio.open(out) as png:
        assert png.count == 2
        assert png.colorinterp == (ColorInterp.gray, ColorInterp.alpha)
        assert png.read(2)[0, 0] == 0
