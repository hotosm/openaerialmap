"""Tests for render nodata hints and codec-aware lineage."""

import metadata


def test_unmasked_visual_uses_nodata_zero():
    r = metadata._renders("visual", [1, 2, 3], None, None, None)
    assert r["browse"]["nodata"] == 0


def test_masked_visual_has_no_nodata_override():
    """nodata would override the alpha band in TiTiler and bring back the fringe."""
    r = metadata._renders("visual", [1, 2, 3], None, None, None, has_mask=True)
    assert "nodata" not in r["browse"]


def test_non_visual_keeps_source_nodata_even_when_masked():
    r = metadata._renders("elevation", [1], "terrain", [[0, 1]], -9999.0, True)
    assert r["browse"]["nodata"] == -9999.0


def test_lossless_lineage():
    opts = {"compress": "ZSTD", "level": "12", "predictor": "STANDARD"}
    text = metadata._lineage({**opts, "lossy": False})
    assert text.startswith("Lossless COG (compress ZSTD level 12")


def test_lossy_lineage_points_at_the_original():
    opts = {"compress": "WEBP", "quality": "90", "mask": "alpha", "lossy": True}
    text = metadata._lineage(opts)
    assert text.startswith("Lossy display COG (compress WEBP quality 90")
    assert "'original' asset" in text
    assert "checksum" not in text
