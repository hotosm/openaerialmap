"""Tests for product-type auto-detection (the form field is now optional)."""

import metadata
import numpy as np
from rasterio.enums import ColorInterp


class _FakeSrc:
    """Minimal stand-in for a rasterio dataset: only what _detect_product_type
    and _looks_like_alpha read."""

    def __init__(self, count, dtype, colorinterp, band4=None):
        self.count = count
        self.dtypes = [dtype] * count
        self.colorinterp = colorinterp
        self.width = self.height = 16
        self._band4 = band4

    def read(self, band, out_shape=None, resampling=None):
        h, w = out_shape
        if self._band4 == "alpha":  # near-binary opaque alpha
            return np.full((h, w), 255, dtype="uint8")
        # NIR: a gradient in 20..219, so nothing is exactly 0 or 255
        return (np.arange(h * w) % 200 + 20).reshape(h, w).astype("uint8")


def test_rgb_uint8_is_visual():
    src = _FakeSrc(3, "uint8", [ColorInterp.red, ColorInterp.green, ColorInterp.blue])
    assert metadata._detect_product_type(src) == "visual"


def test_rgba_by_colorinterp_is_visual():
    ci = [ColorInterp.red, ColorInterp.green, ColorInterp.blue, ColorInterp.alpha]
    assert metadata._detect_product_type(_FakeSrc(4, "uint8", ci)) == "visual"


def test_undeclared_alpha_band_is_visual():
    # 4th band reads near-binary (0/255) -> treated as alpha.
    ci = [ColorInterp.gray] * 4
    src = _FakeSrc(4, "uint8", ci, band4="alpha")
    assert metadata._detect_product_type(src) == "visual"


def test_continuous_fourth_band_is_multispectral():
    # 4th band is continuous (NIR), not alpha.
    ci = [ColorInterp.gray] * 4
    src = _FakeSrc(4, "uint8", ci, band4="nir")
    assert metadata._detect_product_type(src) == "multispectral"


def test_single_float_is_elevation():
    assert (
        metadata._detect_product_type(_FakeSrc(1, "float32", [ColorInterp.gray]))
        == "elevation"
    )


def test_single_integer_is_multispectral_not_elevation():
    assert (
        metadata._detect_product_type(_FakeSrc(1, "uint8", [ColorInterp.gray]))
        == "multispectral"
    )


def test_paletted_is_pseudocolor():
    assert (
        metadata._detect_product_type(_FakeSrc(1, "uint8", [ColorInterp.palette]))
        == "pseudocolor"
    )


def test_declared_type_wins_and_is_flagged_declared():
    src = _FakeSrc(1, "float32", [ColorInterp.gray])
    kind, source = metadata._resolve_product_type({"product_type": "sar"}, src)
    assert (kind, source) == ("sar", "declared")


def test_absent_type_is_detected():
    src = _FakeSrc(3, "uint8", [ColorInterp.red, ColorInterp.green, ColorInterp.blue])
    kind, source = metadata._resolve_product_type({}, src)
    assert (kind, source) == ("visual", "detected")
