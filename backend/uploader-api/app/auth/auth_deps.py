"""Shared HOT auth dependencies.

Normalize identities as ``provider|id``. Disabled auth uses a local admin.
"""

from types import SimpleNamespace
from typing import Any

from litestar import Request
from litestar import status_codes as status
from litestar.exceptions import HTTPException

from app.config import AuthProvider, settings

try:  # Only importable when the hotosm-auth[litestar] extra is installed.
    from hotosm_auth_litestar import (
        get_current_user,
        get_current_user_optional,
        setup_auth,
    )
except ImportError:  # pragma: no cover - allows boot with AUTH disabled
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
