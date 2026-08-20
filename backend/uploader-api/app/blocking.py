"""Run a blocking SDK call without stalling the event loop.

boto3, the Kubernetes client and DNS resolution are all synchronous, and this
app runs a single uvicorn worker, so a slow one inside a handler takes health
checks and every other upload with it.
"""

import functools
from typing import Any

import anyio
import anyio.to_thread

# Bounded so one slow dependency cannot occupy every thread anyio has.
_LIMITER = anyio.CapacityLimiter(16)


async def run_blocking(func, *args, **kwargs) -> Any:
    """Await a synchronous call on a worker thread."""
    return await anyio.to_thread.run_sync(
        functools.partial(func, *args, **kwargs), limiter=_LIMITER
    )
