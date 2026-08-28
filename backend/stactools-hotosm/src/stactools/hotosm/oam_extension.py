"""Resolution of the OAM STAC extension JSON schema, from the installed package.

The schema is published at the URI we put in ``stac_extensions``, but validation
resolves the copy shipped inside this package, so creating STAC Items never
depends on that URL being reachable.
"""

import json
from functools import cache
from importlib.resources import files
from typing import Any

from pystac import Item
from pystac.validation import RegisteredValidator
from pystac.validation.stac_validator import JsonSchemaSTACValidator

from stactools.hotosm.constants import (
    OAM_EXTENSION_DEFAULT_VERSION,
    OAM_EXTENSION_SCHEMA_URI_PATTERN,
    OAM_EXTENSION_SUPPORTED_VERSIONS,
)

OAM_EXTENSION_URI_PREFIX, OAM_EXTENSION_URI_SUFFIX = (
    OAM_EXTENSION_SCHEMA_URI_PATTERN.split("{version}")
)


def is_oam_extension(schema_uri: str) -> bool:
    """Whether a `stac_extensions` entry is the OAM extension, any version."""
    return schema_uri.startswith(OAM_EXTENSION_URI_PREFIX) and schema_uri.endswith(
        OAM_EXTENSION_URI_SUFFIX
    )


def set_oam_extension(item: Item) -> None:
    """Declare the current OAM extension version on an Item, exactly once.

    A third-party Item may already declare the extension: appending it again
    fails core STAC validation, and leaving an older version in place fails the
    older schema, which rejects fields added in later ones.
    """
    item.stac_extensions = [
        schema_uri
        for schema_uri in item.stac_extensions
        if not is_oam_extension(schema_uri)
    ]
    item.stac_extensions.append(
        OAM_EXTENSION_SCHEMA_URI_PATTERN.format(version=OAM_EXTENSION_DEFAULT_VERSION)
    )


@cache
def load_oam_extension_schema(version: str) -> dict[str, Any]:
    """Read the OAM STAC extension schema bundled for `version`."""
    schema = (
        files("stactools.hotosm")
        .joinpath("schemas", "oam", f"v{version}", "schema.json")
        .read_text()
    )
    return json.loads(schema)


def register_oam_extension_schemas() -> None:
    """Make pystac validate the OAM extension from the bundled schemas."""
    validator = RegisteredValidator.get_validator()
    if not isinstance(validator, JsonSchemaSTACValidator):
        return

    for version in OAM_EXTENSION_SUPPORTED_VERSIONS:
        schema_uri = OAM_EXTENSION_SCHEMA_URI_PATTERN.format(version=version)
        validator.schema_cache.setdefault(
            schema_uri, load_oam_extension_schema(version)
        )
