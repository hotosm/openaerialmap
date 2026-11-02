"""Publishing an upload for an organisation."""

import uuid
from pathlib import Path

import pytest
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.plugins.jinja import JinjaTemplateEngine
from litestar.template.config import TemplateConfig
from litestar.testing import RequestFactory, create_test_client

import app
from app.auth import organisations
from app.auth.auth_deps import session_token
from app.db.models import ANONYMOUS_SUB, DbUser
from app.htmx.page_routes import upload_page
from app.main import _configure_templates
from app.uploads.schemas import CreateMultipartBody, CreateRemoteUploadBody
from app.uploads.service import create_upload_row

_ORG = organisations.Organisation(id="org-1", name="Mappers")


@pytest.fixture
def account() -> dict:
    """A fresh account per test: rows stay Initiated and count against the quota."""
    return {"sub": f"hotosm|{uuid.uuid4()}", "name": "A Name"}


@pytest.fixture
def member_of(monkeypatch):
    """Make Login report the caller as a member of the given organisations."""

    def _set(*orgs: organisations.Organisation):
        async def fake(user_sub, session_token):
            assert session_token == "tok"
            return list(orgs)

        monkeypatch.setattr(organisations, "user_organisations", fake)

    return _set


def _body(**fields) -> CreateMultipartBody:
    return CreateMultipartBody(
        filename="o.tif",
        title="t",
        size_bytes=1,
        metadata={"acquisition_start": "2026-05-01"},
        **fields,
    )


def test_owner_is_opt_in_on_both_ingest_paths():
    remote = CreateRemoteUploadBody(source_url="https://example.org/o.tif", title="t")
    assert (_body().owner, remote.owner) == (None, None)


@pytest.mark.asyncio
async def test_a_member_can_publish_for_the_organisation(db, member_of, account):
    member_of(_ORG)

    upload = await create_upload_row(
        db, account, _body(owner=_ORG.owner_id), message="", session_token="tok"
    )

    assert upload.owner_id == "hotosm-org|org-1"
    # Still the caller's upload: the organisation owns the imagery, not the job.
    assert upload.user_sub == account["sub"]


@pytest.mark.asyncio
async def test_without_an_owner_the_caller_owns_it(db, member_of, account):
    member_of(_ORG)

    upload = await create_upload_row(
        db, account, _body(), message="", session_token="tok"
    )

    assert upload.owner_id is None


@pytest.mark.asyncio
async def test_a_non_member_is_refused(db, member_of, account):
    member_of()

    with pytest.raises(HTTPException) as err:
        await create_upload_row(
            db, account, _body(owner=_ORG.owner_id), message="", session_token="tok"
        )
    assert err.value.status_code == 403


@pytest.mark.asyncio
@pytest.mark.parametrize("owner", ["hotosm|43", "org-1", "hotosm-org|"])
async def test_only_an_organisation_can_be_named(db, member_of, account, owner):
    """A user id or a bare id is a 400, not a membership question."""
    member_of(_ORG)

    with pytest.raises(HTTPException) as err:
        await create_upload_row(db, account, _body(owner=owner), message="")
    assert err.value.status_code == 400


@pytest.mark.asyncio
async def test_an_anonymous_upload_cannot_name_an_organisation(db, member_of, account):
    member_of(_ORG)
    await DbUser.upsert(db, DbUser(sub=ANONYMOUS_SUB, username="anonymous"))

    with pytest.raises(HTTPException) as err:
        await create_upload_row(
            db, account, _body(owner=_ORG.owner_id, anonymous=True), message=""
        )
    assert err.value.status_code == 400


@pytest.mark.asyncio
async def test_login_down_fails_closed(db, monkeypatch, account):
    async def down(user_sub, session_token):
        raise organisations.LoginUnavailable("down")

    monkeypatch.setattr(organisations, "user_organisations", down)

    with pytest.raises(HTTPException) as err:
        await create_upload_row(
            db, account, _body(owner=_ORG.owner_id), message="", session_token="tok"
        )
    assert err.value.status_code == 503


def test_the_session_token_is_read_as_hotosm_auth_reads_it():
    factory = RequestFactory()
    cookie = {"cookie": "hanko=c"}
    assert session_token(factory.get("/", headers=cookie)) == "c"
    bearer = factory.get("/", headers={"authorization": "Bearer b", **cookie})
    assert session_token(bearer) == "b"
    assert session_token(factory.get("/")) is None


def _page(user) -> str:
    client = create_test_client(
        route_handlers=[upload_page],
        template_config=TemplateConfig(
            directory=Path(app.__file__).parent / "templates",
            engine=JinjaTemplateEngine,
            engine_callback=_configure_templates,
        ),
        dependencies={"auth_user": Provide(lambda: user, sync_to_thread=False)},
    )
    with client:
        resp = client.get("/", headers={"cookie": "hanko=tok"})
    assert resp.status_code == 200
    return resp.text


def test_a_member_is_offered_their_organisations(member_of, account):
    member_of(_ORG)

    page = _page(account)

    assert 'label="Publish as"' in page
    assert 'value="hotosm-org|org-1">Mappers' in page


def test_without_organisations_the_choice_is_not_offered(member_of, account):
    member_of()

    assert 'label="Publish as"' not in _page(account)


def test_login_down_hides_the_choice_instead_of_failing(monkeypatch, account):
    async def down(user_sub, session_token):
        raise organisations.LoginUnavailable("down")

    monkeypatch.setattr(organisations, "user_organisations", down)

    assert 'label="Publish as"' not in _page(account)
