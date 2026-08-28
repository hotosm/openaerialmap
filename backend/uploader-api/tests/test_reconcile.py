"""Ending uploads whose workflow never reported back.

A workflow's final status is one best-effort HTTP call from a pod. When it is
lost the row stays non-terminal and the owner watches it process forever, so
the reconciler asks Argo what actually happened. What it must not do is fail an
upload that is merely quiet, or one it could not get an answer about.
"""

import re
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from kubernetes.client.exceptions import ApiException

from app.config import settings
from app.db.models import (
    _TERMINAL_ORDER,
    TERMINAL_STATUSES,
    DbUpload,
    UploadStatus,
)
from app.uploads import argo, reconcile

BASELINE = (
    Path(__file__).resolve().parent.parent / "migrations" / "init" / "0-main.sql"
).read_text()


@pytest.fixture
def phase(monkeypatch):
    """Answer the reconciler's Argo lookup with a phase, or an exception."""

    def _install(answer):
        def _get(name):
            if isinstance(answer, Exception):
                raise answer
            return answer

        monkeypatch.setattr(argo, "get_workflow_phase", _get)
        monkeypatch.setattr(settings, "ARGO_ENABLED", True)

    return _install


@pytest.fixture
def stalled_upload(db, new_upload):
    """An upload stuck mid-pipeline, last heard from `quiet_hours` ago."""

    async def _create(quiet_hours: float = 1.0, **fields) -> DbUpload:
        upload = await new_upload(
            status=UploadStatus.CONVERTING,
            workflow_name=f"geotiff-{uuid.uuid4()}",
            **fields,
        )
        async with db.cursor() as cur:
            await cur.execute(
                "UPDATE uploads SET updated_at = NOW() - make_interval(secs => %(s)s) "
                "WHERE id = %(id)s;",
                {"s": quiet_hours * 3600, "id": upload.id},
            )
        upload.updated_at = datetime.now(UTC) - timedelta(hours=quiet_hours)
        return upload

    return _create


def test_the_index_predicate_matches_the_sweep_predicate():
    """Postgres compares the two constant for constant, so order counts too.

    A status added to the enum but not to the index turns the every-minute
    sweep into a sequential scan of every upload ever made.
    """
    predicate = re.search(
        r"uploads_unfinished_idx.*?WHERE status NOT IN \((.*?)\);",
        BASELINE,
        re.DOTALL,
    )
    indexed = [s.strip().strip("'") for s in predicate.group(1).split(",")]
    assert indexed == [str(s) for s in _TERMINAL_ORDER]
    assert set(indexed) == {str(s) for s in TERMINAL_STATUSES}


def test_a_finished_workflow_ends_the_upload():
    assert reconcile._outcome("Failed") == (UploadStatus.FAILED, "Processing failed.")
    assert reconcile._outcome("Error")[0] == UploadStatus.ERROR


def test_a_workflow_argo_no_longer_has_ends_the_upload():
    """ttlStrategy deletes a workflow 10 minutes after it completes."""
    status, message = reconcile._outcome(None)
    assert status == UploadStatus.ERROR
    assert "again" in message


@pytest.mark.parametrize("phase_name", ["Running", "Pending", "Succeeded"])
def test_an_unfinished_workflow_is_left_alone(phase_name):
    assert reconcile._outcome(phase_name) is None


@pytest.mark.asyncio
async def test_a_lost_failure_callback_is_reconciled(db, stalled_upload, phase):
    phase("Failed")
    upload = await stalled_upload()

    assert await reconcile._reconcile_one(_pool(db), upload) is True

    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == UploadStatus.FAILED
    # Terminal, so the workflow cannot come back and register the item.
    assert row.callback_token is None


@pytest.mark.asyncio
async def test_a_quiet_but_running_upload_is_untouched(db, stalled_upload, phase):
    phase("Running")
    upload = await stalled_upload(quiet_hours=3)

    assert await reconcile._reconcile_one(_pool(db), upload) is False

    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == UploadStatus.CONVERTING
    assert row.callback_token == "tok"


@pytest.mark.asyncio
async def test_an_unreachable_apiserver_fails_nothing(db, stalled_upload, phase):
    phase(ApiException(status=503))
    upload = await stalled_upload()

    with pytest.raises(reconcile._LookupFailed):
        await reconcile._reconcile_one(_pool(db), upload)

    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == UploadStatus.CONVERTING


@pytest.mark.asyncio
async def test_a_callback_that_won_the_race_is_not_overwritten(
    db, stalled_upload, phase
):
    """The sweep read `Converting`; a real callback moved on before it wrote."""
    phase("Failed")
    upload = await stalled_upload()
    await DbUpload.update_status(
        db, upload.id, "tok", UploadStatus.SUCCEEDED, "Published."
    )

    assert await reconcile._reconcile_one(_pool(db), upload) is False

    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == UploadStatus.SUCCEEDED


@pytest.mark.asyncio
async def test_an_upload_that_never_reached_the_cluster_expires(db, new_upload):
    """No workflow to ask about, so only age can end it."""
    upload = await new_upload(status=UploadStatus.INITIATED)
    upload.updated_at = datetime.now(UTC) - timedelta(
        hours=settings.RECONCILE_MAX_AGE_HOURS + 1
    )

    assert await reconcile._reconcile_one(_pool(db), upload) is True

    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == UploadStatus.ABORTED


@pytest.mark.asyncio
async def test_a_young_upload_with_no_workflow_is_left_alone(db, new_upload):
    """A browser part-uploading a 100GiB file is quiet, not stuck."""
    upload = await new_upload(status=UploadStatus.INITIATED)
    upload.updated_at = datetime.now(UTC) - timedelta(hours=2)

    assert await reconcile._reconcile_one(_pool(db), upload) is False


@pytest.mark.asyncio
async def test_the_sweep_only_picks_up_quiet_non_terminal_rows(
    db, stalled_upload, new_upload
):
    quiet = await stalled_upload(quiet_hours=1)
    await stalled_upload(quiet_hours=0)
    done = await new_upload(status=UploadStatus.SUCCEEDED)

    ids = {u.id for u in await DbUpload.stalled(db, quiet_minutes=5)}
    assert quiet.id in ids
    assert done.id not in ids


def _pool(conn):
    """Hand the reconciler the test's own connection, uncommitted and rollable."""

    class _Pool:
        def connection(self):
            class _Ctx:
                async def __aenter__(self):
                    return conn

                async def __aexit__(self, *exc):
                    return False

            return _Ctx()

    return _Pool()


@pytest.mark.asyncio
async def test_a_sweep_ends_the_uploads_argo_says_are_over(
    db, pool, stalled_upload, phase
):
    phase("Failed")
    upload = await stalled_upload()
    await db.commit()

    assert await reconcile.reconcile_once(pool) >= 1

    async with pool.connection() as conn:
        row = await DbUpload.get_owned(conn, upload.id, upload.user_sub)
    assert row.status == UploadStatus.FAILED


@pytest.mark.asyncio
async def test_only_one_replica_sweeps_at_a_time(pool, phase, second_db):
    """The other replicas must not all go and ask Argo about the same rows."""
    phase("Running")
    async with second_db.cursor() as cur:
        await cur.execute(
            "SELECT pg_try_advisory_lock(%(k)s);", {"k": reconcile._ADVISORY_LOCK_KEY}
        )
        assert (await cur.fetchone())[0] is True
    assert await _advisory_lock_holders(pool) == 1

    assert await reconcile.reconcile_once(pool) == 0

    async with second_db.cursor() as cur:
        await cur.execute(
            "SELECT pg_advisory_unlock(%(k)s);", {"k": reconcile._ADVISORY_LOCK_KEY}
        )


@pytest.mark.asyncio
async def test_the_lock_is_released_for_the_next_sweep(pool, phase):
    phase("Running")
    await reconcile.reconcile_once(pool)

    assert await _advisory_lock_holders(pool) == 0


async def _advisory_lock_holders(pool) -> int:
    """How many sessions hold the reconciler's advisory lock right now."""
    async with pool.connection() as conn:
        await conn.set_autocommit(True)
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT count(*) FROM pg_locks WHERE locktype = 'advisory' "
                "AND ((classid::bigint << 32) | objid::bigint) = %(k)s;",
                {"k": reconcile._ADVISORY_LOCK_KEY},
            )
            return (await cur.fetchone())[0]
