from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import generate


class FakeReader:
    def __init__(self, *args, **kwargs):
        self._bounds = (-10.0, -10.0, 10.0, 10.0)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def get_geographic_bounds(self, _: object):
        return self._bounds


@pytest.fixture
def tmp_mbtiles_path(tmp_path: Path) -> Path:
    return tmp_path / "test.mbtiles"


def test_generate_mbtiles_raises_on_unexpected_failures(
    monkeypatch, tmp_mbtiles_path: Path
):
    monkeypatch.setattr(generate, "Reader", FakeReader)

    def fake_render_tile(cog_url: str, x: int, y: int, z: int):
        if (x, y, z) == (0, 0, 0):
            return "failed", None
        return "ok", b"png-bytes"

    monkeypatch.setattr(generate, "_render_tile", fake_render_tile)
    monkeypatch.setattr(
        generate,
        "tile_ranges",
        # x=0..1 and y=0 yields two tiles total for this mocked range.
        lambda bounds, min_z, max_z: [(0, 0, 1, 0, 0)],
    )

    with pytest.raises(RuntimeError, match="unexpected tile render failures"):
        generate.generate_mbtiles(
            "https://example.test/cog.tif", tmp_mbtiles_path, 0, 0
        )

    assert not tmp_mbtiles_path.exists()


def test_generate_mbtiles_skips_outside_bounds(monkeypatch, tmp_mbtiles_path: Path):
    monkeypatch.setattr(generate, "Reader", FakeReader)

    def fake_render_tile(cog_url: str, x: int, y: int, z: int):
        if (x, y, z) == (0, 0, 0):
            return "outside", None
        return "ok", b"png-bytes"

    monkeypatch.setattr(generate, "_render_tile", fake_render_tile)
    monkeypatch.setattr(
        generate,
        "tile_ranges",
        # x=0..1 and y=0 yields two tiles total for this mocked range.
        lambda bounds, min_z, max_z: [(0, 0, 1, 0, 0)],
    )

    generate.generate_mbtiles("https://example.test/cog.tif", tmp_mbtiles_path, 0, 0)

    with sqlite3.connect(tmp_mbtiles_path) as conn:
        rows = conn.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
    assert rows == 1


def test_generate_mbtiles_succeeds_for_all_ok_tiles(
    monkeypatch, tmp_mbtiles_path: Path
):
    monkeypatch.setattr(generate, "Reader", FakeReader)

    def fake_render_tile(cog_url: str, x: int, y: int, z: int):
        return "ok", b"png-bytes"

    monkeypatch.setattr(generate, "_render_tile", fake_render_tile)
    monkeypatch.setattr(
        generate,
        "tile_ranges",
        # x=0..1 and y=0 yields two tiles total for this mocked range.
        lambda bounds, min_z, max_z: [(0, 0, 1, 0, 0)],
    )

    generate.generate_mbtiles("https://example.test/cog.tif", tmp_mbtiles_path, 0, 0)

    with sqlite3.connect(tmp_mbtiles_path) as conn:
        rows = conn.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
    assert rows == 2


def test_main_does_not_upload_or_patch_after_generation_failure(
    monkeypatch, tmp_path: Path
):
    monkeypatch.setenv("STAC_ITEM_ID", "item-123")
    monkeypatch.setenv("FORMAT", "mbtiles")
    monkeypatch.setenv("COG_URL", "https://example.test/cog.tif")
    monkeypatch.setenv("OUTPUT_KEY", "tilepacks/item-123.mbtiles")
    monkeypatch.setenv("LOCK_KEY", "tilepacks/item-123.lock")
    monkeypatch.setenv("MIN_ZOOM", "0")
    monkeypatch.setenv("MAX_ZOOM", "0")
    monkeypatch.setenv("CANONICAL", "true")
    monkeypatch.setenv("GSD", "1")
    monkeypatch.setenv("S3_BUCKET", "example-bucket")
    monkeypatch.setenv("S3_PUBLIC_BASE_URL", "https://cdn.example.test")
    monkeypatch.setenv("INTERNAL_BASE_URL", "https://internal.example.test")
    monkeypatch.setenv("INTERNAL_TOKEN", "token")

    upload_calls = []
    patch_calls = []

    def fake_generate_mbtiles(*args, **kwargs):
        raise RuntimeError("unexpected tile render failures")

    monkeypatch.setattr(generate, "generate_mbtiles", fake_generate_mbtiles)
    monkeypatch.setattr(
        generate, "upload", lambda *args, **kwargs: upload_calls.append(args)
    )
    monkeypatch.setattr(
        generate, "_patch_asset", lambda *args, **kwargs: patch_calls.append(args)
    )
    monkeypatch.setattr(generate, "delete_lock", lambda *args, **kwargs: None)

    with pytest.raises(RuntimeError, match="unexpected tile render failures"):
        generate.main()

    assert upload_calls == []
    assert patch_calls == []
