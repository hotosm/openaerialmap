"""Test the per-image properties written to the footprint PMTiles."""

from gen_coverage_vector import _extract_feature_properties


def _content(**properties) -> dict:
    """A hydrated STAC Item with a visual asset."""
    return {
        "properties": {"title": "Test", "oam:platform_type": "uav", **properties},
        "assets": {"visual": {"href": "https://example.com/cog.tif"}},
    }


def test_footprint_carries_the_owner():
    """Let the map highlight one account's imagery."""
    props = _extract_feature_properties(
        "item-1", _content(**{"oam:owner_id": "hotosm|1234"}), "openaerialmap"
    )

    assert props["owner_id"] == "hotosm|1234"


def test_footprint_omits_a_missing_owner():
    """Leave the key out for unowned Items so tiles carry no empty keys."""
    props = _extract_feature_properties("item-1", _content(), "openaerialmap")

    assert "owner_id" not in props
    assert props["title"] == "Test"
