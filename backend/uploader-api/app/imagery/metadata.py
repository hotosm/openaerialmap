"""Turn an edit from My imagery into changes to a stored STAC Item.

The rules match ingest (stactools-hotosm `oam_metadata.py` and `stac.py`). The
API does not depend on that package, which would bring rasterio into the image,
so keep the two in step by hand.
"""

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# The licences the upload form offers, as ingest stores them.
LICENCES = ("CC-BY-4.0", "CC-BY-NC-4.0", "CC-BY-SA-4.0")

# Same cap as upload metadata in app/uploads/schemas.py.
MAX_VALUE_LENGTH = 500

# Same cap as an upload's title.
MAX_TITLE_LENGTH = 200

# Roles ingest gives the provider it creates.
_PROVIDER_ROLES = ["producer", "licensor"]


class LicenceNotOffered(Exception):
    """The edit names a licence the upload form does not offer."""


class MetadataEdit(BaseModel):
    """Descriptive fields an owner may correct. A field left out stays as it is."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    provider: str | None = Field(
        default=None, min_length=1, max_length=MAX_VALUE_LENGTH
    )
    # Empty clears it.
    contact: str | None = Field(default=None, max_length=MAX_VALUE_LENGTH)
    platform: Literal["uav", "aircraft", "balloon", "kite", "satellite"] | None = None
    # Cannot be cleared: patch_properties sets properties, it never removes one.
    sensor: str | None = Field(default=None, min_length=1, max_length=MAX_VALUE_LENGTH)
    license: str | None = Field(default=None, min_length=1, max_length=MAX_VALUE_LENGTH)


@dataclass(slots=True)
class Changes:
    """What to write to the Item, what it must still hold, and what to record."""

    properties: dict[str, Any] = field(default_factory=dict)
    # The values the edit was based on, so a stale edit is refused.
    expected: dict[str, Any] = field(default_factory=dict)
    # `(field, old, new)` rows for imagery_changes.
    history: list[tuple[str, str | None, str | None]] = field(default_factory=list)

    def set(self, key: str, old: Any, new: Any) -> None:
        """Write `new` to the property `key`, which must still be `old`."""
        self.properties[key] = new
        self.expected[key] = old


def normalise_licence(value: str) -> str:
    """Return a licence as ingest stores it: upper case, dashes for spaces."""
    # Older Items still carry `CC-BY 4.0`, so compare normalised values only.
    return "-".join(value.upper().split())


def clean_contact(value: str) -> str:
    """Drop email addresses, which must not be published on an Item."""
    parts = (p.strip() for p in value.split(","))
    return ", ".join(p for p in parts if p and "@" not in p)


def _text(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _first(values: Any) -> str | None:
    return _text(values[0]) if isinstance(values, list) and values else None


def item_changes(item: dict[str, Any], edit: MetadataEdit) -> Changes:
    """Return the changes `edit` makes to `item`, leaving out what is unchanged.

    Raises `LicenceNotOffered` for a licence the upload form does not offer.
    """
    props = item.get("properties") or {}
    changes = Changes()

    old_title = _text(props.get("title"))
    if edit.title is not None and edit.title != old_title:
        changes.set("title", props.get("title"), edit.title)
        changes.history.append(("title", old_title, edit.title))

    _provider_changes(props, edit, changes)

    old_platform = _text(props.get("oam:platform_type"))
    if edit.platform is not None and edit.platform != old_platform:
        changes.set("oam:platform_type", props.get("oam:platform_type"), edit.platform)
        changes.history.append(("oam:platform_type", old_platform, edit.platform))

    old_sensor = _first(props.get("instruments"))
    if edit.sensor is not None and edit.sensor != old_sensor:
        changes.set("instruments", props.get("instruments"), [edit.sensor])
        changes.history.append(("instruments", old_sensor, edit.sensor))

    if edit.license is not None:
        old_licence = _text(props.get("license"))
        new_licence = normalise_licence(edit.license)
        # Any direction is fine: people keep the terms they got the imagery
        # under, and imagery_changes records when each licence applied.
        if new_licence != normalise_licence(old_licence or ""):
            if new_licence not in LICENCES:
                raise LicenceNotOffered(new_licence)
            changes.set("license", props.get("license"), new_licence)
            changes.history.append(("license", old_licence, new_licence))

    return changes


def _provider_changes(
    props: dict[str, Any], edit: MetadataEdit, changes: Changes
) -> None:
    """Apply provider and contact, which ingest keeps in two places."""
    old_providers = props.get("providers")
    providers = (
        [dict(p) for p in old_providers] if isinstance(old_providers, list) else []
    )
    if not providers:
        # Ingest always writes one; "unknown" is its own fallback name.
        providers = [
            {
                "name": _text(props.get("oam:producer_name")) or "unknown",
                "roles": list(_PROVIDER_ROLES),
            }
        ]
    first = providers[0]
    touched = False

    old_name = _text(first.get("name"))
    if edit.provider is not None and edit.provider != old_name:
        first["name"] = edit.provider
        changes.set("oam:producer_name", props.get("oam:producer_name"), edit.provider)
        changes.history.append(("oam:producer_name", old_name, edit.provider))
        touched = True

    if edit.contact is not None:
        old_contact = _text(first.get("description"))
        contact = clean_contact(edit.contact) or None
        if contact != old_contact:
            if contact:
                first["description"] = contact
            else:
                first.pop("description", None)
            changes.history.append(("providers.description", old_contact, contact))
            touched = True

    if touched:
        changes.set("providers", old_providers, providers)
