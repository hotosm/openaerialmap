"""Ensure that the STAC we create follows our STAC extension."""

import json
from pathlib import Path

import pytest
from pystac.errors import STACValidationError
from pystac.validation import JsonSchemaSTACValidator

from stactools.hotosm.constants import (
    OAM_EXTENSION_DEFAULT_VERSION,
    OAM_EXTENSION_SCHEMA_URI_PATTERN,
)
from stactools.hotosm.oam_metadata import OamMetadata
from stactools.hotosm.stac import create_item

OAM_EXT_SCHEMA = OAM_EXTENSION_SCHEMA_URI_PATTERN.format(
    version=OAM_EXTENSION_DEFAULT_VERSION
)
OAM_STAC_EXTENSION_PATH = (
    Path(__file__).parents[1].joinpath("stac-extension", "json-schema", "schema.json")
)


@pytest.fixture
def oam_validator() -> JsonSchemaSTACValidator:
    """Return a STAC validator setup to validate OAM extension from local path."""
    validator = JsonSchemaSTACValidator()
    with OAM_STAC_EXTENSION_PATH.open() as f:
        oam_extension = json.load(f)

    # Inject the extension into the schema cache so that we don't have to fetch it.
    # This helps local development because the extension may not be published yet!
    validator.schema_cache[oam_extension["$id"]] = oam_extension

    return validator


def test_oam_item_validates_stac_extension(
    example_oam_image: OamMetadata, oam_validator: JsonSchemaSTACValidator
):
    """Ensure our OAM STAC Item validates against our own extension."""
    item = create_item(example_oam_image.sanitize())
    item.validate(oam_validator)


def test_stac_extension_requires(
    example_oam_image: OamMetadata, oam_validator: JsonSchemaSTACValidator
):
    """Ensure our OAM STAC Extension requires certain properties."""
    item = create_item(example_oam_image.sanitize())

    broken = item.clone()
    broken.properties.pop("oam:platform_type")
    with pytest.raises(
        STACValidationError, match=r"'oam:platform_type' is a required property"
    ):
        broken.validate(oam_validator)

    # requires oam:platform_type
    broken = item.clone()
    broken.properties.pop("oam:producer_name")
    with pytest.raises(
        STACValidationError, match=r"'oam:producer_name' is a required property"
    ):
        broken.validate(oam_validator)

    # requires gsd
    broken = item.clone()
    broken.properties.pop("gsd")
    with pytest.raises(STACValidationError, match=r"'gsd' is a required property"):
        broken.validate(oam_validator)
