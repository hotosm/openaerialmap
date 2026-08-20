"""Claiming an upload for processing, and closing one out.

Two completion requests must not both submit a workflow, and a late abort must
not mark a scene "Aborted" while its workflow is still registering it. These
need a real PostgreSQL, so they skip without one.
"""

import asyncio

import pytest

from app.db.models import DbUpload


@pytest.mark.asyncio
async def test_claiming_moves_the_upload_out_of_initiated(db, new_upload):
    upload = await new_upload()
    claimed = await DbUpload.claim_for_processing(db, upload.id, upload.user_sub)
    assert claimed.status == "Processing"
    # The caller needs the row it claimed, token included, to submit the workflow.
    assert claimed.callback_token == "tok"


@pytest.mark.asyncio
async def test_a_second_claim_comes_back_empty(db, new_upload):
    upload = await new_upload()
    assert await DbUpload.claim_for_processing(db, upload.id, upload.user_sub)
    await db.commit()
    assert await DbUpload.claim_for_processing(db, upload.id, upload.user_sub) is None


@pytest.mark.asyncio
async def test_only_the_owner_can_claim(db, new_upload):
    upload = await new_upload()
    assert await DbUpload.claim_for_processing(db, upload.id, "test|someone") is None


@pytest.mark.asyncio
async def test_two_concurrent_claims_produce_one_winner(db, second_db, new_upload):
    """The second UPDATE waits on the row lock, then matches nothing."""
    upload = await new_upload()
    await db.commit()
    assert await DbUpload.claim_for_processing(db, upload.id, upload.user_sub)

    contender = asyncio.create_task(
        DbUpload.claim_for_processing(second_db, upload.id, upload.user_sub)
    )
    # Give it time to reach the lock rather than the WHERE clause.
    await asyncio.sleep(0.2)
    assert not contender.done(), "the second claim should be waiting on the row"

    await db.commit()
    assert await asyncio.wait_for(contender, timeout=10) is None


@pytest.mark.asyncio
async def test_a_rolled_back_claim_leaves_the_upload_retryable(
    db, second_db, new_upload
):
    """S3 completion can fail after the claim; the caller must be able to retry."""
    upload = await new_upload()
    await db.commit()
    assert await DbUpload.claim_for_processing(db, upload.id, upload.user_sub)
    await db.rollback()
    assert await DbUpload.claim_for_processing(second_db, upload.id, upload.user_sub)


@pytest.mark.asyncio
async def test_aborting_an_open_session_expires_its_callback_token(db, new_upload):
    """Otherwise the workflow keeps a working token and registers the item."""
    upload = await new_upload()
    assert await DbUpload.set_status_owned(
        db,
        upload.id,
        upload.user_sub,
        "Aborted",
        "Upload aborted.",
        expect_status="Initiated",
    )
    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == "Aborted"
    assert row.callback_token is None


@pytest.mark.asyncio
async def test_aborting_a_session_that_moved_on_does_nothing(db, new_upload):
    upload = await new_upload(status="Processing")
    assert not await DbUpload.set_status_owned(
        db,
        upload.id,
        upload.user_sub,
        "Aborted",
        "Upload aborted.",
        expect_status="Initiated",
    )
    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == "Processing"
    assert row.callback_token == "tok"


@pytest.mark.asyncio
async def test_an_unconditional_status_write_still_works(db, new_upload):
    """The create-failure path sets Error without expecting a prior state."""
    upload = await new_upload()
    assert await DbUpload.set_status_owned(
        db, upload.id, upload.user_sub, "Error", "nope"
    )
    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.status == "Error"
    # Terminal, so the token goes with it.
    assert row.callback_token is None
