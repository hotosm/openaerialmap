"""Server-rendered upload and profile pages.

HTMX refreshes upload status; the uploader remains plain JavaScript.
"""

import uuid

from litestar import Router, get
from litestar.datastructures import CacheControlHeader
from litestar.di import Provide
from litestar.params import FromQuery
from litestar.plugins.htmx import HTMXTemplate
from litestar.response import Template
from psycopg import AsyncConnection

from app.auth.auth_deps import (
    get_optional_auth_user,
    get_user_sub,
    get_user_username,
    login_required,
    mirror_user,
)
from app.db.database import db_conn
from app.db.models import TERMINAL_STATUSES, DbUpload

MAX_TRACKED = 20


def _upload_ids(raw: str) -> list[str]:
    """Parse up to `MAX_TRACKED` UUIDs from a comma-separated string."""
    ids = []
    for part in raw.split(",")[:MAX_TRACKED]:
        try:
            ids.append(str(uuid.UUID(part.strip())))
        except ValueError:
            continue
    return ids


@get("/")
async def upload_page(auth_user: object | None) -> Template:
    """Render the single upload page."""
    return HTMXTemplate(
        template_name="upload.html",
        context={
            "active_nav": "upload",
            "logged_in": auth_user is not None,
            "username": get_user_username(auth_user) if auth_user else None,
        },
    )


@get("/uploads", dependencies={"auth_user": Provide(login_required)})
async def uploads_partial(auth_user: object, db: AsyncConnection) -> Template:
    """Render the current user's uploads list (htmx partial, polled)."""
    uploads = await DbUpload.for_user(db, get_user_sub(auth_user))
    return HTMXTemplate(
        template_name="partials/uploads.html",
        context={"uploads": uploads},
    )


@get("/uploads/anonymous", cache_control=CacheControlHeader(no_store=True))
async def anonymous_uploads_partial(
    db: AsyncConnection, ids: FromQuery[str] = ""
) -> Template:
    """Render anonymous uploads identified by caller-held IDs."""
    upload_ids = _upload_ids(ids)
    uploads = await DbUpload.anonymous_by_ids(db, upload_ids, limit=MAX_TRACKED)
    return HTMXTemplate(
        template_name="partials/anonymous_uploads.html",
        context={
            "uploads": uploads,
            "anonymous": True,
            "pending": any(u.status not in TERMINAL_STATUSES for u in uploads),
            "empty_message": "These uploads are no longer being tracked.",
        },
    )


@get("/profile", dependencies={"auth_user": Provide(login_required)})
async def profile_page(auth_user: object, db: AsyncConnection) -> Template:
    """Render the user profile page, syncing the identity into `users`."""
    user = await mirror_user(db, auth_user)
    return HTMXTemplate(
        template_name="profile.html",
        context={"active_nav": "profile", "user": user},
    )


@get("/profile/me", dependencies={"auth_user": Provide(login_required)})
async def profile_sync(auth_user: object, db: AsyncConnection) -> dict:
    """Persist the identity emitted by the client login hook.

    This avoids waiting for the user to visit the profile page.
    """
    user = await mirror_user(db, auth_user)
    return {"sub": user.sub, "username": user.username}


page_router = Router(
    path="/",
    route_handlers=[
        upload_page,
        uploads_partial,
        anonymous_uploads_partial,
        profile_page,
        profile_sync,
    ],
    dependencies={
        "db": Provide(db_conn),
        "auth_user": Provide(get_optional_auth_user),
    },
)
