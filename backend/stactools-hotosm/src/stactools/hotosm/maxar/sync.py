"""Utilities for syncing Maxar STAC Items."""

import datetime as dt
import logging
from typing import Iterator
from urllib.parse import urljoin

import pystac
import requests

logger = logging.getLogger(__name__)

MAXAR_ROOT = "https://maxar-opendata.s3.amazonaws.com/events/"
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

    for event in events:
        event_date = dt.datetime.strptime(event["date"], "%Y-%m-%d").replace(
            tzinfo=dt.UTC
        )
        if after is None or event_date >= after:
            url = urljoin(MAXAR_ROOT, f"{event['s3_directory']}/collection.json")
            collection = pystac.read_file(url, stac_io=stac_io)
            assert isinstance(collection, pystac.Collection)
            collection.remove_links(pystac.RelType.ROOT)
            yield from collection.get_items(recursive=True)
