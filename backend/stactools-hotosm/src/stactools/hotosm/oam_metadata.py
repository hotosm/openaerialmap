"""This module contains data representations of OAM metadata."""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass


@dataclass
class OamMetadata:
    """Metadata for OAM imagery.

    This metadata specification is based off the Open Imagery Network (OIN)
    metadata specification (https://github.com/openimagerynetwork/oin-metadata-spec).

    For more details about the OAM metadata specification, see:
    https://github.com/hotosm/OpenAerialMap/blob/master/metadata/README.md
    """

    # Unique identifier
    id: str
    # Human readable title for image
    title: str
    # Data provider contact
    contact: str
    # Data provider
    provider: str
    # Sensor platform
    platform: str
    # Sensor that acquired the data (not always provided)
    sensor: str | None
    # SPDX identifier for the license of this specific item
    license: str | None

    # Starting time of acquisition
    acquisition_start: dt.datetime
    # Ending time of acquisition
    acquisition_end: dt.datetime
    # Time uploaded to OAM API (not part of specification, but returned from API)
    uploaded_at: dt.datetime | None

    # GeoJSON of footprint
    geojson: dict
    # Bounding box
    bbox: list[float]
    # Item footprint, defined as Well Known Text
    footprint_wkt: str
    # Projection, defined as Well Known Text
    projection_wkt: str
    # Ground Sampling Distance (meters)
    gsd: float

    # Link to image asset
    image_url: str
    # Filesize of image (bytes)
    image_file_size: int
    # Link to thumbnail
    thumbnail_url: str
    # Link to static metadata this was derived from
    metadata_url: str

    def sanitize(self) -> OamMetadata:
        """Return a sanitized version of this metadata item."""
        self._sanitize_acquisition_datetime()
        self._sanitize_license()
        self._sanitize_platform()
        self._sanitize_sensor()
        return self

    def _sanitize_acquisition_datetime(self):
        """Sanitize acquisition datetimes.

        Some records have start >= end.
        """
        if self.acquisition_start > self.acquisition_end:
            self.acquisition_start, self.acquisition_end = (
                self.acquisition_end,
                self.acquisition_start,
            )

    def _sanitize_license(self):
        """Sanitize license identifier, if provided.

        SPDX license identifiers should not have spaces but dashes,
        https://spdx.org/licenses/
        """
        if self.license:
            self.license = self.license.replace(" ", "-")

    def _sanitize_platform(self):
        """Sanitize platform to a slug representation."""
        self.platform = self.platform.lower().replace("_", "-")

    def _sanitize_sensor(self):
        """Sanitize bad sensor values."""
        if self.sensor is not None:
            if self.sensor.lower().startswith("unknow"):
                self.sensor = None
