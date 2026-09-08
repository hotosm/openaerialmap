"""Anonymous upload ownership and tracking tests."""

import uuid
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.plugins.jinja import JinjaTemplateEngine
from litestar.template.config import TemplateConfig
from litestar.testing import create_test_client
from psycopg import AsyncConnection

import app
from app.auth.auth_deps import get_user_sub
from app.db.models import ANONYMOUS_SUB, DbUpload, DbUser
from app.htmx.page_routes import (
    MAX_TRACKED,
    _upload_ids,
    anonymous_uploads_partial,
)
from app.main import _configure_templates
from app.uploads import upload_routes
from app.uploads.s3 import build_key
from app.uploads.schemas import CreateMultipartBody, CreateRemoteUploadBody
from app.uploads.service import create_upload_row
from app.uploads.upload_routes import _require_key_owner

_SUB = "hotosm|42"
_USER = {"sub": _SUB, "name": "A Name"}


def test_anonymous_is_opt_in_on_both_ingest_paths():
    multipart = CreateMultipartBody(filename="o.tif", title="t", size_bytes=1)
    remote = CreateRemoteUploadBody(source_url="https://example.org/o.tif", title="t")
    assert (multipart.anonymous, remote.anonymous) == (False, False)


def test_no_session_may_claim_the_shared_subject():
    """It owns every anonymous upload; a session claiming it would inherit them."""
    with pytest.raises(HTTPException) as err:
        get_user_sub({"sub": ANONYMOUS_SUB})
    assert err.value.status_code == 401


@pytest.mark.parametrize(
    ("sub", "expected"), [(ANONYMOUS_SUB, ANONYMOUS_SUB), (_SUB, _SUB)]
)
def test_a_key_resolves_to_the_subject_it_is_filed_under(sub, expected):
    assert _require_key_owner(_USER, build_key(sub, "abc", "o.tif")) == expected


def test_someone_elses_key_is_still_refused():
    """The anonymous branch must not have opened a hole for owned uploads."""
    with pytest.raises(HTTPException) as err:
        _require_key_owner(_USER, build_key("hotosm|43", "abc", "o.tif"))
    assert err.value.status_code == 403


@pytest.mark.asyncio
async def test_an_anonymous_upload_names_nobody(db):
    await DbUser.upsert(db, DbUser(sub=ANONYMOUS_SUB, username="anonymous"))
    upload = await create_upload_row(
        db,
        _USER,
        CreateMultipartBody(
            filename="o.tif",
            title="t",
            size_bytes=1,
            metadata={"acquisition_start": "2026-05-01", "contact": "a@example.org"},
            anonymous=True,
        ),
        filename="o.tif",
        message="",
    )

    assert upload.user_sub == ANONYMOUS_SUB
    assert upload.s3_key.startswith("anonymous/")
    # Dropped however it was filled in, not just left undefaulted.
    assert "contact" not in upload.dataset_meta
    caller = get_user_sub(_USER)
    assert upload.id not in [u.id for u in await DbUpload.for_user(db, caller)]
    assert await DbUpload.get_owned(db, upload.id, caller) is None


def test_only_uuids_reach_the_tracker_query():
    """Accept only bounded UUID lists."""
    real = str(uuid.uuid4())
    assert _upload_ids(f" {real} ,,not-a-uuid,1") == [real]
    assert _upload_ids("") == []
    too_many = ",".join(str(uuid.uuid4()) for _ in range(MAX_TRACKED + 10))
    assert len(_upload_ids(too_many)) == MAX_TRACKED


@pytest.mark.asyncio
async def test_the_id_is_the_only_claim_on_an_anonymous_upload(db, new_upload):
    """Resolve only anonymous rows by ID."""
    await DbUser.upsert(db, DbUser(sub=ANONYMOUS_SUB, username="anonymous"))
    anonymous = await new_upload(user_sub=ANONYMOUS_SUB)
    owned = await new_upload()

    found = await DbUpload.anonymous_by_ids(db, [anonymous.id, owned.id])
    assert [u.id for u in found] == [anonymous.id]
    assert await DbUpload.anonymous_by_ids(db, []) == []


def _no_db() -> AsyncConnection:
    return MagicMock(spec=AsyncConnection)


def _tracker_client(rows: list[DbUpload]):
    async def fake_rows(db, upload_ids, limit=MAX_TRACKED):
        return [r for r in rows if r.id in upload_ids]

    return create_test_client(
        route_handlers=[anonymous_uploads_partial],
        template_config=TemplateConfig(
            directory=Path(app.__file__).parent / "templates",
            engine=JinjaTemplateEngine,
            engine_callback=_configure_templates,
        ),
        dependencies={"db": Provide(_no_db, sync_to_thread=False)},
    ), fake_rows


def test_the_tracker_answer_is_never_stored():
    """Prevent caching tracker responses."""
    assert anonymous_uploads_partial.cache_control.no_store is True


@pytest.mark.parametrize(
    ("status", "pending"), [("Processing", "true"), ("Succeeded", "false")]
)
def test_the_tracker_reports_the_row_and_when_to_stop_asking(
    monkeypatch, status, pending
):
    """Report status and whether polling should continue."""
    row = DbUpload(
        id=str(uuid.uuid4()),
        user_sub=ANONYMOUS_SUB,
        title="A scene",
        filename="o.tif",
        status=status,
        message="Queued for processing.",
        created_at=datetime(2026, 9, 8, 12, 0),
    )
    client, fake_rows = _tracker_client([row])
    monkeypatch.setattr(DbUpload, "anonymous_by_ids", fake_rows)
    with client as c:
        resp = c.get("/uploads/anonymous", params={"ids": row.id})
    assert resp.status_code == 200
    assert resp.headers["cache-control"] == "no-store"
    assert f'data-pending="{pending}"' in resp.text
    assert "A scene" in resp.text
    assert f"Reference {row.id}" in resp.text


def test_an_id_that_resolves_to_nothing_says_so(monkeypatch):
    """Report missing uploads as untracked."""
    client, fake_rows = _tracker_client([])
    monkeypatch.setattr(DbUpload, "anonymous_by_ids", fake_rows)
    with client as c:
        resp = c.get("/uploads/anonymous", params={"ids": str(uuid.uuid4())})
    assert "no longer being tracked" in resp.text
    assert 'data-pending="false"' in resp.text


@pytest.mark.asyncio
async def test_the_upload_session_hands_back_the_row_id(monkeypatch):
    """Return the database row ID with a multipart session."""
    row = DbUpload(id=str(uuid.uuid4()), s3_key="anonymous/x/o.tif")

    async def fake_row(*args, **kwargs):
        return row

    monkeypatch.setattr(upload_routes, "create_upload_row", fake_row)
    monkeypatch.setattr(
        upload_routes,
        "internal_client",
        lambda: MagicMock(create_multipart_upload=lambda **kw: {"UploadId": "mp-1"}),
    )
    resp = await upload_routes.create_multipart.fn(
        data=CreateMultipartBody(filename="o.tif", title="t", size_bytes=1),
        auth_user=_USER,
        db=MagicMock(spec=AsyncConnection),
    )
    assert resp["id"] == row.id
    assert resp["key"] == row.s3_key
