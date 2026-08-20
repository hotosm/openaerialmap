"""Utilities for syncing Maxar STAC Items."""

import datetime as dt
import logging
from typing import Iterator
from urllib.parse import urljoin

import pystac
import requests

logger = logging.getLogger(__name__)

MAXAR_ROOT = "https://vantor-opendata.s3.amazonaws.com/events/"
MAXAR_EVENT_INFO = "https://vantor-opendata.s3.amazonaws.com/events/catalog.json"


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
    events = r.json().get("links", [])

    for e in events:

        # pull the href from the event json
        ev = session.get(e["href"])
        ev.raise_for_status()
        event = er.json()

        event_date = dt.datetime.strptime(event["odp:event_date"], "%Y-%m-%dT%H:%M:%SZ")
        if after is None or event_date >= after:
            url = e["href"]
            collection = pystac.read_file(url, stac_io=stac_io)
            assert isinstance(collection, pystac.Collection)
            collection.remove_links(pystac.RelType.ROOT)
            yield from collection.get_items(recursive=True)


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
    events = r.json().get("links", [])

    for event in events:
        url = event["href"]
        r = session.get(url)
        if not r.ok:
            # Some events listed in "event_info.json" have no Collection in
            # the bucket, so don't fail the whole catalog for one of them
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
