"""Thumbnail alpha, for imagery whose valid area is not the whole rectangle.

Viewers drape the thumbnail over the item's bounding box, so an opaque PNG
paints a rotated ortho's nodata collar over whatever sits beneath it - which is
what makes neighbouring images look like they are blotting each other out. The
alpha band is what stops that, so these check it is present exactly when there
is something to mask, and that masked pixels are excluded from the stretch.

The 16-bit RGB+alpha case is also the file the old uploader died on: it kept all
four bands as data, added a mask on top, and handed five bands to a PNG writer
that takes at most four.
"""

import metadata
import numpy as np
import rasterio
from rasterio.enums import ColorInterp
from rasterio.transform import from_origin

SIZE = 120
TRANSFORM = from_origin(300000, 3100000, 0.05, 0.05)
CRS = "EPSG:32645"


def _collar(shape=(SIZE, SIZE)):
    """True where the pixel is valid: a centred square, collar all around."""
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
    """Run the browse + write steps the way build_item does."""
    out = tmp_path / "thumbnail.png"
    with rasterio.open(src_path, driver="GTiff") as src:
        ptype, _ = metadata._resolve_product_type({"product_type": product_type}, src)
        bands = metadata._band_info(src)
        _, _, rescale, thumb, alpha = metadata._browse(src, ptype, bands)
        metadata._write_thumbnail(thumb, alpha, out)
    return out, rescale


def _rgba16(tmp_path):
    """16-bit RGB + alpha, the shape ODM writes when told to keep 16-bit."""
    valid = _collar()
    # A ramp, not a flat fill: percentiles of a constant collapse to the
    # degenerate branch and would pass this test for the wrong reason.
    ramp = np.linspace(3000, 12000, SIZE * SIZE).reshape(SIZE, SIZE)
    rgb = np.repeat(ramp.astype("uint16")[None], 3, axis=0)
    rgb[:, ~valid] = 0
    alpha = np.where(valid, 65535, 0).astype("uint16")
    return _write(tmp_path / "rgba16.tif", np.concatenate([rgb, alpha[None]]))


def test_sixteen_bit_rgba_writes_four_band_png(tmp_path):
    """The old uploader's crash: never more than 4 bands, and alpha is real."""
    out, _ = _thumbnail(tmp_path, _rgba16(tmp_path))
    with rasterio.open(out) as png:
        assert png.count == 4
        assert png.colorinterp[3] == ColorInterp.alpha
        assert png.dtypes[0] == "uint8"
        mask = png.read(4)
    # The collar is transparent and the middle is not, so a neighbouring image
    # shows through the border instead of being covered by black.
    assert mask[0, 0] == 0
    assert mask[SIZE // 2, SIZE // 2] == 255


def test_stretch_ignores_masked_pixels(tmp_path):
    """A collar of zeros must not drag the 2/98 range down to black."""
    _, rescale = _thumbnail(tmp_path, _rgba16(tmp_path))
    assert rescale is not None
    for lo, _ in rescale:
        assert lo > 1000


def test_fully_valid_raster_stays_three_band(tmp_path):
    """No mask to carry means no alpha band; don't pay for bytes we don't need."""
    data = np.full((3, SIZE, SIZE), 200, dtype="uint8")
    out, _ = _thumbnail(tmp_path, _write(tmp_path / "rgb.tif", data))
    with rasterio.open(out) as png:
        assert png.count == 3
        assert ColorInterp.alpha not in png.colorinterp


def test_nodata_border_gives_alpha_without_an_alpha_band(tmp_path):
    """Declared nodata is a mask too - the common 8-bit ODM export."""
    valid = _collar()
    data = np.full((3, SIZE, SIZE), 200, dtype="uint8")
    data[:, ~valid] = 0
    out, _ = _thumbnail(tmp_path, _write(tmp_path / "rgb_nodata.tif", data, nodata=0))
    with rasterio.open(out) as png:
        assert png.count == 4
        assert png.read(4)[0, 0] == 0


def test_single_band_elevation_gets_grey_plus_alpha(tmp_path):
    """Scalar data writes 1 band, so alpha lands on band 2, not band 4."""
    valid = _collar()
    dem = np.where(valid, 1500.0, -9999.0).astype("float32")
    src = _write(tmp_path / "dem.tif", dem[None], nodata=-9999.0)
    out, _ = _thumbnail(tmp_path, src, product_type="elevation")
    with rasterio.open(out) as png:
        assert png.count == 2
        assert png.colorinterp == (ColorInterp.gray, ColorInterp.alpha)
        assert png.read(2)[0, 0] == 0
