"""Upload operations the routes share, whichever way the bytes arrive.

Admitting an upload against its owner's quota, creating its row, handing it to
the cluster, and proving a workflow may report on one.
"""

import logging
import secrets
import uuid
from urllib.parse import urlsplit

import psycopg.errors
from litestar import Request
from litestar import status_codes as status
from litestar.exceptions import HTTPException
from psycopg import AsyncConnection

from app.auth.auth_deps import get_user_display_name, mirror_user
from app.blocking import run_blocking
from app.config import settings
from app.db.models import ANONYMOUS_SUB, DbUpload, UploadStatus
from app.uploads import argo, source_links, url_guard
from app.uploads.s3 import build_key, internal_client, safe_filename
from app.uploads.schemas import (
    CreateMultipartBody,
    CreateRemoteUploadBody,
    clean_external,
    clean_metadata,
)

log = logging.getLogger(__name__)


async def _require_quota(
    db: AsyncConnection, auth_user: object, anonymous: bool
) -> str:
    """Mirror the auth session, then quota-check whoever will own the upload.

    An anonymous upload is owned by a shared account, so it is that pool - not
    the caller - the quota applies to: nothing can attribute the row afterwards.
    """
    caller_sub = (await mirror_user(db, auth_user)).sub
    user_sub = ANONYMOUS_SUB if anonymous else caller_sub
    limit = settings.MAX_ACTIVE_UPLOADS_PER_USER
    active = await DbUpload.count_active(db, user_sub)
    if active >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"{active} {'anonymous ' if anonymous else ''}uploads are in "
                f"progress (max {limit}); wait for one to finish."
            ),
        )
    return user_sub


def _external_id_conflict(external_id: str, existing: DbUpload | None) -> HTTPException:
    """Build the 409 that hands a caller back its own in-flight upload.

    `extra` reaches the response body, so a caller that lost track of an upload
    can rediscover it by submitting the same key again.
    """
    detail = f"external_id '{external_id}' is already used by another upload."
    if existing:
        detail = (
            f"external_id '{external_id}' is already used by upload "
            f"{existing.id} (status {existing.status})."
        )
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=detail,
        extra={
            "external_id": external_id,
            "upload_id": existing.id if existing else None,
            "status": existing.status if existing else None,
        },
    )


async def _checked_source_url(source_url: str) -> str:
    """Rewrite a share link to its direct form, then resolve and vet it.

    Normalising first means a share link is vetted as the host it will really be
    fetched from. It does no I/O, so it stays on the event loop; the DNS does not.
    """
    try:
        direct = source_links.normalise(source_url)
        if direct != source_url.strip():
            # The host only: a query string is where a signature or a token is.
            log.info("Rewrote a share link to fetch from %s", urlsplit(direct).hostname)
        return await run_blocking(
            url_guard.check_url,
            direct,
            allow_private=settings.FETCH_ALLOW_PRIVATE_HOSTS,
        )
    except url_guard.UrlRejected as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)
        ) from err


async def _object_size(key: str) -> int | None:
    """Read an uploaded object's size, None if it cannot be read."""
    try:
        head = await run_blocking(
            internal_client().head_object, Bucket=settings.S3_BUCKET, Key=key
        )
    except Exception:  # noqa: BLE001
        log.warning("Could not size %s; the workspace falls back", key, exc_info=True)
        return None
    return head.get("ContentLength")


async def start_processing(db: AsyncConnection, upload: DbUpload) -> str | None:
    """Submit the processing workflow for a stored upload row.

    Both ingest paths end here: the browser one once the last part lands, the
    remote-source one as soon as the row exists.
    """
    token = upload.callback_token
    *folder, filename = upload.s3_key.split("/")
    s3_path = f"s3://{settings.S3_BUCKET}/{'/'.join(folder)}/"
    remote = bool(upload.source_url)

    if not settings.ARGO_ENABLED:
        if remote:
            await DbUpload.update_status(
                db,
                upload.id,
                token,
                UploadStatus.ERROR,
                "Remote-source ingest needs the processing cluster, "
                "which is not enabled here.",
            )
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Remote-source ingest is unavailable (no processing cluster).",
            )
        await DbUpload.update_status(
            db,
            upload.id,
            token,
            UploadStatus.UPLOADED,
            "Uploaded to storage (processing not triggered - no cluster).",
        )
        await db.commit()
        return None

    # Sizes the workspace volume: the object itself, not the browser's claim
    # about it. A remote source has no object yet and gets the ceiling.
    size_bytes = None if remote else await _object_size(upload.s3_key)
    try:
        workflow_name = await run_blocking(
            argo.submit_geotiff_workflow,
            s3_path=s3_path,
            filename=filename,
            key=upload.s3_key,
            upload_id=upload.id,
            user_sub=upload.user_sub,
            callback_token=token,
            remote_source=remote,
            size_bytes=size_bytes,
        )
    except Exception as err:  # noqa: BLE001
        log.exception("Submitting the workflow for upload %s failed", upload.id)
        if remote:
            # The row is already committed and the caller's only retry is a
            # fresh POST, which a terminal status frees the external_id for.
            await DbUpload.update_status(
                db,
                upload.id,
                token,
                UploadStatus.ERROR,
                "Could not start processing.",
            )
            await db.commit()
        else:
            # The claim is uncommitted, so this returns the upload to Initiated
            # rather than ending it on an error we may be wrong about: an
            # apiserver timeout does not say whether the workflow was created.
            # Completing again resubmits under the same name, and a workflow
            # that did land answers 409.
            await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit the processing workflow.",
        ) from err

    await DbUpload.update_status(
        db, upload.id, token, UploadStatus.PROCESSING, "Queued for processing."
    )
    await DbUpload.set_workflow_name(db, upload.id, workflow_name)
    await db.commit()
    return workflow_name


async def create_upload_row(
    db: AsyncConnection,
    auth_user: object,
    data: "CreateMultipartBody | CreateRemoteUploadBody",
    *,
    message: str,
    filename: str = "",
    source_url: str = "",
) -> DbUpload:
    """Validate, admit and persist a new upload, whichever way the bytes arrive.

    Resolving a source URL means DNS, the one step a caller can make arbitrarily
    slow, so it happens after the cheap indexed checks.
    """
    title = data.title.strip()
    if not title:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A dataset title is required.",
        )
    dataset_meta = clean_metadata(
        data.metadata, title, contact_default=get_user_display_name(auth_user)
    )
    if data.anonymous:
        # The one published field that names a person, however it was filled in.
        dataset_meta.pop("contact", None)
    external_id, external_url = clean_external(data)

    user_sub = await _require_quota(db, auth_user, data.anonymous)
    existing = await DbUpload.find_by_external_id(db, external_id or "")
    if existing:
        raise _external_id_conflict(external_id, existing)

    if source_url:
        source_url = await _checked_source_url(source_url)
        # Fall back to the URL's own basename so the archived original keeps a
        # recognisable name.
        filename = filename or (
            source_links.ODM_ORTHO_ASSET
            if source_links.is_odm_archive(source_url)
            else urlsplit(source_url).path
        )
    filename = safe_filename(filename)

    upload_id = str(uuid.uuid4())
    key = build_key(user_sub, upload_id, filename)
    try:
        upload = await DbUpload.create(
            db,
            DbUpload(
                id=upload_id,
                user_sub=user_sub,
                filename=filename,
                title=title,
                s3_key=key,
                callback_token=secrets.token_urlsafe(32),
                status=UploadStatus.INITIATED,
                message=message,
                external_id=external_id,
                external_url=external_url,
                source_url=source_url or None,
                dataset_meta=dataset_meta,
            ),
        )
    except psycopg.errors.UniqueViolation as err:
        # Lost the race for this external_id; re-read to say who won.
        await db.rollback()
        raise _external_id_conflict(
            external_id or "", await DbUpload.find_by_external_id(db, external_id or "")
        ) from err
    await db.commit()
    return upload


async def authorized_upload(
    db: AsyncConnection, upload_id: str, request: Request
) -> DbUpload:
    """Resolve an upload from its per-upload callback token."""
    upload = await DbUpload.get_authorized(
        db, upload_id, request.headers.get("X-Internal-Token", "")
    )
    if upload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return upload


def public_upload_state(upload: DbUpload) -> dict:
    """Shape an upload row for a status response."""
    return {
        "upload_id": upload.id,
        "item_id": upload.id if upload.status == UploadStatus.SUCCEEDED else None,
        "status": upload.status,
        "message": upload.message,
        "warning": upload.warning,
        "external_id": upload.external_id,
        "title": upload.title,
        "created_at": upload.created_at.isoformat() if upload.created_at else None,
        "updated_at": upload.updated_at.isoformat() if upload.updated_at else None,
    }
