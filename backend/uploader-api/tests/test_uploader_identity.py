"""Test uploader metadata sent to the pipeline."""

import uuid

import pytest
from psycopg import AsyncConnection

from app.db.models import ANONYMOUS_SUB, DbUpload, DbUser
from app.uploads.pipeline_routes import _uploader_meta

_SUB = "hotosm|1234"


async def _upload_by(db: AsyncConnection, new_upload, sub: str, **fields) -> DbUpload:
    """Insert an upload by an account with this sub."""
    await DbUser.upsert(db, DbUser(sub=sub, username="tester"))
    return await new_upload(user_sub=sub, **fields)


@pytest.mark.asyncio
async def test_authenticated_upload_carries_the_account(db, new_upload):
    """Include signed-in account metadata."""
    upload = await _upload_by(db, new_upload, _SUB)
    await DbUser.upsert(
        db,
        DbUser(
            sub=upload.user_sub,
            username="tester",
            email_address="tester@example.org",
        ),
    )

    assert await _uploader_meta(db, upload) == {
        "uploader_id": upload.user_sub,
        "owner_id": upload.user_sub,
        "uploader_name": "tester",
    }


@pytest.mark.asyncio
async def test_anonymous_upload_withholds_the_account(db, new_upload):
    """Publish only the shared anonymous identifier, with no owner."""
    upload = await new_upload(user_sub=ANONYMOUS_SUB)

    assert await _uploader_meta(db, upload) == {"uploader_id": ANONYMOUS_SUB}


@pytest.mark.asyncio
@pytest.mark.parametrize("sub", ["custom|1", "osm|1234"])
async def test_account_outside_hot_login_gets_no_owner(db, new_upload, sub):
    """Withhold an owner the extension schema would reject."""
    upload = await _upload_by(db, new_upload, sub)

    assert await _uploader_meta(db, upload) == {
        "uploader_id": sub,
        "uploader_name": "tester",
    }


@pytest.mark.asyncio
async def test_upload_without_a_mirrored_user_still_reports_its_sub(db, new_upload):
    """Keep the account ID when its user row is missing."""
    upload = await _upload_by(db, new_upload, _SUB)
    async with db.cursor() as cur:
        await cur.execute(
            "DELETE FROM users WHERE sub = %(s)s;", {"s": upload.user_sub}
        )

    assert await _uploader_meta(db, upload) == {
        "uploader_id": upload.user_sub,
        "owner_id": upload.user_sub,
    }


@pytest.mark.asyncio
async def test_display_name_stands_in_for_a_missing_username(db, new_upload):
    """Use display name when username is missing."""
    upload = await new_upload()
    async with db.cursor() as cur:
        await cur.execute(
            "UPDATE users SET username = NULL, name = %(n)s WHERE sub = %(s)s;",
            {"n": "Test Person", "s": upload.user_sub},
        )

    meta = await _uploader_meta(db, upload)

    assert meta["uploader_name"] == "Test Person"


@pytest.mark.asyncio
async def test_uploader_fields_reach_the_pipeline_metadata(db, new_upload):
    """Merge uploader and dataset metadata."""
    upload = await _upload_by(
        db,
        new_upload,
        _SUB,
        dataset_meta={"title": "t", "provider": "someone"},
    )
    await DbUser.upsert(
        db,
        DbUser(sub=upload.user_sub, username="tester", email_address="t@example.org"),
    )

    meta = dict(upload.dataset_meta or {})
    meta.update(await _uploader_meta(db, upload))

    assert meta["provider"] == "someone"
    assert meta["uploader_id"] == upload.user_sub
    assert meta["owner_id"] == upload.user_sub


@pytest.mark.asyncio
async def test_an_upload_with_no_owner_reports_nothing(db):
    """Omit uploader metadata when there is no owner."""
    upload = DbUpload(id=str(uuid.uuid4()), user_sub=None)

    assert await _uploader_meta(db, upload) == {}
