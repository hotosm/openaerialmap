import uuid

import pytest
from litestar.exceptions import HTTPException

from app.db.models import DbUpload, UploadStatus
from app.uploads import pipeline_routes
from app.uploads.schemas import WorkflowStatusBody


class _Request:
    def __init__(self, token: str = ""):
        self.headers = {"X-Internal-Token": token}


def _body(upload_id: str, status: str, message: str = "") -> WorkflowStatusBody:
    return WorkflowStatusBody(id=upload_id, status=status, message=message)


# `.fn` is the undecorated handler; the decorator only accepts a connection.
_report = pipeline_routes.workflow_status.fn


@pytest.fixture
def no_argo(monkeypatch):
    monkeypatch.setattr(pipeline_routes.settings, "ARGO_ENABLED", False)


@pytest.mark.asyncio
async def test_a_finished_upload_accepts_a_late_report(db, new_upload, no_argo):
    upload = await new_upload(status=UploadStatus.CONVERTING)
    await DbUpload.update_status(
        db, upload.id, "tok", UploadStatus.FAILED, "Invalid raster: no CRS."
    )

    result = await _report(_body(upload.id, UploadStatus.FAILED), _Request("tok"), db)

    assert result["ignored"] == "already finished"
    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.message == "Invalid raster: no CRS."


@pytest.mark.asyncio
async def test_an_unfinished_upload_still_rejects_a_bad_token(db, new_upload, no_argo):
    upload = await new_upload(status=UploadStatus.CONVERTING)

    with pytest.raises(HTTPException) as err:
        await _report(_body(upload.id, UploadStatus.UPLOADING), _Request("wrong"), db)

    assert err.value.status_code == 401
    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == UploadStatus.CONVERTING


@pytest.mark.asyncio
async def test_an_unknown_upload_is_still_unauthorized(db, no_argo):
    with pytest.raises(HTTPException) as err:
        await _report(
            _body(str(uuid.uuid4()), UploadStatus.FAILED), _Request("tok"), db
        )

    assert err.value.status_code == 401


@pytest.mark.asyncio
async def test_a_still_running_upload_is_not_reported_finished(db, new_upload):
    upload = await new_upload(status=UploadStatus.CONVERTING)
    assert await DbUpload.is_finished(db, upload.id) is False

    await DbUpload.update_status(db, upload.id, "tok", UploadStatus.FAILED, "gone")
    assert await DbUpload.is_finished(db, upload.id) is True


@pytest.mark.asyncio
async def test_the_exit_handler_gets_its_reason_from_argo(db, new_upload, monkeypatch):
    upload = await new_upload(status=UploadStatus.CONVERTING)
    monkeypatch.setattr(pipeline_routes.settings, "ARGO_ENABLED", True)
    monkeypatch.setattr(
        pipeline_routes.argo,
        "get_workflow_outcome",
        lambda name: ("Failed", "convert: OOMKilled"),
    )

    result = await _report(_body(upload.id, UploadStatus.FAILED), _Request("tok"), db)

    assert "ignored" not in result
    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.message == "convert: OOMKilled"


@pytest.mark.asyncio
async def test_an_unreachable_argo_still_finishes_the_upload(
    db, new_upload, monkeypatch
):
    upload = await new_upload(status=UploadStatus.CONVERTING)
    monkeypatch.setattr(pipeline_routes.settings, "ARGO_ENABLED", True)

    def _boom(name):
        raise RuntimeError("apiserver is down")

    monkeypatch.setattr(pipeline_routes.argo, "get_workflow_outcome", _boom)

    await _report(_body(upload.id, UploadStatus.FAILED), _Request("tok"), db)

    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == UploadStatus.FAILED
    assert row.message == "Processing failed."


@pytest.mark.asyncio
async def test_a_named_reason_is_never_replaced_by_a_lookup(
    db, new_upload, monkeypatch
):
    upload = await new_upload(status=UploadStatus.CONVERTING)
    monkeypatch.setattr(pipeline_routes.settings, "ARGO_ENABLED", True)

    def _never(name):
        raise AssertionError("the API should not have asked Argo")

    monkeypatch.setattr(pipeline_routes.argo, "get_workflow_outcome", _never)

    await _report(
        _body(upload.id, UploadStatus.FAILED, "The source URL served a login page."),
        _Request("tok"),
        db,
    )

    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.message == "The source URL served a login page."
