"""What the pipeline is allowed to ask for, and to report.

Every route here is authenticated by the per-upload callback token rather than a
session, because the caller is a workflow pod. That token is what keeps the
metadata, the source URL and pgstac credentials out of the Workflow spec.
"""

import logging
from typing import Any

from litestar import Request, Response, get, post
from litestar import status_codes as status
from litestar.exceptions import HTTPException
from litestar.params import FromPath
from psycopg import AsyncConnection

from app.blocking import run_blocking
from app.config import settings
from app.db.models import DbUpload, UploadStatus
from app.uploads.pgstac import find_item_by_checksum, upsert_item, validate_item
from app.uploads.schemas import ChecksumBody, WorkflowStatusBody
from app.uploads.service import authorized_upload

log = logging.getLogger(__name__)


@get("/uploads/{upload_id:str}/pipeline/meta", exclude_from_auth=True)
async def pipeline_meta(
    upload_id: FromPath[str], request: Request, db: AsyncConnection
) -> dict[str, str]:
    """Return the metadata the pipeline writes to its `meta.json`.

    Read back here instead of passed as workflow parameters: these are free-text
    fields and they have no business in argv.
    """
    upload = await authorized_upload(db, upload_id, request)
    meta = dict(upload.dataset_meta or {})
    meta["title"] = upload.title or upload_id
    if upload.external_id:
        meta["external_id"] = upload.external_id
    if upload.external_url:
        meta["external_url"] = upload.external_url
    return meta


@get("/uploads/{upload_id:str}/pipeline/source", exclude_from_auth=True)
async def pipeline_source(
    upload_id: FromPath[str], request: Request, db: AsyncConnection
) -> Response:
    """Return the checked source URL as text.

    An empty body means the URL is spent and the bytes are already in the bucket.
    """
    upload = await authorized_upload(db, upload_id, request)
    return Response(content=upload.source_url or "", media_type="text/plain")


@post(
    "/uploads/{upload_id:str}/checksum",
    exclude_from_auth=True,
    status_code=status.HTTP_200_OK,
)
async def report_checksum(
    upload_id: FromPath[str],
    data: ChecksumBody,
    request: Request,
    db: AsyncConnection,
) -> dict:
    """Record the original file's checksum and flag byte-identical duplicates.

    A match is a warning, never a rejection: re-publishing the same bytes is
    sometimes deliberate, and only the uploader knows which case this is.
    """
    upload = await authorized_upload(db, upload_id, request)
    checksum = data.checksum.strip()
    duplicate_of = await find_item_by_checksum(checksum)
    if duplicate_of == upload_id:
        # A retried workflow re-reports its own already-registered checksum.
        duplicate_of = None
    warning = None
    if duplicate_of:
        warning = (
            f"These bytes are already published as item {duplicate_of}. "
            "Continuing; the new item will be a second copy."
        )
        log.info(
            "Upload %s has the same original checksum as item %s",
            upload_id,
            duplicate_of,
        )
    await DbUpload.set_checksum(db, upload_id, upload.callback_token, checksum, warning)
    # The bytes are archived by now, so drop the source URL: a presigned one
    # stays valid for hours.
    await DbUpload.clear_source_url(db, upload_id)
    await db.commit()
    return {"ok": True, "duplicate_of": duplicate_of}


@post("/workflowstatus", exclude_from_auth=True, status_code=status.HTTP_200_OK)
async def workflow_status(
    data: WorkflowStatusBody, request: Request, db: AsyncConnection
) -> dict:
    """Receive a token-authenticated workflow status update."""
    token = request.headers.get("X-Internal-Token", "")
    updated = await DbUpload.update_status(
        db, data.id, token, data.status, data.message
    )
    if updated is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return {"ok": True}


@post("/register", exclude_from_auth=True, status_code=status.HTTP_200_OK)
async def register_item(
    data: dict[str, Any], request: Request, db: AsyncConnection
) -> dict:
    """Register a STAC item for an authorized upload, and finish it.

    The API keeps pgstac credentials out of workflow pods. Registration is the
    last step, so a published item is what success means: recording it here
    rather than waiting for the workflow's exit callback means one fewer
    best-effort message between "it worked" and the row saying so.
    """
    token = request.headers.get("X-Internal-Token", "")
    item_id = data.get("id")
    if not isinstance(item_id, str) or not item_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="item.id is missing"
        )
    upload = await DbUpload.get_authorized(db, item_id, token)
    if upload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    # Blocking: stac-pydantic fetches each extension's schema over HTTP.
    item = await run_blocking(
        validate_item, data, expected_id=item_id, collection=settings.STAC_COLLECTION
    )
    await upsert_item(item)
    await DbUpload.update_status(
        db, item_id, token, UploadStatus.SUCCEEDED, "Published to the catalogue."
    )
    await db.commit()
    log.info("Registered STAC item %s", item_id)
    return {"ok": True}
