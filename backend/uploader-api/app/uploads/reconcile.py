"""Bring uploads to a terminal state when their workflow never said so.

An upload leaves Processing because a workflow pod posts to
`/api/v1/workflowstatus`, or because the register step publishes the item. Both
are single best-effort HTTP calls from a pod that may be gone by the time the
API is reachable again, and a lost one leaves a row that nothing else will ever
finish - visible to its owner as an upload processing forever.

So the API asks Argo instead. Any non-terminal upload that has gone quiet gets
its workflow looked up; a workflow that has ended, or that no longer exists
because Argo garbage-collected it, ends the row too.
"""

import asyncio
import logging
from datetime import UTC, datetime

from litestar import Litestar
from psycopg_pool import AsyncConnectionPool

from app.blocking import run_blocking
from app.config import settings
from app.db.models import DbUpload, UploadStatus
from app.uploads import argo

log = logging.getLogger(__name__)

# One replica sweeps at a time. Session-scoped, so a replica that dies mid-sweep
# releases it when its connection drops rather than blocking the next one.
_ADVISORY_LOCK_KEY = 4_017_336_209

# The apiserver being unreachable looks the same on every row, so stop asking
# rather than spend a 30s timeout each on a few hundred of them.
_MAX_CONSECUTIVE_LOOKUP_FAILURES = 3

# Argo phases that mean the workflow is over. "Succeeded" is not among them:
# the register step is the last thing a workflow does and it marks the upload
# Succeeded itself, so a successful workflow has already ended its row.
_FAILED_PHASES = {"Failed": UploadStatus.FAILED, "Error": UploadStatus.ERROR}

_GONE_MESSAGE = (
    "Processing ended without reporting a result. Please try uploading again."
)


def _outcome(phase: str | None) -> tuple[str, str] | None:
    """Map an Argo phase to the status and message to write, or None to wait."""
    if phase is None:
        # Deleted by ttlStrategy after it completed, or never created at all.
        return UploadStatus.ERROR, _GONE_MESSAGE
    if phase in _FAILED_PHASES:
        return _FAILED_PHASES[phase], "Processing failed."
    # Running, Pending, or a Succeeded whose register callback we somehow
    # missed: nothing here is safe to end on our own guess.
    return None


def _hours_since(when: datetime) -> float:
    """Hours elapsed since a timestamp, read in whichever tzinfo it carries."""
    return (datetime.now(when.tzinfo or UTC) - when).total_seconds() / 3600


class _LookupFailed(Exception):
    """Argo could not be asked, so this upload's state is still unknown."""


async def _reconcile_one(pool: AsyncConnectionPool, upload: DbUpload) -> bool:
    """Ask about one upload and end it if its workflow is over.

    Returns whether the row was moved to a terminal state.
    """
    if upload.workflow_name and settings.ARGO_ENABLED:
        try:
            phase = await run_blocking(argo.get_workflow_phase, upload.workflow_name)
        except Exception as err:
            # An unreachable apiserver is a reason to ask again next sweep, not
            # a reason to fail somebody's upload.
            log.warning(
                "Could not read workflow %s for upload %s; leaving it alone",
                upload.workflow_name,
                upload.id,
            )
            raise _LookupFailed from err
        outcome = _outcome(phase)
        if phase == "Succeeded":
            log.warning(
                "Workflow %s succeeded but upload %s is still %s",
                upload.workflow_name,
                upload.id,
                upload.status,
            )
    else:
        # Nothing was ever handed to a cluster, so only age can end this one.
        phase, outcome = None, None

    if outcome is None:
        age_hours = settings.RECONCILE_MAX_AGE_HOURS
        if upload.updated_at is None:
            return False
        quiet_for = _hours_since(upload.updated_at)
        if quiet_for < age_hours:
            return False
        if phase in ("Running", "Pending"):
            # Past activeDeadlineSeconds and still going means Argo, not the
            # upload, is what is stuck. Ending the row would orphan a workflow
            # that may yet publish, so say so and leave it.
            log.error(
                "Workflow %s has been %s for %.0fh, past its deadline",
                upload.workflow_name,
                phase,
                quiet_for,
            )
            return False
        outcome = (
            UploadStatus.ABORTED,
            f"Abandoned after {age_hours} hours without finishing.",
        )

    new_status, message = outcome
    async with pool.connection() as conn:
        ended = await DbUpload.finalize_stalled(
            conn,
            upload.id,
            new_status,
            message,
            expect_status=upload.status,
        )
        await conn.commit()
    if ended:
        log.info(
            "Reconciled upload %s: %s -> %s (workflow phase %s)",
            upload.id,
            upload.status,
            new_status,
            phase,
        )
    return ended


async def reconcile_once(pool: AsyncConnectionPool) -> int:
    """Run one sweep; return how many uploads it ended.

    Held under an advisory lock so that replicas do not all query Argo for the
    same rows, and skipped outright by whoever does not get it.
    """
    async with pool.connection() as conn:
        # Autocommit: the lock outlives a transaction, and a sweep is far too
        # long to leave one open holding a snapshot against the whole table.
        await conn.set_autocommit(True)
        async with conn.cursor() as cur:
            await cur.execute(
                "SELECT pg_try_advisory_lock(%(k)s);", {"k": _ADVISORY_LOCK_KEY}
            )
            row = await cur.fetchone()
        if not (row and row[0]):
            log.debug("Another replica is reconciling; skipping this sweep")
            return 0
        ended, failures = 0, 0
        try:
            async with pool.connection() as read_conn:
                candidates = await DbUpload.stalled(
                    read_conn, settings.RECONCILE_QUIET_MINUTES
                )
            for upload in candidates:
                try:
                    ended += await _reconcile_one(pool, upload)
                except _LookupFailed:
                    failures += 1
                    if failures >= _MAX_CONSECUTIVE_LOOKUP_FAILURES:
                        log.warning("Argo is not answering; abandoning this sweep")
                        break
                    continue
                failures = 0
        finally:
            async with conn.cursor() as cur:
                await cur.execute(
                    "SELECT pg_advisory_unlock(%(k)s);", {"k": _ADVISORY_LOCK_KEY}
                )
    if ended:
        log.info("Reconciler ended %d stalled upload(s)", ended)
    return ended


async def _reconcile_loop(pool: AsyncConnectionPool) -> None:
    """Sweep forever, surviving anything one sweep manages to raise."""
    while True:
        await asyncio.sleep(settings.RECONCILE_INTERVAL_SECONDS)
        try:
            await reconcile_once(pool)
        except Exception:  # noqa: BLE001
            log.exception("Upload reconciliation sweep failed")


async def start_reconciler(server: Litestar) -> None:
    """Start the background sweep, after the pool exists."""
    if not settings.RECONCILE_ENABLED:
        log.info("Upload reconciler disabled")
        return
    pool = server.state.db_pool
    server.state.reconciler = asyncio.create_task(_reconcile_loop(pool))
    log.info(
        "Upload reconciler started (every %ds, after %dm quiet)",
        settings.RECONCILE_INTERVAL_SECONDS,
        settings.RECONCILE_QUIET_MINUTES,
    )


async def stop_reconciler(server: Litestar) -> None:
    """Cancel the background sweep before the pool closes under it."""
    task = getattr(server.state, "reconciler", None)
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass
