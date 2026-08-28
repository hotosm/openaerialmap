"""Tests for `stactools.hotosm.vantor.stac`."""

import datetime as dt
from pathlib import Path
from urllib.parse import urljoin

import pystac
import pytest

from stactools.hotosm.vantor.stac import create_collection, create_item
from stactools.hotosm.vantor.sync import VANTOR_ROOT

DATA = Path(__file__).parent.joinpath("data")

ORDINARY_ITEM = "1030010122291A00"
# Missing eo:bands and has the wrong visual role.
MISLABELLED_ITEM = "B140001100103610"
# Uses image/jpg instead of image/jpeg.
BAD_MEDIA_TYPE_ITEM = "B150001101B05900"


@pytest.fixture
def catalog() -> pystac.Catalog:
    """Example Vantor root STAC Catalog."""
    obj = pystac.read_file(DATA / "catalog.json")
    assert isinstance(obj, pystac.Catalog)
    return obj


@pytest.fixture
def event_collection() -> pystac.Collection:
    """Example Vantor event STAC Collection."""
    obj = pystac.read_file(DATA / "collection.json")
    assert isinstance(obj, pystac.Collection)
    return obj


def read_item(item_id: str, collection: pystac.Collection) -> pystac.Item:
    """Read a fixture Item, wired to its event Collection like the sync does."""
    item = pystac.read_file(DATA / f"{item_id}.json")
    assert isinstance(item, pystac.Item)
    collection.add_item(item)
    # Restore the upstream HREF changed by add_item.
    item.set_self_href(urljoin(VANTOR_ROOT, f"{collection.id}/{item_id}.json"))
    return item


@pytest.fixture
def item(event_collection: pystac.Collection) -> pystac.Item:
    """Example Vantor catalog STAC Item."""
    return read_item(ORDINARY_ITEM, event_collection)


def test_create_collection(catalog: pystac.Catalog):
    """Test Collection creation."""
    start = dt.datetime(2026, 2, 1, tzinfo=dt.UTC)
    collection = create_collection(catalog, start, start + dt.timedelta(days=1))
    collection.validate()

    collection = create_collection(catalog)
    assert collection.extent.temporal.intervals == [[None, None]]
    assert "catalog_id" not in collection.to_dict().get("summaries", {})
    assert collection.license == "CC-BY-NC-4.0"
    assert set(collection.item_assets) == {"visual", "thumbnail"}
    collection.validate()


def test_create_collection_catalog_id_summaries(catalog: pystac.Catalog):
    """Ensure Vantor catalog IDs are summarized, deduplicated and sorted."""
    # Use more IDs than PySTAC's default summary limit.
    catalog_ids = [f"10300100{i:08X}" for i in range(50)]
    collection = create_collection(catalog, catalog_ids=catalog_ids + catalog_ids[:5])

    assert collection.to_dict()["summaries"]["catalog_id"] == sorted(catalog_ids)
    collection.validate()


def test_create_item(item: pystac.Item):
    """Test STAC Item creation."""
    oam_item = create_item(item)
    oam_item.validate()

    assert oam_item.id == ORDINARY_ITEM
    assert oam_item.properties["oam:producer_name"] == "Vantor"
    assert oam_item.properties["oam:platform_type"] == "satellite"

    assert oam_item.properties["catalog_id"] == ORDINARY_ITEM

    assert oam_item.properties["gsd"] == item.properties["pan_gsd"]

    assert oam_item.properties["platform"] == item.properties["vehicle_name"]

    assert "eo:bands" not in oam_item.properties
    assert (
        oam_item.assets["visual"].extra_fields["eo:bands"]
        == (item.properties["eo:bands"])
    )

    assert oam_item.properties["title"].startswith("Typhoon-Gezani-Feb-2026 - ")


def test_create_item_carries_license(item: pystac.Item):
    """Keep the root-level license in Item properties."""
    assert item.extra_fields["license"] == "CC-BY-NC-4.0"
    assert create_item(item).properties["license"] == "CC-BY-NC-4.0"


def test_create_item_normalizes_published(item: pystac.Item):
    """Add a timezone to naive published values."""
    item.properties["published"] = "2026-02-16T02:51:00.000000"

    oam_item = create_item(item)
    assert oam_item.properties["published"] == "2026-02-16T02:51:00Z"
    oam_item.validate()


def test_create_item_links_and_assets(item: pystac.Item):
    """Ensure Items point back upstream and offer S3 alternates."""
    oam_item = create_item(item)

    derived_from = oam_item.get_links(pystac.RelType.DERIVED_FROM)
    assert [link.href for link in derived_from] == [
        f"{VANTOR_ROOT}Typhoon-Gezani-Feb-2026/{ORDINARY_ITEM}.json"
    ]

    visual = oam_item.assets["visual"]
    assert visual.href.startswith("https://vantor-opendata.s3.amazonaws.com/")
    assert visual.extra_fields["alternate"]["s3"]["href"] == (
        f"s3://vantor-opendata/events/Typhoon-Gezani-Feb-2026/{ORDINARY_ITEM}.tif"
    )


def test_create_item_fixes_asset_metadata(event_collection: pystac.Collection):
    """Ensure upstream asset metadata that confuses renderers is corrected."""
    mislabelled = read_item(MISLABELLED_ITEM, event_collection)
    assert mislabelled.assets["visual"].roles == ["thumbnail"]

    oam_item = create_item(mislabelled)
    oam_item.validate()
    assert oam_item.assets["visual"].roles == ["visual"]
    assert oam_item.assets["thumbnail"].roles == ["thumbnail"]

    bad_media_type = read_item(BAD_MEDIA_TYPE_ITEM, event_collection)
    assert bad_media_type.assets["thumbnail"].media_type == "image/jpg"

    oam_item = create_item(bad_media_type)
    oam_item.validate()
    assert oam_item.assets["thumbnail"].media_type == pystac.MediaType.JPEG


def test_create_item_without_event_collection():
    """Ensure a detached Item fails rather than losing the event title."""
    item = pystac.read_file(DATA / f"{ORDINARY_ITEM}.json")
    assert isinstance(item, pystac.Item)
    item.clear_links()

    with pytest.raises(ValueError, match="Cannot get parent collection"):
        create_item(item)
