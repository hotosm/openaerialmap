"""Rewrite third-party STAC catalogs for OAM."""

import datetime as dt
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable, Iterator

import pystac
import requests
from pystac import (
    Catalog,
    Collection,
    Extent,
    Item,
    Link,
    MediaType,
    Provider,
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

VISUAL_ASSET_DESCRIPTION = "Imagery data formatted for visualization (RGB)"

PrepareItem = Callable[[Item, Item], None]
NewStacItems = Callable[[pystac.StacIO, requests.Session, dt.datetime], Iterator[Item]]
AllCatalogIds = Callable[[requests.Session], Iterator[str]]


def _default_item_assets() -> dict[str, ItemAssetDefinition]:
    return {
        "visual": ItemAssetDefinition.create(
            title="Visual image",
            description=VISUAL_ASSET_DESCRIPTION,
            media_type=MediaType.COG,
            roles=["data"],
        )
    }


@dataclass
class OpenDataCatalog:
    """Describe a third-party STAC catalog."""

    key: str
    collection_id: str
    collection_description: str
    catalog_url: str
    producer_name: str
    platform_type: str
    providers: list[Provider]
    prepare_item: PrepareItem
    new_stac_items: NewStacItems
    all_catalog_ids: AllCatalogIds

    product_type: str = "visual"
    item_assets: dict[str, ItemAssetDefinition] = field(
        default_factory=_default_item_assets
    )

    def read_catalog(self, stac_io: pystac.StacIO | None = None) -> Catalog:
        """Read the provider's root STAC Catalog."""
        catalog = pystac.read_file(self.catalog_url, stac_io=stac_io)
        if not isinstance(catalog, Catalog):
            raise TypeError(f"Expected a STAC Catalog at {self.catalog_url}")
        return catalog


def create_collection(
    catalog: OpenDataCatalog,
    root: Catalog,
    temporal_extent_start: dt.datetime | None = None,
    temporal_extent_end: dt.datetime | None = None,
    catalog_ids: Iterable[str] | None = None,
) -> Collection:
    """Rewrite a provider Catalog as an OAM Collection."""
    collection = Collection(
        id=catalog.collection_id,
        title=root.description,
        description=catalog.collection_description,
        extent=Extent(
            spatial=SpatialExtent([[-180.0, -90.0, 180.0, 90.0]]),
            temporal=TemporalExtent([temporal_extent_start, temporal_extent_end]),
        ),
        license=root.extra_fields["license"],
        providers=catalog.providers,
    )

    if catalog_ids is not None:
        unique_catalog_ids = sorted(set(catalog_ids))
        # PySTAC drops summary lists longer than maxcount.
        collection.summaries = Summaries(
            {"catalog_id": unique_catalog_ids},
            maxcount=len(unique_catalog_ids) + 1,
        )

    if catalog_self_link := root.get_self_href():
        collection.add_link(
            Link(
                rel=RelType.DERIVED_FROM,
                target=catalog_self_link,
                media_type=MediaType.JSON,
            )
        )

    # PySTAC accepts a wider value type than this catalog model.
    item_assets: dict[str, ItemAssetDefinition | dict[str, Any]] = dict(
        catalog.item_assets
    )
    collection.item_assets = item_assets

    collection.ext.add("render")
    render = RenderExtension.ext(collection)
    render.apply(
        {
            "visual": Render.create(
                assets=[
                    "visual",
                ],
                title=VISUAL_ASSET_DESCRIPTION,
            )
        }
    )

    collection.validate()

    return collection


def create_item(catalog: OpenDataCatalog, item: Item) -> Item:
    """Rewrite a provider STAC Item as an OAM STAC Item."""
    oam_item = item.clone()
    oam_item.set_collection(None)

    catalog.prepare_item(oam_item, item)

    oam_item.properties.setdefault("oam:producer_name", catalog.producer_name)
    oam_item.properties.setdefault("oam:platform_type", catalog.platform_type)
    oam_item.properties.setdefault("oam:product_type", catalog.product_type)
    oam_item.properties.setdefault("oam:product_type_source", "declared")

    # Cards use the first provider for attribution.
    oam_item.common_metadata.providers = catalog.providers

    # Item.clone drops root-level fields such as license.
    if license_ := item.extra_fields.get("license"):
        oam_item.properties.setdefault("license", license_)

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
