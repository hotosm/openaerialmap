"""Tests for `stactools.hotosm.queryables`."""

from typing import Any

import pytest
from pypgstac.db import PgstacDB

from stactools.hotosm.queryables import OAM_QUERYABLES, sync_queryables


def _pgstac(monkeypatch: pytest.MonkeyPatch, existing: set[str]) -> list[str]:
    """Record the statements run, treating `existing` as already registered."""
    statements: list[str] = []

    def _query_one(_self, query: str, args: list[Any]) -> int | None:
        verb = query.split()[0]
        name = args[1] if verb == "UPDATE" else args[0]
        statements.append(f"{verb} {name}")
        return None if verb == "UPDATE" and name not in existing else 1

    monkeypatch.setattr(PgstacDB, "query_one", _query_one)
    return statements


def test_new_queryables_are_inserted(monkeypatch: pytest.MonkeyPatch):
    """Insert every queryable that is not registered yet."""
    statements = _pgstac(monkeypatch, existing=set())

    names = sync_queryables(PgstacDB("postgresql://"), "openaerialmap")

    assert names == list(OAM_QUERYABLES)
    assert statements == [
        "UPDATE oam:owner_id",
        "INSERT oam:owner_id",
        "UPDATE oam:uploader_id",
        "INSERT oam:uploader_id",
    ]


def test_existing_queryables_are_updated_not_duplicated(
    monkeypatch: pytest.MonkeyPatch,
):
    """Rerunning the sync must not trip PgSTAC's unique name check."""
    statements = _pgstac(monkeypatch, existing={"oam:owner_id"})

    sync_queryables(PgstacDB("postgresql://"), "openaerialmap")

    assert statements == [
        "UPDATE oam:owner_id",
        "UPDATE oam:uploader_id",
        "INSERT oam:uploader_id",
    ]
