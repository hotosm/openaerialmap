"""Utilities for syncing Vantor STAC Items."""

import datetime as dt
import logging
from typing import Iterator

import pystac
import requests

from stactools.hotosm.opendata import item_timestamp

logger = logging.getLogger(__name__)

VANTOR_ROOT = "https://vantor-opendata.s3.amazonaws.com/events/"
VANTOR_CATALOG = "https://vantor-opendata.s3.amazonaws.com/events/catalog.json"

PUBLISHED_PROPERTY = "published"


def event_collection_hrefs(session: requests.Session) -> Iterator[str]:
    """Yield event Collection HREFs from the root Catalog."""
    r = session.get(VANTOR_CATALOG)
    r.raise_for_status()

    for link in r.json().get("links", []):
        if link.get("rel") == pystac.RelType.CHILD:
            yield link["href"]


def published_datetime(item: pystac.Item) -> dt.datetime | None:
    """Parse an Item's published date, treating naive values as UTC."""
    return item_timestamp(item, PUBLISHED_PROPERTY)


def new_stac_items(
    stac_io: pystac.StacIO,
    session: requests.Session,
    after: dt.datetime,
) -> Iterator[pystac.Item]:
    """Yield Vantor Items published on or after a date."""
    seen: set[str] = set()

    for href in event_collection_hrefs(session):
        collection = pystac.read_file(href, stac_io=stac_io)
        assert isinstance(collection, pystac.Collection)
        collection.remove_links(pystac.RelType.ROOT)

        for item in collection.get_items(recursive=True):
            # Some event Collections repeat Item links.
            if item.id in seen:
                continue
            seen.add(item.id)

            published = published_datetime(item)
            if published is None:
                logger.warning(
                    "Skipping Item without a usable %r property: %s",
                    PUBLISHED_PROPERTY,
                    item.id,
                )
                continue

            if published >= after:
                yield item


def all_catalog_ids(session: requests.Session) -> Iterator[str]:
    """Yield Vantor catalog IDs from event Collection links."""
    for href in event_collection_hrefs(session):
        r = session.get(href)
        if not r.ok:
            # Skip missing event Collections.
            logger.warning(
                "Skipping event Collection missing from bucket (HTTP %s): %s",
                r.status_code,
                href,
            )
            continue

        for link in r.json().get("links", []):
            if link.get("rel") == pystac.RelType.ITEM:
                filename = link["href"].rsplit("/", 1)[-1]
                yield filename.removesuffix(".json")
