"""Test Maxar Item syncing."""

import datetime as dt
from unittest.mock import patch

import pystac
import requests
import responses

from stactools.hotosm.maxar.sync import MAXAR_EVENT_INFO, MAXAR_ROOT, new_stac_items


@responses.activate
def test_new_stac_items_filtering_none():
    """Ensure older events are filtered out."""
    session = requests.Session()
    stac_io = pystac.stac_io.DefaultStacIO()

    resp = responses.get(
        url=MAXAR_EVENT_INFO,
        json=[
            {"date": "2020-01-01"},
            {
                "date": "2020-06-01",
            },
        ],
    )
    items = list(new_stac_items(stac_io, session, dt.datetime.now(tz=dt.UTC)))

    assert len(items) == 0
    assert resp.call_count == 1


@responses.activate
def test_new_stac_items_filtering():
    """Ensure older events are filtered correctly."""
    session = requests.Session()
    stac_io = pystac.stac_io.DefaultStacIO()

    resp = responses.get(
        url=MAXAR_EVENT_INFO,
        json=[
            {"date": "2020-01-01"},
            {
                "date": "2025-05-01",
                "s3_directory": "foo",
            },
        ],
    )
    collection = pystac.Collection(
        id="test",
        description="foo",
        extent=None,
    )
    with patch("pystac.read_file", return_value=collection) as mock:
        items = list(
            new_stac_items(stac_io, session, dt.datetime(2025, 1, 1, tzinfo=dt.UTC))
        )

    assert len(items) == 0
    assert resp.call_count == 1
    mock.assert_called_once_with(
        f"{MAXAR_ROOT.rstrip('/')}/foo/collection.json", stac_io=stac_io
    )
