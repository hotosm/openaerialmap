"""Turning an edit from My imagery into changes to a stored Item."""

import pytest
from pydantic import ValidationError

from app.imagery import metadata
from app.imagery.metadata import (
    LicenceMoreRestrictive,
    LicenceNotOffered,
    MetadataEdit,
    item_changes,
)


def _item(**props) -> dict:
    base = {
        "title": "Old title",
        "oam:producer_name": "Old provider",
        "oam:platform_type": "uav",
        "instruments": ["Old sensor"],
        "license": "CC-BY-NC-4.0",
        "providers": [
            {
                "name": "Old provider",
                "description": "Old contact",
                "roles": ["producer", "licensor"],
            }
        ],
    }
    base.update(props)
    return {"id": "item-1", "properties": base}


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("CC-BY 4.0", "CC-BY-4.0"),
        ("CC BY-NC 4.0", "CC-BY-NC-4.0"),
        ("cc-by-sa-4.0", "CC-BY-SA-4.0"),
        ("  CC-BY-4.0  ", "CC-BY-4.0"),
    ],
)
def test_licences_are_normalised(value, expected):
    assert metadata.normalise_licence(value) == expected


def test_contact_drops_email_addresses():
    assert (
        metadata.clean_contact("Ana, ana@example.org , Mapping Team")
        == "Ana, Mapping Team"
    )


def test_nothing_sent_changes_nothing():
    changes = item_changes(_item(), MetadataEdit())

    assert changes.properties == {}
    assert changes.expected == {}
    assert changes.history == []


def test_the_same_values_change_nothing():
    edit = MetadataEdit(
        title="Old title",
        provider="Old provider",
        contact="Old contact",
        platform="uav",
        sensor="Old sensor",
        license="CC BY-NC 4.0",
    )

    assert item_changes(_item(), edit).properties == {}


def test_every_field_lands_where_ingest_puts_it():
    edit = MetadataEdit(
        title="New title",
        provider="New provider",
        contact="New contact",
        platform="aircraft",
        sensor="New sensor",
        license="CC-BY 4.0",
    )

    changes = item_changes(_item(), edit)

    assert changes.properties == {
        "title": "New title",
        "oam:producer_name": "New provider",
        "providers": [
            {
                "name": "New provider",
                "description": "New contact",
                "roles": ["producer", "licensor"],
            }
        ],
        "oam:platform_type": "aircraft",
        "instruments": ["New sensor"],
        "license": "CC-BY-4.0",
    }
    assert changes.expected == {
        "title": "Old title",
        "oam:producer_name": "Old provider",
        "providers": _item()["properties"]["providers"],
        "oam:platform_type": "uav",
        "instruments": ["Old sensor"],
        "license": "CC-BY-NC-4.0",
    }
    assert changes.history == [
        ("title", "Old title", "New title"),
        ("oam:producer_name", "Old provider", "New provider"),
        ("providers.description", "Old contact", "New contact"),
        ("oam:platform_type", "uav", "aircraft"),
        ("instruments", "Old sensor", "New sensor"),
        ("license", "CC-BY-NC-4.0", "CC-BY-4.0"),
    ]


def test_an_empty_contact_removes_it():
    changes = item_changes(_item(), MetadataEdit(contact="someone@example.org"))

    assert changes.properties == {
        "providers": [{"name": "Old provider", "roles": ["producer", "licensor"]}]
    }
    assert changes.history == [("providers.description", "Old contact", None)]


def test_an_item_without_providers_gets_one():
    item = _item(providers=None)

    changes = item_changes(item, MetadataEdit(contact="Mapping Team"))

    assert changes.properties["providers"] == [
        {
            "name": "Old provider",
            "description": "Mapping Team",
            "roles": ["producer", "licensor"],
        }
    ]
    assert changes.expected["providers"] is None


def test_other_providers_are_kept():
    item = _item()
    item["properties"]["providers"].append({"name": "Host", "roles": ["host"]})

    changes = item_changes(item, MetadataEdit(provider="New provider"))

    assert changes.properties["providers"][1] == {"name": "Host", "roles": ["host"]}


@pytest.mark.parametrize(
    ("current", "new"),
    [
        ("CC-BY-NC-4.0", "CC-BY 4.0"),
        ("CC-BY-SA-4.0", "CC-BY 4.0"),
        ("CC-BY-NC-SA-4.0", "CC BY-NC 4.0"),
        ("CC-BY-NC-SA-4.0", "CC BY-SA 4.0"),
        ("CC-BY-NC-ND-4.0", "CC BY-NC 4.0"),
        ("CC BY 2.0", "CC-BY 4.0"),
    ],
)
def test_a_licence_can_change_to_a_less_restrictive_one(current, new):
    changes = item_changes(_item(license=current), MetadataEdit(license=new))

    expected = metadata.normalise_licence(new)
    assert changes.properties == {"license": expected}
    assert changes.history == [("license", current, expected)]


@pytest.mark.parametrize(
    ("current", "new"),
    [
        ("CC-BY-4.0", "CC BY-NC 4.0"),
        ("CC-BY-4.0", "CC BY-SA 4.0"),
        # Each takes away something the other allows.
        ("CC-BY-NC-4.0", "CC BY-SA 4.0"),
        ("CC-BY-SA-4.0", "CC BY-NC 4.0"),
        ("CC0-1.0", "CC-BY 4.0"),
        # No way to tell what an unknown licence allows.
        ("ODbL-1.0", "CC-BY 4.0"),
    ],
)
def test_a_licence_cannot_change_to_a_more_restrictive_one(current, new):
    with pytest.raises(LicenceMoreRestrictive):
        item_changes(_item(license=current), MetadataEdit(license=new))


def test_a_licence_oam_does_not_offer_is_refused():
    with pytest.raises(LicenceNotOffered):
        item_changes(_item(), MetadataEdit(license="MIT"))


def test_an_unoffered_licence_already_on_an_item_can_stay():
    # Older imports carry licences the form never offered.
    edit = MetadataEdit(license="ODbL-1.0", title="New title")

    changes = item_changes(_item(license="ODbL-1.0"), edit)

    assert changes.properties == {"title": "New title"}


def test_an_item_without_a_licence_can_get_one():
    item = _item()
    del item["properties"]["license"]

    changes = item_changes(item, MetadataEdit(license="CC BY-SA 4.0"))

    assert changes.properties == {"license": "CC-BY-SA-4.0"}
    assert changes.history == [("license", None, "CC-BY-SA-4.0")]


@pytest.mark.parametrize(
    "fields",
    [
        {"title": "   "},
        {"title": "x" * 201},
        {"provider": ""},
        {"sensor": ""},
        {"platform": "rocket"},
        {"contact": "x" * 501},
    ],
)
def test_invalid_values_are_rejected(fields):
    with pytest.raises(ValidationError):
        MetadataEdit(**fields)


def test_values_are_trimmed():
    assert MetadataEdit(title="  New title  ").title == "New title"
