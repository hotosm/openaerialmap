"""Test Vantor Item syncing."""

import datetime as dt
from unittest.mock import patch

import pystac
import pytest
import requests
import responses

from stactools.hotosm.vantor.sync import (
    VANTOR_CATALOG,
    VANTOR_ROOT,
    all_catalog_ids,
    event_collection_hrefs,
    new_stac_items,
    published_datetime,
)

FOO_COLLECTION = f"{VANTOR_ROOT}foo/collection.json"
BAR_COLLECTION = f"{VANTOR_ROOT}bar/collection.json"


def catalog_json(*hrefs: str) -> dict:
    """Root Catalog listing event Collections as children."""
    return {
        "links": [
            {"rel": "root", "href": VANTOR_CATALOG},
            *({"rel": "child", "href": href} for href in hrefs),
        ]
    }


def collection_json(*hrefs: str) -> dict:
    """Event Collection listing its Items."""
    return {
        "links": [
            {"rel": "root", "href": VANTOR_CATALOG},
            *({"rel": "item", "href": href} for href in hrefs),
        ]
    }


def item(id_: str, published: str | None) -> pystac.Item:
    """Minimal Vantor STAC Item."""
    properties = {} if published is None else {"published": published}
    return pystac.Item(
        id=id_,
        geometry=None,
        bbox=None,
        datetime=dt.datetime(2026, 1, 1, tzinfo=dt.UTC),
        properties=properties,
    )


@responses.activate
def test_event_collection_hrefs():
    """Ensure event Collections come from the root Catalog's child links."""
    responses.get(url=VANTOR_CATALOG, json=catalog_json(FOO_COLLECTION, BAR_COLLECTION))

    assert list(event_collection_hrefs(requests.Session())) == [
        FOO_COLLECTION,
        BAR_COLLECTION,
    ]


@pytest.mark.parametrize(
    ("published", "expected"),
    [
        # Vantor writes both of these shapes
        ("2026-02-16T02:51:00.0Z", dt.datetime(2026, 2, 16, 2, 51, tzinfo=dt.UTC)),
        ("2026-02-16T02:51:00.000000", dt.datetime(2026, 2, 16, 2, 51, tzinfo=dt.UTC)),
        (None, None),
        ("not a date", None),
    ],
)
def test_published_datetime(published: str | None, expected: dt.datetime | None):
    """Ensure "published" is parsed, and naive values are read as UTC."""
    assert published_datetime(item("foo", published)) == expected


@responses.activate
def test_new_stac_items_filtering():
    """Ensure Items published before the cutoff are filtered out."""
    responses.get(url=VANTOR_CATALOG, json=catalog_json(FOO_COLLECTION))

    collection = pystac.Collection(id="foo", description="foo", extent=None)
    collection.add_items(
        [
            item("old", "2025-01-01T00:00:00Z"),
            item("new", "2026-01-01T00:00:00Z"),
        ]
    )

    with patch("pystac.read_file", return_value=collection):
        items = list(
            new_stac_items(
                pystac.stac_io.DefaultStacIO(),
                requests.Session(),
                dt.datetime(2025, 6, 1, tzinfo=dt.UTC),
            )
        )

    assert [i.id for i in items] == ["new"]


@responses.activate
def test_new_stac_items_deduplicates_and_skips_unpublished():
    """Drop duplicate and unpublished Items."""
    responses.get(url=VANTOR_CATALOG, json=catalog_json(FOO_COLLECTION))

    collection = pystac.Collection(id="foo", description="foo", extent=None)
    collection.add_items(
        [
            item("dupe", "2026-01-01T00:00:00Z"),
            item("dupe", "2026-01-01T00:00:00Z"),
            item("unpublished", None),
        ]
    )

    with patch("pystac.read_file", return_value=collection):
        items = list(
            new_stac_items(
                pystac.stac_io.DefaultStacIO(),
                requests.Session(),
                dt.datetime(2025, 6, 1, tzinfo=dt.UTC),
            )
        )

    assert [i.id for i in items] == ["dupe"]


@responses.activate
def test_all_catalog_ids():
    """Ensure catalog IDs are collected from every event Collection."""
    responses.get(url=VANTOR_CATALOG, json=catalog_json(FOO_COLLECTION, BAR_COLLECTION))
    responses.get(
        url=FOO_COLLECTION,
        json=collection_json(
            f"{VANTOR_ROOT}foo/1234.json", f"{VANTOR_ROOT}foo/5678.json"
        ),
    )
    responses.get(
        url=BAR_COLLECTION, json=collection_json(f"{VANTOR_ROOT}bar/9012.json")
    )

    assert list(all_catalog_ids(requests.Session())) == ["1234", "5678", "9012"]


@responses.activate
def test_all_catalog_ids_missing_event_collection():
    """Ensure events without a Collection in the bucket are skipped."""
    responses.get(url=VANTOR_CATALOG, json=catalog_json(FOO_COLLECTION, BAR_COLLECTION))
    responses.get(url=FOO_COLLECTION, status=404)
    responses.get(
        url=BAR_COLLECTION, json=collection_json(f"{VANTOR_ROOT}bar/9012.json")
    )

    assert list(all_catalog_ids(requests.Session())) == ["9012"]
