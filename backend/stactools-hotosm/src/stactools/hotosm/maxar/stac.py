"""Create STAC records for HOT OSM from Maxar's public catalog."""

import datetime as dt
from typing import Iterable

from pystac import Catalog, Collection, Item, Provider, ProviderRole

from stactools.hotosm import opendata
from stactools.hotosm.maxar.sync import (
    MAXAR_CATALOG,
    all_catalog_ids,
    new_stac_items,
)

COLLECTION_ID = "maxar-opendata"
COLLECTION_DESCRIPTION = (
    "Maxar Open Data Catalog, formatted for Humanitarian OpenStreetMap "
    "Team's OpenAerialMap project"
)


def prepare_item(oam_item: Item, item: Item) -> None:
    """Apply Maxar-specific Item changes."""
    # Slashes in IDs interfere with API paths.
    oam_item.id = item.id.replace("/", "-")

    oam_item.make_asset_hrefs_absolute()

    # The event is the parent of the ARD tile Collection.
    if (item_parent := item.get_collection()) is None:
        raise ValueError(f"Cannot get parent collection for Item={item.id}")

    if (event_collection := item_parent.get_parent()) is None:
        raise ValueError(f"Cannot get parent collection for Item={item.id}")

    if "grid:code" in item.properties:
        title_suffix = item.properties["grid:code"]
    else:
        title_suffix = item.properties["catalog_id"]

    oam_item.properties["title"] = f"{event_collection.title} - {title_suffix}"


CATALOG = opendata.OpenDataCatalog(
    key="Maxar",
    collection_id=COLLECTION_ID,
    collection_description=COLLECTION_DESCRIPTION,
    catalog_url=MAXAR_CATALOG,
    producer_name="Maxar",
    platform_type="satellite",
    providers=[
        Provider(
            name="Maxar",
            url="https://www.maxar.com/open-data",
            roles=[ProviderRole.LICENSOR, ProviderRole.PRODUCER],
        ),
        Provider(
            name="Amazon Web Services (AWS)",
            url="https://registry.opendata.aws/maxar-open-data/",
            roles=[ProviderRole.HOST],
        ),
    ],
    prepare_item=prepare_item,
    new_stac_items=new_stac_items,
    all_catalog_ids=all_catalog_ids,
)


def create_collection(
    catalog: Catalog,
    temporal_extent_start: dt.datetime | None = None,
    temporal_extent_end: dt.datetime | None = None,
    catalog_ids: Iterable[str] | None = None,
) -> Collection:
    """Rewrite a Maxar Catalog as an OAM Collection."""
    return opendata.create_collection(
        CATALOG,
        catalog,
        temporal_extent_start=temporal_extent_start,
        temporal_extent_end=temporal_extent_end,
        catalog_ids=catalog_ids,
    )


def create_item(item: Item) -> Item:
    """Rewrite Maxar STAC Item."""
    return opendata.create_item(CATALOG, item)
