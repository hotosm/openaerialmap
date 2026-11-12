"""Change what the catalogue says about published imagery.

Edits are checked against ownership here and written straight into pgstac,
the only path that writes stored Items (ADR 0011). Each change is recorded
with who made it.
"""

import logging
from typing import Any

from litestar import Request, Router, patch
from litestar import status_codes as status
from litestar.di import Provide
from litestar.exceptions import HTTPException
from psycopg import AsyncConnection
from pydantic import Field

from app.auth import organisations
from app.auth.auth_deps import get_user_sub, login_required, session_token
from app.db.database import db_conn
from app.db.models import DbImageryChange
from app.imagery.metadata import (
    LicenceMoreRestrictive,
    LicenceNotOffered,
    MetadataEdit,
    item_changes,
)
from app.uploads import pgstac

log = logging.getLogger(__name__)

OWNER_FIELD = "oam:owner_id"

_NOT_FOUND = "No published imagery has that id."


class UpdateImageryBody(MetadataEdit):
    """What may change on published imagery. A field left out stays as it is."""

    # The caller's own `hotosm|<sub>`, or `hotosm-org|<id>` of one of their
    # organisations.
    owner: str | None = Field(default=None, max_length=200)


async def _organisations(
    auth_user: object, request: Request
) -> list[organisations.Organisation]:
    try:
        return await organisations.user_organisations(
            get_user_sub(auth_user), session_token(request)
        )
    except organisations.LoginUnavailable:
        log.warning("Could not check organisations with HOT Login", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "HOT Login could not confirm your organisations. Try again in a moment."
            ),
        ) from None


def _transfer_target(
    owner: str, user_sub: str, orgs: list[organisations.Organisation]
) -> str:
    """Return the owner to transfer to: the caller or one of their organisations."""
    if owner == user_sub or owner in {org.owner_id for org in orgs}:
        return owner
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=(
            "Imagery can be transferred to yourself or to an organisation you "
            "belong to."
        ),
    )


async def _write(item_id: str, changes: dict[str, Any], expect: dict[str, Any]) -> None:
    """Write properties to the stored Item, refusing a stale or vanished one."""
    try:
        updated = await pgstac.patch_properties(item_id, changes, expect=expect)
    except pgstac.ItemChanged:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This imagery changed meanwhile. Reload the page and try again.",
        ) from None
    if updated is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)


@patch("/{item_id:str}")
async def update_imagery(
    item_id: str,
    data: UpdateImageryBody,
    auth_user: object,
    db: AsyncConnection,
    request: Request,
) -> dict:
    """Correct the metadata of published imagery, or transfer it, or both.

    The caller must own the Item, or manage the organisation that does.
    """
    user_sub = get_user_sub(auth_user)
    orgs = await _organisations(auth_user, request)
    item = await pgstac.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)
    current = item.get("properties", {}).get(OWNER_FIELD)
    if not organisations.can_edit(current, user_sub, orgs):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the owner of this imagery, or a manager of the "
                "organisation that owns it, can change it."
            ),
        )

    try:
        edits = item_changes(item, data)
    except LicenceNotOffered:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "OpenAerialMap does not offer that licence. Choose CC-BY 4.0, "
                "CC BY-NC 4.0 or CC BY-SA 4.0."
            ),
        ) from None
    except LicenceMoreRestrictive:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "People already use this imagery under its current licence, so "
                "it can only change to a less restrictive one. Keep the current "
                "licence or choose one that allows more."
            ),
        ) from None

    # Check the transfer before writing anything, so a refused one leaves the
    # metadata sent with it unwritten too.
    owner = current
    if data.owner is not None and data.owner != current:
        owner = _transfer_target(data.owner, user_sub, orgs)

    if edits.properties:
        await _write(item_id, edits.properties, edits.expected)
        for field, old, new in edits.history:
            await DbImageryChange.create(
                db,
                DbImageryChange(
                    item_id=item_id,
                    field=field,
                    actor_sub=user_sub,
                    old_value=old,
                    new_value=new,
                ),
            )
        log.info(
            "Edited %s on %s by %s",
            ", ".join(f for f, _, _ in edits.history),
            item_id,
            user_sub,
        )

    if owner == current:
        return {"id": item_id, "owner_id": current}

    await _write(item_id, {OWNER_FIELD: owner}, {OWNER_FIELD: current})
    await DbImageryChange.create(
        db,
        DbImageryChange(
            item_id=item_id,
            field=OWNER_FIELD,
            actor_sub=user_sub,
            old_value=current,
            new_value=owner,
        ),
    )
    log.info("Transferred %s from %s to %s by %s", item_id, current, owner, user_sub)
    return {"id": item_id, "owner_id": owner}


imagery_router = Router(
    path="/api/v1/imagery",
    route_handlers=[update_imagery],
    dependencies={
        "db": Provide(db_conn),
        "auth_user": Provide(login_required),
    },
)
