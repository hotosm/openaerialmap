"""Tests for codec routing and the lossy visual path."""

import json

import convert
import numpy as np
import pytest
import rasterio
from rasterio.enums import ColorInterp
from rasterio.transform import from_origin

SIZE = 600


def _scene(count: int = 3, dtype: str = "uint8") -> np.ndarray:
    """Smooth gradients inside a rotated square; zero outside (the collar)."""
    yy, xx = np.mgrid[:SIZE, :SIZE]
    inside = (abs(xx - SIZE / 2) + abs(yy - SIZE / 2)) < SIZE * 0.45
    bands = [20 + (xx + yy) % 200, 30 + xx % 180, 40 + yy % 160][:count]
    if count == 4:
        bands.append(np.full((SIZE, SIZE), 255))
    data = np.stack(bands).astype(dtype)
    data[:, ~inside] = 0
    return data


def _write(path, data, nodata=None, colorinterp=None):
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=SIZE,
        height=SIZE,
        count=data.shape[0],
        dtype=data.dtype,
        crs="EPSG:32633",
        transform=from_origin(500000, 5000000, 0.1, 0.1),
        nodata=nodata,
        tiled=True,
        blockxsize=256,
        blockysize=256,
    ) as dst:
        dst.write(data)
        if colorinterp:
            dst.colorinterp = colorinterp
    return str(path)


def _meta(tmp_path, **md):
    (tmp_path / "meta.json").write_text(json.dumps(md))


def _convert(tmp_path, src):
    dst = str(tmp_path / "output.tif")
    convert.convert_to_cog(src, dst)
    with open(f"{dst}.json") as f:
        prov = json.load(f)
    return dst, prov


@pytest.fixture(autouse=True)
def _tmpdir(tmp_path, monkeypatch):
    monkeypatch.setattr(convert, "TMPDIR", str(tmp_path / "tmp"))


def test_rgb_nodata_becomes_webp_with_exact_alpha(tmp_path):
    _meta(tmp_path)
    src = _write(tmp_path / "input.tif", _scene(), nodata=0)
    dst, prov = _convert(tmp_path, src)
    with rasterio.open(dst) as out, rasterio.open(src) as inp:
        assert out.tags(ns="IMAGE_STRUCTURE")["COMPRESSION"] == "WEBP"
        assert out.colorinterp[3] == ColorInterp.alpha
        assert out.nodata is None
        assert np.array_equal(out.read(4), inp.dataset_mask())
        assert (out.width, out.height, out.transform) == (
            inp.width,
            inp.height,
            inp.transform,
        )
    opts = prov["cog_options"]
    assert opts["lossy"] is True
    assert (opts["compress"], opts["quality"], opts["mask"]) == ("WEBP", "90", "alpha")
    assert "predictor" not in opts


def test_rgb_without_nodata_is_fully_opaque(tmp_path):
    """Black pixels are image content when the source declares no mask."""
    _meta(tmp_path)
    src = _write(tmp_path / "input.tif", _scene())
    dst, _ = _convert(tmp_path, src)
    with rasterio.open(dst) as out:
        assert out.read(4).min() == 255


def test_rgba_keeps_its_alpha(tmp_path):
    _meta(tmp_path)
    data = _scene(4)
    ci = [ColorInterp.red, ColorInterp.green, ColorInterp.blue, ColorInterp.alpha]
    src = _write(tmp_path / "input.tif", data, colorinterp=ci)
    dst, prov = _convert(tmp_path, src)
    assert prov["cog_options"]["lossy"] is True
    with rasterio.open(dst) as out:
        assert np.array_equal(out.read(4) > 0, data[3] > 0)


def test_jpeg_fallback_uses_a_mask_band(tmp_path, monkeypatch):
    monkeypatch.setattr(convert, "VISUAL_COMPRESS", "JPEG")
    _meta(tmp_path)
    src = _write(tmp_path / "input.tif", _scene(), nodata=0)
    dst, prov = _convert(tmp_path, src)
    assert prov["cog_options"]["mask"] == "mask band"
    with rasterio.open(dst) as out, rasterio.open(src) as inp:
        assert out.count == 3
        assert np.array_equal(out.dataset_mask() > 0, inp.dataset_mask() > 0)


@pytest.mark.parametrize(
    ("data", "ci", "md"),
    [
        # A continuous fourth band may be NIR, so undeclared stays lossless.
        (_scene(4), [ColorInterp.gray] * 4, {}),
        (_scene(3, "float32"), None, {}),
        (_scene(3, "uint16"), None, {}),
        (_scene(3), None, {"product_type": "elevation"}),
        (_scene(3), None, {"product_type": "multispectral"}),
    ],
    ids=["4band-no-alpha", "float", "uint16", "declared-elevation", "declared-ms"],
)
def test_non_visual_stays_lossless_zstd(tmp_path, data, ci, md):
    _meta(tmp_path, **md)
    src = _write(tmp_path / "input.tif", data, colorinterp=ci)
    dst, prov = _convert(tmp_path, src)
    assert prov["cog_options"]["lossy"] is False
    assert prov["cog_options"]["compress"] == "ZSTD"
    with rasterio.open(dst) as out:
        assert out.tags(ns="IMAGE_STRUCTURE")["COMPRESSION"] == "ZSTD"
        assert out.count == data.shape[0]


def test_declared_visual_untagged_band_4_stays_lossless(tmp_path):
    """Band 4 may be NIR; treating it as alpha would punch holes in the image."""
    _meta(tmp_path, product_type="visual")
    src = _write(tmp_path / "input.tif", _scene(4), colorinterp=[ColorInterp.gray] * 4)
    _, prov = _convert(tmp_path, src)
    assert prov["cog_options"]["lossy"] is False


def test_off_switch_keeps_visual_lossless(tmp_path, monkeypatch):
    monkeypatch.setattr(convert, "VISUAL_COMPRESS", "OFF")
    _meta(tmp_path)
    src = _write(tmp_path / "input.tif", _scene(), nodata=0)
    _, prov = _convert(tmp_path, src)
    assert prov["cog_options"]["compress"] == "ZSTD"


def test_missing_meta_json_is_treated_as_undeclared(tmp_path):
    src = _write(tmp_path / "input.tif", _scene(), nodata=0)
    _, prov = _convert(tmp_path, src)
    assert prov["cog_options"]["lossy"] is True


def test_source_tags_survive_the_vrt(tmp_path):
    _meta(tmp_path)
    src = _write(tmp_path / "input.tif", _scene(), nodata=0)
    with rasterio.open(src, "r+") as ds:
        ds.update_tags(TIFFTAG_DATETIME="2024:05:01 10:00:00")
    dst, _ = _convert(tmp_path, src)
    with rasterio.open(dst) as out:
        assert out.tags()["TIFFTAG_DATETIME"] == "2024:05:01 10:00:00"


def test_pixel_zero_in_one_band_stays_opaque(tmp_path):
    """nodata masks every band only where all bands are nodata."""
    _meta(tmp_path)
    data = _scene()
    data[:, 300, 300] = [0, 120, 200]
    src = _write(tmp_path / "input.tif", data, nodata=0)
    dst, _ = _convert(tmp_path, src)
    with rasterio.open(dst) as out:
        assert out.read(4)[300, 300] == 255


def test_rgba_internal_mask_wins_over_alpha(tmp_path):
    ci = [ColorInterp.red, ColorInterp.green, ColorInterp.blue, ColorInterp.alpha]
    src = _write(tmp_path / "input.tif", _scene(4), colorinterp=ci)
    mask = np.zeros((SIZE, SIZE), dtype="uint8")
    mask[100:200, 100:200] = 255
    with rasterio.Env(GDAL_TIFF_INTERNAL_MASK=True), rasterio.open(src, "r+") as ds:
        ds.write_mask(mask)
    _meta(tmp_path)
    dst, _ = _convert(tmp_path, src)
    with rasterio.open(dst) as out, rasterio.open(src) as inp:
        assert np.array_equal(out.read(4) > 0, inp.dataset_mask() > 0)
        assert np.count_nonzero(out.read(4)) == 100 * 100


def _bad_output(tmp_path, rgb, alpha):
    return _write(tmp_path / "bad.tif", np.concatenate([rgb, alpha[None]]))


def test_lossy_verify_rejects_a_changed_mask(tmp_path):
    src = _write(tmp_path / "input.tif", _scene(), nodata=0)
    # An output that lost the collar: RGB intact, alpha fully opaque.
    bad = _bad_output(tmp_path, _scene(), np.full((SIZE, SIZE), 255, "uint8"))
    with pytest.raises(ValueError, match="validity mask changed"):
        convert._verify_lossy(src, bad)


def test_lossy_verify_rejects_corrupted_pixels_in_a_small_footprint(tmp_path):
    """Corruption confined to a small footprint is still caught."""
    data = np.zeros((3, SIZE, SIZE), dtype="uint8")
    data[:, 370:400, 170:200] = 100
    src = _write(tmp_path / "input.tif", data, nodata=0)
    with rasterio.open(src) as inp:
        alpha = inp.dataset_mask()
    bad = _bad_output(tmp_path, np.where(data > 0, data + 60, 0).astype("uint8"), alpha)
    with pytest.raises(ValueError, match="lossy error too high"):
        convert._verify_lossy(src, bad)
