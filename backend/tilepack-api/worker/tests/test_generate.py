from __future__ import annotations

import os
import signal
import sqlite3
import sys
import threading
import time
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
    render_calls = []

    def fake_render_tile(cog_url: str, x: int, y: int, z: int):
        render_calls.append((x, y, z))
        if (x, y, z) == (0, 0, 0):
            return "failed", None
        return "ok", b"png-bytes"

    monkeypatch.setattr(generate, "_render_tile", fake_render_tile)
    monkeypatch.setattr(
        generate,
        "tile_ranges",
        lambda bounds, min_z, max_z: [
            (0, 0, 0, 0, 0),
            (1, 0, 0, 0, 0),
        ],
    )

    with pytest.raises(RuntimeError, match="unexpected tile render failure"):
        generate.generate_mbtiles(
            "https://example.test/cog.tif", tmp_mbtiles_path, 0, 0
        )

    assert render_calls == [(0, 0, 0), (0, 0, 0)]
    assert not tmp_mbtiles_path.exists()


def test_generate_mbtiles_retries_failed_tile_and_writes_on_success(
    monkeypatch, tmp_mbtiles_path: Path
):
    monkeypatch.setattr(generate, "Reader", FakeReader)
    render_calls = []

    def fake_render_tile(cog_url: str, x: int, y: int, z: int):
        render_calls.append((x, y, z))
        if len(render_calls) == 1:
            return "failed", None
        return "ok", b"png-bytes"

    monkeypatch.setattr(generate, "_render_tile", fake_render_tile)
    monkeypatch.setattr(
        generate,
        "tile_ranges",
        lambda bounds, min_z, max_z: [(0, 0, 0, 0, 0)],
    )

    generate.generate_mbtiles("https://example.test/cog.tif", tmp_mbtiles_path, 0, 0)

    assert render_calls == [(0, 0, 0), (0, 0, 0)]
    with sqlite3.connect(tmp_mbtiles_path) as conn:
        rows = conn.execute("SELECT COUNT(*) FROM tiles").fetchone()[0]
    assert rows == 1


def test_generate_mbtiles_skips_outside_bounds(monkeypatch, tmp_mbtiles_path: Path):
    monkeypatch.setattr(generate, "Reader", FakeReader)
    render_calls = []

    def fake_render_tile(cog_url: str, x: int, y: int, z: int):
        render_calls.append((x, y, z))
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

    assert len(render_calls) == 2
    assert sorted(render_calls) == [(0, 0, 0), (1, 0, 0)]
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


@pytest.fixture
def clean_stop_rendering_flag():
    """Keep the module-level flag from leaking between tests."""
    generate._stop_rendering.clear()
    try:
        yield generate._stop_rendering
    finally:
        generate._stop_rendering.clear()


def test_render_tile_returns_cancelled_once_stop_rendering_is_set(
    clean_stop_rendering_flag,
):
    """Queued tiles must retire without touching the COG - tens of
    thousands may be submitted, and each has to cost nothing."""

    def explode(_cog_url):
        raise AssertionError("must not open a reader while shutting down")

    original = generate._get_thread_reader
    generate._get_thread_reader = explode
    try:
        clean_stop_rendering_flag.set()
        assert generate._render_tile("https://example.test/cog.tif", 0, 0, 0) == (
            "cancelled",
            None,
        )
    finally:
        generate._get_thread_reader = original


def test_generate_mbtiles_aborts_on_cancelled_tile(
    monkeypatch, tmp_mbtiles_path: Path, clean_stop_rendering_flag
):
    """A cancelled tile must abort, not INSERT png=None."""
    monkeypatch.setattr(generate, "Reader", FakeReader)
    monkeypatch.setattr(
        generate,
        "tile_ranges",
        lambda bounds, min_z, max_z: [(0, 0, 0, 0, 0)],
    )

    def cancelled_tile(cog_url: str, x: int, y: int, z: int):
        return "cancelled", None

    monkeypatch.setattr(generate, "_render_tile", cancelled_tile)
    clean_stop_rendering_flag.set()

    with pytest.raises(generate.Terminated):
        generate.generate_mbtiles(
            "https://example.test/cog.tif", tmp_mbtiles_path, 0, 0
        )

    assert not tmp_mbtiles_path.exists()


def test_install_signal_handlers_raises_terminated_in_main_thread(
    clean_stop_rendering_flag,
):
    """SIGTERM must raise, and set the flag first.

    The worker is PID 1, where an untrapped SIGTERM is ignored outright,
    so without this the lock is never released on a deadline kill.
    """
    previous = signal.getsignal(signal.SIGTERM)
    try:
        generate._install_signal_handlers()
        with pytest.raises(generate.Terminated, match="SIGTERM"):
            os.kill(os.getpid(), signal.SIGTERM)
        assert clean_stop_rendering_flag.is_set(), (
            "the flag must be set before the exception unwinds, so tile "
            "threads are already retiring"
        )
    finally:
        signal.signal(signal.SIGTERM, previous)


def test_generate_mbtiles_aborts_when_encoded_bytes_exceed_budget(
    monkeypatch, tmp_mbtiles_path: Path
):
    """The byte budget keeps a run inside ephemeral storage; a tile
    count cannot, since bytes-per-tile spans 15-78 KiB."""
    monkeypatch.setattr(generate, "Reader", FakeReader)
    monkeypatch.setattr(generate, "MAX_ENCODED_BYTES", 2_000)
    monkeypatch.setattr(
        generate,
        "tile_ranges",
        lambda bounds, min_z, max_z: [(0, 0, 3, 0, 3)],
    )
    monkeypatch.setattr(
        generate,
        "_render_tile",
        lambda cog_url, x, y, z: ("ok", b"x" * 1_000),
    )

    with pytest.raises(SystemExit, match="MAX_ENCODED_BYTES"):
        generate.generate_mbtiles(
            "https://example.test/cog.tif", tmp_mbtiles_path, 0, 0
        )

    assert not tmp_mbtiles_path.exists()


def test_aborting_a_run_cancels_the_queued_tiles(
    monkeypatch, tmp_mbtiles_path: Path, clean_stop_rendering_flag
):
    """An abort must drop the rest of the level, not render it anyway.

    Waiting would render a failed run to completion and pin every PNG in
    its future - an OOM on a large level.
    """
    monkeypatch.setattr(generate, "Reader", FakeReader)
    monkeypatch.setattr(generate, "MAX_ENCODED_BYTES", 2_000)
    monkeypatch.setattr(
        generate,
        "tile_ranges",
        lambda bounds, min_z, max_z: [(0, 0, 19, 0, 19)],  # 400 tiles
    )

    executed = []
    executed_lock = threading.Lock()

    def counting_tile(cog_url: str, x: int, y: int, z: int):
        if generate._stop_rendering.is_set():
            return "cancelled", None
        with executed_lock:
            executed.append((x, y, z))
        time.sleep(0.02)  # so the abort lands while most are still queued
        return "ok", b"x" * 1_000

    monkeypatch.setattr(generate, "_render_tile", counting_tile)

    with pytest.raises(SystemExit, match="MAX_ENCODED_BYTES"):
        generate.generate_mbtiles(
            "https://example.test/cog.tif", tmp_mbtiles_path, 0, 0
        )

    # Budget trips after 2 tiles; only running threads should get
    # through. Loose bound to avoid flakiness - the old code ran all 400.
    assert len(executed) < 200, (
        f"{len(executed)}/400 queued tiles ran after the abort; "
        "queued work is not being cancelled"
    )


def test_oversized_existing_mbtiles_is_refused(monkeypatch, tmp_path):
    """Archives predating the byte budget can exceed ephemeral storage."""
    monkeypatch.setattr(generate, "MAX_ENCODED_BYTES", 1_000)
    monkeypatch.setattr(generate, "s3_object_size", lambda bucket, key: 5_000)

    def must_not_download(*args, **kwargs):
        raise AssertionError("download attempted despite the size check")

    monkeypatch.setattr(generate, "download", must_not_download)
    monkeypatch.setattr(generate, "delete_lock", lambda *a: None)
    for key, value in {
        "STAC_ITEM_ID": "item",
        "FORMAT": "pmtiles",
        "COG_URL": "https://example.test/x.tif",
        "OUTPUT_KEY": "a/0/b.pmtiles",
        "LOCK_KEY": "a/0/b.pmtiles.lock",
        "MIN_ZOOM": "0",
        "MAX_ZOOM": "6",
        "CANONICAL": "false",
        "GSD": "0.05",
        "S3_BUCKET": "bucket",
        "INTERNAL_BASE_URL": "http://x",
        "INTERNAL_TOKEN": "t",
    }.items():
        monkeypatch.setenv(key, value)

    with pytest.raises(SystemExit, match="MAX_ENCODED_BYTES"):
        generate.main()
