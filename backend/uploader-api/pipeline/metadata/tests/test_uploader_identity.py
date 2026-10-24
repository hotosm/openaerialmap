"""Test uploader metadata in generated STAC Items."""

import json

import metadata
import numpy as np
import rasterio
from rasterio.transform import from_origin

SIZE = 64
HALF_METRE_DEG = 0.5 / 111320.0


def _item(tmp_path, **meta) -> dict:
    """Build an Item from a small raster."""
    raster = tmp_path / "scene.tif"
    with rasterio.open(
        raster,
        "w",
        driver="GTiff",
        width=SIZE,
        height=SIZE,
        count=3,
        dtype="uint8",
        crs="EPSG:4326",
        transform=from_origin(10.0, -2.0, HALF_METRE_DEG, HALF_METRE_DEG),
        nodata=0,
    ) as dst:
        dst.write(np.full((3, SIZE, SIZE), 200, dtype="uint8"))

    out_dir = tmp_path / "out"
    out_dir.mkdir()
    meta_path = out_dir / "meta.json"
    meta_path.write_text(
        json.dumps(
            {
                "title": "scene",
                "product_type": "visual",
                "acquisition_start": "2026-04-02T00:00:00+00:00",
                **meta,
            }
        )
    )
    metadata.build_item(
        str(raster),
        str(meta_path),
        str(out_dir),
        "id-scene",
        "https://assets.example.org",
        "oam",
        "u-test/id-scene/scene.tif",
        str(raster),
    )
    return json.loads((out_dir / "metadata.json").read_text())


def test_the_uploading_account_reaches_the_item(tmp_path):
    """Copy uploader metadata to the Item, but never an email."""
    item = _item(
        tmp_path,
        uploader_id="hotosm|1234",
        uploader_name="tester",
        uploader_email="tester@example.org",
    )

    assert item["properties"]["oam:uploader_id"] == "hotosm|1234"
    assert item["properties"]["oam:uploader_name"] == "tester"
    assert "oam:uploader_email" not in item["properties"]


def test_an_anonymous_upload_says_so(tmp_path):
    """Include only the anonymous identifier."""
    item = _item(tmp_path, uploader_id="custom|anonymous")

    assert item["properties"]["oam:uploader_id"] == "custom|anonymous"
    assert "oam:uploader_name" not in item["properties"]
    assert "oam:uploader_email" not in item["properties"]


def test_an_import_without_an_account_omits_the_fields(tmp_path):
    """Omit uploader fields when no account is provided."""
    item = _item(tmp_path)

    assert "oam:uploader_id" not in item["properties"]
