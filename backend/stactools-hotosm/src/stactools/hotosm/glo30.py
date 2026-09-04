"""Harvest Copernicus GLO-30 elevation Items from Earth Search."""

import logging
from typing import Any, Iterator

import requests
from pystac import Collection, Item, Link, MediaType, RelType

from stactools.hotosm.stac_common import add_alternate_assets

logger = logging.getLogger(__name__)

COLLECTION_ID = "cop-dem-glo-30"

EARTH_SEARCH_URL = "https://earth-search.aws.element84.com/v1"
SOURCE_COLLECTION_URL = f"{EARTH_SEARCH_URL}/collections/{COLLECTION_ID}"
SOURCE_SEARCH_URL = f"{EARTH_SEARCH_URL}/search"

SOURCE_S3_PREFIX = "s3://copernicus-dem-30m/"
SOURCE_HTTPS_PREFIX = "https://copernicus-dem-30m.s3.eu-central-1.amazonaws.com/"

DEFAULT_PAGE_SIZE = 500
REQUEST_TIMEOUT = 30


def https_href(href: str) -> str:
    """Rewrite a Copernicus DEM S3 HREF to its anonymous HTTPS equivalent."""
    if not href.startswith(SOURCE_S3_PREFIX):
        return href
    return href.replace(SOURCE_S3_PREFIX, SOURCE_HTTPS_PREFIX, 1)


def read_source_collection(session: requests.Session) -> dict[str, Any]:
    """Read the GLO-30 Collection document from Earth Search."""
    response = session.get(SOURCE_COLLECTION_URL, timeout=REQUEST_TIMEOUT)
    response.raise_for_status()
    return response.json()


def create_collection(session: requests.Session) -> Collection:
    """Rewrite the source Collection links for our catalogue."""
    source = read_source_collection(session)
    collection = Collection.from_dict(source)

    license_links = [
        link for link in collection.links if link.rel == RelType.LICENSE.value
    ]
    collection.clear_links()
    for link in license_links:
        collection.add_link(link)

    collection.add_link(
        Link(
            rel=RelType.DERIVED_FROM,
            target=SOURCE_COLLECTION_URL,
            media_type=MediaType.JSON,
        )
    )

    collection.validate()

    return collection


def create_item(item: Item) -> Item:
    """Rewrite a source Item for our catalogue."""
    dem_item = item.clone()
    dem_item.set_collection(None)

    for asset in dem_item.assets.values():
        asset.href = https_href(asset.href)

    add_alternate_assets(dem_item)

    dem_item.clear_links()
    if item_href := item.get_self_href():
        dem_item.add_link(
            Link(
                rel=RelType.DERIVED_FROM,
                target=item_href,
                media_type=MediaType.GEOJSON,
            )
        )

    return dem_item


def walk_items(
    session: requests.Session,
    bbox: tuple[float, float, float, float] | None = None,
    page_size: int = DEFAULT_PAGE_SIZE,
) -> Iterator[Item]:
    """Yield every GLO-30 Item from Earth Search, following its paging links."""
    body: dict[str, Any] = {"collections": [COLLECTION_ID], "limit": page_size}
    if bbox is not None:
        body["bbox"] = list(bbox)

    next_body: dict[str, Any] | None = body
    seen = 0
    while next_body is not None:
        body = next_body
        response = session.post(
            SOURCE_SEARCH_URL,
            json=body,
            timeout=REQUEST_TIMEOUT,
        )
        response.raise_for_status()
        page = response.json()

        if seen == 0 and (matched := page.get("numberMatched")) is not None:
            logger.info("Earth Search reports %s matching Items", matched)

        for feature in page.get("features", []):
            yield Item.from_dict(feature)
            seen += 1

        next_body = _next_page_body(page, body)

    logger.info("Read %s Items from Earth Search", seen)


def _next_page_body(
    page: dict[str, Any],
    body: dict[str, Any],
) -> dict[str, Any] | None:
    """Build the POST body for the next page, or None at the end of the search."""
    for link in page.get("links", []):
        if link.get("rel") != "next":
            continue

        next_body = link.get("body")
        if next_body is None:
            raise ValueError("Earth Search returned a next link without a body")

        # A merged next body patches the previous request.
        if link.get("merge", False):
            return {**body, **next_body}
        return dict(next_body)

    return None
