"""Create STAC records for HOT OSM from Vantor's public catalog."""

import datetime as dt
from typing import Iterable

from pystac import Catalog, Collection, Item, MediaType, Provider, ProviderRole
from pystac.extensions.item_assets import ItemAssetDefinition

from stactools.hotosm import opendata
from stactools.hotosm.vantor.sync import (
    PUBLISHED_PROPERTY,
    VANTOR_CATALOG,
    all_catalog_ids,
    new_stac_items,
    published_datetime,
)

COLLECTION_ID = "vantor-opendata"
COLLECTION_DESCRIPTION = (
    "Vantor Open Data Catalog, formatted for Humanitarian OpenStreetMap "
    "Team's OpenAerialMap project"
)


def prepare_item(oam_item: Item, item: Item) -> None:
    """Apply Vantor-specific Item changes."""
    # Vantor uses the Item ID as the catalog ID.
    oam_item.properties["catalog_id"] = item.id

    if (event_collection := item.get_collection()) is None:
        raise ValueError(f"Cannot get parent collection for Item={item.id}")

    oam_item.properties["title"] = (
        f"{event_collection.title} - {item.properties['title']}"
    )

    # OAM requires gsd; the visual COG is pan-sharpened.
    if "gsd" not in oam_item.properties:
        oam_item.properties["gsd"] = item.properties["pan_gsd"]

    # STAC calls the Vantor vehicle_name field platform.
    if vehicle_name := item.properties.get("vehicle_name"):
        oam_item.properties.setdefault("platform", vehicle_name)

    # The timestamps extension requires a timezone.
    if (published := published_datetime(item)) is not None:
        oam_item.properties[PUBLISHED_PROPERTY] = published.isoformat().replace(
            "+00:00", "Z"
        )

    _fix_asset_metadata(oam_item)


def _fix_asset_metadata(oam_item: Item) -> None:
    """Fix invalid upstream asset metadata."""
    if (visual := oam_item.assets.get("visual")) is not None:
        visual.roles = ["visual"]

        # STAC 1.1 stores eo:bands on the asset.
        if bands := oam_item.properties.pop("eo:bands", None):
            visual.extra_fields["eo:bands"] = bands

    if (thumbnail := oam_item.assets.get("thumbnail")) is not None:
        thumbnail.roles = ["thumbnail"]
        if thumbnail.media_type == "image/jpg":
            thumbnail.media_type = MediaType.JPEG


CATALOG = opendata.OpenDataCatalog(
    key="Vantor",
    collection_id=COLLECTION_ID,
    collection_description=COLLECTION_DESCRIPTION,
    catalog_url=VANTOR_CATALOG,
    producer_name="Vantor",
    platform_type="satellite",
    providers=[
        Provider(
            name="Vantor",
            url="https://vantor.com/company/open-data-program/",
            roles=[ProviderRole.LICENSOR, ProviderRole.PRODUCER],
        ),
        Provider(
            name="Amazon Web Services (AWS)",
            url="https://registry.opendata.aws/vantor-open-data/",
            roles=[ProviderRole.HOST],
        ),
    ],
    prepare_item=prepare_item,
    new_stac_items=new_stac_items,
    all_catalog_ids=all_catalog_ids,
    item_assets={
        "visual": ItemAssetDefinition.create(
            title="Visual image",
            description=opendata.VISUAL_ASSET_DESCRIPTION,
            media_type=MediaType.COG,
            roles=["data"],
        ),
        "thumbnail": ItemAssetDefinition.create(
            title="Thumbnail",
            description="Downsampled browse image",
            media_type=MediaType.JPEG,
            roles=["thumbnail"],
        ),
    },
)


def create_collection(
    catalog: Catalog,
    temporal_extent_start: dt.datetime | None = None,
    temporal_extent_end: dt.datetime | None = None,
    catalog_ids: Iterable[str] | None = None,
) -> Collection:
    """Rewrite a Vantor Catalog as an OAM Collection."""
    return opendata.create_collection(
        CATALOG,
        catalog,
        temporal_extent_start=temporal_extent_start,
        temporal_extent_end=temporal_extent_end,
        catalog_ids=catalog_ids,
    )


def create_item(item: Item) -> Item:
    """Rewrite Vantor STAC Item."""
    return opendata.create_item(CATALOG, item)
