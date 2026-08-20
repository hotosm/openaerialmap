"""Server-rendered upload and profile pages.

HTMX refreshes upload status; the uploader remains plain JavaScript.
"""

from litestar import Router, get
from litestar.di import Provide
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
from app.db.models import DbUpload


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
    route_handlers=[upload_page, uploads_partial, profile_page, profile_sync],
    dependencies={
        "db": Provide(db_conn),
        "auth_user": Provide(get_optional_auth_user),
    },
)
