"""Bootstrap the imagery bucket on an S3-compatible store.

RustFS starts with no buckets, so without this the first upload 404s and the
seed job has nowhere to copy to. Every step is idempotent, which is what lets it
hang off a Helm post-upgrade hook.

Three things have to hold for the upload flow to work:

  * the bucket exists
  * its objects are anonymously readable - STAC asset URLs are fetched by
    titiler and by browsers, with no credentials
  * it allows cross-origin PUTs from the upload form's origin, because the
    browser presigns and uploads straight to the store

The last needs RustFS >= the April 2026 release, where PutBucketCors stopped
returning 501. Failing hard on it beats warning: the alternative is an
environment that looks healthy and rejects every upload.
"""

import json
import logging
import os
import sys
import time

import boto3
import botocore.exceptions
from botocore.config import Config

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s %(message)s",
)
log = logging.getLogger("init-bucket")

# The AWS SDKs log every request signature and event handler at DEBUG.
for noisy in ("boto3", "botocore", "s3transfer", "urllib3"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

BUCKET = os.environ["S3_BUCKET"]
ENDPOINT = os.environ.get("S3_ENDPOINT") or None
REGION = os.environ.get("S3_REGION", "us-east-1")
PUBLIC_READ = os.environ.get("INIT_PUBLIC_READ", "true") not in ("", "0", "false")
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("INIT_CORS_ORIGINS", "").split(",")
    if origin.strip()
]
# The store's Deployment may still be rolling when this hook fires.
WAIT_SECONDS = int(os.environ.get("INIT_WAIT_SECONDS", "180"))


def client():
    """S3 client for the store, matching how the app addresses it."""
    return boto3.client(
        "s3",
        endpoint_url=ENDPOINT,
        region_name=REGION,
        config=Config(
            signature_version="s3v4",
            # Path-style addressing, matching app/uploads/s3.py: a bundled store
            # has no wildcard DNS for virtual-hosted buckets.
            s3={"addressing_style": "path"},
            connect_timeout=5,
            read_timeout=30,
            retries={"mode": "standard"},
            # Automatic checksums break presigned PUTs on MinIO and RustFS, and
            # this client is the one that proves the store answers at all.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def wait_for_store(s3) -> None:
    """Block until the store answers, so a rolling pod is not a failed hook."""
    deadline = time.monotonic() + WAIT_SECONDS
    while True:
        try:
            s3.list_buckets()
            return
        except Exception as exc:  # noqa: BLE001 - any failure means "not yet"
            if time.monotonic() >= deadline:
                raise RuntimeError(
                    f"object store at {ENDPOINT or 'AWS S3'} did not respond "
                    f"within {WAIT_SECONDS}s"
                ) from exc
            log.info("waiting for object store at %s", ENDPOINT or "AWS S3")
            time.sleep(3)


def ensure_bucket(s3) -> None:
    """Create the bucket unless it is already there."""
    # HeadBucket first: RustFS answers CreateBucket on an existing bucket with
    # success rather than BucketAlreadyOwnedByYou, so creating blind would report
    # having created a bucket that was already there.
    try:
        s3.head_bucket(Bucket=BUCKET)
        log.info("bucket %r already exists", BUCKET)
        return
    except botocore.exceptions.ClientError as exc:
        if exc.response["Error"]["Code"] not in ("404", "NoSuchBucket", "NotFound"):
            raise
    try:
        s3.create_bucket(Bucket=BUCKET)
        log.info("created bucket %r", BUCKET)
    except botocore.exceptions.ClientError as exc:
        # Lost a race with a concurrent run of this same job.
        if exc.response["Error"]["Code"] not in (
            "BucketAlreadyOwnedByYou",
            "BucketAlreadyExists",
        ):
            raise
        log.info("bucket %r already exists", BUCKET)


def ensure_public_read(s3) -> None:
    """Allow anonymous GET, which is how STAC asset URLs are fetched."""
    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": "*",
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{BUCKET}/*",
            }
        ],
    }
    s3.put_bucket_policy(Bucket=BUCKET, Policy=json.dumps(policy))
    log.info("set public-read policy on %r", BUCKET)


def ensure_cors(s3) -> None:
    """Allow presigned PUTs from the upload form, and COG reads from anywhere.

    Requires both read and write rule.
    """
    rules = []
    if PUBLIC_READ:
        rules.append(
            {
                "AllowedOrigins": ["*"],
                "AllowedMethods": ["GET", "HEAD"],
                "AllowedHeaders": ["*"],
                "ExposeHeaders": ["ETag", "Content-Range", "Accept-Ranges"],
                "MaxAgeSeconds": 3600,
            }
        )
    if CORS_ORIGINS:
        rules.append(
            {
                "AllowedOrigins": CORS_ORIGINS,
                "AllowedMethods": ["GET", "HEAD", "PUT", "POST", "DELETE"],
                "AllowedHeaders": ["*"],
                "ExposeHeaders": ["ETag", "x-amz-request-id"],
                "MaxAgeSeconds": 3600,
            }
        )
    s3.put_bucket_cors(Bucket=BUCKET, CORSConfiguration={"CORSRules": rules})
    if PUBLIC_READ:
        log.info("allowed cross-origin reads from any origin")
    if CORS_ORIGINS:
        log.info("allowed cross-origin uploads from %s", ", ".join(CORS_ORIGINS))


def main() -> int:
    """Bring the bucket to the state the upload flow needs."""
    s3 = client()
    wait_for_store(s3)
    ensure_bucket(s3)
    if PUBLIC_READ:
        ensure_public_read(s3)
    else:
        log.info("skipping public-read policy (INIT_PUBLIC_READ is off)")
    if CORS_ORIGINS or PUBLIC_READ:
        ensure_cors(s3)
    else:
        log.info("private bucket and no INIT_CORS_ORIGINS; leaving bucket CORS alone")
    log.info("bucket %r ready", BUCKET)
    return 0


if __name__ == "__main__":
    sys.exit(main())
