"""Organisations the signed-in account may publish imagery as.

HOT Login owns organisations and their members. `GET /api/groups` is the
contract other HOT apps (Portal) consume for membership: the session token is
forwarded as the `hanko` cookie, so Login answers for that account only.

Answers are cached briefly per account. An unreachable Login raises rather
than caching, so a membership check fails closed.
"""

import logging
import time
from dataclasses import dataclass
from typing import Any

import httpx

from app.config import settings

log = logging.getLogger(__name__)

# Owner ids for organisations, next to `hotosm|<sub>` for accounts.
ORG_PREFIX = "hotosm-org"

# Membership is security-sensitive, so keep the staleness window short.
CACHE_TTL_SECONDS = 60.0
# Login answers from its database in well under a second; the upload waits.
REQUEST_TIMEOUT_SECONDS = 5.0
# One entry per signed-in account; well above the concurrent users expected.
_CACHE_MAX = 1000


@dataclass(frozen=True)
class Organisation:
    """An organisation the account is an approved member of."""

    id: str
    name: str

    @property
    def owner_id(self) -> str:
        """The organisation as an `oam:owner_id`."""
        return f"{ORG_PREFIX}|{self.id}"


class LoginUnavailable(Exception):
    """Login did not answer, so membership could not be checked."""


_cache: dict[str, tuple[float, list[Organisation]]] = {}


async def user_organisations(
    user_sub: str, session_token: str | None
) -> list[Organisation]:
    """Return the approved organisations the account belongs to.

    Empty when organisations are not configured (`LOGIN_API_URL`), the request
    carries no session, or Login rejects it. Raises `LoginUnavailable` when
    Login cannot be reached; that answer is never cached.
    """
    if not settings.LOGIN_API_URL or not session_token:
        return []
    cached = _cache.get(user_sub)
    if cached and cached[0] > time.monotonic():
        return cached[1]

    url = f"{settings.LOGIN_API_URL.rstrip('/')}/api/groups"
    # trust_env=False: a proxy from the environment must not see the session.
    try:
        async with httpx.AsyncClient(
            timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS), trust_env=False
        ) as client:
            resp = await client.get(
                url,
                params={"type": "organization"},
                cookies={"hanko": session_token},
                headers={"accept": "application/json"},
            )
    except httpx.HTTPError as err:
        raise LoginUnavailable(str(err)) from err
    if resp.status_code in (httpx.codes.UNAUTHORIZED, httpx.codes.FORBIDDEN):
        # A session Login rejects simply has no organisations here; the
        # upload itself answers for the session.
        orgs: list[Organisation] = []
    elif resp.status_code != httpx.codes.OK:
        raise LoginUnavailable(f"HTTP {resp.status_code} from {url}")
    else:
        orgs = _parse(resp.json())

    if len(_cache) >= _CACHE_MAX:
        _prune()
    _cache[user_sub] = (time.monotonic() + CACHE_TTL_SECONDS, orgs)
    return orgs


def _parse(payload: Any) -> list[Organisation]:
    # Approved organisations only: the owner is published with the Item, and
    # anyone can ask Login for an organisation under any name.
    groups = payload.get("groups", []) if isinstance(payload, dict) else []
    return [
        Organisation(id=str(g["id"]), name=str(g.get("name") or ""))
        for g in groups
        if g.get("id")
        and g.get("type") == "organization"
        and g.get("status") == "approved"
    ]


def _prune() -> None:
    now = time.monotonic()
    for key in [k for k, (expires, _) in _cache.items() if expires <= now]:
        del _cache[key]
    if len(_cache) >= _CACHE_MAX:
        _cache.clear()
