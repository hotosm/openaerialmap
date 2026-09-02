"""What "upload anonymously" detaches: the row's owner, the key, the contact."""

import pytest
from litestar.exceptions import HTTPException

from app.auth.auth_deps import get_user_sub
from app.db.models import ANONYMOUS_SUB, DbUpload, DbUser
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
