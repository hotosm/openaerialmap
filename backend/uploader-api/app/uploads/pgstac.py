"""Write STAC items through pgstac database functions.

The STAC transactions extension stays disabled, and workflow pods never receive
database credentials.
"""

import logging
from typing import Any

import psycopg
from litestar import status_codes as status
from litestar.exceptions import HTTPException
from psycopg.types.json import Jsonb
from stac_pydantic import Item
from stac_pydantic.extensions import validate_extensions

from app.config import settings

log = logging.getLogger(__name__)


def validate_item(
    item: dict[str, Any], expected_id: str, collection: str
) -> dict[str, Any]:
    """Validate and normalize a STAC item before writing it.

    The item ID must match the authorized upload, and the server controls its
    collection. Extension validation may be relaxed for remote schema failures.
    """
    item_id = item.get("id")
    if not isinstance(item_id, str) or not item_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="item.id is missing"
        )
    if item_id != expected_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="item.id does not match the authorised upload",
        )

    # pgstac requires an explicit datetime; STAC 1.1 items that carry only
    # start/end_datetime must send datetime: null.
    props = item.setdefault("properties", {})
    if "datetime" not in props and (
        "start_datetime" in props or "end_datetime" in props
    ):
        props["datetime"] = None

    # Use the collection from server configuration.
    item["collection"] = collection
    # Items with a collection also need collection and parent links.
    collection_href = f"{settings.STAC_URL.rstrip('/')}/collections/{collection}"
    links = item.setdefault("links", [])
    have = {link.get("rel") for link in links if isinstance(link, dict)}
    for rel in ("collection", "parent"):
        if rel not in have:
            links.append(
                {"rel": rel, "href": collection_href, "type": "application/json"}
            )

    try:
        Item.model_validate(item)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"invalid STAC item: {exc}",
        ) from exc

    # Remote extension validation rejects failures only in strict mode.
    if item.get("stac_extensions"):
        try:
            validate_extensions(item, reraise_exception=True)
        except Exception as exc:  # noqa: BLE001
            if settings.STAC_STRICT_EXTENSIONS:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"STAC extension validation failed: {exc}",
                ) from exc
            log.warning(
                "stac_extensions validation failed for %s (non-strict): %s",
                item_id,
                exc,
            )

    return item


async def upsert_item(item: dict[str, Any]) -> None:
    """Insert or update a STAC item.

    Idempotency makes workflow retries safe. The collection must already exist.
    """
    async with await psycopg.AsyncConnection.connect(settings.PGSTAC_DB_URL) as conn:
        async with conn.cursor() as cur:
            await cur.execute("SELECT pgstac.upsert_item(%s::jsonb);", (Jsonb(item),))
