"""Test the imagery owner in STAC Items."""

import json
from pathlib import Path

from stactools.hotosm.oam_metadata import OamMetadata
from stactools.hotosm.oam_metadata_client import LEGACY_ID_PREFIX, OamMetadataClient
from stactools.hotosm.stac import create_item

DATA = Path(__file__).parent / "data"


def _legacy_result() -> dict:
    """Load one legacy metadata record."""
    response = json.loads((DATA / "oam_meta_api_response10.json").read_text())
    return response["results"][0]


def test_item_carries_the_owner(example_oam_image: OamMetadata):
    """Add the owner to the Item, separately from the uploader."""
    example_oam_image.uploader_id = "hotosm|1234"
    example_oam_image.owner_id = "hotosm|5678"

    item = create_item(example_oam_image.sanitize())
    item.validate()

    assert item.properties["oam:owner_id"] == "hotosm|5678"
    assert item.properties["oam:uploader_id"] == "hotosm|1234"


def test_item_omits_an_unknown_owner(example_oam_image: OamMetadata):
    """Leave unattributed imagery without an owner."""
    example_oam_image.owner_id = "  "

    item = create_item(example_oam_image.sanitize())
    item.validate()

    assert "oam:owner_id" not in item.properties


def test_legacy_result_is_owned_by_the_legacy_account():
    """Keep legacy imagery with its legacy account until it is claimed."""
    result = _legacy_result()
    result["user"] = {"_id": "67f8a774f769c0a050db59c2", "name": "Lockport AI Tools"}

    parsed = OamMetadataClient.new()._parse_result(result)

    assert parsed.owner_id == f"{LEGACY_ID_PREFIX}|67f8a774f769c0a050db59c2"
    assert parsed.owner_id == parsed.uploader_id


def test_legacy_result_without_a_user_has_no_owner():
    """Leave legacy imagery without an account unowned."""
    result = _legacy_result()
    assert result.get("user") is None

    parsed = OamMetadataClient.new()._parse_result(result)

    assert parsed.owner_id is None
