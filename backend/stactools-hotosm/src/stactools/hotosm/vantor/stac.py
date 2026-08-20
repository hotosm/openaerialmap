"""Create STAC records for HOT OSM from Vantor's public catalog."""

import datetime as dt
from typing import Iterable

from pystac import (
    Catalog,
    Collection,
    Extent,
    Item,
    Link,
    MediaType,
    Provider,
    ProviderRole,
    RelType,
    SpatialExtent,
    Summaries,
    TemporalExtent,
)
from pystac.extensions.item_assets import ItemAssetDefinition
from pystac.extensions.render import Render, RenderExtension

from stactools.hotosm.constants import (
    OAM_EXTENSION_DEFAULT_VERSION,
    OAM_EXTENSION_SCHEMA_URI_PATTERN,
)
from stactools.hotosm.oam_extension import register_oam_extension_schemas
from stactools.hotosm.stac_common import add_alternate_assets

COLLECTION_ID = "vantor-opendata"
COLLECTION_DESCRIPTION = (
    "Vantor Open Data Catalog, formatted for Humanitarian OpenStreetMap "
    "Team's OpenAerialMap project"
)


def create_collection(
    catalog: Catalog,
    temporal_extent_start: dt.datetime | None = None,
    temporal_extent_end: dt.datetime | None = None,
    catalog_ids: Iterable[str] | None = None,
) -> Collection:
    """Rewrite Maxar root Catalog into a Collection for HOT OAM.

    Args:
        catalog: Maxar root STAC Catalog
        temporal_extent_start: Start of the Collection temporal extent
        temporal_extent_end: End of the Collection temporal extent
        catalog_ids: Maxar acquisition "catalog IDs" to summarize. These are
            an opaque but useful key for finding a given open data archive,
            see `stactools.hotosm.maxar.sync.all_catalog_ids`.
    """
    collection = Collection(
        id=COLLECTION_ID,
        # The Maxar catalogs have terse descriptions that are better suited to use
        # as a title
        title=catalog.description,
        description=COLLECTION_DESCRIPTION,
        extent=Extent(
            spatial=SpatialExtent([[-180.0, -90.0, 180.0, 90.0]]),
            temporal=TemporalExtent([temporal_extent_start, temporal_extent_end]),
        ),
        license=catalog.extra_fields["license"],
        providers=[
            Provider(
                name="Maxar",
                url="https://vantor.com/company/open-data-program/",
                roles=[ProviderRole.LICENSOR, ProviderRole.PRODUCER],
            ),
            Provider(
                name="Amazon Web Services (AWS)",
                url="https://registry.opendata.aws/vantor-open-data/",
                roles=[ProviderRole.HOST],
            ),
        ],
    )

    if catalog_ids is not None:
        unique_catalog_ids = sorted(set(catalog_ids))
        # NOTE: `Summaries.to_dict` silently drops any list longer than
        # `maxcount`, which defaults to 25
        collection.summaries = Summaries(
            {"catalog_id": unique_catalog_ids},
            maxcount=len(unique_catalog_ids) + 1,
        )

    if catalog_self_link := catalog.get_self_href():
        collection.add_link(
            Link(
                rel=RelType.DERIVED_FROM,
                target=catalog_self_link,
                media_type=MediaType.JSON,
            )
        )

    collection.item_assets = {
        "visual": ItemAssetDefinition.create(
            title="Visual image",
            description="Imagery data formatted for visualization (RGB)",
            media_type=MediaType.COG,
            roles=["data"],
        )
    }

    # Add render extension
    collection.ext.add("render")
    render = RenderExtension.ext(collection)
    render.apply(
        {
            "visual": Render.create(
                assets=[
                    "visual",
                ],
                title="Imagery data formatted for visualization (RGB)",
            )
        }
    )

    collection.validate()

    return collection


def create_item(item: Item) -> Item:
    """Rewrite Maxar STAC Item."""
    oam_item = item.clone()
    oam_item.set_collection(None)

    # The ID is unique but contains "/" that interfere with access via API
    oam_item.id = item.id.replace("/", "-")

    # This Item is in an ARD tile sub-Collection. The "title" we want to use
    # is from the parent of the ARD tile Collection which is organized based
    # on the "event"
    if (item_parent := item.get_collection()) is None:
        raise ValueError(f"Cannot get parent collection for Item={item.id}")

    if (event_collection := item_parent.get_parent()) is None:
        raise ValueError(f"Cannot get parent collection for Item={item.id}")

    # Vantor uses absolute HREFs now
    # oam_item.make_asset_hrefs_absolute()

    # Add some OAM properties
    oam_item.properties["oam:producer_name"] = "Vantor"
    oam_item.properties["oam:platform_type"] = "satellite"
    oam_item.properties["title"] = item.properties["title"]

    # Clear existing links and add DERIVED_FROM
    oam_item.clear_links()
    if item_href := item.get_self_href():
        oam_item.add_link(
            Link(
                rel=RelType.DERIVED_FROM,
                target=item_href,
                media_type=MediaType.JSON,
            )
        )

    add_alternate_assets(oam_item)

    oam_item.stac_extensions.append(
        OAM_EXTENSION_SCHEMA_URI_PATTERN.format(version=OAM_EXTENSION_DEFAULT_VERSION)
    )

    register_oam_extension_schemas()

    return oam_item
