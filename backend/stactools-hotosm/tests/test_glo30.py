"""Test GLO-30 harvesting."""

import pystac
import pytest
import requests
import responses

from stactools.hotosm.glo30 import (
    COLLECTION_ID,
    SOURCE_COLLECTION_URL,
    SOURCE_HTTPS_PREFIX,
    SOURCE_S3_PREFIX,
    SOURCE_SEARCH_URL,
    create_collection,
    create_item,
    https_href,
    walk_items,
)

TILE = "Copernicus_DSM_COG_10_N27_00_E085_00_DEM"
SELF_HREF = f"https://earth-search.aws.element84.com/v1/collections/{COLLECTION_ID}/items/{TILE}"


def source_item(id_: str = TILE) -> dict:
    """Create a source Item."""
    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": id_,
        "collection": COLLECTION_ID,
        "geometry": {
            "type": "Polygon",
            "coordinates": [[[85, 27], [86, 27], [86, 28], [85, 28], [85, 27]]],
        },
        "bbox": [85, 27, 86, 28],
        "properties": {"datetime": "2021-04-22T00:00:00Z", "gsd": 30},
        "assets": {
            "data": {
                "href": f"{SOURCE_S3_PREFIX}{id_}/{id_}.tif",
                "type": "image/tiff; application=geotiff; profile=cloud-optimized",
                "roles": ["data"],
            }
        },
        "links": [
            {"rel": "self", "type": "application/geo+json", "href": SELF_HREF},
            {"rel": "root", "href": "https://earth-search.aws.element84.com/v1"},
            {"rel": "canonical", "href": f"s3://earthsearch-data/{id_}.json"},
        ],
    }


def search_page(*ids: str, next_token: str | None = None) -> dict:
    """Create a search response."""
    links = []
    if next_token is not None:
        links.append(
            {
                "rel": "next",
                "method": "POST",
                "href": SOURCE_SEARCH_URL,
                "merge": False,
                "body": {
                    "collections": [COLLECTION_ID],
                    "limit": 500,
                    "next": next_token,
                },
            }
        )
    return {
        "type": "FeatureCollection",
        "features": [source_item(id_) for id_ in ids],
        "links": links,
        "numberMatched": len(ids),
    }


def test_https_href_rewrites_the_dem_bucket():
    """Rewrite the DEM bucket HREF."""
    assert https_href(f"{SOURCE_S3_PREFIX}{TILE}/{TILE}.tif") == (
        f"{SOURCE_HTTPS_PREFIX}{TILE}/{TILE}.tif"
    )


def test_https_href_leaves_other_hrefs_alone():
    """Preserve unrelated HREFs."""
    assert https_href("https://example.org/dem.tif") == "https://example.org/dem.tif"
    assert https_href("s3://other-bucket/dem.tif") == "s3://other-bucket/dem.tif"


def test_create_item_rewrites_the_asset_and_keeps_s3_as_an_alternate():
    """Retain the S3 HREF as an alternate."""
    item = create_item(pystac.Item.from_dict(source_item()))

    asset = item.assets["data"]
    assert asset.href == f"{SOURCE_HTTPS_PREFIX}{TILE}/{TILE}.tif"
    assert asset.extra_fields["alternate:name"] == "HTTPS"
    assert asset.extra_fields["alternate"]["s3"]["href"] == (
        f"{SOURCE_S3_PREFIX}{TILE}/{TILE}.tif"
    )


def test_create_item_replaces_upstream_links_with_derived_from():
    """Replace upstream links."""
    item = create_item(pystac.Item.from_dict(source_item()))

    assert [(link.rel, link.href) for link in item.links] == [
        ("derived_from", SELF_HREF)
    ]


def test_create_item_adds_no_oam_properties():
    """Omit imagery properties."""
    item = create_item(pystac.Item.from_dict(source_item()))

    assert not [key for key in item.properties if key.startswith("oam:")]


def test_create_item_is_valid_without_a_target_collection_link():
    """Create a valid detached Item."""
    item = create_item(pystac.Item.from_dict(source_item()))

    assert item.collection_id is None
    item.validate()


@responses.activate
def test_create_collection_keeps_license_and_source_links():
    """Retain useful source links."""
    source = pystac.Collection(
        id=COLLECTION_ID,
        description="Copernicus DEM",
        extent=pystac.Extent(
            pystac.SpatialExtent([[-180, -90, 180, 90]]),
            pystac.TemporalExtent([[None, None]]),
        ),
        license="proprietary",
    )
    source.add_link(pystac.Link("self", SOURCE_COLLECTION_URL))
    source.add_link(pystac.Link("license", "https://example.org/license"))
    responses.get(url=SOURCE_COLLECTION_URL, json=source.to_dict())

    with requests.Session() as session:
        collection = create_collection(session)

    assert [(link.rel, link.href) for link in collection.links] == [
        ("license", "https://example.org/license"),
        ("derived_from", SOURCE_COLLECTION_URL),
    ]


@responses.activate
def test_walk_items_follows_paging():
    """Follow search pages."""
    responses.post(url=SOURCE_SEARCH_URL, json=search_page("one", next_token="token"))
    responses.post(url=SOURCE_SEARCH_URL, json=search_page("two"))

    with requests.Session() as session:
        items = list(walk_items(session))

    assert [item.id for item in items] == ["one", "two"]
    assert responses.calls[1].request.body is not None
    assert b'"next": "token"' in responses.calls[1].request.body


@responses.activate
def test_walk_items_passes_a_bbox_through():
    """Pass the bbox to search."""
    responses.post(url=SOURCE_SEARCH_URL, json=search_page("one"))

    with requests.Session() as session:
        list(walk_items(session, bbox=(85.0, 27.0, 86.0, 28.0)))

    assert responses.calls[0].request.body is not None
    assert b'"bbox": [85.0, 27.0, 86.0, 28.0]' in responses.calls[0].request.body


@responses.activate
def test_walk_items_rejects_a_next_link_without_a_body():
    """Reject unusable next links."""
    responses.post(
        url=SOURCE_SEARCH_URL,
        json={
            "type": "FeatureCollection",
            "features": [source_item()],
            "links": [{"rel": "next", "href": SOURCE_SEARCH_URL}],
        },
    )

    with requests.Session() as session, pytest.raises(ValueError, match="next link"):
        list(walk_items(session))
