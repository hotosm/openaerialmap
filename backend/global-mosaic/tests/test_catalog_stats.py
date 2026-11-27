"""catalog_stats against a real pgstac, loaded with a small catalog.

Runs only when PGSTAC_TEST_DSN is set (``just test global-mosaic`` does). The
database's pgstac items and collections are wiped first.
"""

import json
import logging
import os
from datetime import UTC, datetime

import catalog_stats
import psycopg
import pytest

DSN = os.environ.get("PGSTAC_TEST_DSN")
LICENSES = {
    "openaerialmap": "various",
    "maxar-opendata": "CC-BY-NC-4.0",
    "vantor-opendata": "CC-BY-NC-4.0",
    "noaa-emergency-response": "CC0-1.0",
    "cop-dem-glo-30": "proprietary",
}


def item(iid, cid, year, km2=None, x=0, size=0.01, platform=None, **props) -> dict:
    """An item on a square footprint, captured on 1 January of `year`."""
    ring = [[x, 0], [x + size, 0], [x + size, size], [x, size], [x, 0]]
    if km2 is not None:
        props["oam:footprint_area"] = km2 * 1e6
    if platform:
        props["oam:platform_type"] = platform
    return {
        "type": "Feature",
        "stac_version": "1.0.0",
        "id": iid,
        "collection": cid,
        "geometry": {"type": "Polygon", "coordinates": [ring]},
        "bbox": [x, 0, x + size, size],
        "properties": {"datetime": f"{year:04}-01-01T00:00:00Z", **props},
        "links": [],
        "assets": {},
    }


OAM, CC = "openaerialmap", "CC-BY-4.0"
DUP = {"x": 10, "platform": "uav", "gsd": 0.03, "title": "t", "license": CC}
ITEMS = [
    item("drone", OAM, 2020, 1, platform="UAV", gsd=0.05, license=CC),
    # No license of its own: falls back to the collection's.
    item("aircraft", OAM, 2021, 2, platform="aircraft", gsd=0.2),
    # Exact duplicates: two entries and two images, but the area counts once.
    *[item(f"dup-{n}", OAM, 2022, 3, **DUP) for n in (1, 2)],
    # Continent-sized with an absurd GSD: an image, but set aside from area.
    item("continent", OAM, 2019, x=-60, size=50, gsd=4e5, license=CC),
    # Year 26: an invalid date, left out of the by-year figures and capture range.
    item("year-26", OAM, 26, 1, platform="uav", gsd=0.05, license="CC-BY-SA-4.0"),
    # Federated: three Maxar tiles of one capture are one image.
    *[
        item(f"maxar-{n}", "maxar-opendata", 2023, 10, x=n, gsd=0.3, catalog_id="c")
        for n in (1, 2, 3)
    ],
    # 0.5 m sits on the upper bound, so it lands in the coarsest class.
    item("vantor", "vantor-opendata", 2024, 5, gsd=0.5),
    # A zero GSD counts as unknown; no platform falls back to the default.
    item("noaa", "noaa-emergency-response", 2024, 4, gsd=0),
    item("dem", "cop-dem-glo-30", 2021, gsd=30),
]

NOW = datetime(2026, 11, 16, tzinfo=UTC)


@pytest.fixture(scope="module")
def conn():
    if not DSN:
        pytest.skip("PGSTAC_TEST_DSN not set")
    with psycopg.connect(DSN, autocommit=True) as conn:
        (count,) = conn.execute(
            "SELECT count(*) FROM (SELECT 1 FROM pgstac.items LIMIT %s) s",
            [len(ITEMS) + 1],
        ).fetchone()
        if count > len(ITEMS):
            pytest.fail("PGSTAC_TEST_DSN looks like a real catalog; not wiping it")
        conn.execute("DELETE FROM pgstac.items")
        conn.execute("DELETE FROM pgstac.collections")
        for cid, license in LICENSES.items():
            collection = {
                "type": "Collection",
                "stac_version": "1.0.0",
                "id": cid,
                "description": cid,
                "license": license,
                "extent": {
                    "spatial": {"bbox": [[-180, -90, 180, 90]]},
                    "temporal": {"interval": [[None, None]]},
                },
                "links": [],
            }
            conn.execute(
                "SELECT pgstac.create_collection(%s::jsonb)", [json.dumps(collection)]
            )
        conn.execute("SELECT pgstac.create_items(%s::jsonb)", [json.dumps(ITEMS)])
        yield conn


@pytest.fixture(scope="module")
def docs(conn):
    return catalog_stats.compute(conn, NOW)


def by(rows: list[dict], field: str) -> dict:
    return {row[field]: row for row in rows}


def test_hosted_totals(docs):
    hosted = docs["index.json"]["hosted"]
    assert (hosted["images"], hosted["entries"]) == (6, 6)
    # drone 1 + duplicates 3 (once) + year-0026 1; aircraft 2; continent set aside
    assert hosted["area_km2"] == {
        "under_10cm": 5.0,
        "10_50cm": 2.0,
        "over_50cm": 0.0,
        "unknown": 0.0,
    }
    assert (hosted["duplicates"], hosted["invalid_dates"]) == (1, 1)
    assert hosted["set_aside"]["items"] == 1
    assert hosted["set_aside"]["area_km2"] > 10_000_000
    assert hosted["earliest_capture"].year == 2019
    assert hosted["latest_capture"].year == 2022


def test_federated_totals(docs):
    federated = docs["index.json"]["federated"]
    assert (federated["images"], federated["entries"]) == (3, 5)  # DEM excluded
    assert federated["area_km2"] == {
        "under_10cm": 0.0,
        "10_50cm": 30.0,
        "over_50cm": 5.0,
        "unknown": 4.0,
    }


def test_platforms(docs):
    hosted = docs["platforms.json"]["hosted"]
    assert hosted[0]["platform"] == "uav"  # most images first
    assert hosted[0]["images"] == 4  # "UAV" and "uav" merge
    federated = by(docs["platforms.json"]["federated"], "platform")
    assert federated["aircraft"]["images"] == 1  # NOAA default
    assert federated["satellite"]["images"] == 2


def test_by_year_skips_invalid_dates(docs):
    years = docs["by-year.json"]["hosted"]
    assert [r["year"] for r in years] == [2019, 2020, 2021, 2022]
    assert by(years, "year")[2022]["images"] == 2


def test_licenses_fall_back_to_collection(docs):
    hosted = by(docs["licenses.json"]["hosted"], "license")
    assert set(hosted) == {"CC-BY-4.0", "CC-BY-SA-4.0", "various"}
    assert hosted["various"]["images"] == 1
    assert by(docs["licenses.json"]["federated"], "license")["CC0-1.0"]["images"] == 1


def test_collections(docs):
    federated = docs["collections.json"]["federated"]
    assert [c["collection"] for c in federated] == [
        "maxar-opendata",
        "noaa-emergency-response",
        "vantor-opendata",
    ]
    assert (federated[0]["images"], federated[0]["entries"]) == (1, 3)


def test_landing(docs):
    assert catalog_stats.landing(docs) == {
        "generated_at": NOW,
        "collection": "openaerialmap",
        "items": 6,
        "area_km2": 7,
        "latest_capture": docs["index.json"]["hosted"]["latest_capture"],
        "catalog": {"total_items": 11, "collections": 4},
    }


def test_warns_about_ungrouped_collections(conn, caplog, monkeypatch):
    monkeypatch.setattr(catalog_stats, "EXCLUDED", [])
    with caplog.at_level(logging.WARNING):
        catalog_stats.compute(conn, NOW)
    assert "cop-dem-glo-30" in caplog.text
