"""Tests for `stactools.hotosm.cli`."""

import datetime as dt
from typing import Iterator

import pystac
import pytest

from stactools.hotosm.cli import sync_handler

COLLECTION_ID = "test-collection"
UPLOADED_AFTER = dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc)


def _item(id_: str) -> pystac.Item:
    """Build a minimal STAC Item for testing."""
    return pystac.Item(
        id=id_,
        geometry={
            "type": "Polygon",
            "coordinates": [
                [[0.0, 0.0], [1.0, 0.0], [1.0, 1.0], [0.0, 1.0], [0.0, 0.0]]
            ],
        },
        bbox=[0.0, 0.0, 1.0, 1.0],
        datetime=UPLOADED_AFTER,
        properties={},
    )


def _create_item(raw_metadata: str) -> pystac.Item:
    """Create a STAC Item, failing for the entry named ``bad``."""
    if raw_metadata == "bad":
        raise ValueError("cannot create a STAC Item from this entry")
    return _item(raw_metadata)


def _middle_entry_fails(_uploaded_after: dt.datetime) -> Iterator[str]:
    """Yield raw metadata whose second entry cannot be converted."""
    yield from ["good-1", "bad", "good-2"]


def _first_entry_fails(_uploaded_after: dt.datetime) -> Iterator[str]:
    """Yield raw metadata whose first entry cannot be converted."""
    yield from ["bad", "good-1"]


class TestSyncHandler:
    """Test the `sync_handler` orchestration helper."""

    def test_ignored_failure_is_skipped(self):
        """A failed entry is skipped rather than duplicating the previous Item."""
        items, errors = sync_handler(
            collection_id=COLLECTION_ID,
            raw_metadata_creator=_middle_entry_fails,
            stac_item_creator=_create_item,
            uploaded_after=UPLOADED_AFTER,
            handle_exceptions="IGNORE",
        )

        assert [item["id"] for item in items] == ["good-1", "good-2"]
        assert all(item["collection"] == COLLECTION_ID for item in items)
        assert len(errors) == 1

    def test_ignored_failure_on_first_entry(self):
        """A failure on the first entry is skipped without raising."""
        items, errors = sync_handler(
            collection_id=COLLECTION_ID,
            raw_metadata_creator=_first_entry_fails,
            stac_item_creator=_create_item,
            uploaded_after=UPLOADED_AFTER,
            handle_exceptions="IGNORE",
        )

        assert [item["id"] for item in items] == ["good-1"]
        assert len(errors) == 1

    def test_failure_is_raised_by_default(self):
        """`RAISE` propagates the underlying exception."""
        with pytest.raises(ValueError):
            sync_handler(
                collection_id=COLLECTION_ID,
                raw_metadata_creator=_middle_entry_fails,
                stac_item_creator=_create_item,
                uploaded_after=UPLOADED_AFTER,
                handle_exceptions="RAISE",
            )

    def test_all_entries_succeed(self):
        """Every Item is collected and stamped with the Collection ID."""
        items, errors = sync_handler(
            collection_id=COLLECTION_ID,
            raw_metadata_creator=lambda _: iter(["good-1", "good-2"]),
            stac_item_creator=_create_item,
            uploaded_after=UPLOADED_AFTER,
            handle_exceptions="RAISE",
        )

        assert [item["id"] for item in items] == ["good-1", "good-2"]
        assert all(item["collection"] == COLLECTION_ID for item in items)
        assert errors == []
