"""Transferring published imagery to another owner, from its page in the uploader."""

import uuid
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from litestar import Router
from litestar import status_codes as status
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.plugins.htmx import HTMXPlugin
from litestar.plugins.jinja import JinjaTemplateEngine
from litestar.template.config import TemplateConfig
from litestar.testing import RequestFactory, create_test_client
from psycopg import AsyncConnection

import app
from app.auth import auth_deps, organisations
from app.db.models import DbImageryChange
from app.imagery import routes
from app.imagery.routes import OWNER_FIELD, TransferForm
from app.main import _configure_templates, _htmx_exception_handler
from app.uploads import pgstac

_ORG = organisations.Organisation(id="org-1", name="Mappers", role="manager")
_OTHER_ORG = organisations.Organisation(id="org-2", name="Others")
_HTMX = {"HX-Request": "true"}


def _no_db() -> AsyncConnection:
    return MagicMock(spec=AsyncConnection)


@pytest.fixture
def account() -> dict:
    return {"sub": f"hotosm|{uuid.uuid4()}", "name": "A Name"}


@pytest.fixture
def member_of(monkeypatch):
    """Make Login report the caller as a member of the given organisations."""

    def _set(*orgs: organisations.Organisation):
        async def fake(user_sub, session_token):
            return list(orgs)

        monkeypatch.setattr(organisations, "user_organisations", fake)

    return _set


@pytest.fixture
def catalogue(monkeypatch):
    """A fake pgstac holding one Item; returns the dict of its properties."""

    def _store(owner: str | None) -> dict:
        props = {"datetime": "2026-05-01T00:00:00Z", "title": "Ward 5 <ortho>"}
        if owner is not None:
            props[OWNER_FIELD] = owner
        item = {"id": "item-1", "properties": props}

        async def get_item(item_id):
            return item if item_id == item["id"] else None

        async def patch_properties(item_id, changes, *, expect=None):
            if item_id != item["id"]:
                return None
            for key, value in (expect or {}).items():
                if props.get(key) != value:
                    raise pgstac.ItemChanged(key)
            props.update(changes)
            return item

        monkeypatch.setattr(pgstac, "get_item", get_item)
        monkeypatch.setattr(pgstac, "patch_properties", patch_properties)
        return props

    return _store


async def _transfer(db, account, item_id="item-1", owner=None, current=None):
    """Post the form as the page would, showing the owner stored right now."""
    if current is None:
        shown = await pgstac.get_item(item_id) or {}
        current = shown.get("properties", {}).get(OWNER_FIELD) or ""
    return await routes.transfer_imagery.fn(
        item_id=item_id,
        data=TransferForm(owner=owner, current=current),
        auth_user=account,
        db=db,
        request=RequestFactory().post("/", headers={"cookie": "hanko=tok", **_HTMX}),
    )


async def _history(db, item_id="item-1") -> list[tuple]:
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT old_value, new_value, actor_sub FROM imagery_changes "
            "WHERE item_id = %s ORDER BY id;",
            [item_id],
        )
        return await cur.fetchall()


@pytest.mark.asyncio
async def test_an_owner_can_hand_imagery_to_their_organisation(
    db, account, member_of, catalogue
):
    member_of(_ORG)
    props = catalogue(account["sub"])

    resp = await _transfer(db, account, owner=_ORG.owner_id)

    assert resp.context["moved_to"] == "Mappers"
    assert resp.context["owner_name"] == "Mappers"
    assert props[OWNER_FIELD] == "hotosm-org|org-1"
    assert await _history(db) == [(account["sub"], "hotosm-org|org-1", account["sub"])]


@pytest.mark.asyncio
async def test_a_manager_can_take_organisation_imagery_back(
    db, account, member_of, catalogue
):
    member_of(_ORG)
    props = catalogue(_ORG.owner_id)

    await _transfer(db, account, owner=account["sub"])

    assert props[OWNER_FIELD] == account["sub"]


@pytest.mark.asyncio
async def test_a_member_only_sees(db, account, member_of, catalogue):
    member_of(organisations.Organisation(id="org-1", name="Mappers", role="member"))
    catalogue(_ORG.owner_id)

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=account["sub"])
    assert err.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
@pytest.mark.parametrize("owner", ["hotosm|someone-else", "oam-legacy|abc", None])
async def test_someone_elses_imagery_cannot_be_moved(
    db, account, member_of, catalogue, owner
):
    member_of(_ORG)
    catalogue(owner)

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=account["sub"])
    assert err.value.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.asyncio
async def test_imagery_only_goes_to_the_callers_own_organisations(
    db, account, member_of, catalogue
):
    member_of(_ORG)
    props = catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=_OTHER_ORG.owner_id)
    assert err.value.status_code == status.HTTP_403_FORBIDDEN
    assert props[OWNER_FIELD] == account["sub"]
    assert await _history(db) == []


@pytest.mark.asyncio
async def test_the_same_owner_changes_nothing(db, account, member_of, catalogue):
    member_of(_ORG)
    catalogue(account["sub"])

    resp = await _transfer(db, account, owner=account["sub"])

    assert resp.context["moved_to"] is None
    assert await _history(db) == []


@pytest.mark.asyncio
async def test_imagery_handed_to_an_organisation_the_caller_only_belongs_to_is_gone(
    db, account, member_of, catalogue
):
    """A member can give imagery to their organisation, but not manage it after."""
    member_of(_OTHER_ORG)
    catalogue(account["sub"])

    resp = await _transfer(db, account, owner=_OTHER_ORG.owner_id)

    assert resp.context["can_edit"] is False
    assert resp.context["choices"] == []


@pytest.mark.asyncio
async def test_unknown_imagery_is_a_404(db, account, member_of, catalogue):
    member_of(_ORG)
    catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, item_id="nope", owner=_ORG.owner_id)
    assert err.value.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_login_down_fails_closed(db, account, monkeypatch, catalogue):
    async def down(user_sub, session_token):
        raise organisations.LoginUnavailable("down")

    monkeypatch.setattr(organisations, "user_organisations", down)
    catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=_ORG.owner_id)
    assert err.value.status_code == status.HTTP_503_SERVICE_UNAVAILABLE


@pytest.mark.asyncio
async def test_a_change_made_meanwhile_is_not_overwritten(
    db, account, member_of, catalogue, monkeypatch
):
    member_of(_ORG)
    props = catalogue(account["sub"])
    seen = pgstac.get_item

    async def someone_moved_it_first(item_id):
        item = await seen(item_id)
        props[OWNER_FIELD] = "hotosm|someone-else"
        return {
            **item,
            "properties": {**item["properties"], OWNER_FIELD: account["sub"]},
        }

    monkeypatch.setattr(pgstac, "get_item", someone_moved_it_first)

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=_ORG.owner_id)
    assert err.value.status_code == status.HTTP_409_CONFLICT
    assert props[OWNER_FIELD] == "hotosm|someone-else"


@pytest.mark.asyncio
async def test_a_choice_made_on_an_older_page_is_refused(
    db, account, member_of, catalogue
):
    """The page showed the caller; Mappers own it since, which changes the choice."""
    member_of(_ORG, _OTHER_ORG)
    props = catalogue(_ORG.owner_id)

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=_OTHER_ORG.owner_id, current=account["sub"])
    assert err.value.status_code == status.HTTP_409_CONFLICT
    assert props[OWNER_FIELD] == _ORG.owner_id
    assert await _history(db) == []


async def _records_by(db, actor_sub) -> int:
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT count(*) FROM imagery_changes WHERE actor_sub = %s;", [actor_sub]
        )
        return (await cur.fetchone())[0]


@pytest.mark.asyncio
async def test_a_refused_write_leaves_no_record(
    pool, account, member_of, catalogue, monkeypatch
):
    member_of(_ORG)
    catalogue(account["sub"])
    written_first = []

    with pytest.raises(HTTPException):
        # Held like `db_conn` holds the request's: an error rolls it back.
        async with pool.connection() as db:

            async def changed(item_id, changes, *, expect=None):
                written_first.append(await _records_by(db, account["sub"]))
                raise pgstac.ItemChanged(OWNER_FIELD)

            monkeypatch.setattr(pgstac, "patch_properties", changed)
            await _transfer(db, account, owner=_ORG.owner_id)

    assert written_first == [1]
    async with pool.connection() as db:
        assert await _records_by(db, account["sub"]) == 0


@pytest.mark.asyncio
async def test_a_form_htmx_did_not_send_is_refused(db, account, member_of, catalogue):
    """A cross-site form carries the cookie but cannot set the header."""
    member_of(_ORG)
    props = catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await routes.transfer_imagery.fn(
            item_id="item-1",
            data=TransferForm(owner=_ORG.owner_id, current=account["sub"]),
            auth_user=account,
            db=db,
            request=RequestFactory().post("/", headers={"cookie": "hanko=tok"}),
        )
    assert err.value.status_code == status.HTTP_403_FORBIDDEN
    assert props[OWNER_FIELD] == account["sub"]


@pytest.mark.parametrize(
    ("owner", "role", "allowed"),
    [
        ("hotosm|me", "member", True),
        ("hotosm-org|org-1", "owner", True),
        ("hotosm-org|org-1", "manager", True),
        ("hotosm-org|org-1", "member", False),
        ("hotosm-org|org-9", "owner", False),
        ("hotosm|you", "owner", False),
        (None, "owner", False),
    ],
)
def test_who_can_edit(owner, role, allowed):
    orgs = [organisations.Organisation(id="org-1", name="Mappers", role=role)]
    assert organisations.can_edit(owner, "hotosm|me", orgs) is allowed


@pytest.fixture
def signed_in(monkeypatch):
    """Sign the given account in, or nobody, for requests through the client."""

    def _as(account: dict | None):
        async def current_user(request):
            return account

        monkeypatch.setattr(auth_deps, "_auth_disabled", lambda: False)
        monkeypatch.setattr(auth_deps, "get_current_user", current_user)
        monkeypatch.setattr(auth_deps, "get_current_user_optional", current_user)

    return _as


@pytest.fixture
def client(monkeypatch):
    """The imagery pages over HTTP, with history writes going nowhere."""
    recorded = []

    async def record(db, change):
        recorded.append(change)
        return change

    monkeypatch.setattr(DbImageryChange, "create", record)
    client = create_test_client(
        route_handlers=[
            Router(
                path="/imagery",
                route_handlers=[routes.imagery_page, routes.transfer_imagery],
                dependencies={
                    "auth_user": Provide(auth_deps.login_required),
                    "db": Provide(_no_db, sync_to_thread=False),
                },
            )
        ],
        plugins=[HTMXPlugin()],
        template_config=TemplateConfig(
            directory=Path(app.__file__).parent / "templates",
            engine=JinjaTemplateEngine,
            engine_callback=_configure_templates,
        ),
        exception_handlers={HTTPException: _htmx_exception_handler},
    )
    client.recorded = recorded
    return client


def test_the_page_offers_the_owners_other_than_the_current_one(
    client, account, signed_in, member_of, catalogue
):
    signed_in(account)
    member_of(_ORG, _OTHER_ORG)
    catalogue(_ORG.owner_id)

    with client:
        resp = client.get("/imagery/item-1")

    assert resp.status_code == status.HTTP_200_OK
    # The title is whatever the contributor typed, so it is escaped.
    assert "Ward 5 &lt;ortho&gt;" in resp.text
    assert 'hx-post="/imagery/item-1/owner"' in resp.text
    assert f'<wa-option value="{account["sub"]}">' in resp.text
    assert '<wa-option value="hotosm-org|org-2">Others</wa-option>' in resp.text
    assert '<wa-option value="hotosm-org|org-1">' not in resp.text


def test_the_page_asks_a_stranger_to_sign_in(client, signed_in, catalogue):
    signed_in(None)
    catalogue("hotosm|someone")

    with client:
        resp = client.get("/imagery/item-1")

    assert resp.status_code == status.HTTP_401_UNAUTHORIZED
    assert "Sign in to manage this imagery." in resp.text
    assert "hx-post" not in resp.text
    # Nothing about the Item reaches someone who has not signed in.
    assert "Ward 5" not in resp.text


@pytest.mark.parametrize(
    ("item_id", "owner", "expected"),
    [
        ("nope", "hotosm|someone", status.HTTP_404_NOT_FOUND),
        ("item-1", "hotosm|someone", status.HTTP_403_FORBIDDEN),
    ],
)
def test_the_page_explains_why_imagery_cannot_be_managed(  # noqa: PLR0913
    client, account, signed_in, member_of, catalogue, item_id, owner, expected
):
    signed_in(account)
    member_of(_ORG)
    catalogue(owner)

    with client:
        resp = client.get(f"/imagery/{item_id}")

    assert resp.status_code == expected
    assert resp.headers["content-type"].startswith("text/html")
    assert "wa-callout" in resp.text
    assert "hx-post" not in resp.text


def test_the_form_swaps_in_the_new_owner(
    client, account, signed_in, member_of, catalogue
):
    signed_in(account)
    member_of(_ORG)
    props = catalogue(account["sub"])

    with client:
        resp = client.post(
            "/imagery/item-1/owner",
            data={"owner": _ORG.owner_id, "current": account["sub"]},
            headers=_HTMX,
        )

    assert resp.status_code == status.HTTP_200_OK
    assert props[OWNER_FIELD] == "hotosm-org|org-1"
    # Errors land in the form; a success replaces the whole section.
    assert resp.headers["HX-Retarget"] == "#imagery-owner"
    assert resp.headers["HX-Reswap"] == "outerHTML"
    assert "Transferred to Mappers." in resp.text
    # The next choice is made against the owner just written.
    assert 'name="current" value="hotosm-org|org-1"' in resp.text
    assert [c.new_value for c in client.recorded] == ["hotosm-org|org-1"]


def test_a_refused_transfer_is_a_callout_for_the_form(
    client, account, signed_in, member_of, catalogue
):
    signed_in(account)
    member_of(_ORG)
    props = catalogue(account["sub"])

    with client:
        resp = client.post(
            "/imagery/item-1/owner",
            data={"owner": _OTHER_ORG.owner_id, "current": account["sub"]},
            headers=_HTMX,
        )

    assert resp.status_code == status.HTTP_403_FORBIDDEN
    assert "wa-callout" in resp.text
    assert "HX-Retarget" not in resp.headers
    assert props[OWNER_FIELD] == account["sub"]
    assert client.recorded == []


def test_the_page_names_the_imagery_with_its_preview_and_facts():
    item = {
        "id": "item-1",
        "properties": {
            "title": "Ward 5",
            "datetime": "2026-05-01T00:00:00Z",
            "gsd": 0.05,
            "providers": [{"name": "Mappers"}],
            "license": "CC-BY-4.0",
        },
        "assets": {"thumbnail": {"href": "https://example.org/thumb.png"}},
    }

    summary = routes._summary(item)

    assert summary["thumbnail"] == "https://example.org/thumb.png"
    assert summary["facts"] == [
        ("Captured", "1 May 2026"),
        ("Resolution", "0.05 m"),
        ("Provider", "Mappers"),
        ("Licence", "CC-BY-4.0"),
    ]


def test_missing_facts_are_left_out():
    summary = routes._summary({"id": "item-1", "properties": {"datetime": "nope"}})

    assert summary == {"title": "item-1", "thumbnail": None, "facts": []}
