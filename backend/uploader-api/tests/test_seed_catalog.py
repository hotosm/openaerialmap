"""The seeder's failure handling.

Staging once held ~12GiB of copied imagery and an empty catalogue: two
oversized GeoTIFFs failed, and the seeder returned before writing anything.
"""

import importlib
import os
import sys
import urllib.error

import pytest

SEED_ENV = {
    "SEED_STAC_URL": "https://api.example.org/stac",
    "SEED_SRC_BUCKET": "src-bucket",
    "SEED_SRC_ASSET_BASE_URL": "https://src-bucket.s3.example.org",
    "SEED_COLLECTION": "openaerialmap",
    "S3_BUCKET": "dst-bucket",
    "PUBLIC_ASSET_BASE_URL": "https://s3.stage.example.org/dst-bucket",
}


@pytest.fixture
def seed(monkeypatch):
    """The seeder module, imported against a known environment."""
    for key, value in SEED_ENV.items():
        monkeypatch.setenv(key, value)
    sys.modules.pop("seed_catalog", None)
    monkeypatch.syspath_prepend(
        os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts")
    )
    module = importlib.import_module("seed_catalog")
    yield module
    sys.modules.pop("seed_catalog", None)


def item(item_id: str, **assets) -> dict:
    base = SEED_ENV["SEED_SRC_ASSET_BASE_URL"]
    return {
        "id": item_id,
        "links": [{"rel": "self", "href": "https://api.example.org/x"}],
        "assets": {name: {"href": f"{base}/{key}"} for name, key in assets.items()},
    }


class FakeCursor:
    def __init__(self, calls):
        self.calls = calls

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def execute(self, sql, params=None):
        self.calls.append((sql, params))


class FakeConn:
    def __init__(self):
        self.calls = []

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def cursor(self):
        return FakeCursor(self.calls)

    def transaction(self):
        return FakeCursor(self.calls)

    def statements(self, needle):
        return [params for sql, params in self.calls if needle in sql]


def run_main(seed, monkeypatch, items, copies, copied):
    """Drive main() over a planned batch, with `copied` the assets that landed."""
    conn = FakeConn()
    monkeypatch.setattr(seed, "fetch_collection", lambda: {"id": "openaerialmap"})
    monkeypatch.setattr(seed, "connect", lambda: conn)
    monkeypatch.setattr(seed, "wanted_items", lambda _conn: (items, copies, 0))
    monkeypatch.setattr(
        seed, "copy_assets", lambda keys: (copied, len(set(keys) - copied))
    )
    return seed.main(), conn


def test_a_failed_copy_still_creates_the_collection(seed, monkeypatch):
    """The uploader registers into it, so it must not ride on the imagery."""
    good = item("good", visual="a.tif")
    bad = item("bad", visual="b.tif")
    _, conn = run_main(seed, monkeypatch, [good, bad], ["a.tif", "b.tif"], {"a.tif"})

    (collection,) = conn.statements("upsert_collection")
    assert collection[0].obj == {"id": "openaerialmap"}


def test_a_failed_copy_costs_only_its_own_items(seed, monkeypatch):
    """One oversized GeoTIFF used to cost the whole catalogue."""
    good = item("good", visual="a.tif")
    bad = item("bad", visual="b.tif")
    _, conn = run_main(seed, monkeypatch, [good, bad], ["a.tif", "b.tif"], {"a.tif"})

    loaded = [params[0].obj["id"] for params in conn.statements("upsert_item")]
    assert loaded == ["good"]


def test_a_shortfall_fails_the_job(seed, monkeypatch):
    """Committed first, then non-zero: the retry re-plans only what is absent."""
    good = item("good", visual="a.tif")
    bad = item("bad", visual="b.tif")
    code, conn = run_main(seed, monkeypatch, [good, bad], ["a.tif", "b.tif"], {"a.tif"})

    assert [p[0].obj["id"] for p in conn.statements("upsert_item")] == ["good"]
    assert code == 1


def test_a_clean_run_succeeds(seed, monkeypatch):
    only = item("only", visual="a.tif")
    code, _ = run_main(seed, monkeypatch, [only], ["a.tif"], {"a.tif"})

    assert code == 0


def test_an_optional_asset_that_did_not_land_is_dropped(seed, monkeypatch):
    """Same treatment plan() gives an asset that is missing at source."""
    monkeypatch.setattr(seed, "REQUIRED_ASSETS", {"visual"})
    subject = item("x", visual="a.tif", thumbnail="a.png")

    assert seed.rewrite(subject, {"a.tif"}) is subject
    assert set(subject["assets"]) == {"visual"}
    assert subject["assets"]["visual"]["href"].startswith(
        SEED_ENV["PUBLIC_ASSET_BASE_URL"]
    )


def test_a_required_asset_that_did_not_land_skips_the_item(seed, monkeypatch):
    monkeypatch.setattr(seed, "REQUIRED_ASSETS", {"visual"})
    subject = item("x", visual="a.tif", thumbnail="a.png")

    assert seed.rewrite(subject, {"a.png"}) is None


def planning(seed, monkeypatch, count=4, size=None, resident=()):
    """Set plan() up over `count` source items of `size` bytes each."""
    batch = [item(f"i{n}", visual=f"{n}.tif") for n in range(count)]
    monkeypatch.setattr(seed, "iter_items", lambda: iter(batch))
    monkeypatch.setattr(seed, "MAX_ITEMS", 10)
    monkeypatch.setattr(seed, "REQUIRED_ASSETS", {"visual"})
    monkeypatch.setattr(seed, "head_size", lambda url, attempts=3: size)
    monkeypatch.setattr(seed, "already_there", lambda key: key in resident)
    return batch


def test_items_already_in_the_catalogue_are_not_replanned(seed, monkeypatch):
    """A seeded environment plans nothing, so a re-sync copies nothing."""
    planning(seed, monkeypatch, size=1024)

    chosen, copies, _ = seed.plan(frozenset({"i0", "i1", "i2", "i3"}))

    assert chosen == []
    assert copies == []


def test_an_item_that_failed_last_run_is_planned_again(seed, monkeypatch):
    """ "The collection holds something" used to write the stragglers off."""
    planning(seed, monkeypatch, size=1024)

    chosen, _, _ = seed.plan(frozenset({"i0", "i2"}))

    assert [i["id"] for i in chosen] == ["i1", "i3"]


def test_resident_bytes_are_budgeted_but_not_recopied(seed, monkeypatch):
    """The budget is the seed set; the returned figure is the write."""
    gib = 1024**3
    planning(seed, monkeypatch, size=2 * gib, resident=("0.tif", "1.tif"))
    monkeypatch.setattr(seed, "MAX_BYTES", 6 * gib)

    chosen, copies, to_copy = seed.plan(frozenset())

    # Three items fit the 6GiB seed set, but two are already in the bucket.
    assert [i["id"] for i in chosen] == ["i0", "i1", "i2"]
    assert copies == ["0.tif", "1.tif", "2.tif"]
    assert to_copy == 2 * gib


def test_maxitems_counts_the_source_not_the_shortfall(seed, monkeypatch):
    """Otherwise a mostly-seeded run walks further down prod on every sync."""
    planning(seed, monkeypatch, count=8, size=1024)
    monkeypatch.setattr(seed, "MAX_ITEMS", 4)

    chosen, _, _ = seed.plan(frozenset({"i0", "i1", "i2"}))

    assert [i["id"] for i in chosen] == ["i3"]


def test_loaded_items_still_spend_the_budget(seed, monkeypatch):
    """Skipping them from the budget advanced the window a maxGiB a sync."""
    gib = 1024**3
    planning(seed, monkeypatch, count=8, size=2 * gib)
    monkeypatch.setattr(seed, "MAX_BYTES", 6 * gib)

    # An earlier run already loaded the 6GiB the budget covers.
    chosen, copies, to_copy = seed.plan(frozenset({"i0", "i1", "i2"}))

    assert chosen == []
    assert copies == []
    assert to_copy == 0


def test_a_source_that_keeps_erroring_is_missing_not_fatal(seed, monkeypatch):
    """A single 503 mid-plan used to abort before anything was written."""
    monkeypatch.setattr(seed.time, "sleep", lambda _s: None)

    def explode(request, timeout=None):
        raise urllib.error.HTTPError(request.full_url, 503, "busy", {}, None)

    monkeypatch.setattr(seed.urllib.request, "urlopen", explode)

    assert seed.head_size("https://src-bucket.s3.example.org/a.tif") is None
