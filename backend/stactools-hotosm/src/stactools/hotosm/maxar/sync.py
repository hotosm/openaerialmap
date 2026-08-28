"""Utilities for syncing Maxar STAC Items."""

import datetime as dt
import logging
from typing import Iterator
from urllib.parse import urljoin

import pystac
import requests

logger = logging.getLogger(__name__)

MAXAR_ROOT = "https://maxar-opendata.s3.amazonaws.com/events/"
MAXAR_CATALOG = "https://maxar-opendata.s3.amazonaws.com/events/catalog.json"
MAXAR_EVENT_INFO = "https://maxar-opendata.s3.amazonaws.com/events/event_info.json"


def new_stac_items(
    stac_io: pystac.StacIO,
    session: requests.Session,
    after: dt.datetime,
) -> Iterator[pystac.Item]:
    """Find Maxar STAC Items newer than some date.

    This function helps subset the catalog by using the "event_info.json"
    file in the root of the bucket that catalogs STAC Collections added
    by event.

    Args:
        stac_io: PySTAC StacIO instance
        session: requests Session object
        after: Only return Items added after this date.

    Yields:
        STAC Items
    """
    r = session.get(MAXAR_EVENT_INFO)
    r.raise_for_status()
    events = r.json()

    seen: set[str] = set()
    for event in events:
        event_date = dt.datetime.strptime(event["date"], "%Y-%m-%d").replace(
            tzinfo=dt.UTC
        )
        if after is None or event_date >= after:
            url = urljoin(MAXAR_ROOT, f"{event['s3_directory']}/collection.json")
            collection = pystac.read_file(url, stac_io=stac_io)
            assert isinstance(collection, pystac.Collection)
            collection.remove_links(pystac.RelType.ROOT)

            for item in collection.get_items(recursive=True):
                # An acquisition covering two events is one Maxar Item, filed
                # under each event's Collection.
                if item.id in seen:
                    continue
                seen.add(item.id)
                yield item


def all_catalog_ids(session: requests.Session) -> Iterator[str]:
    """Find every Maxar acquisition "catalog ID" in the open data bucket.

    Each event Collection has one child Collection per acquisition, and those
    are named after the acquisition's "catalog_id" Item property, so the IDs
    can be collected from the child links rather than by reading every
    Collection in the catalog.

    Args:
        session: requests Session object

    Yields:
        Maxar catalog IDs, which may include duplicates if an acquisition
        covers more than one event.
    """
    r = session.get(MAXAR_EVENT_INFO)
    r.raise_for_status()
    events = r.json()

    for event in events:
        url = urljoin(MAXAR_ROOT, f"{event['s3_directory']}/collection.json")
        r = session.get(url)
        if not r.ok:
            # Skip events without a Collection in the bucket.
            logger.warning(
                "Skipping event Collection missing from bucket (HTTP %s): %s",
                r.status_code,
                url,
            )
            continue

        for link in r.json().get("links", []):
            if link.get("rel") == pystac.RelType.CHILD:
                filename = link["href"].rsplit("/", 1)[-1]
                yield filename.removesuffix(".json").removesuffix("_collection")
