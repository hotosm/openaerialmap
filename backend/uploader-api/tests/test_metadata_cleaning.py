import pytest
from litestar.exceptions import HTTPException

from app.uploads.schemas import (
    CreateRemoteUploadBody,
    clean_external,
    clean_metadata,
)


def test_requires_acquisition_start():
    with pytest.raises(HTTPException) as err:
        clean_metadata({}, "A title")
    assert "acquisition start" in err.value.detail


def test_rejects_end_before_start():
    with pytest.raises(HTTPException) as err:
        clean_metadata(
            {"acquisition_start": "2026-05-02", "acquisition_end": "2026-05-01"},
            "A title",
        )
    assert "on or after" in err.value.detail


def test_drops_unknown_keys():
    """The dict is echoed into the STAC item, so it is not a scratchpad."""
    cleaned = clean_metadata(
        {
            "acquisition_start": "2026-05-01",
            "provider": " HOTOSM ",
            "unexpected": "should not survive",
        },
        "A title",
    )
    assert cleaned == {
        "acquisition_start": "2026-05-01T00:00:00+00:00",
        "provider": "HOTOSM",
        "title": "A title",
    }


def test_title_argument_wins_over_metadata_title():
    cleaned = clean_metadata(
        {"acquisition_start": "2026-05-01", "title": "stale"}, "A title"
    )
    assert cleaned["title"] == "A title"


def test_contact_falls_back_to_signed_in_user():
    cleaned = clean_metadata(
        {"acquisition_start": "2026-05-01"}, "A title", contact_default="Sam Woodcock"
    )
    assert cleaned["contact"] == "Sam Woodcock"


def test_supplied_contact_is_not_overridden():
    cleaned = clean_metadata(
        {"acquisition_start": "2026-05-01", "contact": "imagery@example.org"},
        "A title",
        contact_default="Sam Woodcock",
    )
    assert cleaned["contact"] == "imagery@example.org"


def _body(**kwargs):
    return CreateRemoteUploadBody(
        source_url="https://example.org/o.tif", title="t", **kwargs
    )


def test_blank_external_fields_become_none():
    assert clean_external(_body(external_id="  ", external_url="")) == (None, None)


def test_external_id_is_not_parsed():
    """Namespacing is a convention for callers, not a format OAM enforces."""
    external_id, _ = clean_external(_body(external_id=" dronetm:abc-123 "))
    assert external_id == "dronetm:abc-123"


@pytest.mark.parametrize(
    "url", ["javascript:alert(1)", "data:text/html,<script>", "not-a-url"]
)
def test_rejects_unsafe_external_url(url):
    with pytest.raises(HTTPException) as err:
        clean_external(_body(external_url=url))
    assert err.value.status_code == 400


def test_accepts_http_external_url():
    """Unlike the fetch source, the backlink is published, never requested."""
    _, external_url = clean_external(
        _body(external_url="http://dronetm.example.org/projects/1")
    )
    assert external_url == "http://dronetm.example.org/projects/1"


# The prefill link carries an offset-aware timestamp; the form's date input can
# only hand back YYYY-MM-DD. Comparing the two used to raise TypeError.


@pytest.mark.parametrize(
    ("start", "end", "expected_start"),
    [
        ("2026-04-02T09:30:00+00:00", "2026-04-03", "2026-04-02T09:30:00+00:00"),
        ("2026-04-02", "2026-04-02T11:00:00+00:00", "2026-04-02T00:00:00+00:00"),
        ("2026-04-02T09:30:00", None, "2026-04-02T09:30:00+00:00"),
        ("2026-04-02T09:30:00Z", None, "2026-04-02T09:30:00+00:00"),
        # 21:00-05:00 is 02:00 UTC the next day, so ordering follows the offset.
        (
            "2026-04-02T21:00:00-05:00",
            "2026-04-03T03:00:00+00:00",
            "2026-04-02T21:00:00-05:00",
        ),
    ],
)
def test_acquisition_dates_normalise_to_utc_aware(start, end, expected_start):
    metadata = {"acquisition_start": start}
    if end:
        metadata["acquisition_end"] = end
    assert clean_metadata(metadata, "A title")["acquisition_start"] == expected_start


@pytest.mark.parametrize(
    ("start", "end"),
    [
        ("2026-04-03T09:30:00+00:00", "2026-04-02"),
        # Same wall-clock ordering, but an hour earlier as an instant.
        ("2026-04-02T21:00:00-05:00", "2026-04-03T01:00:00+00:00"),
    ],
)
def test_normalising_does_not_defeat_the_ordering_check(start, end):
    with pytest.raises(HTTPException, match="on or after"):
        clean_metadata({"acquisition_start": start, "acquisition_end": end}, "A title")
