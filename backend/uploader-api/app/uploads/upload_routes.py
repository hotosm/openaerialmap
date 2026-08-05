"""Multipart upload and workflow API routes.

Upload state lives in Postgres so retries and callbacks survive process restarts.
"""

import datetime as dt
import logging
import re
import secrets
import uuid
from typing import Any

import botocore.exceptions
from litestar import Request, Router, post
from litestar import status_codes as status
from litestar.di import Provide
from litestar.exceptions import HTTPException
from psycopg import AsyncConnection
from pydantic import BaseModel, Field

from app.auth.auth_deps import get_user_sub, get_user_username, login_required
from app.config import settings
from app.db.database import db_conn
from app.db.models import DbUpload, DbUser
from app.uploads import argo
from app.uploads.pgstac import upsert_item, validate_item
from app.uploads.s3 import (
    build_key,
    external_client,
    internal_client,
    key_owner_prefix,
    upload_id_from_key,
)

log = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {"image/tiff", "image/tif", "application/octet-stream"}


class CreateMultipartBody(BaseModel):
    """Start a multipart upload for a titled dataset."""

    filename: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=200)
    content_type: str = "image/tiff"
    size_bytes: int = Field(default=0, ge=0)
    metadata: dict[str, str] = {}


class SignedUrlBody(BaseModel):
    """Request a presigned URL for one part."""

    key: str
    upload_id: str
    part_number: int


class ListPartsBody(BaseModel):
    """List already-uploaded parts (for resume)."""

    key: str
    upload_id: str


class Part(BaseModel):
    """A completed part."""

    ETag: str
    PartNumber: int


class CompleteMultipartBody(BaseModel):
    """Finish a multipart upload and kick off processing."""

    key: str
    upload_id: str
    title: str
    filename: str
    parts: list[Part]


class AbortMultipartBody(BaseModel):
    """Abort an in-progress multipart upload."""

    key: str
    upload_id: str


class WorkflowStatusBody(BaseModel):
    """Status update posted by an Argo workflow step."""

    id: str
    status: str
    message: str = ""


def _parse_iso(value: str | None) -> dt.datetime | None:
    """Parse an ISO-8601 datetime (tolerating a trailing Z), else None."""
    if not value or not value.strip():
        return None
    try:
        return dt.datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return None


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
    user_sub = get_user_sub(auth_user)
    title = data.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A dataset title is required.",
        )
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
    start = _parse_iso(data.metadata.get("acquisition_start"))
    if start is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid ISO-8601 acquisition start date is required.",
        )
    end_raw = data.metadata.get("acquisition_end", "").strip()
    if end_raw:
        end = _parse_iso(end_raw)
        if end is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="acquisition_end is not a valid ISO-8601 date.",
            )
        if end < start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="acquisition_end must be on or after acquisition_start.",
            )

    await DbUser.upsert(db, DbUser(sub=user_sub, username=get_user_username(auth_user)))
    active = await DbUpload.count_active(db, user_sub)
    if active >= settings.MAX_ACTIVE_UPLOADS_PER_USER:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"You have {active} uploads in progress "
                f"(max {settings.MAX_ACTIVE_UPLOADS_PER_USER}); "
                "wait for one to finish."
            ),
        )

    upload_id = str(uuid.uuid4())
    callback_token = secrets.token_urlsafe(32)
    key = build_key(user_sub, upload_id, data.filename)

    # Persist first so completion cannot race ahead of its session row.
    await DbUpload.create(
        db,
        DbUpload(
            id=upload_id,
            user_sub=user_sub,
            filename=data.filename,
            title=title,
            s3_key=key,
            callback_token=callback_token,
            status="Initiated",
            message="Upload started.",
        ),
    )
    await db.commit()

    # Failed S3 sessions must not count toward the user's upload limit.
    try:
        resp = internal_client().create_multipart_upload(
            Bucket=settings.S3_BUCKET,
            Key=key,
            ContentType=data.content_type,
            Metadata={**data.metadata, "title": title},
        )
    except botocore.exceptions.ClientError as err:
        await DbUpload.set_status_owned(
            db, upload_id, user_sub, "Error", "Could not start the upload."
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Could not start the upload (storage error).",
        ) from err
    return {"key": key, "upload_id": resp["UploadId"]}


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
        resp = internal_client().list_parts(
            Bucket=settings.S3_BUCKET, Key=data.key, UploadId=data.upload_id
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

    # Require the session ID embedded in the key to match its owner.
    upload_id = upload_id_from_key(data.key)
    upload = await DbUpload.get_owned(db, upload_id, user_sub)
    if upload is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="No such upload session."
        )
    if upload.status != "Initiated":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This upload has already been completed.",
        )
    token = upload.callback_token

    *folder, file = data.key.split("/")
    s3_path = f"s3://{settings.S3_BUCKET}/{'/'.join(folder)}/"

    s3 = internal_client()
    try:
        s3.complete_multipart_upload(
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
            s3.head_object(Bucket=settings.S3_BUCKET, Key=data.key)
            log.info("Multipart already completed for %s; continuing.", data.key)
        except botocore.exceptions.ClientError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=err.response["Error"]["Message"],
            ) from err

    workflow_name = None
    if settings.ARGO_ENABLED:
        try:
            workflow_name = argo.submit_geotiff_workflow(
                s3_path=s3_path,
                filename=file,
                key=data.key,
                upload_id=upload_id,
                user_sub=user_sub,
                callback_token=token,
            )
        except Exception as err:  # noqa: BLE001
            await DbUpload.update_status(
                db,
                upload_id,
                token,
                "Error",
                f"Failed to submit processing workflow: {err}",
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to submit the processing workflow.",
            ) from err
        await DbUpload.update_status(
            db, upload_id, token, "Processing", "Queued for processing."
        )
        await DbUpload.set_workflow_name(db, upload_id, workflow_name)
    else:
        await DbUpload.update_status(
            db,
            upload_id,
            token,
            "Uploaded",
            "Uploaded to storage (processing not triggered - no cluster).",
        )
    await db.commit()

    return {"upload_id": upload_id, "workflow": workflow_name}


@post("/s3/abortmultipart")
async def abort_multipart(
    data: AbortMultipartBody, auth_user: object, db: AsyncConnection
) -> dict:
    """Abort an in-progress multipart upload and close out its session."""
    user_sub = _require_key_owner(auth_user, data.key)
    # Aborting an upload twice is safe.
    try:
        internal_client().abort_multipart_upload(
            Bucket=settings.S3_BUCKET, Key=data.key, UploadId=data.upload_id
        )
    except botocore.exceptions.ClientError as err:
        log.info("Abort: multipart already gone for %s (%s)", data.key, err)
    await DbUpload.set_status_owned(
        db, upload_id_from_key(data.key), user_sub, "Aborted", "Upload aborted."
    )
    await db.commit()
    return {"ok": True}


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
    """Register a STAC item for an authorized upload.

    The API keeps pgstac credentials out of workflow pods.
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

    item = validate_item(data, expected_id=item_id, collection=settings.STAC_COLLECTION)
    await upsert_item(item)
    log.info("Registered STAC item %s for upload %s", item_id, item_id)
    return {"ok": True}


upload_router = Router(
    path="/api/v1",
    route_handlers=[
        create_multipart,
        signed_url,
        list_parts,
        complete_multipart,
        abort_multipart,
        workflow_status,
        register_item,
    ],
    dependencies={
        "db": Provide(db_conn),
        "auth_user": Provide(login_required),
    },
)
