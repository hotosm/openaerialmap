"""S3 multipart helpers.

Separate clients let the API use an internal endpoint while presigned URLs use
a browser-reachable endpoint.
"""

import hashlib
import logging
import os
import re
from functools import lru_cache

import boto3
from botocore.config import Config

from app.config import settings

log = logging.getLogger(__name__)


def _client(endpoint: str | None):
    return boto3.client(
        "s3",
        # "" is not a valid endpoint for boto3; None selects the standard AWS one.
        endpoint_url=endpoint or None,
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=(
            settings.AWS_SECRET_ACCESS_KEY.get_secret_value()
            if settings.AWS_SECRET_ACCESS_KEY
            else None
        ),
        config=Config(
            # Custom endpoints may default to SigV2, which MinIO and rustfs reject.
            signature_version="s3v4",
            s3={"addressing_style": "path"},  # path-style for rustfs / localstack
            # New botocore checksums break presigned PUTs on MinIO and rustfs.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


@lru_cache
def internal_client():
    """S3 client for in-network/server-side calls."""
    return _client(settings.S3_ENDPOINT)


@lru_cache
def external_client():
    """S3 client whose presigned URLs are reachable by the browser."""
    return _client(settings.S3_EXTERNAL_ENDPOINT or settings.S3_ENDPOINT)


def safe_filename(filename: str) -> str:
    """Remove shell metacharacters and path separators from an upload name.

    The pipeline interpolates this value into an AWS CLI shell command.
    """
    base = os.path.basename((filename or "").strip())
    stem, dot, ext = base.rpartition(".")
    if not dot:  # no extension present
        stem, ext = base, "tif"
    stem = re.sub(r"[^A-Za-z0-9_-]", "-", stem).strip("-._") or "upload"
    ext = re.sub(r"[^A-Za-z0-9]", "", ext)[:8] or "tif"
    return f"{stem}.{ext}"


def key_owner_prefix(user_sub: str) -> str:
    """Return a stable, collision-resistant S3 prefix for a user.

    A hash of the canonical subject (not a lossy slug), so distinct identities
    can never normalise to the same prefix and cross into each other's uploads.
    """
    return "u-" + hashlib.sha256((user_sub or "").encode()).hexdigest()[:16]


def build_key(user_sub: str, upload_id: str, filename: str) -> str:
    """Build a key scoped by user and immutable upload ID.

    The upload ID prevents title collisions and makes prefix deletion safe.
    """
    return f"{key_owner_prefix(user_sub)}/{upload_id}/{safe_filename(filename)}"


def upload_id_from_key(key: str) -> str:
    """Extract the upload ID from a build_key() key."""
    parts = key.split("/")
    return parts[-2] if len(parts) >= 2 else ""


def ensure_bucket_lifecycle() -> None:
    """Configure cleanup for multipart uploads abandoned by failed clients.

    Lifecycle permissions are optional, so failures are logged and ignored.
    """
    days = settings.ABORT_INCOMPLETE_MULTIPART_DAYS
    try:
        internal_client().put_bucket_lifecycle_configuration(
            Bucket=settings.S3_BUCKET,
            LifecycleConfiguration={
                "Rules": [
                    {
                        "ID": "oam-abort-incomplete-multipart",
                        "Status": "Enabled",
                        "Filter": {"Prefix": ""},
                        "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": days},
                    }
                ]
            },
        )
        log.info("S3 lifecycle set: abort incomplete multipart after %d days", days)
    except Exception as err:  # noqa: BLE001
        log.warning("Could not set S3 abort-incomplete-multipart lifecycle: %s", err)
