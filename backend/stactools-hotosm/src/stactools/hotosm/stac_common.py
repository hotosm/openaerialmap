"""Common STAC manipulation code."""

from urllib.parse import urlparse

from pystac import Item

ALTERNATE_ASSETS_VERSION = "v1.2.0"
ALTERNATE_ASSETS_SCHEMA = f"https://stac-extensions.github.io/alternate-assets/{ALTERNATE_ASSETS_VERSION}/schema.json"


def add_alternate_assets(item: Item) -> Item:
    """Modify Item in place by adding alternate-assets extension."""
    item.stac_extensions.append(ALTERNATE_ASSETS_SCHEMA)

    for asset in item.assets.values():
        parsed = urlparse(asset.href)
        if "amazonaws.com" in parsed.netloc:
            bucket = parsed.netloc.split(".")[0]
            s3_url = f"s3://{bucket}{parsed.path}"

            asset.extra_fields.update(
                {
                    "alternate:name": "HTTPS",
                    "alternate": {"s3": {"href": s3_url, "alternate:name": "S3"}},
                }
            )

    return item
