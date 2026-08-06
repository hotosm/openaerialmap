"""Tests for `stactools.hotosm.stac` module."""

import datetime as dt
from unittest.mock import patch

import pytest
from pystac.utils import str_to_datetime

from stactools.hotosm.exceptions import AssetNotFoundError
from stactools.hotosm.oam_metadata import OamMetadata
from stactools.hotosm.stac import create_collection, create_item


def test_create_collection():
    """Test Collection creation."""
    collection = create_collection()
    collection.validate()


def test_create_item(example_oam_image: OamMetadata):
    """Test Item creation."""
    item = create_item(example_oam_image)
    item.validate()

    for datetime_prop in {"start_datetime", "end_datetime"}:
        assert isinstance(str_to_datetime(item.properties[datetime_prop]), dt.datetime)

    assert set(item.assets) == {"visual", "thumbnail", "metadata"}

    assert "file:size" in item.assets["visual"].extra_fields
    for prop in {"code", "geometry", "bbox", "shape", "transform"}:
        assert f"proj:{prop}" in item.assets["visual"].extra_fields

    assert "alternate" not in item.assets["visual"].extra_fields


def test_create_item_raises_asset_not_found(example_oam_metadata: OamMetadata):
    """Test that create_item() raises AssetNotFoundError."""
    with pytest.raises(AssetNotFoundError, match=r"Asset does not exist.*"):
        create_item(example_oam_metadata)


@patch("stactools.hotosm.stac._add_projection_extension")
def test_create_item_creates_s3_alternate_assets(
    patch_add_proj_ext, example_oam_metadata: OamMetadata
):
    """Ensure create_item creates alternate assets references for AWS S3 hrefs.

    This test patches `_add_projection_extension` because it would otherwise make
    network requests to S3 that we want to avoid.
    """
    example_oam_metadata.image_url = "https://test-bucket.s3.amazonaws.com/test.tif"

    item = create_item(example_oam_metadata)

    visual_asset = item.assets["visual"]
    assert visual_asset.extra_fields["alternate:name"] == "HTTPS"

    visual_alt_assets = visual_asset.extra_fields["alternate"]
    assert "s3" in visual_alt_assets
    assert visual_alt_assets["s3"] == {
        "alternate:name": "S3",
        "href": "s3://test-bucket/test.tif",
    }

    patch_add_proj_ext.assert_called()


@patch("stactools.hotosm.stac._add_projection_extension")
def test_create_item_handles_start_vs_end_datetime(
    patch_add_proj_ext, example_oam_metadata: OamMetadata
):
    """Ensure STAC Item parsing correctly populates datetime or start/end datetime."""
    # Same start/end should just use "datetime"
    now = dt.datetime.now(dt.UTC)
    example_oam_metadata.acquisition_start = now
    example_oam_metadata.acquisition_end = now

    item = create_item(example_oam_metadata)
    assert item.datetime == now
    assert "start_datetime" not in item.properties
    assert "end_datetime" not in item.properties
    patch_add_proj_ext.assert_called()

    # Different start/end should just use "datetime"
    example_oam_metadata.acquisition_start = now
    example_oam_metadata.acquisition_end = now + dt.timedelta(minutes=5)

    item = create_item(example_oam_metadata)
    assert item.datetime is None
    assert "start_datetime" in item.properties
    assert "end_datetime" in item.properties
    patch_add_proj_ext.assert_called()
