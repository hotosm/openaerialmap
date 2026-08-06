"""Tests for `stactools.hotosm.maxar.stac`."""

import datetime as dt
import json
from pathlib import Path

import pystac
import pytest

from stactools.hotosm.maxar.stac import create_collection, create_item

DATA = Path(__file__).parent.joinpath("data")


@pytest.fixture
def catalog() -> pystac.Catalog:
    """Example Maxar STAC Catalog."""
    obj = pystac.read_file(DATA / "catalog.json")
    assert isinstance(obj, pystac.Catalog)
    return obj


@pytest.fixture
def event_info() -> list[dict]:
    """Maxar STAC catalog bucket 'event info' listing."""
    with (DATA / "event_info.json").open() as f:
        events = json.load(f)

    for event in events:
        event["date"] = dt.datetime.strptime(event["date"], "%Y-%m-%d")
    return events


@pytest.fixture
def item() -> pystac.Item:
    """Example Maxar catalog STAC Item."""
    obj = pystac.read_file(DATA / "item.json")
    assert isinstance(obj, pystac.Item)
    return obj


def test_create_collection(catalog: pystac.Catalog, event_info: list[dict]):
    """Test Collection creation."""
    event_dates = [info["date"] for info in event_info]
    collection = create_collection(catalog, min(event_dates), max(event_dates))
    collection.validate()

    collection = create_collection(catalog)
    assert collection.extent.temporal.intervals == [[None, None]]
    collection.validate()


def test_create_item(item: pystac.Item):
    """Test STAC Item creation."""
    oam_item = create_item(item)
    oam_item.validate()

    assert oam_item.properties["oam:producer_name"] == "Maxar"
    assert oam_item.properties["oam:platform_type"] == "satellite"
