"""Organisation membership from HOT Login."""

import httpx
import pytest

from app.auth import organisations

_SUB = "hotosm|42"


@pytest.fixture(autouse=True)
def _login(monkeypatch):
    monkeypatch.setattr(organisations.settings, "LOGIN_API_URL", "http://login")
    organisations._cache.clear()


def _answer(monkeypatch, handler):
    """Route the client's requests to `handler` and record them."""
    seen = []

    def record(request):
        seen.append(request)
        return handler(request)

    transport = httpx.MockTransport(record)
    real_client = httpx.AsyncClient
    monkeypatch.setattr(
        organisations.httpx,
        "AsyncClient",
        lambda **kw: real_client(transport=transport, **kw),
    )
    return seen


def _group(id: str, type: str, status: str) -> dict:
    return {"id": id, "type": type, "name": id.title(), "status": status}


_GROUPS = {
    "groups": [
        _group("org-1", "organization", "approved"),
        _group("org-2", "organization", "pending"),
        _group("team-1", "team", "approved"),
    ]
}


@pytest.mark.asyncio
async def test_only_approved_organisations_count(monkeypatch):
    """Forward the session to Login and keep approved organisations only."""
    seen = _answer(monkeypatch, lambda r: httpx.Response(200, json=_GROUPS))

    orgs = await organisations.user_organisations(_SUB, "tok")

    assert orgs == [organisations.Organisation(id="org-1", name="Org-1")]
    assert orgs[0].owner_id == "hotosm-org|org-1"
    request = seen[0]
    assert request.url == "http://login/api/groups?type=organization"
    assert request.headers["cookie"] == "hanko=tok"


@pytest.mark.asyncio
async def test_answers_are_cached_per_account(monkeypatch):
    seen = _answer(monkeypatch, lambda r: httpx.Response(200, json=_GROUPS))

    await organisations.user_organisations(_SUB, "tok")
    await organisations.user_organisations(_SUB, "tok")
    organisations._cache.clear()
    await organisations.user_organisations(_SUB, "tok")

    assert len(seen) == 2


@pytest.mark.asyncio
@pytest.mark.parametrize("code", [401, 403])
async def test_a_rejected_session_has_no_organisations(monkeypatch, code):
    _answer(monkeypatch, lambda r: httpx.Response(code))

    assert await organisations.user_organisations(_SUB, "tok") == []


@pytest.mark.asyncio
async def test_an_unreachable_login_raises_and_is_not_cached(monkeypatch):
    """Membership checks must fail closed, and retry next time."""
    calls = []

    def flaky(request):
        calls.append(request)
        if len(calls) == 1:
            raise httpx.ConnectError("down")
        return httpx.Response(500)

    _answer(monkeypatch, flaky)

    with pytest.raises(organisations.LoginUnavailable):
        await organisations.user_organisations(_SUB, "tok")
    with pytest.raises(organisations.LoginUnavailable):
        await organisations.user_organisations(_SUB, "tok")
    assert len(calls) == 2


@pytest.mark.asyncio
async def test_without_login_or_a_session_nobody_has_organisations(monkeypatch):
    seen = _answer(monkeypatch, lambda r: httpx.Response(200, json=_GROUPS))

    assert await organisations.user_organisations(_SUB, None) == []
    monkeypatch.setattr(organisations.settings, "LOGIN_API_URL", None)
    assert await organisations.user_organisations(_SUB, "tok") == []
    assert seen == []
