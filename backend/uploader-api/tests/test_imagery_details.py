"""Correcting the details of published imagery, from its page in the uploader."""

import uuid
from pathlib import Path
from unittest.mock import MagicMock

import psycopg
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
from app.imagery.metadata import MetadataEdit
from app.imagery.routes import OWNER_FIELD, DetailsForm
from app.main import _configure_templates, _htmx_exception_handler
from app.uploads import pgstac

_ORG = organisations.Organisation(id="org-1", name="Mappers", role="manager")
_HTMX = {"HX-Request": "true"}

# What the page shows for the Item `catalogue` stores.
_SHOWN = {
    "title": "Old title",
    "provider": "Old provider",
    "contact": "Old contact",
    "platform": "uav",
    "sensor": "Old sensor",
    "license": "CC-BY-NC-4.0",
}


def _form(seen: dict[str, str] = _SHOWN, **typed: str | None) -> dict[str, str]:
    """The form as the page posts it: every field as shown, `typed` changed.

    A field typed as None is one the page did not send.
    """
    fields = {**seen, **typed, **{f"seen_{k}": v for k, v in seen.items()}}
    return {k: v for k, v in fields.items() if v is not None}


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
    """A fake pgstac holding one described Item; returns its properties."""

    def _store(owner: str | None, **extra) -> dict:
        props = {
            "datetime": "2026-05-01T00:00:00Z",
            "title": "Old title",
            "oam:producer_name": "Old provider",
            "oam:platform_type": "uav",
            "instruments": ["Old sensor"],
            "license": "CC-BY-NC-4.0",
            "providers": [
                {
                    "name": "Old provider",
                    "description": "Old contact",
                    "roles": ["producer"],
                }
            ],
            **extra,
        }
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


@pytest.fixture
def signed_in(monkeypatch):
    """Sign the given account in for requests through the client."""

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
                route_handlers=[routes.imagery_page, routes.save_details],
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


def test_the_page_shows_the_details_to_correct(
    client, account, signed_in, member_of, catalogue
):
    signed_in(account)
    member_of()
    catalogue(account["sub"], title="Ward 5 <ortho>")

    with client:
        resp = client.get("/imagery/item-1")

    assert resp.status_code == status.HTTP_200_OK
    assert 'hx-post="/imagery/item-1/details"' in resp.text
    # What the contributor typed is escaped, and kept to compare against.
    assert 'name="seen_title" value="Ward 5 &lt;ortho&gt;"' in resp.text
    # Only the licences that allow at least as much as CC BY-NC.
    assert '<wa-option value="CC-BY-NC-4.0">' in resp.text
    assert '<wa-option value="CC-BY-4.0">' in resp.text
    assert '<wa-option value="CC-BY-SA-4.0">' not in resp.text


@pytest.mark.parametrize("licence", ["CC-BY-4.0", "ODbL-1.0"])
def test_a_licence_nothing_offered_opens_up_is_shown_not_offered(
    client, account, signed_in, member_of, catalogue, licence
):
    signed_in(account)
    member_of()
    catalogue(account["sub"], license=licence)

    with client:
        resp = client.get("/imagery/item-1")

    # Spelt as stored, like the summary above it; the hidden field normalises.
    assert f"<strong>{licence}</strong>" in resp.text
    assert 'name="license"' not in resp.text


def test_every_field_an_edit_may_refuse_has_a_message():
    assert set(routes._INVALID) == set(MetadataEdit.model_fields)


def test_the_page_routes_are_registered():
    """Dropping a handler from the router is a silent 404 in production."""
    paths = {route.path for route in routes.imagery_router.routes}

    assert paths == {
        "/imagery/{item_id:str}",
        "/imagery/{item_id:str}/owner",
        "/imagery/{item_id:str}/details",
    }


def test_a_platform_the_form_never_offered_stays_selectable(
    client, account, signed_in, member_of, catalogue
):
    signed_in(account)
    member_of()
    catalogue(account["sub"], **{"oam:platform_type": "helicopter"})

    with client:
        resp = client.get("/imagery/item-1")

    assert '<wa-option value="helicopter">helicopter</wa-option>' in resp.text


async def _save(db, account, item_id="item-1", seen=_SHOWN, headers=_HTMX, **typed):
    return await routes.save_details.fn(
        item_id=item_id,
        data=DetailsForm(**_form(seen, **typed)),
        auth_user=account,
        db=db,
        request=RequestFactory().post("/", headers={"cookie": "hanko=tok", **headers}),
    )


async def _history(db, item_id="item-1") -> list[tuple]:
    async with db.cursor() as cur:
        await cur.execute(
            "SELECT field, old_value, new_value, actor_sub FROM imagery_changes "
            "WHERE item_id = %s ORDER BY id;",
            [item_id],
        )
        return await cur.fetchall()


@pytest.mark.asyncio
async def test_an_owner_can_correct_the_details(db, account, member_of, catalogue):
    member_of()
    props = catalogue(account["sub"])

    resp = await _save(db, account, title="New title", platform="aircraft")

    assert resp.context["saved"] is True
    assert resp.context["details"]["title"] == "New title"
    assert props["title"] == "New title"
    assert props["oam:platform_type"] == "aircraft"
    assert await _history(db) == [
        ("title", "Old title", "New title", account["sub"]),
        ("oam:platform_type", "uav", "aircraft", account["sub"]),
    ]


@pytest.mark.asyncio
async def test_a_manager_can_correct_organisation_imagery(
    db, account, member_of, catalogue
):
    member_of(_ORG)
    props = catalogue(_ORG.owner_id)

    await _save(db, account, provider="New provider")

    assert props["oam:producer_name"] == "New provider"
    assert props["providers"][0]["name"] == "New provider"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("role", "owner", "item_id", "expected"),
    [
        ("member", _ORG.owner_id, "item-1", status.HTTP_403_FORBIDDEN),
        ("manager", "hotosm|someone-else", "item-1", status.HTTP_403_FORBIDDEN),
        ("manager", _ORG.owner_id, "nope", status.HTTP_404_NOT_FOUND),
    ],
)
async def test_only_who_may_edit_can_save(  # noqa: PLR0913
    db, account, member_of, catalogue, role, owner, item_id, expected
):
    member_of(organisations.Organisation(id="org-1", name="Mappers", role=role))
    props = catalogue(owner)

    with pytest.raises(HTTPException) as err:
        await _save(db, account, item_id=item_id, title="New title")
    assert err.value.status_code == expected
    assert props["title"] == "Old title"


@pytest.mark.asyncio
async def test_a_form_htmx_did_not_send_is_refused(db, account, member_of, catalogue):
    """A cross-site form carries the cookie but cannot set the header."""
    member_of()
    props = catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _save(db, account, headers={}, title="New title")
    assert err.value.status_code == status.HTTP_403_FORBIDDEN
    assert props["title"] == "Old title"


@pytest.mark.asyncio
async def test_a_form_saved_as_shown_writes_nothing(
    db, account, member_of, catalogue, monkeypatch
):
    member_of()
    catalogue(account["sub"])

    async def must_not_write(*args, **kwargs):
        raise AssertionError("patch_properties was called")

    monkeypatch.setattr(pgstac, "patch_properties", must_not_write)

    resp = await _save(db, account)

    assert resp.context["saved"] is False
    assert resp.context["unchanged"] is True
    assert await _history(db) == []


@pytest.mark.asyncio
async def test_a_licence_change_is_recorded(db, account, member_of, catalogue):
    member_of()
    props = catalogue(account["sub"])

    await _save(db, account, license="CC-BY-4.0")

    assert props["license"] == "CC-BY-4.0"
    assert await _history(db) == [
        ("license", "CC-BY-NC-4.0", "CC-BY-4.0", account["sub"])
    ]


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("stored", "wanted"),
    [
        # More restrictive.
        ("CC-BY-4.0", "CC-BY-NC-4.0"),
        # Not offered.
        ("CC-BY-4.0", "MIT"),
        # Outside CC BY, so there is no telling what it allows.
        ("ODbL-1.0", "CC-BY-4.0"),
    ],
)
async def test_a_refused_licence_writes_nothing(  # noqa: PLR0913
    db, account, member_of, catalogue, stored, wanted
):
    member_of()
    props = catalogue(account["sub"], license=stored)
    seen = {**_SHOWN, "license": stored.upper()}

    with pytest.raises(HTTPException) as err:
        await _save(db, account, seen=seen, license=wanted, title="New title")
    assert err.value.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert props["license"] == stored
    assert props["title"] == "Old title"
    assert await _history(db) == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("field", "value"),
    [("title", "   "), ("sensor", ""), ("platform", "rocket")],
)
async def test_an_invalid_value_says_which_field(  # noqa: PLR0913
    db, account, member_of, catalogue, field, value
):
    member_of()
    catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _save(db, account, **{field: value})
    assert err.value.status_code == status.HTTP_400_BAD_REQUEST
    assert err.value.detail == routes._INVALID[field]
    assert await _history(db) == []


@pytest.mark.asyncio
async def test_a_save_based_on_stale_values_is_refused(
    db, account, member_of, catalogue
):
    member_of()
    props = catalogue(account["sub"], title="Their title")

    with pytest.raises(HTTPException) as err:
        await _save(db, account, title="New title")
    assert err.value.status_code == status.HTTP_409_CONFLICT
    assert props["title"] == "Their title"
    assert await _history(db) == []


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("key", "value"),
    [("title", "Their title"), (OWNER_FIELD, "hotosm|someone-else")],
)
async def test_a_change_made_after_the_check_is_not_overwritten(  # noqa: PLR0913
    db, account, member_of, catalogue, monkeypatch, key, value
):
    """Edited, or transferred, between reading the Item and writing it."""
    member_of()
    props = catalogue(account["sub"])
    read = pgstac.get_item

    async def changed_meanwhile(item_id):
        item = await read(item_id)
        snapshot = {**item, "properties": dict(item["properties"])}
        props[key] = value
        return snapshot

    monkeypatch.setattr(pgstac, "get_item", changed_meanwhile)

    with pytest.raises(HTTPException) as err:
        await _save(db, account, title="New title")
    assert err.value.status_code == status.HTTP_409_CONFLICT
    assert props[key] == value


@pytest.mark.asyncio
async def test_nothing_is_published_when_the_change_cannot_be_recorded(
    db, account, member_of, catalogue, monkeypatch
):
    member_of()
    props = catalogue(account["sub"])

    async def database_down(db, change):
        raise psycopg.OperationalError("connection lost")

    monkeypatch.setattr(DbImageryChange, "create", database_down)

    with pytest.raises(psycopg.OperationalError):
        await _save(db, account, license="CC-BY-4.0")
    assert props["license"] == "CC-BY-NC-4.0"


@pytest.mark.asyncio
async def test_a_legacy_value_nobody_touched_is_kept(db, account, member_of, catalogue):
    """Ingest once kept emails in the contact; saving the title must not drop them."""
    member_of()
    contact = "Ana, ana@example.org"
    props = catalogue(
        account["sub"],
        providers=[{"name": "Old provider", "description": contact}],
    )

    await _save(db, account, seen={**_SHOWN, "contact": contact}, title="New title")

    assert props["title"] == "New title"
    assert props["providers"][0]["description"] == contact


@pytest.mark.asyncio
async def test_a_licence_the_form_did_not_send_stays(db, account, member_of, catalogue):
    member_of()
    props = catalogue(account["sub"], license="CC0-1.0")
    seen = {**_SHOWN, "license": "CC0-1.0"}

    await _save(db, account, seen=seen, license=None, title="New title")

    assert props["title"] == "New title"
    assert props["license"] == "CC0-1.0"


def test_a_save_swaps_in_the_details_and_the_summary(
    client, account, signed_in, member_of, catalogue
):
    signed_in(account)
    member_of()
    props = catalogue(account["sub"])

    with client:
        resp = client.post(
            "/imagery/item-1/details", data=_form(title="New title"), headers=_HTMX
        )

    assert resp.status_code == status.HTTP_200_OK
    assert props["title"] == "New title"
    # Errors land in the form; a success replaces the whole section.
    assert resp.headers["HX-Retarget"] == "#imagery-details"
    assert resp.headers["HX-Reswap"] == "outerHTML"
    assert "Saved." in resp.text
    # The next save is compared against what was just written.
    assert 'name="seen_title" value="New title"' in resp.text
    # The summary card follows, out of band.
    assert 'id="imagery-summary"' in resp.text
    assert 'hx-swap-oob="true"' in resp.text
    assert [c.field for c in client.recorded] == ["title"]


def test_a_refused_save_is_a_callout_for_the_form(
    client, account, signed_in, member_of, catalogue
):
    signed_in(account)
    member_of()
    props = catalogue(account["sub"], license="CC-BY-4.0")
    seen = {**_SHOWN, "license": "CC-BY-4.0"}

    with client:
        resp = client.post(
            "/imagery/item-1/details",
            data=_form(seen, license="CC-BY-NC-4.0"),
            headers=_HTMX,
        )

    assert resp.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
    assert "wa-callout" in resp.text
    assert "HX-Retarget" not in resp.headers
    assert props["license"] == "CC-BY-4.0"
    assert client.recorded == []
