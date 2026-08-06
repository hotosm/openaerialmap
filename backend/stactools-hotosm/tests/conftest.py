"""Test fixtures."""

import datetime as dt
import json
from pathlib import Path

import numpy as np
import pyproj
import pytest
import rasterio
import shapely
from rasterio.transform import from_bounds
from shapely.wkt import dumps as wkt_dumps

from stactools.hotosm.oam_metadata import OamMetadata

DATA = Path(__file__).parent / "data"


@pytest.fixture
def example_oam_metadata() -> OamMetadata:
    """Example OamItemMetadata for testing."""
    now = dt.datetime.now(tz=dt.timezone.utc)
    bbox = [-80.4248105, -0.980146199999, -80.418725308, -0.9748217]
    geojson = {
        "coordinates": [
            [
                [-80.4248105, -0.9748217],
                [-80.418725308, -0.9748217],
                [-80.418725308, -0.980146199999],
                [-80.4248105, -0.980146199999],
                [-80.4248105, -0.9748217],
            ]
        ],
        "type": "Polygon",
    }

    return OamMetadata(
        id="foo",
        title="Foo",
        contact="foo@openaerialmap.org",
        provider="openaerialmap",
        platform="uav",
        sensor="camera",
        license="CC-BY-4.0",
        acquisition_start=now,
        acquisition_end=now + dt.timedelta(seconds=1),
        uploaded_at=now,
        geojson=geojson,
        bbox=bbox,
        footprint_wkt=wkt_dumps(shapely.geometry.shape(geojson)),
        projection_wkt=pyproj.CRS.from_epsg(4326).to_wkt(),
        gsd=1.857e-7,
        image_url="image.tif",
        image_file_size=12345,
        thumbnail_url="thumb.png",
        metadata_url="metadata.json",
    )


@pytest.fixture
def example_oam_meta_api_response() -> dict:
    """Example OAM Metadata API response."""
    return json.loads((DATA / "oam_meta_api_response10.json").read_text())


@pytest.fixture
def example_oam_meta_api_response_sortby_uploaded_at(
    example_oam_meta_api_response: dict,
) -> dict:
    """Example OAM Metadata API response, sorted by uploaded date."""
    example_oam_meta_api_response["results"] = sorted(
        example_oam_meta_api_response["results"],
        key=lambda result: result.get("uploaded_at", "0"),
        reverse=True,
    )
    return example_oam_meta_api_response


@pytest.fixture
def example_oam_image(example_oam_metadata: OamMetadata, tmp_path: Path) -> OamMetadata:
    """Provision data for the example OAM metadata item."""
    data = np.random.randint(low=0, high=255, size=(3, 13, 42), dtype="uint8")
    profile = {
        "count": data.shape[0],
        "height": data.shape[1],
        "width": data.shape[2],
        "dtype": "uint8",
        "crs": rasterio.crs.CRS.from_string(example_oam_metadata.projection_wkt),
        "transform": from_bounds(*example_oam_metadata.bbox, *data.shape[1:]),
    }

    example_oam_metadata.image_url = str(tmp_path / example_oam_metadata.image_url)
    with rasterio.open(
        example_oam_metadata.image_url, "w", driver="COG", **profile
    ) as dst:
        dst.write(data)

    example_oam_metadata.thumbnail_url = str(
        tmp_path / example_oam_metadata.thumbnail_url
    )
    with rasterio.open(
        example_oam_metadata.thumbnail_url, "w", driver="PNG", **profile
    ) as dst:
        dst.write(data)

    return example_oam_metadata
