"""The upload API: browser multipart uploads, remote-source ingest, and reads.

The pipeline's own callbacks live in `pipeline_routes`; they authenticate with a
per-upload token rather than a session.
"""

import logging
import re

import botocore.exceptions
from litestar import Router, get, post
from litestar import status_codes as status
from litestar.di import Provide
from litestar.exceptions import HTTPException
from litestar.params import FromPath, FromQuery
from psycopg import AsyncConnection

from app.auth.auth_deps import get_optional_auth_user, get_user_sub, login_required
from app.blocking import run_blocking
from app.config import settings
from app.db.database import db_conn
from app.db.models import DbUpload, UploadStatus
from app.uploads import pipeline_routes
from app.uploads.s3 import (
    external_client,
    internal_client,
    key_owner_prefix,
    upload_id_from_key,
)
from app.uploads.schemas import (
    ALLOWED_CONTENT_TYPES,
    AbortMultipartBody,
    CompleteMultipartBody,
    CreateMultipartBody,
    CreateRemoteUploadBody,
    ListPartsBody,
    SignedUrlBody,
)
from app.uploads.service import (
    create_upload_row,
    public_upload_state,
    start_processing,
)

log = logging.getLogger(__name__)


def _require_key_owner(auth_user: object, key: str) -> str:
    """Return the user's subject after verifying that they own the key."""
    user_sub = get_user_sub(auth_user)
    if not key.startswith(key_owner_prefix(user_sub) + "/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not own this upload.",
        )
    return user_sub


@post("/s3/createmultipart")
async def create_multipart(
    data: CreateMultipartBody, auth_user: object, db: AsyncConnection
) -> dict:
    """Create a multipart upload and its database record."""
    if data.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported content type; upload a GeoTIFF.",
        )
    if data.size_bytes > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Upload exceeds the {settings.MAX_UPLOAD_BYTES}-byte limit.",
        )
    # Persist first so completion cannot race ahead of its session row.
    upload = await create_upload_row(
        db, auth_user, data, filename=data.filename, message="Upload started."
    )

    # Failed S3 sessions must not count toward the user's upload limit.
    try:
        resp = await run_blocking(
            internal_client().create_multipart_upload,
            Bucket=settings.S3_BUCKET,
            Key=upload.s3_key,
            ContentType=data.content_type,
        )
    except botocore.exceptions.ClientError as err:
        await DbUpload.set_status_owned(
            db,
            upload.id,
            upload.user_sub,
            UploadStatus.ERROR,
            "Could not start the upload.",
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not start the upload (storage error).",
        ) from err
    return {"key": upload.s3_key, "upload_id": resp["UploadId"]}


@post("/s3/signedurl")
async def signed_url(data: SignedUrlBody, auth_user: object) -> dict:
    """Generate a browser-reachable presigned URL for one part."""
    _require_key_owner(auth_user, data.key)
    if not 0 < data.part_number <= 10000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="part_number must be 1-10000.",
        )
    url = external_client().generate_presigned_url(
        ClientMethod="upload_part",
        Params={
            "Bucket": settings.S3_BUCKET,
            "Key": data.key,
            "PartNumber": data.part_number,
            "UploadId": data.upload_id,
        },
        ExpiresIn=3600,
    )
    return {"url": url}


@post("/s3/listparts")
async def list_parts(data: ListPartsBody, auth_user: object) -> list:
    """List already-uploaded parts (supports resumable uploads)."""
    _require_key_owner(auth_user, data.key)
    try:
        resp = await run_blocking(
            internal_client().list_parts,
            Bucket=settings.S3_BUCKET,
            Key=data.key,
            UploadId=data.upload_id,
        )
    except botocore.exceptions.ClientError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err.response["Error"]["Message"],
        ) from err
    return resp.get("Parts", [])


@post("/s3/completemultipart")
async def complete_multipart(
    data: CompleteMultipartBody, auth_user: object, db: AsyncConnection
) -> dict:
    """Complete the upload against its session row and submit the workflow."""
    user_sub = _require_key_owner(auth_user, data.key)

    # Restrict this shell input because the pipeline passes it to `sh -c`.
    if not re.fullmatch(r"[A-Za-z0-9._/-]+", data.key):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid upload key."
        )

    # Claiming the row is what stops two clicks becoming two workflows. It stays
    # uncommitted until processing is under way, so a failure below rolls the
    # upload back to Initiated and it can be retried.
    upload_id = upload_id_from_key(data.key)
    upload = await DbUpload.claim_for_processing(db, upload_id, user_sub)
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No open upload session for this key.",
        )
    # The pipeline reads the key from the row, not from this request, so a
    # mismatched filename would complete one object and then process another.
    if upload.s3_key != data.key:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload key does not match the one this session was created with.",
        )

    s3 = internal_client()
    try:
        await run_blocking(
            s3.complete_multipart_upload,
            Bucket=settings.S3_BUCKET,
            Key=data.key,
            UploadId=data.upload_id,
            MultipartUpload={
                "Parts": [
                    {"ETag": p.ETag, "PartNumber": p.PartNumber} for p in data.parts
                ]
            },
        )
    except botocore.exceptions.ClientError as err:
        # A retry may find the object after the multipart upload has closed.
        try:
            await run_blocking(s3.head_object, Bucket=settings.S3_BUCKET, Key=data.key)
            log.info("Multipart already completed for %s; continuing.", data.key)
        except botocore.exceptions.ClientError:
            # Release the claim, so the caller can fix the parts and try again.
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err.response["Error"]["Message"],
            ) from err

    workflow_name = await start_processing(db, upload)
    return {"upload_id": upload_id, "workflow": workflow_name}


@post("/s3/abortmultipart")
async def abort_multipart(
    data: AbortMultipartBody, auth_user: object, db: AsyncConnection
) -> dict:
    """Abort an upload session that has not started processing.

    Conditional on the session still being open, so a late cancel cannot mark a
    scene "Aborted" while its workflow is still registering it.
    """
    user_sub = _require_key_owner(auth_user, data.key)
    # Aborting an upload twice is safe.
    try:
        await run_blocking(
            internal_client().abort_multipart_upload,
            Bucket=settings.S3_BUCKET,
            Key=data.key,
            UploadId=data.upload_id,
        )
    except botocore.exceptions.ClientError as err:
        log.info("Abort: multipart already gone for %s (%s)", data.key, err)
    aborted = await DbUpload.set_status_owned(
        db,
        upload_id_from_key(data.key),
        user_sub,
        UploadStatus.ABORTED,
        "Upload aborted.",
        expect_status=UploadStatus.INITIATED,
    )
    await db.commit()
    if not aborted:
        log.info("Abort: %s was not an open session; left as it was", data.key)
    return {"ok": True, "aborted": aborted}


@post("/uploads", status_code=status.HTTP_201_CREATED)
async def create_remote_upload(
    data: CreateRemoteUploadBody, auth_user: object, db: AsyncConnection
) -> dict:
    """Register an upload the pipeline fetches from a URL, and start it.

    Used by partner systems that already hold the imagery: there is no
    browser-side transfer, so the row goes straight to Processing.
    """
    upload = await create_upload_row(
        db,
        auth_user,
        data,
        filename=data.filename,
        source_url=data.source_url,
        message="Queued to fetch from the source URL.",
    )
    workflow_name = await start_processing(db, upload)
    return {
        "upload_id": upload.id,
        # The upload ID is the STAC item ID, so a caller can record the link now.
        "item_id": upload.id,
        "external_id": upload.external_id,
        "workflow": workflow_name,
    }


@get(
    "/uploads/lookup",
    exclude_from_auth=True,
    dependencies={"auth_user": Provide(get_optional_auth_user)},
)
async def lookup_upload(
    db: AsyncConnection,
    auth_user: object | None,
    external_id: FromQuery[str],
) -> dict:
    """Resolve an external_id to its upload, for a caller that lost the link.

    In-progress detail is owner-only: whether someone's upload failed validation
    is not public, but a published item is.
    """
    external_id = external_id.strip()
    if not external_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="external_id is required."
        )

    upload = await DbUpload.find_by_external_id(db, external_id)
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No upload or catalogue item for that external_id.",
        )

    is_owner = auth_user is not None and get_user_sub(auth_user) == upload.user_sub
    if not is_owner and upload.status != UploadStatus.SUCCEEDED:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No published item for that external_id yet.",
        )
    return public_upload_state(upload)


@get("/uploads/{upload_id:str}")
async def get_upload(
    upload_id: FromPath[str], auth_user: object, db: AsyncConnection
) -> dict:
    """Return one of the caller's uploads as JSON (for programmatic polling)."""
    upload = await DbUpload.get_owned(db, upload_id, get_user_sub(auth_user))
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No such upload."
        )
    return {**public_upload_state(upload), "workflow": upload.workflow_name}


upload_router = Router(
    path="/api/v1",
    route_handlers=[
        create_multipart,
        signed_url,
        list_parts,
        complete_multipart,
        abort_multipart,
        create_remote_upload,
        lookup_upload,
        get_upload,
        pipeline_routes.pipeline_meta,
        pipeline_routes.pipeline_source,
        pipeline_routes.report_checksum,
        pipeline_routes.workflow_status,
        pipeline_routes.register_item,
    ],
    dependencies={
        "db": Provide(db_conn),
        "auth_user": Provide(login_required),
    },
)
