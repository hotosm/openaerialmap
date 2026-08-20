"""Dataclass models for the user mirror and persisted upload state."""

import logging
from dataclasses import asdict, dataclass, is_dataclass
from datetime import datetime
from enum import StrEnum
from typing import Any, Self

from psycopg import AsyncConnection, sql
from psycopg.rows import class_row
from psycopg.types.json import Jsonb

log = logging.getLogger(__name__)


class UploadStatus(StrEnum):
    """Every state an upload can be in.

    The workflow template reports these as plain strings; a test checks that
    every step-id it uses appears here.
    """

    INITIATED = "Initiated"
    PROCESSING = "Processing"
    # Fetching (remote source) and Downloading (own bucket) are the same stage
    # reached by the two ingest paths.
    FETCHING = "Fetching"
    DOWNLOADING = "Downloading"
    VALIDATING = "Validating"
    CONVERTING = "Converting"
    UPLOADING = "Uploading"
    REGISTERING = "Registering"
    # Stored, with no processing cluster to hand it to (local development).
    UPLOADED = "Uploaded"
    SUCCEEDED = "Succeeded"
    FAILED = "Failed"
    ERROR = "Error"
    ABORTED = "Aborted"


# Nothing follows these, so they expire the callback token and stop counting
# against the quota. "Uploaded" means stored with no cluster to process it.
TERMINAL_STATUSES = frozenset(
    {
        UploadStatus.UPLOADED,
        UploadStatus.SUCCEEDED,
        UploadStatus.FAILED,
        UploadStatus.ERROR,
        UploadStatus.ABORTED,
    }
)

# Declaration order is progress order, so a callback that arrives late cannot
# move an upload backwards.
_RANK = {status: rank for rank, status in enumerate(UploadStatus)}


def status_transition(current: str, new: str) -> tuple[bool, bool]:
    """Return whether to apply the update and expire its callback token."""
    if current in TERMINAL_STATUSES or _RANK.get(new, 0) < _RANK.get(current, 0):
        return False, False
    return True, new in TERMINAL_STATUSES


def _dump(model: Any) -> dict[str, Any]:
    """Dump a dataclass to query parameters, dropping None values.

    Dicts and lists are wrapped in `Jsonb`; psycopg won't adapt a bare dict.
    """
    if is_dataclass(model):
        data = {k: v for k, v in asdict(model).items() if v is not None}
    elif isinstance(model, dict):
        data = {k: v for k, v in model.items() if v is not None}
    else:
        raise TypeError(f"Unsupported model type: {type(model)!r}")
    if not data:
        raise ValueError("Nothing to write.")
    return {k: Jsonb(v) if isinstance(v, dict | list) else v for k, v in data.items()}


@dataclass(slots=True)
class DbUser:
    """Mirror of a shared-auth user."""

    sub: str | None = None  # e.g. "hotosm|1234" or "osm|1234"
    username: str | None = None
    name: str | None = None
    email_address: str | None = None
    profile_img: str | None = None
    is_admin: bool | None = False
    registered_at: datetime | None = None
    last_login_at: datetime | None = None

    @classmethod
    async def one(cls, db: AsyncConnection, sub: str) -> Self:
        """Fetch a single user by `sub`."""
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute("SELECT * FROM users WHERE sub = %(sub)s;", {"sub": sub})
            user = await cur.fetchone()
        if user is None:
            raise KeyError(f"User ({sub}) not found.")
        return user

    @classmethod
    async def upsert(cls, db: AsyncConnection, user_in: Self) -> Self:
        """Insert or update a user on login (keyed on `sub`)."""
        data = _dump(user_in)
        columns = sql.SQL(", ").join(sql.Identifier(k) for k in data)
        values = sql.SQL(", ").join(sql.Placeholder(k) for k in data)
        query = sql.SQL(
            """
            INSERT INTO users ({columns}) VALUES ({values})
            ON CONFLICT (sub) DO UPDATE SET
                -- COALESCE: a session that omits a field must not erase what
                -- an earlier, fuller one stored.
                username = COALESCE(EXCLUDED.username, users.username),
                name = COALESCE(EXCLUDED.name, users.name),
                email_address = COALESCE(
                    EXCLUDED.email_address, users.email_address
                ),
                profile_img = COALESCE(EXCLUDED.profile_img, users.profile_img),
                last_login_at = NOW()
            RETURNING *;
            """
        ).format(columns=columns, values=values)
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(query, data)
            return await cur.fetchone()


@dataclass(slots=True)
class DbUpload:
    """Persisted state for one upload."""

    id: str | None = None  # uuid
    user_sub: str | None = None
    filename: str | None = None
    title: str | None = None
    s3_key: str | None = None
    workflow_name: str | None = None  # Argo workflow name
    callback_token: str | None = None  # secret proving a workflow may report
    status: str | None = None  # Processing | Succeeded | Failed | Error ...
    message: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    # Opaque idempotency key from the system that requested this upload.
    external_id: str | None = None
    # Public backlink to whatever produced the imagery (STAC `rel: via`).
    external_url: str | None = None
    # Set when the pipeline fetches the bytes itself. Never published, and
    # cleared once the bytes arrive: it may be credential-bearing.
    source_url: str | None = None
    # Dataset metadata read back by the pipeline over the callback token.
    dataset_meta: dict[str, Any] | None = None
    # sha256 multihash of the original bytes, computed after they arrive.
    checksum: str | None = None
    # Non-fatal notice shown with the status (e.g. duplicate bytes detected).
    warning: str | None = None

    @classmethod
    async def create(cls, db: AsyncConnection, upload_in: Self) -> Self:
        """Insert a new upload job row."""
        data = _dump(upload_in)
        columns = sql.SQL(", ").join(sql.Identifier(k) for k in data)
        values = sql.SQL(", ").join(sql.Placeholder(k) for k in data)
        query = sql.SQL(
            "INSERT INTO uploads ({columns}) VALUES ({values}) RETURNING *;"
        ).format(columns=columns, values=values)
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(query, data)
            return await cur.fetchone()

    @classmethod
    async def find_by_external_id(
        cls, db: AsyncConnection, external_id: str
    ) -> Self | None:
        """Fetch the upload currently holding an external_id, if any.

        Mirrors `uploads_external_id_active_idx`: failed and aborted attempts do
        not hold the key, so an external system can retry a publish that broke.
        """
        if not external_id:
            return None
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(
                "SELECT * FROM uploads WHERE external_id = %(e)s "
                "AND status NOT IN ('Failed', 'Error', 'Aborted') "
                "ORDER BY created_at DESC LIMIT 1;",
                {"e": external_id},
            )
            return await cur.fetchone()

    @classmethod
    async def set_checksum(
        cls,
        db: AsyncConnection,
        upload_id: str,
        callback_token: str,
        checksum: str,
        warning: str | None = None,
    ) -> Self | None:
        """Record the pipeline-computed checksum and any duplicate warning."""
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(
                """
                UPDATE uploads
                SET checksum = %(checksum)s,
                    warning = COALESCE(%(warning)s, warning),
                    updated_at = NOW()
                WHERE id = %(id)s AND callback_token = %(token)s
                RETURNING *;
                """,
                {
                    "checksum": checksum,
                    "warning": warning,
                    "id": upload_id,
                    "token": callback_token,
                },
            )
            return await cur.fetchone()

    @classmethod
    async def clear_source_url(cls, db: AsyncConnection, upload_id: str) -> None:
        """Forget a source URL once the pipeline has used it.

        A presigned URL is a bearer token for someone else's bucket, so it only
        lives here as long as the fetch needs it.
        """
        async with db.cursor() as cur:
            await cur.execute(
                "UPDATE uploads SET source_url = NULL WHERE id = %(id)s;",
                {"id": upload_id},
            )

    @classmethod
    async def count_active(
        cls, db: AsyncConnection, user_sub: str, stale_hours: int = 24
    ) -> int:
        """Count a user's non-terminal uploads for the quota.

        Excludes anything stuck for longer than `stale_hours`, so a session the
        user abandoned or a workflow whose final callback was lost cannot
        consume the quota for good.
        """
        async with db.cursor() as cur:
            await cur.execute(
                "SELECT count(*) FROM uploads WHERE user_sub = %(u)s "
                "AND status <> ALL(%(terminal)s) "
                "AND updated_at > NOW() - make_interval(hours => %(h)s);",
                {
                    "u": user_sub,
                    "h": stale_hours,
                    "terminal": [str(s) for s in TERMINAL_STATUSES],
                },
            )
            row = await cur.fetchone()
            return int(row[0]) if row else 0

    @classmethod
    async def set_status_owned(
        cls,
        db: AsyncConnection,
        upload_id: str,
        user_sub: str,
        new_status: str,
        message: str = "",
        *,
        expect_status: str | None = None,
    ) -> bool:
        """Set status for a user-initiated transition (abort / create failure).

        Owner-scoped (not token-guarded, unlike workflow callbacks); used when the
        user or the API itself terminates a session.

        `expect_status` makes the write conditional, so a request that raced a
        state change loses instead of overwriting it. A terminal status expires
        the callback token, so an aborted upload's workflow cannot go on to
        register the item the user just cancelled.

        Returns whether a row was actually updated.
        """
        terminal = new_status in TERMINAL_STATUSES
        async with db.cursor() as cur:
            await cur.execute(
                """
                UPDATE uploads
                SET status = %(s)s, message = %(m)s, updated_at = NOW(),
                    callback_token = CASE
                        WHEN %(terminal)s THEN NULL ELSE callback_token END,
                    source_url = CASE WHEN %(terminal)s THEN NULL ELSE source_url END
                WHERE id = %(id)s AND user_sub = %(u)s
                  AND (%(expect_status)s::text IS NULL OR status = %(expect_status)s)
                RETURNING id;
                """,
                {
                    "s": new_status,
                    "m": message,
                    "id": upload_id,
                    "u": user_sub,
                    "terminal": terminal,
                    "expect_status": expect_status,
                },
            )
            return await cur.fetchone() is not None

    @classmethod
    async def claim_for_processing(
        cls, db: AsyncConnection, upload_id: str, user_sub: str
    ) -> Self | None:
        """Take an Initiated upload for processing, or return None.

        Atomic, so two completion requests cannot both submit a workflow. The
        claim is not committed here, so a failure between claiming and
        submitting rolls the upload back to Initiated and it stays retryable.
        """
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(
                "UPDATE uploads SET status = 'Processing', message = %(m)s, "
                "updated_at = NOW() "
                "WHERE id = %(id)s AND user_sub = %(u)s AND status = 'Initiated' "
                "RETURNING *;",
                {"id": upload_id, "u": user_sub, "m": "Completing the upload…"},
            )
            return await cur.fetchone()

    @classmethod
    async def get_owned(
        cls, db: AsyncConnection, upload_id: str, user_sub: str
    ) -> Self | None:
        """Fetch an upload only when the user owns it."""
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(
                "SELECT * FROM uploads WHERE id = %(id)s AND user_sub = %(u)s;",
                {"id": upload_id, "u": user_sub},
            )
            return await cur.fetchone()

    @classmethod
    async def for_user(
        cls, db: AsyncConnection, user_sub: str, limit: int = 50
    ) -> list[Self]:
        """List a user's most recent uploads, newest first.

        Bounded because the page polls this every five seconds.
        """
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(
                "SELECT * FROM uploads WHERE user_sub = %(s)s "
                "ORDER BY created_at DESC LIMIT %(n)s;",
                {"s": user_sub, "n": limit},
            )
            return await cur.fetchall()

    @classmethod
    async def set_workflow_name(
        cls, db: AsyncConnection, upload_id: str, workflow_name: str
    ) -> None:
        """Record the Argo workflow name once it has been submitted."""
        async with db.cursor() as cur:
            await cur.execute(
                "UPDATE uploads SET workflow_name = %(w)s, updated_at = NOW() "
                "WHERE id = %(id)s;",
                {"w": workflow_name, "id": upload_id},
            )

    @classmethod
    async def get_authorized(
        cls, db: AsyncConnection, upload_id: str, callback_token: str
    ) -> Self | None:
        """Fetch an upload only when its callback token matches.

        Each workflow receives only its upload's token.
        """
        if not callback_token:
            return None
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(
                "SELECT * FROM uploads "
                "WHERE id = %(id)s AND callback_token = %(token)s;",
                {"id": upload_id, "token": callback_token},
            )
            return await cur.fetchone()

    @classmethod
    async def update_status(
        cls,
        db: AsyncConnection,
        upload_id: str,
        callback_token: str,
        new_status: str,
        message: str = "",
    ) -> Self | None:
        """Advance status after token validation.

        Updates cannot regress or replace a terminal result. Terminal updates
        expire the callback token and drop the source URL.
        """
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(
                "SELECT * FROM uploads "
                "WHERE id = %(id)s AND callback_token = %(token)s FOR UPDATE;",
                {"id": upload_id, "token": callback_token},
            )
            row = await cur.fetchone()
            if row is None:
                return None
            should_apply, expire_token = status_transition(row.status, new_status)
            if not should_apply:
                return row
            token = None if expire_token else row.callback_token
            await cur.execute(
                """
                UPDATE uploads
                SET status = %(status)s, message = %(message)s,
                    callback_token = %(token)s,
                    source_url = CASE WHEN %(terminal)s THEN NULL ELSE source_url END,
                    updated_at = NOW()
                WHERE id = %(id)s
                RETURNING *;
                """,
                {
                    "status": new_status,
                    "message": message,
                    "token": token,
                    "terminal": expire_token,
                    "id": upload_id,
                },
            )
            return await cur.fetchone()
