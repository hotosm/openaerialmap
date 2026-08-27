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
from typing import Any

import boto3
import psycopg
from botocore import UNSIGNED
from botocore.config import Config
from botocore.exceptions import ClientError
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


def head_size(url: str) -> int | None:
    """Return Content-Length over public HTTP, or None if the object is gone."""
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=60) as resp:
            return int(resp.headers["Content-Length"])
    except urllib.error.HTTPError as exc:
        if exc.code == 404:
            return None
        raise


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


def plan() -> tuple[list[dict], list[str], int]:
    """Pick the items that fit the budget, and the assets they need."""
    chosen: list[dict] = []
    copies: list[str] = []
    total = 0
    dropped_items = 0
    dropped_assets: Counter[str] = Counter()
    for item in iter_items():
        if len(chosen) >= MAX_ITEMS:
            break
        assets = item.get("assets") or {}
        keys, sizes = {}, 0
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
        if REQUIRED_ASSETS & missing:
            dropped_items += 1
            continue
        for name in missing:
            if name in assets:
                del assets[name]
                dropped_assets[name] += 1
        if total + sizes > MAX_BYTES:
            log.info("budget reached at %d items", len(chosen))
            break
        item.pop("links", None)
        chosen.append(item)
        copies.extend(keys.values())
        total += sizes
    if dropped_assets:
        log.info("assets missing in source, dropped: %s", dict(dropped_assets))
    if dropped_items:
        log.info("items dropped for missing required assets: %d", dropped_items)
    return chosen, copies, total


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


def copy_assets(keys: list[str]) -> tuple[set[str], int]:
    """Copy objects into this bucket, skipping any already there."""
    src, dst = s3_clients()
    done: set[str] = set()
    failed: dict[str, Exception] = {}

    def one(key: str) -> tuple[str, Exception | None]:
        try:
            try:
                dst.head_object(Bucket=DST_BUCKET, Key=key)
                return key, None
            except ClientError as exc:
                if exc.response["Error"]["Code"] not in ("404", "NoSuchKey"):
                    raise
            if DST_ENDPOINT is None:
                # client.copy supports OAM GeoTIFFs larger than 5 GB.
                dst.copy({"Bucket": SRC_BUCKET, "Key": key}, DST_BUCKET, key)
            else:
                # Server-side copies cannot cross endpoints.
                body = src.get_object(Bucket=SRC_BUCKET, Key=key)["Body"]
                dst.upload_fileobj(body, DST_BUCKET, key)
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
    """Point assets at this bucket, or None if one did not land."""
    for asset in (item.get("assets") or {}).values():
        key = asset_key(asset.get("href"))
        if key is None:
            continue
        if key not in copied:
            return None
        repoint(asset)
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


def item_count(conn: psycopg.Connection) -> int:
    """Count items already in the target collection."""
    with conn.cursor() as cur:
        cur.execute(
            "SELECT count(*) FROM pgstac.items WHERE collection = %s;", (COLLECTION,)
        )
        return cur.fetchone()[0]


def wanted_items(conn: psycopg.Connection) -> tuple[list[dict], list[str], int]:
    """Plan the items to load, or nothing when seeding is not wanted."""
    if MAX_ITEMS <= 0:
        log.info("SEED_MAX_ITEMS is 0, collection only")
        return [], [], 0
    existing = item_count(conn)
    if existing and not RESEED:
        log.info("%s already holds %d items, skipping", COLLECTION, existing)
        return [], [], 0
    return plan()


def main() -> int:
    """Create the collection, then seed items and their imagery."""
    collection = fetch_collection()
    with connect() as conn:
        items, copies, total = wanted_items(conn)
        log.info(
            "%d items, %d assets, %.2f GiB",
            len(items),
            len(copies),
            total / 1024**3,
        )
        if DRY_RUN:
            log.info("SEED_DRY_RUN, nothing written")
            return 0

        if items:
            copied, failures = copy_assets(copies)
            if failures:
                log.error("%d of %d asset copies failed", failures, len(copies))
                return 1
            for item in items:
                if rewrite(item, copied) is None:
                    log.error("assets incomplete for %s", item.get("id"))
                    return 1

        # Keep catalogue writes atomic so retries never skip a partial load.
        with conn.transaction(), conn.cursor() as cur:
            cur.execute(
                "SELECT pgstac.upsert_collection(%s::jsonb);", (Jsonb(collection),)
            )
            for item in items:
                cur.execute("SELECT pgstac.upsert_item(%s::jsonb);", (Jsonb(item),))
        log.info("loaded %d items into %s", len(items), COLLECTION)

    return 0


if __name__ == "__main__":
    sys.exit(main())
