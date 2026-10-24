"""Object ACL and multipart completion tests."""

import botocore.exceptions
import pytest

from app.config import settings
from app.uploads import upload_routes
from app.uploads.s3 import acl_kwargs
from app.uploads.schemas import CompleteMultipartBody


def _denied():
    return botocore.exceptions.ClientError(
        {"Error": {"Code": "AccessDenied", "Message": "Access Denied"}}, "ListParts"
    )


def test_no_acl_argument_without_a_configured_acl(monkeypatch):
    monkeypatch.setattr(settings, "S3_OBJECT_ACL", "")
    assert acl_kwargs() == {}


def test_a_configured_acl_becomes_an_argument(monkeypatch):
    monkeypatch.setattr(settings, "S3_OBJECT_ACL", "public-read")
    assert acl_kwargs() == {"ACL": "public-read"}


class _S3:
    def __init__(self, pages=None, error=None):
        self.pages = pages or []
        self.error = error
        self.calls = []

    def list_parts(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        if not self.pages:
            return {"Parts": []}
        return self.pages[len(self.calls) - 1]


def _body(parts):
    return CompleteMultipartBody(key="u-abc/id/o.tif", upload_id="up-1", parts=parts)


@pytest.mark.asyncio
async def test_the_clients_etags_are_used_when_it_has_them():
    s3 = _S3()
    parts = await upload_routes._resolve_parts(
        s3, _body([{"ETag": '"a"', "PartNumber": 1}, {"ETag": '"b"', "PartNumber": 2}])
    )
    assert parts == [
        {"ETag": '"a"', "PartNumber": 1},
        {"ETag": '"b"', "PartNumber": 2},
    ]
    assert s3.calls == [], "S3 should not be asked when the client knows"


@pytest.mark.asyncio
async def test_null_etags_fall_back_to_listing_the_parts():
    s3 = _S3(
        pages=[{"Parts": [{"ETag": '"b"', "PartNumber": 2}], "IsTruncated": False}]
    )
    parts = await upload_routes._resolve_parts(
        s3, _body([{"ETag": None, "PartNumber": 1}, {"ETag": None, "PartNumber": 2}])
    )
    assert parts == [{"ETag": '"b"', "PartNumber": 2}]


@pytest.mark.asyncio
async def test_a_listing_is_followed_past_its_first_page():
    s3 = _S3(
        pages=[
            {
                "Parts": [{"ETag": '"b"', "PartNumber": 2}],
                "IsTruncated": True,
                "NextPartNumberMarker": 2,
            },
            {"Parts": [{"ETag": '"a"', "PartNumber": 1}], "IsTruncated": False},
        ]
    )
    parts = await upload_routes._resolve_parts(
        s3, _body([{"ETag": None, "PartNumber": 1}])
    )
    assert [p["PartNumber"] for p in parts] == [1, 2]
    assert s3.calls[1]["PartNumberMarker"] == 2


@pytest.mark.asyncio
async def test_no_parts_when_listing_is_denied():
    s3 = _S3(error=_denied())
    assert (
        await upload_routes._resolve_parts(s3, _body([{"ETag": None, "PartNumber": 1}]))
        is None
    )


@pytest.mark.asyncio
async def test_no_parts_when_the_upload_lists_none():
    s3 = _S3()
    assert (
        await upload_routes._resolve_parts(s3, _body([{"ETag": None, "PartNumber": 1}]))
        is None
    )
