"""Tests for capture dates and sensor tags."""

import datetime as dt

import metadata
import numpy as np
import rasterio
from rasterio.transform import from_bounds


def _write_tif(path, tags):
    profile = dict(
        driver="GTiff",
        width=8,
        height=8,
        count=1,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_bounds(0, 0, 1, 1, 8, 8),
    )
    with rasterio.open(path, "w", **profile) as dst:
        dst.write(np.zeros((1, 8, 8), dtype="uint8"))
        dst.update_tags(**tags)
    return str(path)


def test_exif_datetime(tmp_path):
    path = _write_tif(tmp_path / "a.tif", {"TIFFTAG_DATETIME": "2024:06:01 10:30:00"})
    got = metadata._tag_datetime(metadata._file_tags([path]))
    assert got == dt.datetime(2024, 6, 1, 10, 30, tzinfo=dt.UTC)


def test_odm_datetime_with_offset():
    tags = {"TIFFTAG_DATETIME": "2026:07:03 15:47:56+00:00"}
    got = metadata._tag_datetime(tags)
    assert got == dt.datetime(2026, 7, 3, 15, 47, 56, tzinfo=dt.UTC)


def test_datetime_original_wins_over_tiff_datetime():
    tags = {
        "EXIF_DateTimeOriginal": "2024:01:02 03:04:05",
        "TIFFTAG_DATETIME": "2026:07:03 15:47:56",
    }
    assert metadata._tag_datetime(tags).year == 2024


def test_garbage_datetime_is_none():
    assert metadata._tag_datetime({"TIFFTAG_DATETIME": "not a date"}) is None
    assert metadata._tag_datetime({}) is None


def test_sensor_from_make_model():
    assert (
        metadata._tag_sensor({"EXIF_Make": "DJI", "EXIF_Model": "FC6310"})
        == "DJI FC6310"
    )
    # Model repeating the make is not doubled.
    assert (
        metadata._tag_sensor({"EXIF_Make": "Canon", "EXIF_Model": "Canon EOS R5"})
        == "Canon EOS R5"
    )
    assert metadata._tag_sensor({}) is None


def test_software_from_tag():
    assert metadata._tag_software({"TIFFTAG_SOFTWARE": "ODM 3.6.1"}) == ("ODM", "3.6.1")
    assert metadata._tag_software({"TIFFTAG_SOFTWARE": "Pix4Dmapper"}) == (
        "Pix4Dmapper",
        "unknown",
    )
    assert metadata._tag_software({}) is None


def test_file_tags_skips_unreadable_paths(tmp_path):
    path = _write_tif(tmp_path / "b.tif", {"TIFFTAG_DATETIME": "2024:06:01 10:30:00"})
    tags = metadata._file_tags([None, "/nonexistent.tif", path])
    assert tags.get("TIFFTAG_DATETIME") == "2024:06:01 10:30:00"
    assert metadata._file_tags([None, "/nonexistent.tif"]) == {}
