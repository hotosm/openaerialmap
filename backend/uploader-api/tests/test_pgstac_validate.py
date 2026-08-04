"""Tests for STAC item validation/normalisation (blocker #6)."""

import copy

import pytest
from litestar.exceptions import HTTPException

from app.uploads.pgstac import validate_item

_BASE = {
    "type": "Feature",
    "stac_version": "1.1.0",
    "id": "up1",
    "geometry": {"type": "Point", "coordinates": [0.0, 0.0]},
    "bbox": [0.0, 0.0, 0.0, 0.0],
    "properties": {"datetime": "2020-01-01T00:00:00Z"},
    "assets": {},
    "links": [],
    "stac_extensions": [],
}


def _item(**overrides):
    return {**copy.deepcopy(_BASE), **overrides}


def test_id_mismatch_is_forbidden():
    with pytest.raises(HTTPException):
        validate_item(_item(id="someone-else"), expected_id="up1", collection="c")


def test_sets_collection_and_required_links():
    item = validate_item(_item(), expected_id="up1", collection="openaerialmap")
    assert item["collection"] == "openaerialmap"
    rels = {link["rel"] for link in item["links"]}
    assert {"collection", "parent"} <= rels
