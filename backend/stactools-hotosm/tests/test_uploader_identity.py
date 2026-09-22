"""Test uploader identity in STAC Items."""

import json
from pathlib import Path

import pytest

from stactools.hotosm.oam_metadata import OamMetadata
from stactools.hotosm.oam_metadata_client import (
    LEGACY_ID_PREFIX,
    OamMetadataClient,
    _split_contact,
)
from stactools.hotosm.stac import create_item

DATA = Path(__file__).parent / "data"


def _legacy_result() -> dict:
    """Load one legacy metadata record."""
    response = json.loads((DATA / "oam_meta_api_response10.json").read_text())
    return response["results"][0]


@pytest.mark.parametrize(
    ("contact", "expected"),
    [
        (
            "Lockport AI Tools,lockportaitools@gmail.com",
            ("Lockport AI Tools", "lockportaitools@gmail.com"),
        ),
        ("someone@example.org", (None, "someone@example.org")),
        ("A Person", ("A Person", None)),
        ("A Person, Second Person, a@example.org", ("A Person", "a@example.org")),
        ("", (None, None)),
        (None, (None, None)),
    ],
)
def test_split_contact(contact: str | None, expected: tuple[str | None, str | None]):
    """Split common legacy contact formats."""
    assert _split_contact(contact) == expected


def test_legacy_result_keeps_the_old_account():
    """Keep the legacy account identifier."""
    result = _legacy_result()
    result["user"] = {"_id": "67f8a774f769c0a050db59c2", "name": "Lockport AI Tools"}
    result["contact"] = "Lockport AI Tools,lockportaitools@gmail.com"

    parsed = OamMetadataClient.new()._parse_result(result)

    assert parsed.uploader_id == f"{LEGACY_ID_PREFIX}|67f8a774f769c0a050db59c2"
    assert parsed.uploader_name == "Lockport AI Tools"
    assert parsed.uploader_email == "lockportaitools@gmail.com"


def test_legacy_result_without_a_user_falls_back_to_contact():
    """Use contact details when the account is absent."""
    result = _legacy_result()
    assert result.get("user") is None

    parsed = OamMetadataClient.new()._parse_result(result)

    assert parsed.uploader_id is None
    assert parsed.uploader_email == "redacted@redacted.redacted"


def test_item_carries_the_uploader(example_oam_image: OamMetadata):
    """Add uploader fields to the Item."""
    example_oam_image.uploader_id = "hotosm|1234"
    example_oam_image.uploader_name = "spwoodcock"
    example_oam_image.uploader_email = "Someone@Example.org"

    item = create_item(example_oam_image.sanitize())
    item.validate()

    assert item.properties["oam:uploader_id"] == "hotosm|1234"
    assert item.properties["oam:uploader_name"] == "spwoodcock"
    assert item.properties["oam:uploader_email"] == "someone@example.org"


def test_item_omits_an_unknown_uploader(example_oam_image: OamMetadata):
    """Omit unknown uploader fields."""
    item = create_item(example_oam_image.sanitize())
    item.validate()

    assert "oam:uploader_id" not in item.properties
    assert "oam:uploader_name" not in item.properties
    assert "oam:uploader_email" not in item.properties


@pytest.mark.parametrize(
    "contact",
    [
        "Name <someone@example.org>",
        "someone at example.org",
        "@example.org",
        "someone@",
    ],
)
def test_an_unusable_legacy_contact_costs_only_the_email(
    example_oam_image: OamMetadata, contact: str
):
    """Drop an invalid legacy email without rejecting the Item."""
    example_oam_image.uploader_id = "oam-legacy|67f8a774f769c0a050db59c2"
    example_oam_image.uploader_email = _split_contact(contact)[1]

    item = create_item(example_oam_image.sanitize())
    item.validate()

    assert "oam:uploader_email" not in item.properties
    assert item.properties["oam:uploader_id"] == "oam-legacy|67f8a774f769c0a050db59c2"


def test_blank_uploader_fields_are_dropped(example_oam_image: OamMetadata):
    """Drop blank uploader fields."""
    example_oam_image.uploader_id = "  "
    example_oam_image.uploader_name = ""
    example_oam_image.uploader_email = "   "

    oam = example_oam_image.sanitize()

    assert oam.uploader_id is None
    assert oam.uploader_name is None
    assert oam.uploader_email is None
