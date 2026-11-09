"""Editing the metadata and licence of published imagery."""

import uuid

import pytest
from litestar.exceptions import HTTPException
from litestar.testing import RequestFactory

from app.auth import organisations
from app.imagery import routes
from app.imagery.routes import OWNER_FIELD, UpdateImageryBody
from app.uploads import pgstac

_ORG = organisations.Organisation(id="org-1", name="Mappers", role="manager")


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
            "license": "CC-BY-NC-4.0",
            "providers": [{"name": "Old provider", "roles": ["producer"]}],
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


async def _edit(db, account, item_id="item-1", **fields):
    return await routes.update_imagery.fn(
        item_id=item_id,
        data=UpdateImageryBody(**fields),
        auth_user=account,
        db=db,
        request=RequestFactory().post("/", headers={"cookie": "hanko=tok"}),
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
async def test_an_owner_can_fix_the_metadata(db, account, member_of, catalogue):
    member_of()
    props = catalogue(account["sub"])

    resp = await _edit(db, account, title="New title", platform="aircraft")

    assert resp == {"id": "item-1", "owner_id": account["sub"]}
    assert props["title"] == "New title"
    assert props["oam:platform_type"] == "aircraft"
    assert await _history(db) == [
        ("title", "Old title", "New title", account["sub"]),
        ("oam:platform_type", "uav", "aircraft", account["sub"]),
    ]


@pytest.mark.asyncio
async def test_a_manager_can_fix_organisation_imagery(
    db, account, member_of, catalogue
):
    member_of(_ORG)
    props = catalogue(_ORG.owner_id)

    await _edit(db, account, provider="New provider")

    assert props["oam:producer_name"] == "New provider"
    assert props["providers"][0]["name"] == "New provider"


@pytest.mark.asyncio
async def test_a_member_cannot_edit(db, account, member_of, catalogue):
    member_of(organisations.Organisation(id="org-1", name="Mappers", role="member"))
    props = catalogue(_ORG.owner_id)

    with pytest.raises(HTTPException) as err:
        await _edit(db, account, title="New title")
    assert err.value.status_code == 403
    assert props["title"] == "Old title"


@pytest.mark.asyncio
async def test_someone_elses_imagery_cannot_be_edited(
    db, account, member_of, catalogue
):
    member_of(_ORG)
    catalogue("hotosm|someone-else")

    with pytest.raises(HTTPException) as err:
        await _edit(db, account, title="New title")
    assert err.value.status_code == 403


@pytest.mark.asyncio
async def test_unknown_imagery_is_a_404(db, account, member_of, catalogue):
    member_of()
    catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _edit(db, account, item_id="nope", title="New title")
    assert err.value.status_code == 404


@pytest.mark.asyncio
async def test_a_licence_change_is_recorded(db, account, member_of, catalogue):
    member_of()
    props = catalogue(account["sub"], license="CC-BY-4.0")

    await _edit(db, account, license="CC BY-NC 4.0")

    assert props["license"] == "CC-BY-NC-4.0"
    assert await _history(db) == [
        ("license", "CC-BY-4.0", "CC-BY-NC-4.0", account["sub"])
    ]


@pytest.mark.asyncio
async def test_a_licence_oam_does_not_offer_is_refused(
    db, account, member_of, catalogue
):
    member_of()
    props = catalogue(account["sub"], license="CC-BY-4.0")

    with pytest.raises(HTTPException) as err:
        await _edit(db, account, license="MIT", title="New title")
    assert err.value.status_code == 422
    # Nothing is written when any part of the edit is refused.
    assert props["license"] == "CC-BY-4.0"
    assert props["title"] == "Old title"
    assert await _history(db) == []


@pytest.mark.asyncio
async def test_the_same_values_write_nothing(
    db, account, member_of, catalogue, monkeypatch
):
    member_of()
    catalogue(account["sub"])

    async def must_not_write(*args, **kwargs):
        raise AssertionError("patch_properties was called")

    monkeypatch.setattr(pgstac, "patch_properties", must_not_write)

    resp = await _edit(db, account, title="Old title", license="CC BY-NC 4.0")

    assert resp == {"id": "item-1", "owner_id": account["sub"]}
    assert await _history(db) == []


@pytest.mark.asyncio
async def test_an_edit_made_meanwhile_is_not_overwritten(
    db, account, member_of, catalogue, monkeypatch
):
    member_of()
    props = catalogue(account["sub"])
    seen = pgstac.get_item

    async def someone_edited_it_first(item_id):
        item = await seen(item_id)
        snapshot = {**item, "properties": dict(item["properties"])}
        props["title"] = "Their title"
        return snapshot

    monkeypatch.setattr(pgstac, "get_item", someone_edited_it_first)

    with pytest.raises(HTTPException) as err:
        await _edit(db, account, title="New title")
    assert err.value.status_code == 409
    assert props["title"] == "Their title"


@pytest.mark.asyncio
async def test_an_edit_and_a_transfer_go_together(db, account, member_of, catalogue):
    member_of(_ORG)
    props = catalogue(account["sub"])

    resp = await _edit(db, account, title="New title", owner=_ORG.owner_id)

    assert resp == {"id": "item-1", "owner_id": _ORG.owner_id}
    assert props["title"] == "New title"
    assert props[OWNER_FIELD] == _ORG.owner_id
    assert [row[0] for row in await _history(db)] == ["title", OWNER_FIELD]


@pytest.mark.asyncio
async def test_a_refused_transfer_writes_no_metadata(db, account, member_of, catalogue):
    member_of(_ORG)
    props = catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _edit(db, account, title="New title", owner="hotosm-org|org-9")
    assert err.value.status_code == 403
    assert props["title"] == "Old title"
    assert await _history(db) == []
