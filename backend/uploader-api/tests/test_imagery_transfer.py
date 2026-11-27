"""Transferring published imagery to another owner."""

import uuid

import pytest
from litestar.exceptions import HTTPException
from litestar.testing import RequestFactory

from app.auth import organisations
from app.imagery import routes
from app.imagery.routes import OWNER_FIELD, UpdateImageryBody
from app.uploads import pgstac

_ORG = organisations.Organisation(id="org-1", name="Mappers", role="manager")
_OTHER_ORG = organisations.Organisation(id="org-2", name="Others")


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
        props = {"datetime": "2026-05-01T00:00:00Z"}
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


async def _transfer(db, account, item_id="item-1", owner=None):
    return await routes.update_imagery.fn(
        item_id=item_id,
        data=UpdateImageryBody(owner=owner),
        auth_user=account,
        db=db,
        request=RequestFactory().post("/", headers={"cookie": "hanko=tok"}),
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

    assert resp == {"id": "item-1", "owner_id": "hotosm-org|org-1"}
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
    assert err.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("owner", ["hotosm|someone-else", "oam-legacy|abc", None])
async def test_someone_elses_imagery_cannot_be_moved(
    db, account, member_of, catalogue, owner
):
    member_of(_ORG)
    catalogue(owner)

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=account["sub"])
    assert err.value.status_code == 403


@pytest.mark.asyncio
async def test_imagery_only_goes_to_the_callers_own_organisations(
    db, account, member_of, catalogue
):
    member_of(_ORG)
    props = catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=_OTHER_ORG.owner_id)
    assert err.value.status_code == 403
    assert props[OWNER_FIELD] == account["sub"]
    assert await _history(db) == []


@pytest.mark.asyncio
async def test_the_same_owner_changes_nothing(db, account, member_of, catalogue):
    member_of(_ORG)
    catalogue(account["sub"])

    resp = await _transfer(db, account, owner=account["sub"])

    assert resp["owner_id"] == account["sub"]
    assert await _history(db) == []


@pytest.mark.asyncio
async def test_unknown_imagery_is_a_404(db, account, member_of, catalogue):
    member_of(_ORG)
    catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, item_id="nope", owner=_ORG.owner_id)
    assert err.value.status_code == 404


@pytest.mark.asyncio
async def test_login_down_fails_closed(db, account, monkeypatch, catalogue):
    async def down(user_sub, session_token):
        raise organisations.LoginUnavailable("down")

    monkeypatch.setattr(organisations, "user_organisations", down)
    catalogue(account["sub"])

    with pytest.raises(HTTPException) as err:
        await _transfer(db, account, owner=_ORG.owner_id)
    assert err.value.status_code == 503


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
    assert err.value.status_code == 409
    assert props[OWNER_FIELD] == "hotosm|someone-else"


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
