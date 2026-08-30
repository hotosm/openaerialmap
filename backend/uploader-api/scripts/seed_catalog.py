#!/usr/bin/env python3
"""Create a STAC collection and optionally copy items from a public catalogue."""

import json
import logging
import os
import sys
import time
import urllib.error
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from functools import cache
from typing import Any

import boto3
import psycopg
from boto3.s3.transfer import TransferConfig
from botocore import UNSIGNED
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from psycopg.conninfo import make_conninfo
from psycopg.types.json import Jsonb

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"), format="%(levelname)s %(message)s"
)
log = logging.getLogger("seed")

# The AWS SDKs log every request signature and event handler at DEBUG.
for noisy in ("boto3", "botocore", "s3transfer", "urllib3"):
    logging.getLogger(noisy).setLevel(logging.WARNING)

SRC_STAC = os.environ["SEED_STAC_URL"].rstrip("/")
SRC_BUCKET = os.environ["SEED_SRC_BUCKET"]
SRC_PREFIX = os.environ["SEED_SRC_ASSET_BASE_URL"].rstrip("/")
COLLECTION = os.environ["SEED_COLLECTION"]

DST_BUCKET = os.environ["S3_BUCKET"]
DST_PREFIX = os.environ["PUBLIC_ASSET_BASE_URL"].rstrip("/")
DST_ENDPOINT = os.environ.get("S3_ENDPOINT") or None
REGION = os.environ.get("S3_REGION", "us-east-1")

# Rewrite both HTTP and S3 references to copied objects.
PREFIX_PAIRS = (
    (SRC_PREFIX, DST_PREFIX),
    (f"s3://{SRC_BUCKET}", f"s3://{DST_BUCKET}"),
)

MAX_BYTES = int(float(os.environ.get("SEED_MAX_GIB", "10")) * 1024**3)
MAX_ITEMS = int(os.environ.get("SEED_MAX_ITEMS", "0"))
REQUIRED_ASSETS = {
    name.strip()
    for name in os.environ.get("SEED_REQUIRED_ASSETS", "visual").split(",")
    if name.strip()
}
WORKERS = int(os.environ.get("SEED_WORKERS", "8"))

# Streaming a non-seekable body, `max_in_memory_upload_chunks` (default 10) is
# what bounds buffering, not `max_concurrency`. Pin it: WORKERS x 2 x 16 MiB.
TRANSFER = TransferConfig(use_threads=False, multipart_chunksize=16 * 1024**2)
TRANSFER.max_in_memory_upload_chunks = 2
DRY_RUN = os.environ.get("SEED_DRY_RUN", "") not in ("", "0", "false")
RESEED = os.environ.get("SEED_RESEED", "") not in ("", "0", "false")


def http_json(url: str) -> dict[str, Any]:
    """GET and parse JSON, anonymously."""
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.load(resp)


def next_link(page: dict[str, Any]) -> str | None:
    """Return the next page of an item search, if there is one."""
    for link in page.get("links", []):
        if link.get("rel") == "next":
            return link.get("href")
    return None


def head_size(url: str, attempts: int = 3) -> int | None:
    """Return Content-Length over public HTTP, or None if the object is gone.

    A source that keeps erroring counts as missing; raising aborted the run.
    """
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, method="HEAD")
            with urllib.request.urlopen(req, timeout=60) as resp:
                return int(resp.headers["Content-Length"])
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return None
            last = exc
        except OSError as exc:  # URLError, timeouts, reset connections
            last = exc
        if attempt < attempts - 1:
            time.sleep(2**attempt)
    log.warning("cannot size %s, treating as missing (%s)", url, last)
    return None


def asset_key(href: str | None) -> str | None:
    """Return the S3 key for an href in the source bucket, else None."""
    for src, _ in PREFIX_PAIRS:
        if href and href.startswith(src + "/"):
            return href[len(src) + 1 :]
    return None


def repoint(node: Any) -> None:
    """Rewrite every source href in an asset, in place."""
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "href" and isinstance(value, str):
                for src, dst in PREFIX_PAIRS:
                    if value.startswith(src + "/"):
                        node[key] = dst + value[len(src) :]
                        break
            else:
                repoint(value)
    elif isinstance(node, list):
        for value in node:
            repoint(value)


def fetch_collection() -> dict:
    """Return the configured source collection without API links."""
    collection = http_json(f"{SRC_STAC}/collections/{COLLECTION}")
    collection.pop("links", None)
    return collection


def iter_items():
    """Yield every item in the source collection."""
    url = f"{SRC_STAC}/collections/{COLLECTION}/items?limit=100"
    while url:
        page = http_json(url)
        yield from page.get("features", [])
        url = next_link(page)


def plan(loaded: frozenset[str]) -> tuple[list[dict], list[str], int]:
    """Pick the items that fit the budget, and the assets they need.

    The budget covers loaded items too, so it settles on a stable ~maxGiB
    instead of advancing every sync. `loaded` only decides what gets copied.
    """
    chosen: list[dict] = []
    copies: list[str] = []
    total = 0
    to_copy = 0
    seen = 0
    skipped = 0
    dropped_items = 0
    dropped_assets: Counter[str] = Counter()
    for item in iter_items():
        if seen >= MAX_ITEMS:
            break
        seen += 1
        done = item.get("id") in loaded
        assets = item.get("assets") or {}
        keys, sizes, unwritten = {}, 0, 0
        missing = REQUIRED_ASSETS - assets.keys()
        for name in sorted(assets):
            key = asset_key(assets[name].get("href"))
            if key is None:
                if name in REQUIRED_ASSETS:
                    missing.add(name)
                continue
            size = head_size(f"{SRC_PREFIX}/{key}")
            if size is None:
                missing.add(name)
                continue
            keys[name] = key
            sizes += size
            if not done and not already_there(key):
                unwritten += size
        if REQUIRED_ASSETS & missing:
            dropped_items += 1
            continue
        for name in missing:
            if name in assets:
                del assets[name]
                dropped_assets[name] += 1
        if total + sizes > MAX_BYTES:
            log.info("budget reached at %d items", seen - 1)
            break
        total += sizes
        if done:
            skipped += 1
            continue
        item.pop("links", None)
        chosen.append(item)
        copies.extend(keys.values())
        to_copy += unwritten
    if dropped_assets:
        log.info("assets missing in source, dropped: %s", dict(dropped_assets))
    if dropped_items:
        log.info("items dropped for missing required assets: %d", dropped_items)
    log.info(
        "seed set %.2f GiB over %d items, %d already loaded",
        total / 1024**3,
        len(chosen) + skipped,
        skipped,
    )
    return chosen, copies, to_copy


@cache
def s3_clients() -> tuple[Any, Any]:
    """Build an anonymous reader for the source and a writer for this bucket."""
    src = boto3.client(
        "s3",
        region_name=REGION,
        config=Config(signature_version=UNSIGNED, retries={"mode": "standard"}),
    )
    dst = boto3.client(
        "s3",
        endpoint_url=DST_ENDPOINT,
        region_name=REGION,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            retries={"mode": "standard"},
            # Automatic checksums break MinIO and RustFS uploads.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )
    return src, dst


def already_there(key: str) -> bool:
    """Whether this bucket already holds the object.

    Only a 404 is definite. Anything else answers "no" and costs an idempotent
    re-copy, rather than taking the whole seed down with it.
    """
    _, dst = s3_clients()
    try:
        dst.head_object(Bucket=DST_BUCKET, Key=key)
        return True
    except ClientError as exc:
        code = exc.response["Error"]["Code"]
        if code not in ("404", "NoSuchKey", "NotFound"):
            log.warning(
                "cannot check %s in %s (%s), assuming absent", key, DST_BUCKET, code
            )
        return False
    except BotoCoreError as exc:  # connection, endpoint, credential resolution
        log.warning("cannot check %s in %s (%s), assuming absent", key, DST_BUCKET, exc)
        return False


def copy_assets(keys: list[str]) -> tuple[set[str], int]:
    """Copy objects into this bucket, skipping any already there."""
    src, dst = s3_clients()
    done: set[str] = set()
    failed: dict[str, Exception] = {}

    def one(key: str) -> tuple[str, Exception | None]:
        try:
            if already_there(key):
                return key, None
            if DST_ENDPOINT is None:
                # client.copy supports OAM GeoTIFFs larger than 5 GB.
                dst.copy(
                    {"Bucket": SRC_BUCKET, "Key": key}, DST_BUCKET, key, Config=TRANSFER
                )
            else:
                # Server-side copies cannot cross endpoints.
                body = src.get_object(Bucket=SRC_BUCKET, Key=key)["Body"]
                dst.upload_fileobj(body, DST_BUCKET, key, Config=TRANSFER)
            return key, None
        except Exception as exc:  # noqa: BLE001
            return key, exc

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        for key, exc in pool.map(one, keys):
            if exc is None:
                done.add(key)
            else:
                failed[key] = exc

    for key, exc in list(failed.items())[:10]:
        log.error("copy failed: %s (%s)", key, exc)
    return done, len(failed)


def rewrite(item: dict, copied: set[str]) -> dict | None:
    """Point assets at this bucket, or None if a required one did not land.

    An optional asset that failed is dropped, as plan() drops one missing at
    source.
    """
    assets = item.get("assets") or {}
    absent = [
        name
        for name, asset in assets.items()
        if (key := asset_key(asset.get("href"))) is not None and key not in copied
    ]
    if REQUIRED_ASSETS.intersection(absent):
        return None
    for name in absent:
        del assets[name]
    repoint(assets)
    return item


def connect(retries: int = 30) -> psycopg.Connection:
    """Connect to pgstac, waiting for a database that is still starting."""
    conninfo = make_conninfo(
        host=os.environ["PGSTAC_DB_HOST"],
        port=os.environ.get("PGSTAC_DB_PORT", "5432"),
        user=os.environ["PGSTAC_DB_USER"],
        password=os.environ["PGSTAC_DB_PASSWORD"],
        dbname=os.environ["PGSTAC_DB_NAME"],
    )
    for attempt in range(retries):
        try:
            return psycopg.connect(conninfo, autocommit=True)
        except psycopg.OperationalError as exc:
            if attempt == retries - 1:
                raise
            log.info("waiting for pgstac (%s)", exc.args[0].strip())
            time.sleep(5)
    raise AssertionError("unreachable")


def loaded_ids(conn: psycopg.Connection) -> frozenset[str]:
    """Return the ids already in the target collection."""
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM pgstac.items WHERE collection = %s;", (COLLECTION,))
        return frozenset(row[0] for row in cur)


def wanted_items(conn: psycopg.Connection) -> tuple[list[dict], list[str], int]:
    """Plan the items still missing from the catalogue.

    Reconciled by id: "the collection holds something" wrote stragglers off.
    """
    if MAX_ITEMS <= 0:
        log.info("SEED_MAX_ITEMS is 0, collection only")
        return [], [], 0
    loaded = frozenset() if RESEED else loaded_ids(conn)
    return plan(loaded)


def main() -> int:
    """Create the collection, then seed items and their imagery."""
    collection = fetch_collection()
    with connect() as conn:
        items, copies, total = wanted_items(conn)
        log.info(
            "%d items, %d assets, %.2f GiB to copy",
            len(items),
            len(copies),
            total / 1024**3,
        )
        if DRY_RUN:
            log.info("SEED_DRY_RUN, nothing written")
            return 0

        # Before any imagery moves: gating it behind a clean copy left staging
        # with a full bucket and an empty catalogue.
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pgstac.upsert_collection(%s::jsonb);", (Jsonb(collection),)
            )
        log.info("collection %s is present", COLLECTION)

        if not items:
            return 0

        copied, failures = copy_assets(copies)
        if failures:
            log.error("%d of %d asset copies failed", failures, len(copies))

        loadable, skipped = [], []
        for item in items:
            (loadable if rewrite(item, copied) is not None else skipped).append(item)
        if skipped:
            log.error(
                "%d items skipped, required assets did not land: %s",
                len(skipped),
                ", ".join(str(item.get("id")) for item in skipped[:10]),
            )

        # Keep catalogue writes atomic so retries never skip a partial load.
        with conn.transaction(), conn.cursor() as cur:
            for item in loadable:
                cur.execute("SELECT pgstac.upsert_item(%s::jsonb);", (Jsonb(item),))
        log.info("loaded %d of %d items into %s", len(loadable), len(items), COLLECTION)

        # Committed above, so the Job's backoff retry only re-plans what is
        # still absent. Fail so a shortfall is visible rather than silent.
        if skipped:
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
