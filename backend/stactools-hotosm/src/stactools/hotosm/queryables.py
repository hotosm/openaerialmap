"""PgSTAC queryables for the OAM Collection."""

from psycopg.types.json import Jsonb
from pypgstac.db import PgstacDB

# Account fields, indexed so a search for one account's imagery stays fast.
OAM_QUERYABLES: dict[str, dict] = {
    "oam:owner_id": {
        "title": "Owner",
        "description": "Current owner as `provider|id`.",
        "type": "string",
    },
    "oam:uploader_id": {
        "title": "Uploader",
        "description": "Uploading account as `provider|id`.",
        "type": "string",
    },
}


def sync_queryables(pgstac: PgstacDB, collection_id: str) -> list[str]:
    """Create or update the OAM queryables for a Collection.

    PgSTAC builds the index on each of the Collection's partitions, now and
    when a new one is created. The Collection must already exist.

    Returns:
        The names of the queryables that were synced.
    """
    for name, definition in OAM_QUERYABLES.items():
        # CQL2 compares these as text, so the index wraps them with to_text too.
        updated = pgstac.query_one(
            """
            UPDATE queryables
            SET definition = %s, property_wrapper = 'to_text',
                property_index_type = 'BTREE'
            WHERE name = %s AND %s = ANY(collection_ids)
            RETURNING id
            """,
            [Jsonb(definition), name, collection_id],
        )
        if updated is None:
            pgstac.query_one(
                """
                INSERT INTO queryables (name, collection_ids, definition,
                    property_wrapper, property_index_type)
                VALUES (%s, %s, %s, 'to_text', 'BTREE')
                RETURNING id
                """,
                [name, [collection_id], Jsonb(definition)],
            )
    return list(OAM_QUERYABLES)
