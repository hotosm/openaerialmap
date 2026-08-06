"""Tests for `stactools.hotosm.oam_metadata`."""

import datetime as dt

from stactools.hotosm.oam_metadata import OamMetadata


class TestOamMetadata:
    """Test OamMetadata data class."""

    def test_sanitize(self, example_oam_metadata: OamMetadata):
        """Test sanitize() method resolves identified metadata issues."""
        example_oam_metadata.platform = "UaV"
        example_oam_metadata.license = "CC-BY 4.0"
        example_oam_metadata.sensor = "Unknow"

        example_oam_metadata.sanitize()

        assert example_oam_metadata.platform == "uav"
        assert example_oam_metadata.license == "CC-BY-4.0"
        assert example_oam_metadata.sensor is None

    def test_sanitize_fixes_acquisition_order(
        self,
        example_oam_metadata: OamMetadata,
    ):
        """Ensure result parsing corrects backwards start/end for acquisition."""
        start_ = dt.datetime(2020, 1, 1, tzinfo=dt.timezone.utc)
        end_ = dt.datetime(2020, 1, 2, tzinfo=dt.timezone.utc)
        example_oam_metadata.acquisition_start = start_
        example_oam_metadata.acquisition_end = end_

        example_oam_metadata.sanitize()
        assert example_oam_metadata.acquisition_start == start_
        assert example_oam_metadata.acquisition_end == end_
