"""Round-trip an upload row through psycopg's type adaptation.

`dataset_meta` is JSONB fed from a plain dict, and psycopg won't adapt a bare
dict. Getting it wrong fails at runtime, on every single upload.
"""

import uuid

import pytest
from psycopg.adapt import PyFormat, Transformer
from psycopg.errors import ProgrammingError
from psycopg.types.json import Jsonb

from app.db.models import DbUpload, _dump

SIGNED = "https://example.org/o.tif?X-Amz-Signature=secret"


def test_a_bare_dict_is_not_adaptable():
    """The failure the Jsonb wrapper exists to avoid."""
    with pytest.raises(ProgrammingError):
        Transformer().get_dumper({"a": 1}, PyFormat.AUTO).dump({"a": 1})


def test_dump_wraps_json_columns_for_psycopg():
    params = _dump(DbUpload(id="a", dataset_meta={"title": "t"}))
    assert isinstance(params["dataset_meta"], Jsonb)
    # Scalars must not be wrapped, they map to TEXT/UUID columns.
    assert params["id"] == "a"


@pytest.mark.asyncio
async def test_create_inserts_jsonb_and_reads_it_back(db, new_upload):
    """A real INSERT. A mocked cursor passes while production 500s."""
    meta = {
        "title": "Kathmandu ward 5",
        "provider": "HOT Nepal",
        "acquisition_start": "2026-04-02T09:30:00+00:00",
    }
    created = await new_upload(dataset_meta=meta, title="Kathmandu ward 5")

    # A dict, not a string; a wrapper that stringified would show up here.
    assert created.dataset_meta == meta
    fetched = await DbUpload.get_owned(db, created.id, created.user_sub)
    assert fetched.dataset_meta == meta


@pytest.mark.asyncio
async def test_source_url_is_cleared_once_the_bytes_are_fetched(db, new_upload):
    """A presigned URL is a bearer token; it must not outlive its one use."""
    upload = await new_upload(status="Processing", source_url=SIGNED)
    await DbUpload.clear_source_url(db, upload.id)
    row = await DbUpload.get_owned(db, upload.id, upload.user_sub)
    assert row.source_url is None


@pytest.mark.asyncio
async def test_a_terminal_status_also_forgets_the_source_url(db, new_upload):
    """A workflow that dies before the checksum still ends with it gone."""
    upload = await new_upload(status="Processing", source_url=SIGNED)

    mid = await DbUpload.update_status(db, upload.id, "tok", "Converting")
    assert mid.source_url is not None, "still running; the fetch may be retried"

    done = await DbUpload.update_status(db, upload.id, "tok", "Failed", "nope")
    assert done.source_url is None
    assert done.callback_token is None


@pytest.mark.asyncio
async def test_a_failed_attempt_releases_its_external_id(db, new_upload):
    """A broken publish must not lock the partner system out for ever.

    The partial unique index is what allows the retry to take the key back.
    """
    external_id = f"dronetm:{uuid.uuid4()}"
    first = await new_upload(status="Processing", external_id=external_id)
    assert (await DbUpload.find_by_external_id(db, external_id)).id == first.id

    await DbUpload.update_status(db, first.id, "tok", "Failed", "broke")
    assert await DbUpload.find_by_external_id(db, external_id) is None

    second = await new_upload(status="Processing", external_id=external_id)
    assert (await DbUpload.find_by_external_id(db, external_id)).id == second.id


@pytest.mark.asyncio
async def test_a_stalled_upload_stops_counting_against_the_quota(db, new_upload):
    """A lost final callback must not cost the user a slot for ever."""
    upload = await new_upload(status="Registering")
    assert await DbUpload.count_active(db, upload.user_sub) == 1

    async with db.cursor() as cur:
        await cur.execute(
            "UPDATE uploads SET updated_at = NOW() - interval '48 hours' "
            "WHERE id = %(id)s;",
            {"id": upload.id},
        )
    assert await DbUpload.count_active(db, upload.user_sub) == 0
