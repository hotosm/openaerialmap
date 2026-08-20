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
        # An empty endpoint selects standard AWS S3.
        endpoint_url=endpoint or None,
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=(
            settings.AWS_SECRET_ACCESS_KEY.get_secret_value()
            if settings.AWS_SECRET_ACCESS_KEY
            else None
        ),
        config=Config(
            # Local S3 services require SigV4 and path-style addresses.
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            # botocore defaults to a minute each; an unreachable endpoint
            # should fail a request, not hold a worker thread that long.
            connect_timeout=5,
            read_timeout=60,
            retries={"mode": "standard"},
            # Automatic checksums break presigned PUTs on MinIO and rustfs.
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
    """Make a filename safe to use in the pipeline's shell command."""
    base = os.path.basename((filename or "").strip())
    stem, dot, ext = base.rpartition(".")
    if not dot:
        stem, ext = base, "tif"
    stem = re.sub(r"[^A-Za-z0-9_-]", "-", stem).strip("-._") or "upload"
    ext = re.sub(r"[^A-Za-z0-9]", "", ext)[:8] or "tif"
    return f"{stem}.{ext}"


def key_owner_prefix(user_sub: str) -> str:
    """Hash the user identity so different subjects cannot share a prefix."""
    return "u-" + hashlib.sha256((user_sub or "").encode()).hexdigest()[:16]


def build_key(user_sub: str, upload_id: str, filename: str) -> str:
    """Build a key scoped by user and upload ID."""
    return f"{key_owner_prefix(user_sub)}/{upload_id}/{safe_filename(filename)}"


def upload_id_from_key(key: str) -> str:
    """Extract the upload ID from a build_key() key."""
    parts = key.split("/")
    return parts[-2] if len(parts) >= 2 else ""
