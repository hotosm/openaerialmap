"""Test the footprint GeoParquet and the PMTiles tylertoo builds from it."""

from unittest.mock import MagicMock

import gen_coverage_vector as gen
import pyarrow.parquet as pq
from pmtiles.reader import MmapSource, Reader
from shapely.geometry import box


def _item(item_id: str, size: float = 0.01, **properties) -> tuple:
    """A PgSTAC row: id, collection, WKB geometry, hydrated content."""
    content = {
        "properties": {"title": item_id, **properties},
        "assets": {"visual": {"href": f"https://example.com/{item_id}.tif"}},
    }
    return item_id, "openaerialmap", box(10, 10, 10 + size, 10 + size).wkb, content


def _run_footprints(monkeypatch, tmp_path, rows: list[tuple]) -> None:
    cursor = MagicMock()
    cursor.__enter__.return_value.__iter__.return_value = iter(rows)
    conn = MagicMock()
    conn.__enter__.return_value.cursor.return_value = cursor
    monkeypatch.setattr(gen, "connect", lambda _dsn: conn)
    for name, filename in [
        ("OUTPUT_FOOTPRINTS_PARQUET", "data.parquet"),
        ("OUTPUT_FOOTPRINTS_OVERVIEW", "overview.parquet"),
        ("OUTPUT_FOOTPRINTS_PMTILES", "data.pmtiles"),
    ]:
        monkeypatch.setattr(gen, name, str(tmp_path / filename))

    gen.get_footprint_features()
    gen.footprints_to_pmtiles()


def test_footprints_keep_properties_only_some_items_have(monkeypatch, tmp_path):
    """Columns are the union of keys, so an owner on one Item is not lost."""
    rows = [_item("a"), _item("b", **{"oam:owner_id": "hotosm|1"})]

    _run_footprints(monkeypatch, tmp_path, rows)

    table = pq.read_table(tmp_path / "data.parquet")
    assert table.column("owner_id").to_pylist() == [None, "hotosm|1"]
    assert b"geo" in table.schema.metadata


def test_footprints_archive_has_the_browser_layer(monkeypatch, tmp_path):
    """The frontend reads the `globalcoverage` layer up to ZOOM_MAX."""
    _run_footprints(monkeypatch, tmp_path, [_item("a")])

    with open(tmp_path / "data.pmtiles", "rb") as f:
        reader = Reader(MmapSource(f))
        header = reader.header()
        layers = reader.metadata()["vector_layers"]

    assert [layer["id"] for layer in layers] == ["globalcoverage"]
    assert "owner_id" not in layers[0]["fields"]
    assert header["max_zoom"] == gen.ZOOM_MAX


def test_small_footprint_is_kept_at_every_zoom(monkeypatch, tmp_path):
    """A ~110 m drone footprint must stay discoverable in the sidebar."""
    _run_footprints(monkeypatch, tmp_path, [_item("a", size=0.001)])

    overview = pq.read_table(tmp_path / "overview.parquet")
    levels = set(overview.column("level").to_pylist())
    assert len(levels) == gen.ZOOM_MAX - gen.ZOOM_MIN + 1
