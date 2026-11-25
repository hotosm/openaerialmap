"""Server-rendered pages to manage published imagery, and the metadata API.

Changes are checked against ownership here and written straight into pgstac,
the only path that writes stored Items (ADR 0011). Each change is recorded
with who made it. The forms are HTMX, like the rest of the uploader (ADR
0007); the map frontend only links here. The JSON API still serves the
metadata editor in Browse until that moves to the page too.
"""

import logging
from datetime import datetime
from typing import Annotated, Any

from litestar import Request, Router, get, patch, post
from litestar import status_codes as status
from litestar.di import Provide
from litestar.enums import RequestEncodingType
from litestar.exceptions import HTTPException
from litestar.params import Body
from litestar.plugins.htmx import HTMXTemplate
from litestar.response import Template
from psycopg import AsyncConnection
from pydantic import BaseModel, Field

from app.auth import organisations
from app.auth.auth_deps import (
    get_optional_auth_user,
    get_user_sub,
    get_user_username,
    login_required,
    session_token,
)
from app.db.database import db_conn
from app.db.models import DbImageryChange
from app.imagery.metadata import (
    LicenceMoreRestrictive,
    LicenceNotChangeable,
    LicenceNotOffered,
    MetadataEdit,
    SeenMetadata,
    changed_meanwhile,
    item_changes,
)
from app.uploads import pgstac

log = logging.getLogger(__name__)

OWNER_FIELD = "oam:owner_id"
_CHANGED_MEANWHILE = "This imagery changed meanwhile. Reload the page and try again."
_NOT_FOUND = "No published imagery has that id."


class TransferForm(BaseModel):
    """The owner picked in the transfer form, and the owner the page showed."""

    # The caller's own `hotosm|<sub>`, or `hotosm-org|<id>` of one of their
    # organisations.
    owner: str = Field(min_length=1, max_length=200)
    # A choice made while the page showed an older owner is not one to act on.
    current: str = Field(default="", max_length=200)


def _require_htmx(request: Request) -> None:
    """Refuse a form that HTMX did not send.

    Another site can post a plain form with the session cookie attached, but
    it cannot set a header without CORS letting it.
    """
    if request.headers.get("HX-Request") != "true":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Use the form on the imagery page to change imagery.",
        )


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


async def _editable_item(
    item_id: str, auth_user: object, request: Request
) -> tuple[dict[str, Any], list[organisations.Organisation]]:
    """Return the Item and the caller's organisations, or refuse.

    The caller must own the Item, or manage the organisation that does.
    """
    orgs = await _organisations(auth_user, request)
    item = await pgstac.get_item(item_id)
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)
    current = item.get("properties", {}).get(OWNER_FIELD)
    if not organisations.can_edit(current, get_user_sub(auth_user), orgs):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "Only the owner of this imagery, or a manager of the "
                "organisation that owns it, can change it."
            ),
        )
    return item, orgs


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


def _owner_name(
    owner: str | None, user_sub: str, orgs: list[organisations.Organisation]
) -> str:
    """Name an owner for the caller; an owner they have no name for stays an id."""
    if owner == user_sub:
        return "you"
    names = {org.owner_id: org.name for org in orgs}
    return names.get(owner) or owner or "nobody"


def _owner_context(
    item: dict[str, Any],
    auth_user: object,
    orgs: list[organisations.Organisation],
    *,
    moved_to: str | None = None,
) -> dict[str, Any]:
    """Build what the owner form shows: who owns the Item and who else could."""
    user_sub = get_user_sub(auth_user)
    current = item.get("properties", {}).get(OWNER_FIELD)
    # Handing imagery to an organisation the caller only belongs to ends
    # their say over it, so the form goes with it.
    can_edit = organisations.can_edit(current, user_sub, orgs)
    owners = [
        {"id": user_sub, "name": f"Yourself ({get_user_username(auth_user)})"},
        *({"id": org.owner_id, "name": org.name} for org in orgs),
    ]
    return {
        "item_id": item["id"],
        "owner_id": current or "",
        "owner_name": _owner_name(current, user_sub, orgs),
        "can_edit": can_edit,
        "choices": [o for o in owners if o["id"] != current] if can_edit else [],
        "moved_to": moved_to,
    }


def _date_label(when: datetime) -> str:
    return f"{when.day} {when:%b %Y}"


def _summary(item: dict[str, Any]) -> dict[str, Any]:
    """Describe the imagery for its page: a preview and a few facts."""
    props = item.get("properties", {})
    captured = props.get("datetime") or props.get("start_datetime")
    try:
        captured = _date_label(datetime.fromisoformat(captured)) if captured else None
    except (TypeError, ValueError):
        captured = None
    gsd = props.get("gsd")
    providers = props.get("providers") or [{}]
    return {
        "title": props.get("title") or item["id"],
        "thumbnail": (item.get("assets", {}).get("thumbnail") or {}).get("href"),
        "facts": [
            (label, value)
            for label, value in (
                ("Captured", captured),
                (
                    "Resolution",
                    f"{gsd:.2f} m" if isinstance(gsd, int | float) else None,
                ),
                ("Provider", providers[0].get("name")),
                ("Licence", props.get("license")),
            )
            if value
        ],
    }


def _problem_page(
    detail: str, status_code: int, *, variant: str = "danger"
) -> Template:
    return HTMXTemplate(
        template_name="imagery.html",
        context={"problem": detail, "problem_variant": variant},
        status_code=status_code,
    )


@get("/{item_id:str}", dependencies={"auth_user": Provide(get_optional_auth_user)})
async def imagery_page(
    item_id: str, auth_user: object | None, request: Request
) -> Template:
    """Render the page where an owner manages one published Item."""
    if auth_user is None:
        return _problem_page(
            "Sign in to manage this imagery.",
            status.HTTP_401_UNAUTHORIZED,
            variant="info",
        )
    try:
        item, orgs = await _editable_item(item_id, auth_user, request)
    except HTTPException as err:
        # Someone followed a link here, so the reason is a page, not JSON.
        return _problem_page(str(err.detail), err.status_code)
    return HTMXTemplate(
        template_name="imagery.html",
        context={**_owner_context(item, auth_user, orgs), **_summary(item)},
    )


@post("/{item_id:str}/owner", status_code=status.HTTP_200_OK)
async def transfer_imagery(
    item_id: str,
    data: Annotated[TransferForm, Body(media_type=RequestEncodingType.URL_ENCODED)],
    auth_user: object,
    db: AsyncConnection,
    request: Request,
) -> Template:
    """Transfer published imagery to another owner and render the form again."""
    _require_htmx(request)
    user_sub = get_user_sub(auth_user)
    item, orgs = await _editable_item(item_id, auth_user, request)
    current = item.get("properties", {}).get(OWNER_FIELD)
    if data.current != (current or ""):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_CHANGED_MEANWHILE
        )
    moved_to = None
    if data.owner != current:
        owner = _transfer_target(data.owner, user_sub, orgs)
        # Recorded first, in the request's transaction: if the Item cannot be
        # written, the record rolls back with it.
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
        try:
            updated = await pgstac.patch_properties(
                item_id, {OWNER_FIELD: owner}, expect={OWNER_FIELD: current}
            )
        except pgstac.ItemChanged:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail=_CHANGED_MEANWHILE
            ) from None
        if updated is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND
            )
        log.info(
            "Transferred %s from %s to %s by %s", item_id, current, owner, user_sub
        )
        item, moved_to = updated, _owner_name(owner, user_sub, orgs)
    # A refusal lands inside the form; a success replaces the whole section.
    return HTMXTemplate(
        template_name="partials/imagery_owner.html",
        context=_owner_context(item, auth_user, orgs, moved_to=moved_to),
        re_target="#imagery-owner",
        re_swap="outerHTML",
    )


class UpdateImageryBody(MetadataEdit):
    """What may change on published imagery. A field left out stays as it is."""

    # What the editor showed, so a change someone made since is not overwritten.
    seen: SeenMetadata | None = None


async def _write(item_id: str, changes: dict[str, Any], expect: dict[str, Any]) -> None:
    """Write properties to the stored Item, refusing a stale or vanished one."""
    try:
        updated = await pgstac.patch_properties(item_id, changes, expect=expect)
    except pgstac.ItemChanged:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_CHANGED_MEANWHILE
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
    """Correct the metadata of published imagery; transfers are on its page."""
    user_sub = get_user_sub(auth_user)
    item, _ = await _editable_item(item_id, auth_user, request)
    current = item.get("properties", {}).get(OWNER_FIELD)

    if data.seen is not None and changed_meanwhile(item, data, data.seen):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail=_CHANGED_MEANWHILE
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
    except LicenceNotChangeable:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "This imagery is under a licence OpenAerialMap cannot change. "
                "Leave the licence as it is."
            ),
        ) from None

    if not edits.properties:
        return {"id": item_id, "owner_id": current}

    # Recorded first, so a refused write rolls the rows back with the request.
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
    # Also refuses an Item transferred since it was checked.
    await _write(
        item_id, dict(edits.properties), {**edits.expected, OWNER_FIELD: current}
    )
    log.info(
        "Edited %s on %s by %s",
        ", ".join(f for f, _, _ in edits.history),
        item_id,
        user_sub,
    )
    return {"id": item_id, "owner_id": current}


imagery_router = Router(
    path="/imagery",
    route_handlers=[imagery_page, transfer_imagery],
    dependencies={
        "db": Provide(db_conn),
        "auth_user": Provide(login_required),
    },
)

imagery_api_router = Router(
    path="/api/v1/imagery",
    route_handlers=[update_imagery],
    dependencies={
        "db": Provide(db_conn),
        "auth_user": Provide(login_required),
    },
)
