"""
Catalog figures for the statistics and landing pages, from one pgSTAC query.

Counting rules (agreed in hotosm/openaerialmap#353):

- Hosted and federated imagery are reported separately, never added together.
  Federated means provider collections indexed in this catalog while the
  imagery stays with the provider (``FEDERATED``), not other OAM instances
  (hotosm/openaerialmap#248).
- An *image* is a scene (Maxar tiles sharing a ``catalog_id`` are one image);
  an *entry* is a catalog item.
- Area is in km², split by GSD class. Overlapping images each count in full.
- Items coarser than 5 m (hosted) / 50 m (federated) GSD, or larger than
  10,000 km² / 50,000 km², still count as images and entries but are set
  aside from area: a few hosted items have broken, continent-sized footprints.
- Exact duplicates (same collection, geometry, capture time and title) add
  their area once.
- Capture dates outside 1990..tomorrow (UTC) are counted as invalid and left
  out of the by-year figures and the capture range.
"""

import logging
from datetime import datetime

from psycopg import Connection
from psycopg.rows import dict_row

log = logging.getLogger(__name__)

GROUPS = ("hosted", "federated")
HOSTED = ["openaerialmap"]
FEDERATED = ["maxar-opendata", "vantor-opendata", "noaa-emergency-response"]
# An elevation model, not imagery.
EXCLUDED = ["cop-dem-glo-30"]
GSD_CLASSES = ("under_10cm", "10_50cm", "over_50cm", "unknown")
# Breakdown dimension -> (file, field naming the value in each row).
BREAKDOWNS = {
    "platform": ("platforms.json", "platform"),
    "year": ("by-year.json", "year"),
    "license": ("licenses.json", "license"),
    "collection": ("collections.json", "collection"),
}

QUERY = """
WITH items AS (
    SELECT i.id,
           i.collection,
           i.datetime,  -- the pgstac column; most hosted items lack properties.datetime
           i.geometry,
           i.content -> 'properties' AS p,
           c.content ->> 'license' AS collection_license,
           CASE WHEN i.collection = ANY(%(hosted)s) THEN 'hosted' ELSE 'federated' END AS grp
    FROM pgstac.items i
    JOIN pgstac.collections c ON c.id = i.collection
    WHERE i.collection = ANY(%(hosted)s) OR i.collection = ANY(%(federated)s)
),
typed AS (
    SELECT *,
           -- A GSD of zero or less counts as unknown.
           CASE WHEN jsonb_typeof(p -> 'gsd') = 'number'
                THEN nullif(greatest((p ->> 'gsd')::float8, 0), 0) END AS gsd,
           coalesce(
               CASE WHEN jsonb_typeof(p -> 'oam:footprint_area') = 'number'
                    THEN (p ->> 'oam:footprint_area')::float8 END,
               ST_Area(geometry::geography)
           ) AS area_m2,
           CASE WHEN datetime >= '1990-01-01' AND datetime < now() + interval '1 day'
                THEN datetime END AS captured
    FROM items
),
f AS (
    SELECT grp,
           collection,
           coalesce(p ->> 'catalog_id', id) AS scene,
           coalesce(
               lower(p ->> 'oam:platform_type'),
               CASE collection WHEN 'noaa-emergency-response' THEN 'aircraft'
                               WHEN 'maxar-opendata' THEN 'satellite'
                               WHEN 'vantor-opendata' THEN 'satellite' END,
               'unknown'
           ) AS platform,
           coalesce(p ->> 'license', collection_license, 'unspecified') AS license,
           extract(year FROM captured)::int AS year_captured,
           captured,
           gsd,
           area_m2,
           coalesce(gsd > CASE grp WHEN 'hosted' THEN 5 ELSE 50 END, false)
               OR coalesce(area_m2 > CASE grp WHEN 'hosted' THEN 1e10 ELSE 5e10 END, false)
               AS set_aside,
           row_number() OVER (
               PARTITION BY collection,
                            md5(encode(ST_AsBinary(ST_SnapToGrid(geometry, 1e-6)), 'hex')
                                || coalesce(datetime::text, '') || coalesce(p ->> 'title', ''))
               ORDER BY id
           ) > 1 AS duplicate
    FROM typed
),
counted AS (
    SELECT *, NOT set_aside AND NOT duplicate AS in_area FROM f
)
SELECT CASE WHEN GROUPING(platform) = 0 THEN 'platform'
            WHEN GROUPING(year_captured) = 0 THEN 'year'
            WHEN GROUPING(license) = 0 THEN 'license'
            WHEN GROUPING(collection) = 0 THEN 'collection'
            ELSE 'group' END AS dim,
       grp,
       coalesce(platform, year_captured::text, license, collection) AS key,
       count(DISTINCT scene) AS images,
       count(*) AS entries,
       coalesce(sum(area_m2) FILTER (WHERE in_area AND gsd < 0.1), 0) AS area_under_10cm,
       coalesce(sum(area_m2) FILTER (WHERE in_area AND gsd >= 0.1 AND gsd < 0.5), 0)
           AS area_10_50cm,
       coalesce(sum(area_m2) FILTER (WHERE in_area AND gsd >= 0.5), 0) AS area_over_50cm,
       coalesce(sum(area_m2) FILTER (WHERE in_area AND gsd IS NULL), 0) AS area_unknown,
       count(*) FILTER (WHERE set_aside) AS set_aside,
       coalesce(sum(area_m2) FILTER (WHERE set_aside AND NOT duplicate), 0)
           AS set_aside_area,
       count(*) FILTER (WHERE duplicate) AS duplicates,
       count(*) FILTER (WHERE captured IS NULL) AS invalid_dates,
       min(captured) AS earliest,
       max(captured) AS latest
FROM counted
GROUP BY GROUPING SETS (
    (grp), (grp, platform), (grp, year_captured), (grp, license), (grp, collection)
)
"""


def _km2(m2: float) -> float:
    return round(m2 / 1e6, 2)


def documents(rows: list[dict], generated_at: datetime) -> dict[str, dict]:
    """Turn the query rows into {file name: JSON document}."""
    docs = {"index.json": {"generated_at": generated_at}}
    for name, _ in BREAKDOWNS.values():
        docs[name] = {"generated_at": generated_at, "hosted": [], "federated": []}

    for row in rows:
        figures = {
            "images": row["images"],
            "entries": row["entries"],
            "area_km2": {c: _km2(row[f"area_{c}"]) for c in GSD_CLASSES},
        }
        dates = {"earliest_capture": row["earliest"], "latest_capture": row["latest"]}
        if row["dim"] == "group":
            docs["index.json"][row["grp"]] = {
                **figures,
                **dates,
                "invalid_dates": row["invalid_dates"],
                "duplicates": row["duplicates"],
                "set_aside": {
                    "items": row["set_aside"],
                    "area_km2": _km2(row["set_aside_area"]),
                },
            }
        elif row["key"] is not None:  # invalid dates have no year
            name, field = BREAKDOWNS[row["dim"]]
            value = int(row["key"]) if row["dim"] == "year" else row["key"]
            extra = dates if row["dim"] == "collection" else {}
            docs[name][row["grp"]].append({field: value, **figures, **extra})

    for dim, (name, field) in BREAKDOWNS.items():
        for grp in GROUPS:
            by_name = dim in ("year", "collection")
            docs[name][grp].sort(
                key=lambda r: r[field] if by_name else (-r["images"], r[field])
            )
    return docs


def landing(docs: dict[str, dict]) -> dict:
    """The stats.json shape the landing page reads, from the same figures."""
    index = docs["index.json"]
    hosted = index["hosted"]
    return {
        "generated_at": index["generated_at"],
        "collection": HOSTED[0],
        "items": hosted["entries"],
        "area_km2": round(sum(hosted["area_km2"].values())),
        "latest_capture": hosted["latest_capture"],
        "catalog": {
            "total_items": sum(index[g]["entries"] for g in GROUPS if g in index),
            "collections": sum(len(docs["collections.json"][g]) for g in GROUPS),
        },
    }


def compute(conn: Connection, generated_at: datetime) -> dict[str, dict]:
    # UTC, so capture years don't depend on the server's time zone.
    conn.execute("SET TimeZone = 'UTC'")
    ungrouped = conn.execute(
        "SELECT id FROM pgstac.collections WHERE NOT id = ANY(%s) ORDER BY id",
        [HOSTED + FEDERATED + EXCLUDED],
    ).fetchall()
    if ungrouped:
        log.warning(
            "Stats skip collections in no group: %s",
            ", ".join(r[0] for r in ungrouped),
        )
    with conn.cursor(row_factory=dict_row) as cur:
        rows = cur.execute(QUERY, {"hosted": HOSTED, "federated": FEDERATED}).fetchall()
    return documents(rows, generated_at)
