"""Change what the catalogue says about published imagery.

Edits are checked against ownership here and written straight into pgstac,
the only path that writes stored Items (ADR 0011). Each change is recorded
with who made it.
"""

import logging

from litestar import Request, Router, patch
from litestar import status_codes as status
from litestar.di import Provide
from litestar.exceptions import HTTPException
from psycopg import AsyncConnection
from pydantic import BaseModel, Field

from app.auth import organisations
from app.auth.auth_deps import get_user_sub, login_required, session_token
from app.db.database import db_conn
from app.db.models import DbImageryChange
from app.uploads import pgstac

log = logging.getLogger(__name__)

OWNER_FIELD = "oam:owner_id"


class UpdateImageryBody(BaseModel):
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


@patch("/{item_id:str}")
async def update_imagery(
    item_id: str,
    data: UpdateImageryBody,
    auth_user: object,
    db: AsyncConnection,
    request: Request,
) -> dict:
    """Transfer published imagery to another owner.

    The caller must own the Item, or manage the organisation that does.
    """
    user_sub = get_user_sub(auth_user)
    orgs = await _organisations(auth_user, request)
    item = await pgstac.get_item(item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No published imagery has that id.",
        )
    current = item.get("properties", {}).get(OWNER_FIELD)
    if not organisations.can_edit(current, user_sub, orgs):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the owner of this imagery, or a manager of the "
                "organisation that owns it, can change it."
            ),
        )
    if data.owner is None or data.owner == current:
        return {"id": item_id, "owner_id": current}

    owner = _transfer_target(data.owner, user_sub, orgs)
    try:
        updated = await pgstac.patch_properties(
            item_id, {OWNER_FIELD: owner}, expect={OWNER_FIELD: current}
        )
    except pgstac.ItemChanged:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This imagery changed meanwhile. Reload the page and try again.",
        ) from None
    if updated is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No published imagery has that id.",
        )
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
