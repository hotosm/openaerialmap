"""Tests for `stactools.hotosm.cli`."""

import datetime as dt
from dataclasses import dataclass
from typing import Iterator

import pystac
import pytest

from stactools.hotosm.catalogs import CATALOGS
from stactools.hotosm.cli import OAM_CATALOG_KEY, main, sync_handler

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


@dataclass
class _Entry:
    """Raw metadata carrying the ID it converts into."""

    id: str


def _create_item(raw_metadata: _Entry) -> pystac.Item:
    """Create a STAC Item, failing for the entry named ``bad``."""
    if raw_metadata.id == "bad":
        raise ValueError("cannot create a STAC Item from this entry")
    return _item(raw_metadata.id)


def _entries(*ids: str) -> Iterator[_Entry]:
    """Yield raw metadata for each ID."""
    yield from (_Entry(id_) for id_ in ids)


def _middle_entry_fails(_uploaded_after: dt.datetime) -> Iterator[_Entry]:
    """Yield raw metadata whose second entry cannot be converted."""
    yield from _entries("good-1", "bad", "good-2")


def _first_entry_fails(_uploaded_after: dt.datetime) -> Iterator[_Entry]:
    """Yield raw metadata whose first entry cannot be converted."""
    yield from _entries("bad", "good-1")


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
            raw_metadata_creator=lambda _: _entries("good-1", "good-2"),
            stac_item_creator=_create_item,
            uploaded_after=UPLOADED_AFTER,
            handle_exceptions="RAISE",
        )

        assert [item["id"] for item in items] == ["good-1", "good-2"]
        assert all(item["collection"] == COLLECTION_ID for item in items)
        assert errors == []

    def test_colliding_target_ids_are_rejected(self):
        """Two source Items landing on one ID would overwrite each other."""
        with pytest.raises(ValueError, match="already taken by source Item"):
            sync_handler(
                collection_id=COLLECTION_ID,
                raw_metadata_creator=lambda _: _entries("a/b", "a-b"),
                stac_item_creator=lambda entry: _item(entry.id.replace("/", "-")),
                uploaded_after=UPLOADED_AFTER,
                handle_exceptions="RAISE",
                target_item_id=lambda id_: id_.replace("/", "-"),
            )

    def test_colliding_target_ids_are_reported_when_ignoring(self):
        """`IGNORE` keeps the first Item and reports the collision."""
        items, errors = sync_handler(
            collection_id=COLLECTION_ID,
            raw_metadata_creator=lambda _: _entries("a/b", "a-b"),
            stac_item_creator=lambda entry: _item(entry.id.replace("/", "-")),
            uploaded_after=UPLOADED_AFTER,
            handle_exceptions="IGNORE",
            target_item_id=lambda id_: id_.replace("/", "-"),
        )

        assert [item["id"] for item in items] == ["a-b"]
        assert len(errors) == 1
        assert "already taken by source Item" in errors[0]

    def test_unpredicted_item_id_is_rejected(self):
        """A catalog whose `prepare_item` and `target_item_id` disagree fails."""
        with pytest.raises(ValueError, match="is not the predicted"):
            sync_handler(
                collection_id=COLLECTION_ID,
                raw_metadata_creator=lambda _: _entries("a/b"),
                stac_item_creator=lambda entry: _item(entry.id.replace("/", "_")),
                uploaded_after=UPLOADED_AFTER,
                handle_exceptions="RAISE",
                target_item_id=lambda id_: id_.replace("/", "-"),
            )

    def test_existing_items_are_looked_up_by_target_id(self):
        """A provider rewriting its IDs is matched on the ID PgSTAC stores."""
        queried: list[list[str]] = []

        def _existing(_collection_id: str, item_ids: list[str]) -> set[str]:
            queried.append(item_ids)
            return {"a-1"}

        items, errors = sync_handler(
            collection_id=COLLECTION_ID,
            raw_metadata_creator=lambda _: _entries("a/1", "a/2"),
            stac_item_creator=lambda entry: _item(entry.id.replace("/", "-")),
            uploaded_after=UPLOADED_AFTER,
            handle_exceptions="RAISE",
            existing_ids_finder=_existing,
            target_item_id=lambda id_: id_.replace("/", "-"),
        )

        assert queried == [["a-1", "a-2"]]
        assert [item["id"] for item in items] == ["a-2"]
        assert errors == []

    def test_existing_items_are_not_rebuilt(self):
        """Do not build Items already in PgSTAC."""
        built = []

        def _record(entry: _Entry) -> pystac.Item:
            built.append(entry.id)
            return _item(entry.id)

        items, errors = sync_handler(
            collection_id=COLLECTION_ID,
            raw_metadata_creator=lambda _: _entries("old", "new"),
            stac_item_creator=_record,
            uploaded_after=UPLOADED_AFTER,
            handle_exceptions="RAISE",
            existing_ids_finder=lambda _collection, _ids: {"old"},
        )

        assert built == ["new"]
        assert [item["id"] for item in items] == ["new"]
        assert errors == []


class TestCatalogCommands:
    """Test catalog registry commands."""

    def test_command_per_registered_catalog(self):
        """Create dump and sync commands for every catalog."""
        assert {"dump-maxar", "sync-maxar"} <= set(main.commands)

        for key in CATALOGS:
            assert f"dump-{key.lower()}" in main.commands
            assert f"sync-{key.lower()}" in main.commands

    def test_collection_choices_cover_every_catalog(self):
        """`--catalog` offers OAM and every registered open data catalog."""
        catalog_option = next(
            param
            for param in main.commands["dump-collection"].params
            if param.name == "catalog"
        )

        assert list(catalog_option.type.choices) == [OAM_CATALOG_KEY, *CATALOGS]
