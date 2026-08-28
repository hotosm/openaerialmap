"""Tests for `stactools.hotosm.opendata` module.

The catalog walking tests are adapted from Hidenori FUJIMURA's external STAC
harvester branch, https://github.com/hfu/openaerialmap/tree/add-external-stac-harvester.
"""

import datetime as dt
import json
from pathlib import Path
from unittest.mock import patch

import pystac
import pytest
from pystac import Provider, ProviderRole

from stactools.hotosm.constants import (
    OAM_EXTENSION_DEFAULT_VERSION,
    OAM_EXTENSION_SCHEMA_URI_PATTERN,
)
from stactools.hotosm.opendata import (
    OpenDataCatalog,
    create_item,
    item_timestamp,
    walk_new_items,
)
from stactools.hotosm.stac_common import ALTERNATE_ASSETS_SCHEMA

OAM_EXTENSION = OAM_EXTENSION_SCHEMA_URI_PATTERN.format(
    version=OAM_EXTENSION_DEFAULT_VERSION
)

CATALOG_URL = "https://example.org/catalog.json"
AFTER = dt.datetime(2020, 1, 1, tzinfo=dt.UTC)


def _item(id_: str, **properties: object) -> pystac.Item:
    """Build a minimal STAC Item."""
    return pystac.Item(
        id=id_,
        geometry={
            "type": "Polygon",
            "coordinates": [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
        },
        bbox=[0, 0, 1, 1],
        datetime=dt.datetime(2019, 6, 1, tzinfo=dt.UTC),
        properties=dict(properties),
    )


def _catalog(*items: pystac.Item) -> pystac.Catalog:
    """Build a root Catalog linking Items directly."""
    catalog = pystac.Catalog(id="source", description="A provider's root Catalog.")
    for item in items:
        catalog.add_item(item)
    return catalog


def _collection(id_: str, *items: pystac.Item) -> pystac.Collection:
    """Build a child Collection linking Items."""
    collection = pystac.Collection(
        id=id_,
        description="A nested Collection.",
        extent=pystac.Extent(
            pystac.SpatialExtent([[0.0, 0.0, 1.0, 1.0]]),
            pystac.TemporalExtent([[AFTER, None]]),
        ),
    )
    for item in items:
        collection.add_item(item)
    return collection


def _catalog_model(**kwargs) -> OpenDataCatalog:
    """Build a provider catalog model for testing."""
    return OpenDataCatalog(
        key="Test",
        collection_id="test-opendata",
        collection_description="A test catalog.",
        catalog_url=CATALOG_URL,
        producer_name="Test Producer",
        platform_type="satellite",
        providers=[
            Provider(
                name="Test Producer",
                roles=[ProviderRole.LICENSOR, ProviderRole.PRODUCER],
            )
        ],
        **kwargs,
    )


class TestItemTimestamp:
    """Test parsing a timestamp property off an Item."""

    @pytest.mark.parametrize(
        "value,expected",
        [
            ("2021-01-01T00:00:00Z", dt.datetime(2021, 1, 1, tzinfo=dt.UTC)),
            ("2021-01-01T00:00:00+00:00", dt.datetime(2021, 1, 1, tzinfo=dt.UTC)),
            # Naive values are read as UTC rather than rejected.
            ("2021-01-01T00:00:00", dt.datetime(2021, 1, 1, tzinfo=dt.UTC)),
            (
                "2021-01-01T00:00:00+09:00",
                dt.datetime(2021, 1, 1, tzinfo=dt.timezone(dt.timedelta(hours=9))),
            ),
            ("not a date", None),
            (None, None),
            (12345, None),
        ],
    )
    def test_parses_a_timestamp_property(self, value, expected):
        """Parse the usable values and reject the rest without raising."""
        properties = {} if value is None else {"published": value}

        assert item_timestamp(_item("foo", **properties), "published") == expected


class TestWalkNewItems:
    """Test walking a provider's static STAC catalog."""

    @patch("pystac.read_file")
    def test_yields_every_item_by_default(self, mock_read_file):
        """Without a declared timestamp property, nothing is filtered out."""
        mock_read_file.return_value = _catalog(
            _item("old", created="2019-01-01T00:00:00+00:00"),
            _item("new", created="2021-01-01T00:00:00+00:00"),
        )

        items = list(walk_new_items(CATALOG_URL, pystac.StacIO.default(), AFTER))

        assert [item.id for item in items] == ["old", "new"]

    @patch("pystac.read_file")
    def test_created_is_not_an_implicit_cursor(self, mock_read_file):
        """A newly published historical Item keeps its old `created`.

        Filtering on `created` by default would drop it for good, since
        `created` is when the metadata was written, not when the provider
        published it here.
        """
        mock_read_file.return_value = _catalog(
            _item("backfilled", created="2010-01-01T00:00:00+00:00")
        )

        items = list(walk_new_items(CATALOG_URL, pystac.StacIO.default(), AFTER))

        assert [item.id for item in items] == ["backfilled"]

    @patch("pystac.read_file")
    def test_filters_on_a_declared_timestamp_property(self, mock_read_file):
        """A provider documenting a publication property gets incremental walks."""
        mock_read_file.return_value = _catalog(
            _item("old", published="2019-01-01T00:00:00+00:00"),
            _item("new", published="2021-01-01T00:00:00+00:00"),
        )

        items = list(
            walk_new_items(
                CATALOG_URL,
                pystac.StacIO.default(),
                AFTER,
                timestamp_property="published",
            )
        )

        assert [item.id for item in items] == ["new"]

    @patch("pystac.read_file")
    def test_yields_items_missing_a_declared_property(self, mock_read_file):
        """An Item with nothing to filter on is surfaced rather than dropped."""
        mock_read_file.return_value = _catalog(_item("undated"))

        items = list(
            walk_new_items(
                CATALOG_URL,
                pystac.StacIO.default(),
                AFTER,
                timestamp_property="published",
            )
        )

        assert [item.id for item in items] == ["undated"]

    def test_walks_a_catalog_of_linked_documents(self, tmp_path: Path):
        """Follow real relative links on disk, not a preassembled object tree."""
        catalog = _catalog(_item("root-item"))
        catalog.add_child(_collection("child", _item("nested-item")))
        catalog.normalize_hrefs(str(tmp_path))
        catalog.save(catalog_type=pystac.CatalogType.SELF_CONTAINED)

        items = list(
            walk_new_items(
                str(tmp_path / "catalog.json"), pystac.StacIO.default(), AFTER
            )
        )

        assert sorted(item.id for item in items) == ["nested-item", "root-item"]

    def test_repeated_ids_across_collections_all_survive_the_walk(self, tmp_path: Path):
        """STAC scopes Item IDs to a Collection, so a walk can see an ID twice.

        Resolving that belongs downstream, where the provider's Items are
        flattened into one OAM Collection - the walk must not hide it.
        """
        catalog = _catalog()
        catalog.add_child(_collection("first", _item("image-001")))
        catalog.add_child(_collection("second", _item("image-001")))
        catalog.normalize_hrefs(str(tmp_path))
        catalog.save(catalog_type=pystac.CatalogType.SELF_CONTAINED)

        items = list(
            walk_new_items(
                str(tmp_path / "catalog.json"), pystac.StacIO.default(), AFTER
            )
        )

        assert [item.id for item in items] == ["image-001", "image-001"]

    def test_deduplicates_one_item_linked_twice(self, tmp_path: Path):
        """A catalog linking an Item directly and via a child yields it once."""
        (tmp_path / "child").mkdir()
        item = _item("shared")
        item.set_self_href(str(tmp_path / "child" / "item.json"))
        pystac.write_file(item, dest_href=str(tmp_path / "child" / "item.json"))
        (tmp_path / "child" / "collection.json").write_text(
            json.dumps(
                {
                    "type": "Collection",
                    "stac_version": "1.1.0",
                    "id": "child",
                    "description": "A nested Collection linking the Item.",
                    "license": "CC-BY-4.0",
                    "extent": {
                        "spatial": {"bbox": [[0.0, 0.0, 1.0, 1.0]]},
                        "temporal": {"interval": [["2020-01-01T00:00:00Z", None]]},
                    },
                    "links": [
                        {"rel": "root", "href": "../catalog.json"},
                        {"rel": "parent", "href": "../catalog.json"},
                        {"rel": "item", "href": "./item.json"},
                    ],
                }
            )
        )
        (tmp_path / "catalog.json").write_text(
            json.dumps(
                {
                    "type": "Catalog",
                    "stac_version": "1.1.0",
                    "id": "source",
                    "description": "A root Catalog linking the Item both ways.",
                    "links": [
                        {"rel": "child", "href": "./child/collection.json"},
                        {"rel": "item", "href": "./child/item.json"},
                    ],
                }
            )
        )

        items = list(
            walk_new_items(
                str(tmp_path / "catalog.json"), pystac.StacIO.default(), AFTER
            )
        )

        assert [item.id for item in items] == ["shared"]

    @patch("pystac.read_file")
    def test_rejects_a_url_that_is_not_a_catalog(self, mock_read_file):
        """A URL pointing at something other than a Catalog fails loudly."""
        mock_read_file.return_value = _item("lonely")

        with pytest.raises(TypeError, match="Expected a STAC Catalog"):
            list(walk_new_items(CATALOG_URL, pystac.StacIO.default(), AFTER))


class TestFindNewItems:
    """Test how a catalog finds its new Items."""

    @patch("pystac.read_file")
    def test_walks_the_catalog_by_default(self, mock_read_file):
        """A provider supplying no `new_stac_items` gets the generic walk."""
        mock_read_file.return_value = _catalog(_item("found"))

        items = list(
            _catalog_model().find_new_items(pystac.StacIO.default(), None, AFTER)
        )

        assert [item.id for item in items] == ["found"]

    def test_prefers_a_provider_specific_walk(self):
        """A provider supplying `new_stac_items` keeps control of the traversal."""
        catalog = _catalog_model(
            new_stac_items=lambda _stac_io, _session, _after: iter([_item("bespoke")])
        )

        items = list(catalog.find_new_items(pystac.StacIO.default(), None, AFTER))

        assert [item.id for item in items] == ["bespoke"]

    def test_catalog_ids_are_optional(self):
        """A provider with no acquisition IDs summarises nothing."""
        assert _catalog_model().find_catalog_ids(None) is None


class TestCreateItem:
    """Test rewriting a provider Item as an OAM Item."""

    def test_rewrites_a_compliant_item(self):
        """An Item carrying the OAM requirements needs no `prepare_item`."""
        item = _item("compliant", gsd=0.5, license="CC-BY-4.0")

        oam_item = create_item(_catalog_model(), item)

        assert oam_item.properties["oam:producer_name"] == "Test Producer"
        assert oam_item.properties["oam:platform_type"] == "satellite"

    def test_source_already_declaring_the_extensions(self):
        """An Item declaring what we add keeps one copy, not two."""
        item = _item("already-oam", gsd=0.5, license="CC-BY-4.0")
        item.stac_extensions = [OAM_EXTENSION, ALTERNATE_ASSETS_SCHEMA]

        oam_item = create_item(_catalog_model(), item)

        assert oam_item.stac_extensions.count(OAM_EXTENSION) == 1
        assert oam_item.stac_extensions.count(ALTERNATE_ASSETS_SCHEMA) == 1

    def test_source_declaring_an_older_extension_version(self):
        """An older OAM version is replaced: its schema rejects newer fields."""
        item = _item("old-oam", gsd=0.5, license="CC-BY-4.0")
        item.stac_extensions = [
            OAM_EXTENSION_SCHEMA_URI_PATTERN.format(version="0.1.0")
        ]

        oam_item = create_item(_catalog_model(), item)

        assert [uri for uri in oam_item.stac_extensions if "hotosm.org/oam" in uri] == [
            OAM_EXTENSION
        ]

    def test_rejects_an_item_missing_oam_requirements(self):
        """Core STAC compliance is not OAM compliance: `gsd` is still required."""
        item = _item("no-gsd", license="CC-BY-4.0")

        with pytest.raises(pystac.errors.STACValidationError):
            create_item(_catalog_model(), item)
