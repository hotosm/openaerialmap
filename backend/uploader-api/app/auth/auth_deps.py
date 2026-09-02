"""Shared HOT auth dependencies.

Normalize identities as ``provider|id``. Disabled auth uses a local admin.
"""

from types import SimpleNamespace
from typing import Any

from litestar import Request
from litestar import status_codes as status
from litestar.exceptions import HTTPException
from psycopg import AsyncConnection

from app.config import AuthProvider, settings
from app.db.models import ANONYMOUS_SUB, DbUser

# hotosm-auth is optional when authentication is disabled.
try:
    from hotosm_auth_litestar import (
        get_current_user,
        get_current_user_optional,
        setup_auth,
    )
except ImportError:  # pragma: no cover
    get_current_user = None
    get_current_user_optional = None
    setup_auth = None

_LOCAL_ADMIN = SimpleNamespace(sub="custom|1", username="localadmin", is_admin=True)


def _pick(user: object, *names: str) -> Any:
    """Return the first non-empty attribute/key from `names`."""
    for name in names:
        value = user.get(name) if isinstance(user, dict) else getattr(user, name, None)
        if value not in (None, ""):
            return value
    return None


def get_user_sub(user: object) -> str:
    """Normalise a hotosm-auth user to `provider|id` form."""
    prefix = {AuthProvider.HOTOSM: "hotosm"}.get(settings.AUTH_PROVIDER)
    sub = _pick(user, "sub", "user_sub")
    if sub:
        sub = str(sub)
        if sub == ANONYMOUS_SUB:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authenticated user is missing a valid identifier.",
            )
        if "|" in sub:
            existing, raw = sub.split("|", 1)
            if existing == AuthProvider.CUSTOM.value:
                return sub
            return f"{prefix}|{raw}" if prefix else sub
        return f"{prefix or 'osm'}|{sub}"
    uid = _pick(user, "uid", "id", "user_id")
    if uid is not None:
        return f"{prefix or 'osm'}|{uid}"
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authenticated user is missing a valid identifier.",
    )


def get_user_username(user: object) -> str:
    """Return the first usable username."""
    username = _pick(user, "username", "preferred_username", "name")
    if username:
        return str(username)
    email = _pick(user, "email", "email_address")
    return str(email).split("@")[0] if email else "unknown"


def get_user_display_name(user: object) -> str | None:
    """Return the user's full name if the session carries one."""
    name = _pick(user, "name", "full_name")
    return str(name) if name else None


def get_user_email(user: object) -> str | None:
    """Return the user's email if the session carries one.

    Only used to populate the local identity mirror. It is deliberately not used
    as a default for the catalogue's public `contact` field: publishing someone's
    address because they happened to be logged in is their decision, not ours.
    """
    email = _pick(user, "email", "email_address")
    return str(email) if email else None


async def mirror_user(db: AsyncConnection, user: object) -> DbUser:
    """Upsert the local mirror of the signed-in identity.

    The one place the mirror is written, so every page and route stores the same
    fields and none of them can narrow an earlier, fuller session.
    """
    return await DbUser.upsert(
        db,
        DbUser(
            sub=get_user_sub(user),
            username=get_user_username(user),
            name=get_user_display_name(user),
            email_address=get_user_email(user),
        ),
    )


def _auth_disabled() -> bool:
    return settings.DEBUG or settings.AUTH_PROVIDER == AuthProvider.DISABLED


async def login_required(request: Request) -> object:
    """Dependency for endpoints that require an authenticated user."""
    if _auth_disabled():
        return _LOCAL_ADMIN
    if get_current_user is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Auth enabled but hotosm-auth is not installed.",
        )
    return await get_current_user(request)


async def get_optional_auth_user(request: Request) -> object | None:
    """Dependency returning the user when present, else None."""
    if _auth_disabled():
        return _LOCAL_ADMIN
    if get_current_user_optional is None:
        return None
    return await get_current_user_optional(request)
