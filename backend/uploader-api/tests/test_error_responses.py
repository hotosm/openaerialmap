"""What a failed request actually puts on the wire.

The duplicate 409 is documented as carrying `upload_id` and `status`, so the
exception handler has to render them, not just the message.
"""

import json
import logging

import pytest
from litestar import status_codes as status
from litestar.exceptions import HTTPException

from app.main import _AccessLogFilter, _htmx_exception_handler, redact_query_string


class _Request:
    """The one attribute the handler reads."""

    def __init__(self, htmx: bool = False):
        self.headers = {"HX-Request": "true"} if htmx else {}


def _json_body(exc: Exception) -> dict:
    response = _htmx_exception_handler(_Request(), exc)
    content = response.content
    return json.loads(content) if isinstance(content, str | bytes) else content


def _conflict(**extra) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="already used by upload up-1",
        extra={"external_id": "dronetm:abc", "upload_id": None, **extra},
    )


def test_recovery_fields_reach_the_client():
    body = _json_body(_conflict(upload_id="up-1", status="Processing"))
    assert body["external_id"] == "dronetm:abc"
    assert body["upload_id"] == "up-1"
    assert body["status"] == "Processing"
    assert "already used by upload up-1" in body["detail"]


def test_a_plain_error_still_returns_only_a_detail():
    body = _json_body(
        HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nope.")
    )
    assert body == {"detail": "Nope."}


def test_extra_cannot_overwrite_the_detail():
    body = _json_body(_conflict(detail="hijacked"))
    assert body["detail"] == "already used by upload up-1"


def test_htmx_requests_still_get_html():
    """Recovery fields are for API callers, the UI gets a callout."""
    response = _htmx_exception_handler(_Request(htmx=True), _conflict())
    assert response.media_type == "text/html"
    assert "wa-callout" in response.content


def test_an_unexpected_error_does_not_leak_its_message():
    body = _json_body(RuntimeError("connection string: postgres://u:p@host"))
    assert body == {"detail": "An unexpected error occurred."}


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        (
            "/?source_url=https://s3/o.tif?X-Amz-Signature=abc",
            "/?source_url=[redacted]",
        ),
        (
            "/?title=Ward+5&source_url=https://s3/o.tif&external_id=dronetm:1",
            "/?title=Ward+5&source_url=[redacted]&external_id=dronetm:1",
        ),
        ("/api/v1/uploads/lookup?external_id=dronetm:1", None),
        ("/", None),
    ],
)
def test_a_presigned_url_is_kept_out_of_the_access_log(path, expected):
    assert redact_query_string(path) == (expected or path)


def _access_record(method: str, path: str, status_code: int) -> logging.LogRecord:
    record = logging.LogRecord(
        "uvicorn.access", logging.INFO, __file__, 0, '%s - "%s %s HTTP/%s" %d', (), None
    )
    record.args = ("10.0.0.1:1", method, path, "1.1", status_code)
    return record


@pytest.mark.parametrize(
    ("method", "path", "status_code", "logged"),
    [
        ("GET", "/uploads", 200, False),
        ("GET", "/__lbheartbeat__", 200, False),
        ("GET", "/uploads", 500, True),
        ("GET", "/__lbheartbeat__", 503, True),
        ("GET", "/uploads/up-1", 200, True),
        ("POST", "/uploads", 201, True),
    ],
)
def test_only_uninformative_access_lines_are_dropped(method, path, status_code, logged):
    record = _access_record(method, path, status_code)
    assert _AccessLogFilter().filter(record) is logged


def test_a_dropped_line_is_still_redacted_if_it_is_kept():
    record = _access_record("GET", "/?source_url=https://s3/o.tif", 200)
    assert _AccessLogFilter().filter(record) is True
    assert record.args[2] == "/?source_url=[redacted]"
