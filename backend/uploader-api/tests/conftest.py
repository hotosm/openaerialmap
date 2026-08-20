"""Shared fixtures.

The DB-backed tests need a real PostgreSQL to be worth anything, since
psycopg's adaptation and the database's own locking are what they check.
`just test uploader` provides one; outside that they skip.
"""

import os
import uuid

import pytest
import pytest_asyncio
from psycopg import AsyncConnection

from app.db.models import DbUpload, DbUser

# Same vars the app reads, so the compose stack needs no extra setup.
_DSN = os.environ.get("TEST_DB_URL") or (
    "postgresql://{user}:{password}@{host}:{port}/{name}".format(
        user=os.environ.get("DB_USER", "oam"),
        password=os.environ.get("DB_PASSWORD", "oam"),
        host=os.environ.get("DB_HOST", "db"),
        port=os.environ.get("DB_PORT", "5432"),
        name=os.environ.get("DB_NAME", "oam_uploader"),
    )
)


async def _connect() -> AsyncConnection:
    try:
        return await AsyncConnection.connect(_DSN, connect_timeout=5)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"No PostgreSQL available at {_DSN.rsplit('@', 1)[-1]}: {exc}")


@pytest_asyncio.fixture
async def db() -> AsyncConnection:
    """A connection to a real PostgreSQL, or skip the test."""
    conn = await _connect()
    try:
        yield conn
    finally:
        await conn.rollback()
        await conn.close()


@pytest_asyncio.fixture
async def second_db() -> AsyncConnection:
    """A second connection: one cannot demonstrate a row lock against itself."""
    conn = await _connect()
    try:
        yield conn
    finally:
        await conn.rollback()
        await conn.close()


@pytest.fixture
def new_upload(db):
    """Insert an upload row with a fresh owner, and return it."""

    async def _create(**fields) -> DbUpload:
        sub = f"test|{uuid.uuid4()}"
        await DbUser.upsert(db, DbUser(sub=sub, username="tester"))
        upload_id = str(uuid.uuid4())
        return await DbUpload.create(
            db,
            DbUpload(
                **{
                    "id": upload_id,
                    "user_sub": sub,
                    "filename": "o.tif",
                    "title": "t",
                    "s3_key": f"u-test/{upload_id}/o.tif",
                    "callback_token": "tok",
                    "status": "Initiated",
                    "dataset_meta": {"title": "t"},
                    **fields,
                }
            ),
        )

    return _create
