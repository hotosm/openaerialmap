"""Writes to stored Items, against a pgstac that speaks just enough SQL."""

import copy
from contextlib import asynccontextmanager

import psycopg
import pytest

from app.uploads import pgstac

_OWNER = "oam:owner_id"


class _Cursor:
    def __init__(self, rows):
        self._rows = rows

    async def fetchone(self):
        return self._rows[0] if self._rows else None

    async def fetchall(self):
        return self._rows


class _Pgstac:
    """Items in a dict, a transaction that undoes itself on error, and conflicts."""

    def __init__(self, *items):
        self.items = {item["id"]: item for item in items}
        # Writes that fail as a concurrent transaction would make them fail.
        self.conflicts = 0
        self.writes = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    @asynccontextmanager
    async def transaction(self):
        before = copy.deepcopy(self.items)
        try:
            yield
        except BaseException:
            self.items = before
            raise

    async def execute(self, sql, params=None):
        if "pgstac.get_item" in sql:
            return _Cursor([(copy.deepcopy(self.items.get(params["id"])),)])
        if "pgstac.update_item" in sql:
            if self.conflicts:
                self.conflicts -= 1
                raise psycopg.errors.SerializationFailure
            item = params["item"].obj
            self.items[item["id"]] = copy.deepcopy(item)
            self.writes += 1
        return _Cursor([])


@pytest.fixture
def catalogue(monkeypatch):
    """One stored Item with tilepack assets, owned by a user."""
    store = _Pgstac(
        {
            "id": "item-1",
            "properties": {_OWNER: "hotosm|me", "title": "Ward 5"},
            "assets": {"visual": {"href": "v.tif"}, "pmtiles": {"href": "t.pmtiles"}},
        }
    )

    async def connect(*args, **kwargs):
        return store

    monkeypatch.setattr(pgstac.psycopg.AsyncConnection, "connect", connect)
    return store


@pytest.mark.asyncio
async def test_a_patch_keeps_everything_it_does_not_change(catalogue):
    item = await pgstac.patch_properties(
        "item-1", {_OWNER: "hotosm-org|org-1"}, expect={_OWNER: "hotosm|me"}
    )

    stored = catalogue.items["item-1"]
    assert item == stored
    assert stored["properties"] == {_OWNER: "hotosm-org|org-1", "title": "Ward 5"}
    # A rebuild would drop these (ADR 0011).
    assert set(stored["assets"]) == {"visual", "pmtiles"}


@pytest.mark.asyncio
async def test_a_patch_on_an_item_that_changed_writes_nothing(catalogue):
    with pytest.raises(pgstac.ItemChanged):
        await pgstac.patch_properties(
            "item-1", {_OWNER: "hotosm|me"}, expect={_OWNER: "hotosm-org|org-1"}
        )

    assert catalogue.writes == 0
    assert catalogue.items["item-1"]["properties"][_OWNER] == "hotosm|me"


@pytest.mark.asyncio
async def test_a_patch_on_a_missing_item_is_none(catalogue):
    assert await pgstac.patch_properties("nope", {_OWNER: "hotosm|me"}) is None
    assert catalogue.writes == 0


@pytest.mark.asyncio
async def test_a_patch_retries_a_write_another_transaction_got_in_first(catalogue):
    catalogue.conflicts = pgstac._MAX_ATTEMPTS - 1

    await pgstac.patch_properties("item-1", {_OWNER: "hotosm-org|org-1"})

    assert catalogue.writes == 1
    assert catalogue.items["item-1"]["properties"][_OWNER] == "hotosm-org|org-1"


@pytest.mark.asyncio
async def test_a_patch_gives_up_after_its_retries(catalogue):
    catalogue.conflicts = pgstac._MAX_ATTEMPTS

    with pytest.raises(psycopg.errors.SerializationFailure):
        await pgstac.patch_properties("item-1", {_OWNER: "hotosm-org|org-1"})

    assert catalogue.items["item-1"]["properties"][_OWNER] == "hotosm|me"
