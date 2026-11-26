"""Turn an edit from the imagery page into changes to a stored STAC Item.

The rules match ingest (stactools-hotosm `oam_metadata.py` and `stac.py`). The
API does not depend on that package, which would bring rasterio into the image,
so keep the two in step by hand.
"""

import re
from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.uploads.schemas import MAX_METADATA_VALUE_LENGTH

# The licences the upload form offers, as ingest stores them.
LICENCES = ("CC-BY-4.0", "CC-BY-NC-4.0", "CC-BY-SA-4.0")

# The platforms the upload form offers, with its labels.
Platform = Literal["uav", "aircraft", "balloon", "kite", "satellite"]
PLATFORMS: tuple[tuple[Platform, str], ...] = (
    ("uav", "UAV / drone"),
    ("aircraft", "Aircraft"),
    ("balloon", "Balloon"),
    ("kite", "Kite"),
    ("satellite", "Satellite"),
)

# A Creative Commons BY licence; the group holds what it adds to attribution.
_CC_BY = re.compile(r"CC-BY((?:-(?:NC|ND|SA))*)-\d+(?:\.\d+)?")  # codespell:ignore

# Same cap as an upload's title.
MAX_TITLE_LENGTH = 200

# Stored values can predate the form's caps, so what an editor saw may be longer.
MAX_SEEN_LENGTH = 10_000

# Roles ingest gives the provider it creates.
_PROVIDER_ROLES = ["producer", "licensor"]


class LicenceNotOffered(Exception):
    """The edit names a licence the upload form does not offer."""


class LicenceMoreRestrictive(Exception):
    """The edit takes away something the current licence allows."""


class LicenceNotChangeable(Exception):
    """The current licence is outside CC BY, so there is no telling what it allows."""


class MetadataEdit(BaseModel):
    """Descriptive fields an owner may correct. A field left out stays as it is."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=MAX_TITLE_LENGTH)
    provider: str | None = Field(
        default=None, min_length=1, max_length=MAX_METADATA_VALUE_LENGTH
    )
    # Empty clears it.
    contact: str | None = Field(default=None, max_length=MAX_METADATA_VALUE_LENGTH)
    platform: Platform | None = None
    # Cannot be cleared: patch_properties sets properties, it never removes one.
    sensor: str | None = Field(
        default=None, min_length=1, max_length=MAX_METADATA_VALUE_LENGTH
    )
    license: str | None = Field(
        default=None, min_length=1, max_length=MAX_METADATA_VALUE_LENGTH
    )


class SeenMetadata(BaseModel):
    """The values the editor showed before the edit, untrimmed, empty when unset."""

    title: str | None = Field(default=None, max_length=MAX_SEEN_LENGTH)
    provider: str | None = Field(default=None, max_length=MAX_SEEN_LENGTH)
    contact: str | None = Field(default=None, max_length=MAX_SEEN_LENGTH)
    platform: str | None = Field(default=None, max_length=MAX_SEEN_LENGTH)
    sensor: str | None = Field(default=None, max_length=MAX_SEEN_LENGTH)
    license: str | None = Field(default=None, max_length=MAX_SEEN_LENGTH)


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


def _restrictions(licence: str) -> frozenset[str] | None:
    """Return what a CC BY licence adds to attribution; None for any other."""
    match = _CC_BY.fullmatch(normalise_licence(licence))
    if match is None:
        return None
    return frozenset(match.group(1).split("-")) - {""}


def _opens_up(current: str, new: str) -> bool:
    """Return whether `new` allows everything `current` does."""
    old, wanted = _restrictions(current), _restrictions(new)
    return old is not None and wanted is not None and wanted <= old


def licence_choices(current: str | None) -> list[str]:
    """Return the licences an Item under `current` may move to, current first."""
    if not current:
        return list(LICENCES)
    current = normalise_licence(current)
    return [
        current,
        *(
            licence
            for licence in LICENCES
            if licence != current and _opens_up(current, licence)
        ),
    ]


def clean_contact(value: str) -> str:
    """Drop email addresses, which must not be published on an Item."""
    parts = (p.strip() for p in value.split(","))
    return ", ".join(p for p in parts if p and "@" not in p)


def _text(value: Any) -> str | None:
    return value if isinstance(value, str) else None


def _first(values: Any) -> str | None:
    return _text(values[0]) if isinstance(values, list) and values else None


def shown(props: dict[str, Any]) -> dict[str, str]:
    """Return the fields as the details form shows them from an Item."""
    providers = props.get("providers")
    first = providers[0] if isinstance(providers, list) and providers else None
    first = first if isinstance(first, dict) else {}
    return {
        "title": _text(props.get("title")) or "",
        "provider": _text(first.get("name"))
        or _text(props.get("oam:producer_name"))
        or "",
        "contact": _text(first.get("description")) or "",
        "platform": _text(props.get("oam:platform_type")) or "",
        "sensor": _first(props.get("instruments")) or "",
        "license": normalise_licence(_text(props.get("license")) or ""),
    }


def changed_meanwhile(
    item: dict[str, Any], edit: MetadataEdit, seen: SeenMetadata
) -> str | None:
    """Return a field the edit changes that no longer holds what the editor saw."""
    current = shown(item.get("properties") or {})
    for name in MetadataEdit.model_fields:
        was = getattr(seen, name)
        if getattr(edit, name) is not None and was is not None and was != current[name]:
            return name
    return None


def item_changes(item: dict[str, Any], edit: MetadataEdit) -> Changes:
    """Return the changes `edit` makes to `item`, leaving out what is unchanged.

    Raises `LicenceNotOffered` for a licence the upload form does not offer,
    `LicenceNotChangeable` when the current one is outside CC BY, and
    `LicenceMoreRestrictive` for one that allows less than the current one.
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
        if new_licence != normalise_licence(old_licence or ""):
            if new_licence not in LICENCES:
                raise LicenceNotOffered(new_licence)
            if old_licence and _restrictions(old_licence) is None:
                raise LicenceNotChangeable(old_licence)
            # Never more restrictive: people already rely on the current terms.
            if old_licence and not _opens_up(old_licence, new_licence):
                raise LicenceMoreRestrictive(new_licence)
            changes.set("license", props.get("license"), new_licence)
            changes.history.append(("license", old_licence, new_licence))

    return changes


def _provider_changes(
    props: dict[str, Any], edit: MetadataEdit, changes: Changes
) -> None:
    """Apply provider and contact, which ingest keeps in two places."""
    old_providers = props.get("providers")
    # A provider that is not an object is dropped rather than failing the edit.
    providers = (
        [dict(p) for p in old_providers if isinstance(p, dict)]
        if isinstance(old_providers, list)
        else []
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
