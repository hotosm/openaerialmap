"""Rewrite third-party STAC catalogs for OAM."""

import datetime as dt
import logging
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

from stactools.hotosm.oam_extension import (
    register_oam_extension_schemas,
    set_oam_extension,
)
from stactools.hotosm.stac_common import add_alternate_assets

logger = logging.getLogger(__name__)

VISUAL_ASSET_DESCRIPTION = "Imagery data formatted for visualization (RGB)"

PrepareItem = Callable[[Item, Item], None]
NewStacItems = Callable[[pystac.StacIO, requests.Session, dt.datetime], Iterator[Item]]
AllCatalogIds = Callable[[requests.Session], Iterator[str]]
TargetItemId = Callable[[str], str]


def item_timestamp(item: Item, property_name: str) -> dt.datetime | None:
    """Parse an Item timestamp property, treating naive values as UTC."""
    value = item.properties.get(property_name)
    if not isinstance(value, str):
        return None

    try:
        parsed = dt.datetime.fromisoformat(value)
    except ValueError:
        logger.warning("Cannot parse %r=%r for Item=%s", property_name, value, item.id)
        return None

    return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.UTC)


def deduplicate_items(items: Iterable[Item]) -> Iterator[Item]:
    """Yield each source document once.

    Identity is where the Item lives, so a catalog linking one Item both
    directly and through a child Collection yields it once. Two Items sharing
    an ID but not an HREF are distinct records - STAC only scopes an ID to its
    Collection - so both are yielded for the ingest to resolve or reject rather
    than being silently collapsed here.
    """
    seen: set[str] = set()
    for item in items:
        identity = item.get_self_href() or item.id
        if identity in seen:
            continue
        seen.add(identity)
        yield item


def walk_new_items(
    catalog_url: str,
    stac_io: pystac.StacIO,
    after: dt.datetime,
    timestamp_property: str | None = None,
) -> Iterator[Item]:
    """Yield a provider's Items by walking its static STAC catalog.

    Follows the provider's own child Catalog/Collection and Item links from the
    root, so a provider publishing spec-compliant STAC needs no bespoke crawling
    code. Reading every Item is the price of that: use `new_stac_items` for a
    provider large enough to need an index, manifest or API to subset with.

    Yields the provider's whole inventory unless `timestamp_property` names a
    property meaning "published in this catalog", which no STAC field is
    guaranteed to be. In particular `created` is when the *metadata* was
    written, so a provider adding a historical Item publishes it with an old
    `created` and filtering on it would drop the Item for good. Callers subset
    by reconciling against the Items already ingested instead.

    Items missing a declared timestamp are yielded rather than dropped: there is
    nothing to filter them on, and a provider omitting it is a data problem
    worth surfacing.
    """
    root = pystac.read_file(catalog_url, stac_io=stac_io)
    if not isinstance(root, Catalog):
        raise TypeError(f"Expected a STAC Catalog or Collection at {catalog_url}")

    for item in deduplicate_items(root.get_items(recursive=True)):
        if timestamp_property is None:
            yield item
            continue

        timestamp = item_timestamp(item, timestamp_property)
        if timestamp is None:
            logger.warning(
                "Item without a usable %r property: %s", timestamp_property, item.id
            )
            yield item
        elif timestamp >= after:
            yield item


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

    # A provider whose Items already satisfy the OAM extension, and whose
    # catalog is small enough to walk, needs none of these.
    prepare_item: PrepareItem | None = None
    new_stac_items: NewStacItems | None = None
    all_catalog_ids: AllCatalogIds | None = None
    target_item_id: TargetItemId | None = None
    # Only set this to a property the provider documents as "published here".
    timestamp_property: str | None = None

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

    def find_new_items(
        self,
        stac_io: pystac.StacIO,
        session: requests.Session,
        after: dt.datetime,
    ) -> Iterator[Item]:
        """Yield the provider's Items added since a date."""
        if self.new_stac_items is not None:
            yield from self.new_stac_items(stac_io, session, after)
        else:
            yield from walk_new_items(
                self.catalog_url, stac_io, after, self.timestamp_property
            )

    def find_catalog_ids(self, session: requests.Session) -> Iterator[str] | None:
        """Yield acquisition IDs for the Collection summary, if there are any."""
        if self.all_catalog_ids is None:
            return None
        return self.all_catalog_ids(session)


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

    if catalog.prepare_item is not None:
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

    set_oam_extension(oam_item)

    register_oam_extension_schemas()

    # Declaring the extension is not the same as satisfying it: a provider that
    # publishes no `gsd` needs a `prepare_item` supplying one.
    oam_item.validate()

    return oam_item
