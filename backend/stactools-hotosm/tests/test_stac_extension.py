"""Ensure that the STAC we create follows our STAC extension."""

import copy
import hashlib
import json
from pathlib import Path
from typing import Any

import pystac
import pytest
from pystac.errors import STACValidationError
from pystac.validation import JsonSchemaSTACValidator

from stactools.hotosm.constants import (
    OAM_EXTENSION_DEFAULT_VERSION,
    OAM_EXTENSION_SCHEMA_URI_PATTERN,
    OAM_EXTENSION_SUPPORTED_VERSIONS,
)
from stactools.hotosm.oam_extension import (
    load_oam_extension_schema,
    register_oam_extension_schemas,
)
from stactools.hotosm.oam_metadata import OamMetadata
from stactools.hotosm.stac import create_item

OAM_EXT_SCHEMA = OAM_EXTENSION_SCHEMA_URI_PATTERN.format(
    version=OAM_EXTENSION_DEFAULT_VERSION
)
JSON_SCHEMA_DIR = Path(__file__).parents[1].joinpath("stac-extension", "json-schema")
EXAMPLES_DIR = Path(__file__).parents[1].joinpath("stac-extension", "examples")
OAM_STAC_EXTENSION_PATH = JSON_SCHEMA_DIR.joinpath(
    f"v{OAM_EXTENSION_DEFAULT_VERSION}", "schema.json"
)
DOCS_SITE_URL = "https://docs.imagery.hotosm.org/"
DOCS_DIR = Path(__file__).parents[3].joinpath("docs")

# Add a new version instead of changing these released checksums.
RELEASED_SCHEMA_SHA256 = {
    "0.1.0": "f8512228a01361265f07d99710056687006b2facb487c57cfe5b90d2a9f5fdfa",
    "0.2.0": "1f442028f486d84fcecbfd63f55e2f872724b654f00e68f8d6ffc1efc4b653d4",
}


def test_stac_extension_id_matches_schema_uri():
    """Ensure the schema's own $id is the URI we put in ``stac_extensions``."""
    with OAM_STAC_EXTENSION_PATH.open() as f:
        oam_extension = json.load(f)

    assert oam_extension["$id"] == OAM_EXT_SCHEMA


@pytest.mark.parametrize("version", OAM_EXTENSION_SUPPORTED_VERSIONS)
def test_stac_extension_is_published_through_docs(version: str):
    """Publish each schema version from its own source file."""
    schema_uri = OAM_EXTENSION_SCHEMA_URI_PATTERN.format(version=version)
    assert schema_uri.startswith(DOCS_SITE_URL)

    source = JSON_SCHEMA_DIR.joinpath(f"v{version}", "schema.json")
    published = DOCS_DIR.joinpath(schema_uri.removeprefix(DOCS_SITE_URL))
    assert source.is_file()
    assert published.is_file()
    assert published.read_bytes() == source.read_bytes()


@pytest.mark.parametrize("version", OAM_EXTENSION_SUPPORTED_VERSIONS)
def test_published_versions_mirror_the_source(version: str):
    """Match bundled and published schemas to their source and $id."""
    schema_uri = OAM_EXTENSION_SCHEMA_URI_PATTERN.format(version=version)
    schema = load_oam_extension_schema(version)

    assert schema["$id"] == schema_uri
    published = DOCS_DIR.joinpath(schema_uri.removeprefix(DOCS_SITE_URL))
    assert published.is_file()
    assert json.loads(published.read_text()) == schema


@pytest.mark.parametrize("version", OAM_EXTENSION_SUPPORTED_VERSIONS)
def test_released_schemas_are_unchanged(version: str):
    """Prevent changes to released schemas."""
    source = JSON_SCHEMA_DIR.joinpath(f"v{version}", "schema.json")
    digest = hashlib.sha256(source.read_bytes()).hexdigest()

    assert digest == RELEASED_SCHEMA_SHA256[version], (
        f"v{version} is already published at "
        f"{OAM_EXTENSION_SCHEMA_URI_PATTERN.format(version=version)} and must "
        "keep serving the bytes it was released with. Add a new version "
        "instead of editing this one."
    )


def test_stac_extension_is_bundled_in_package():
    """Ensure validation resolves the schema without fetching the published URI."""
    with OAM_STAC_EXTENSION_PATH.open() as f:
        oam_extension = json.load(f)

    assert load_oam_extension_schema(OAM_EXTENSION_DEFAULT_VERSION) == oam_extension


@pytest.fixture
def oam_validator() -> JsonSchemaSTACValidator:
    """Return a STAC validator setup to validate OAM extension from local path."""
    validator = JsonSchemaSTACValidator()
    with OAM_STAC_EXTENSION_PATH.open() as f:
        oam_extension = json.load(f)

    # Cache the local extension because it may not be published yet.
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


@pytest.fixture
def example_extension_item() -> dict:
    """The extension's own example Item, which uses every required field."""
    with EXAMPLES_DIR.joinpath("item.json").open() as f:
        return json.load(f)


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("oam:product_type", "elevation"),
        ("oam:product_type_source", "detected"),
        ("oam:footprint_source", "bbox"),
        ("oam:footprint_area", 0),
        ("oam:acquisition_time_estimated", True),
        # Every value of the enum, including the one the prose used to omit
        ("oam:acquisition_source", "user"),
        ("oam:acquisition_source", "file-tags"),
        ("oam:acquisition_source", "ingest"),
        ("oam:external_id", "odm-task-1"),
    ],
)
def test_v0_2_0_fields_accepted(example_extension_item: dict, key: str, value: Any):
    """Ensure every field v0.2.0 added is usable."""
    item = copy.deepcopy(example_extension_item)
    item["properties"][key] = value

    register_oam_extension_schemas()
    pystac.Item.from_dict(item).validate()


@pytest.mark.parametrize(
    ("key", "value"),
    [
        ("oam:product_type", "visual2"),
        ("oam:product_type_source", "guessed"),
        ("oam:footprint_source", "polygon"),
        ("oam:footprint_area", -5),
        ("oam:acquisition_time_estimated", "yes"),
        ("oam:acquisition_source", "nonsense"),
        ("oam:external_id", 123),
        # A misspelled "oam:" field must not slip through as a free-form one
        ("oam:extrnal_id", "typo"),
    ],
)
def test_v0_2_0_fields_reject_bad_values(
    example_extension_item: dict, key: str, value: Any
):
    """Reject invalid v0.2.0 field values."""
    item = copy.deepcopy(example_extension_item)
    item["properties"][key] = value

    register_oam_extension_schemas()
    with pytest.raises(STACValidationError):
        pystac.Item.from_dict(item).validate()
