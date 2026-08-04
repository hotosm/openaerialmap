"""Dataclass models for the user mirror and persisted upload state."""

import logging
from dataclasses import asdict, dataclass, is_dataclass
from datetime import datetime
from typing import Any, Self

from litestar import status_codes as status
from litestar.exceptions import HTTPException
from psycopg import AsyncConnection, sql
from psycopg.rows import class_row

log = logging.getLogger(__name__)

# Freeze terminal states and reject late updates that would regress status.
# Rank unknown values below terminal so typos cannot freeze an upload.
_STATUS_RANK = {
    "Initiated": 0,
    "Processing": 1,
    "Downloading": 2,
    "Validating": 3,
    "Converting": 4,
    "Uploading": 5,
    "Registering": 6,
    "Succeeded": 9,
    "Failed": 9,
    "Error": 9,
    "Aborted": 9,
}
_TERMINAL = {"Succeeded", "Failed", "Error", "Aborted"}
_UNKNOWN_RANK = 7


def status_transition(current: str, new: str) -> tuple[bool, bool]:
    """Return whether to apply the update and expire its callback token."""
    if current in _TERMINAL:
        return False, False
    if _STATUS_RANK.get(new, _UNKNOWN_RANK) < _STATUS_RANK.get(current, _UNKNOWN_RANK):
        return False, False
    return True, new in _TERMINAL


def _dump(model: Any) -> dict[str, Any]:
    """Dump a dataclass to a dict, dropping None values; error if empty."""
    if is_dataclass(model):
        data = {k: v for k, v in asdict(model).items() if v is not None}
    elif isinstance(model, dict):
        data = {k: v for k, v in model.items() if v is not None}
    else:
        raise TypeError(f"Unsupported model type: {type(model)!r}")
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No data provided."
        )
    return data


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
                username = EXCLUDED.username,
                name = EXCLUDED.name,
                email_address = EXCLUDED.email_address,
                profile_img = EXCLUDED.profile_img,
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
    async def count_active(
        cls, db: AsyncConnection, user_sub: str, stale_initiated_hours: int = 24
    ) -> int:
        """Count a user's non-terminal uploads for the quota.

        Excludes stale "Initiated" sessions (started but never completed) so an
        abandoned upload can't permanently consume the user's quota - the S3
        lifecycle rule reaps the corresponding multipart objects.
        """
        async with db.cursor() as cur:
            await cur.execute(
                "SELECT count(*) FROM uploads WHERE user_sub = %(u)s "
                "AND status NOT IN ('Succeeded', 'Failed', 'Error', 'Aborted') "
                "AND NOT (status = 'Initiated' "
                "         AND created_at < NOW() - make_interval(hours => %(h)s));",
                {"u": user_sub, "h": stale_initiated_hours},
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
    ) -> None:
        """Set status for a user-initiated transition (abort / create failure).

        Owner-scoped (not token-guarded, unlike workflow callbacks); used when the
        user or the API itself terminates a session.
        """
        async with db.cursor() as cur:
            await cur.execute(
                "UPDATE uploads SET status = %(s)s, message = %(m)s, "
                "updated_at = NOW() WHERE id = %(id)s AND user_sub = %(u)s;",
                {"s": new_status, "m": message, "id": upload_id, "u": user_sub},
            )

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
    async def for_user(cls, db: AsyncConnection, user_sub: str) -> list[Self]:
        """List a user's in-progress / recent uploads, newest first."""
        async with db.cursor(row_factory=class_row(cls)) as cur:
            await cur.execute(
                "SELECT * FROM uploads WHERE user_sub = %(s)s "
                "ORDER BY created_at DESC;",
                {"s": user_sub},
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
        expire the callback token.
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
                    callback_token = %(token)s, updated_at = NOW()
                WHERE id = %(id)s
                RETURNING *;
                """,
                {
                    "status": new_status,
                    "message": message,
                    "token": token,
                    "id": upload_id,
                },
            )
            return await cur.fetchone()
