"""The worst-case conversion bound that sizes a visual upload's workspace."""

from app.uploads import budget


def test_every_level_is_counted_until_one_block_holds_it():
    assert list(budget._levels(2048, 600)) == [(2048, 600), (1024, 300), (512, 150)]


def test_a_level_is_charged_in_whole_blocks():
    """GDAL allocates edge blocks at full size."""
    one = budget._tiled(1, 1, 512)
    assert one == budget._tiled(512, 512, 512)
    assert budget._tiled(513, 1, 512) == 2 * one


def test_the_bound_covers_half_the_raw_cog_and_the_raw_pyramid():
    """Full resolution plus a third for overviews; the temp holds that third."""
    raw = 20_480 * 20_480 * budget.PIXEL_BYTES
    assert budget.conversion_bytes(20_480, 20_480) >= raw * (4 / 3 / 2 + 1 / 3)
