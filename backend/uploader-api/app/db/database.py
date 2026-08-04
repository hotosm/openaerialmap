"""Psycopg pool and Litestar database dependency."""

import logging
from collections.abc import AsyncGenerator
from typing import cast

from litestar import Litestar
from litestar.datastructures import State
from psycopg import AsyncConnection
from psycopg_pool import AsyncConnectionPool

from app.config import settings

log = logging.getLogger(__name__)


async def get_db_connection_pool(server: Litestar) -> AsyncConnectionPool:
    """Open the psycopg pool on server startup and stash it on app state."""
    pool = getattr(server.state, "db_pool", None)
    if pool is None or pool.closed:
        log.debug(f"Creating DB pool: {settings.DB_USER}@{settings.DB_HOST}")
        pool = AsyncConnectionPool(
            conninfo=settings.DB_URL,
            min_size=1,
            max_size=10,
            timeout=30.0,
            open=False,
        )
        server.state.db_pool = pool
        await pool.open()
        log.debug("Database connection pool opened")
    return cast(AsyncConnectionPool, pool)


async def close_db_connection_pool(server: Litestar) -> None:
    """Close the psycopg pool on server shutdown."""
    pool = getattr(server.state, "db_pool", None)
    if pool and not pool.closed:
        await cast(AsyncConnectionPool, pool).close()
        log.debug("Database connection pool closed")


async def db_conn(state: State) -> AsyncGenerator[AsyncConnection]:
    """Yield a pooled connection for the lifetime of a request handler."""
    db_pool = cast(AsyncConnectionPool, state.db_pool)
    async with db_pool.connection() as conn:
        yield conn
