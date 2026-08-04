"""Tests for EO band selection + datetime parsing (blockers #3, #4)."""

import metadata


def test_rgb_indexes_resolve_bgr_order():
    # RGB isn't always bands 1-3; common names must drive selection.
    bands = [
        {"name": "b1", "eo:common_name": "blue"},
        {"name": "b2", "eo:common_name": "green"},
        {"name": "b3", "eo:common_name": "red"},
        {"name": "b4", "eo:common_name": "nir"},
    ]
    assert metadata._rgb_band_indexes(bands) == [3, 2, 1]


def test_rgb_indexes_none_when_unlabelled():
    assert metadata._rgb_band_indexes([{"name": f"b{i}"} for i in range(1, 4)]) is None


def test_display_bands_multispectral_uses_named_rgb():
    bands = [
        {"name": "b1", "eo:common_name": "blue"},
        {"name": "b2", "eo:common_name": "green"},
        {"name": "b3", "eo:common_name": "red"},
    ]
    assert metadata._display_bands("multispectral", bands) == [3, 2, 1]


def test_display_bands_single_for_elevation():
    assert metadata._display_bands("elevation", [{"name": "b1"}]) == [1]


def test_display_bands_first_three_fallback():
    bands = [{"name": f"b{i}"} for i in range(1, 5)]
    assert metadata._display_bands("multispectral", bands) == [1, 2, 3]


def test_parse_dt():
    assert metadata._parse_dt("2020-01-01T00:00:00Z") is not None
    assert metadata._parse_dt("") is None
    assert metadata._parse_dt("not-a-date") is None
