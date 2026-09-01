"""What the validate step accepts, and what it tells the uploader when it does not."""

import json

import pytest
import rasterio
import validate
from rasterio.crs import CRS
from rasterio.enums import ColorInterp


class _FakeSrc:
    """A rasterio dataset stand-in, so a 4-terapixel grid costs no disk."""

    def __init__(self, width, height, count=3, dtype="uint8", crs="EPSG:4326"):
        self.width = width
        self.height = height
        self.count = count
        self.dtypes = [dtype] * count
        self.crs = CRS.from_string(crs) if crs else None
        self.colorinterp = [ColorInterp.gray] * count

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


@pytest.fixture
def reason(tmp_path, monkeypatch):
    """Redirect the reason file and read it back."""
    path = tmp_path / "validation-error.txt"
    monkeypatch.setattr(validate, "REASON_PATH", str(path))
    return lambda: path.read_text() if path.exists() else ""


@pytest.fixture
def opens(monkeypatch):
    """Make validate.rasterio.open return a given dataset."""

    def _opens(src):
        monkeypatch.setattr(rasterio, "open", lambda *a, **k: src)

    return _opens


def _rejects(meta_path=None) -> int:
    """Run the opened dataset through validation and return its exit code."""
    with pytest.raises(SystemExit) as exit_:
        validate.validate_raster("/data/input.tif", meta_path)
    return exit_.value.code


# The limits. A 100 GiB upload is tens of gigapixels by definition.


def test_a_multi_gigapixel_upload_is_accepted(opens):
    """Past both old ceilings: 2 gigapixels and 32 GB decoded."""
    opens(_FakeSrc(150_000, 150_000))  # 22.5 gigapixels, 67.5 GB decoded
    assert validate.validate_raster("/data/input.tif") is True


def test_pixel_count_is_not_capped_by_default():
    assert validate.MAX_GIGAPIXELS == 0


def test_the_decoded_ceiling_clears_a_max_size_upload():
    """An upload at MAX_UPLOAD_BYTES decodes to at least its own size."""
    assert validate.MAX_DECODED_GB >= 100 * 2**30 / 1e9


def test_a_decompression_bomb_is_still_rejected(opens, reason):
    """A small file can declare an enormous grid; the workspace pays for it."""
    opens(_FakeSrc(2_000_000, 2_000_000, count=1))  # 4 TB decoded
    assert _rejects() == 6
    assert "4000.0 GB decoded" in reason()


def test_a_deployment_can_still_cap_pixels(opens, reason, monkeypatch):
    monkeypatch.setattr(validate, "MAX_GIGAPIXELS", 2)
    opens(_FakeSrc(100_000, 100_000))
    assert _rejects() == 6
    assert "10.00 gigapixels" in reason()


# What the uploader is told: cleanup maps an exit code to a fixed sentence.


def test_a_size_rejection_names_the_dimensions_and_the_limit(opens, reason):
    opens(_FakeSrc(1_000_000, 1_000_000, count=4, dtype="uint16"))  # 8 TB decoded
    assert _rejects() == 6
    said = reason()
    assert "1000000 x 1000000" in said
    assert "4 band(s)" in said and "uint16" in said
    assert str(int(validate.MAX_DECODED_GB)) in said


def test_a_reason_is_safe_to_embed_in_the_cleanup_payload(reason, monkeypatch):
    """Cleanup interpolates it through shell into JSON with no escaping."""
    with pytest.raises(SystemExit):
        validate._reject(6, 'a "quoted" \\ back\nslash\tand a — dash')
    said = reason()
    assert '"' not in said and "\\" not in said and "\n" not in said
    assert json.loads(f'{{"message": "{said}"}}')["message"] == said


def test_a_reason_stays_short_enough_for_the_api(reason):
    with pytest.raises(SystemExit):
        validate._reject(6, "x" * 5000)
    assert len(reason()) == validate.MAX_REASON_CHARS


def test_an_unwritable_reason_still_exits_with_its_code(monkeypatch):
    """Losing the detail must not lose the failure."""
    monkeypatch.setattr(validate, "REASON_PATH", "/nonexistent-dir/reason.txt")
    with pytest.raises(SystemExit) as exit_:
        validate._reject(6, "too big")
    assert exit_.value.code == 6


def test_a_raster_without_a_crs_is_rejected(opens, reason):
    opens(_FakeSrc(1024, 1024, crs=None))
    assert _rejects() == 5
    assert "CRS" in reason()


def test_something_that_is_not_a_geotiff_is_rejected(tmp_path, reason):
    not_a_tiff = tmp_path / "input.tif"
    not_a_tiff.write_text("<html>login required</html>")
    with pytest.raises(SystemExit) as exit_:
        validate.validate_raster(str(not_a_tiff))
    assert exit_.value.code == 8
    assert "not a GeoTIFF" in reason()


def test_declared_visual_must_actually_be_rgb(opens, reason, tmp_path):
    meta = tmp_path / "meta.json"
    meta.write_text(json.dumps({"product_type": "visual"}))
    opens(_FakeSrc(1024, 1024, count=1, dtype="float32"))
    assert _rejects(str(meta)) == 7
    said = reason()
    assert "float32" in said and "1 band(s)" in said


def test_native_data_types_pass_when_nothing_is_declared(opens):
    opens(_FakeSrc(1024, 1024, count=1, dtype="float32"))
    assert validate.validate_raster("/data/input.tif") is True
