"""STAC creation constants."""

COLLECTION_ID = "openaerialmap"
COLLECTION_TITLE = "OpenAerialMap (OAM) STAC Catalog"
COLLECTION_DESCRIPTION = (
    "OpenAerialMap (OAM) is a set of tools for searching, sharing, and using openly "
    "licensed satellite and unmanned aerial vehicle (UAV) imagery."
)

OAM_EXTENSION_SCHEMA_URI_PATTERN: str = (
    "https://hotosm.github.io/stactools-hotosm/oam/v{version}/schema.json"
)
OAM_EXTENSION_DEFAULT_VERSION: str = "0.1.0"
OAM_EXTENSION_SUPPORTED_VERSIONS: list[str] = ["0.1.0"]
