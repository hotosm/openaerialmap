"""Ground sample distance and footprint, for imagery that is not near 0,0.

The old uploader failed every geographic-CRS scene past +/-90 longitude, because
it built (lon, lat) pairs and handed them to a library that wanted (lat, lon).
It surfaced as `Latitude 120.29 is out of range` - but only because that library
range-checks. `Geod.geometry_area_perimeter`, which this step uses for footprint
area, does not: swapped axes there would return a plausible wrong number rather
than raising, and nobody would notice.

So these do not check "it ran". They check the property that makes it correct:
metres per pixel and ground area depend on latitude, never on longitude.
"""

import json
import math

import metadata
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

SIZE = 200
# Half a metre per pixel at the equator, expressed in degrees.
HALF_METRE_DEG = 0.5 / 111320.0


def _scene(tmp_path, name, crs, transform):
    """A 3-band visual scene with a nodata border, so there is a mask to trace."""
    path = tmp_path / f"{name}.tif"
    data = np.full((3, SIZE, SIZE), 200, dtype="uint8")
    data[:, :20, :] = 0
    data[:, :, :20] = 0
    with rasterio.open(
        path,
        "w",
        driver="GTiff",
        width=SIZE,
        height=SIZE,
        count=3,
        dtype="uint8",
        crs=crs,
        transform=transform,
        nodata=0,
    ) as dst:
        dst.write(data)
    return str(path)


def _item(tmp_path, name, crs, transform) -> dict:
    """Run the real metadata step and return the STAC item it wrote."""
    raster = _scene(tmp_path, name, crs, transform)
    out_dir = tmp_path / f"out-{name}"
    out_dir.mkdir()
    meta_path = out_dir / "meta.json"
    meta_path.write_text(
        json.dumps(
            {
                "title": name,
                "product_type": "visual",
                "acquisition_start": "2026-04-02T00:00:00+00:00",
            }
        )
    )
    metadata.build_item(
        raster,
        str(meta_path),
        str(out_dir),
        f"id-{name}",
        "https://assets.example.org",
        "oam",
        f"u-test/id-{name}/{name}.tif",
        raster,
    )
    return json.loads((out_dir / "metadata.json").read_text())


def _geographic(lon, lat):
    return "EPSG:4326", from_origin(lon, lat, HALF_METRE_DEG, HALF_METRE_DEG)


@pytest.mark.parametrize("lon", [120.29, 179.9, -150.0, 0.0])
def test_a_geographic_scene_is_measured_the_same_at_any_longitude(tmp_path, lon):
    """The regression. Longitude 120.29 is Sulawesi, where this used to fail."""
    control = _item(tmp_path, "control", *_geographic(10.0, -2.0))
    subject = _item(tmp_path, "subject", *_geographic(lon, -2.0))
    assert subject["properties"]["gsd"] == pytest.approx(
        control["properties"]["gsd"], rel=1e-9
    )
    assert subject["properties"]["oam:footprint_area"] == pytest.approx(
        control["properties"]["oam:footprint_area"], rel=1e-6
    )


def test_it_matches_the_same_ground_sample_reprojected(tmp_path):
    """Half-metre pixels are half-metre pixels in either CRS."""
    geographic = _item(tmp_path, "geographic", *_geographic(120.29, -2.0))
    # UTM zone 51S covers longitude 120, so this is the same place, projected.
    projected = _item(
        tmp_path, "projected", "EPSG:32751", from_origin(200000, 9779000, 0.5, 0.5)
    )
    assert geographic["properties"]["gsd"] == pytest.approx(
        projected["properties"]["gsd"], rel=0.01
    )
    assert geographic["properties"]["oam:footprint_area"] == pytest.approx(
        projected["properties"]["oam:footprint_area"], rel=0.01
    )


@pytest.mark.parametrize("lat", [70.0, -70.0])
def test_a_degree_of_longitude_narrows_with_latitude(tmp_path, lat):
    """And by the same amount either side of the equator, since cosine is even."""
    equator = _item(tmp_path, "equator", *_geographic(120.29, 0.0))["properties"]["gsd"]
    high = _item(tmp_path, f"lat{lat}", *_geographic(120.29, lat))["properties"]["gsd"]
    # x shrinks by cos(lat), y does not, and the two are averaged.
    expected = equator * (1 + math.cos(math.radians(lat))) / 2
    assert high == pytest.approx(expected, rel=0.01)


def test_the_geometry_is_longitude_then_latitude(tmp_path):
    """GeoJSON position order. Swapped, this scene would sit off Somalia."""
    item = _item(tmp_path, "order", *_geographic(120.29, -2.0))
    ring = item["geometry"]["coordinates"][0]
    lons = [x for x, _ in ring]
    lats = [y for _, y in ring]
    assert all(120 < lon < 121 for lon in lons)
    assert all(-3 < lat < -1 for lat in lats)
    assert item["bbox"][0] == pytest.approx(min(lons))
    assert item["bbox"][1] == pytest.approx(min(lats))


def test_a_traced_footprint_is_smaller_than_its_bounding_box(tmp_path):
    """The nodata border is two of the four sides, so this is a real trace."""
    item = _item(tmp_path, "traced", *_geographic(120.29, -2.0))
    assert item["properties"]["oam:footprint_source"] == "mask"
    bbox = item["bbox"]
    # Rough box area in metres at this latitude, for the order-of-magnitude check.
    lat_m = (bbox[3] - bbox[1]) * 111320.0
    lon_m = (bbox[2] - bbox[0]) * 111320.0 * math.cos(math.radians(bbox[1]))
    assert 0 < item["properties"]["oam:footprint_area"] < lat_m * lon_m


# The antimeridian. A scene near 180 arrives wrong from two directions: a
# geographic raster keeps counting past 180, and a projected one gets split by
# GDAL and then measured by shapely as if it spanned the planet.


# SIZE pixels of HALF_METRE_DEG each, so these origins put half the scene on
# either side of the meridian.
_HALF_WIDTH_DEG = SIZE * HALF_METRE_DEG / 2


def _straddling_geographic(tmp_path):
    return _item(tmp_path, "geog180", *_geographic(180.0 - _HALF_WIDTH_DEG, -2.0))


def _straddling_projected(tmp_path):
    # UTM zone 60S. 180 degrees falls near easting 833778 at this latitude.
    return _item(
        tmp_path,
        "utm180",
        "EPSG:32760",
        from_origin(833778 - SIZE * 0.5 / 2, 9779000, 0.5, 0.5),
    )


@pytest.mark.parametrize("build", [_straddling_geographic, _straddling_projected])
def test_a_scene_across_the_meridian_stays_inside_wgs84(tmp_path, build):
    """`transform_geom` returns 180.0008 for the geographic case, which is not
    a longitude any client will accept."""
    item = build(tmp_path)
    assert item["geometry"]["type"] == "MultiPolygon"
    lons = [
        x
        for polygon in item["geometry"]["coordinates"]
        for ring in polygon
        for x, _ in ring
    ]
    assert all(-180 <= lon <= 180 for lon in lons)


@pytest.mark.parametrize("build", [_straddling_geographic, _straddling_projected])
def test_it_is_not_given_a_bounding_box_around_the_whole_planet(tmp_path, build):
    """The regression that matters: shapely's own bounds on a split geometry
    produce [-180, ..., 180, ...], so a 200 m scene matched every search."""
    bbox = build(tmp_path)["bbox"]
    assert (bbox[0], bbox[2]) != (-180.0, 180.0)
    # RFC 7946 section 5.2: crossing is expressed by the box starting east of
    # the meridian and ending west of it.
    assert bbox[0] > bbox[2]
    assert bbox[0] > 179 and bbox[2] < -179


@pytest.mark.parametrize("build", [_straddling_geographic, _straddling_projected])
def test_crossing_the_meridian_does_not_change_how_big_a_scene_is(tmp_path, build):
    """Area is measured before the geometry is cut, so the halves still add up."""
    away = _item(tmp_path, "away", *_geographic(120.29, -2.0))
    crossing = build(tmp_path)
    assert crossing["properties"]["oam:footprint_area"] == pytest.approx(
        away["properties"]["oam:footprint_area"], rel=0.05
    )


def test_a_scene_just_past_the_meridian_wraps_rather_than_splitting(tmp_path):
    """Wholly east of 180 is not a crossing; it is the same place named twice."""
    item = _item(tmp_path, "past180", *_geographic(180.05, -2.0))
    lons = [x for ring in item["geometry"]["coordinates"] for x, _ in ring]
    assert item["geometry"]["type"] == "Polygon"
    assert all(-180 <= lon <= -179.9 for lon in lons)
    assert item["bbox"][0] < item["bbox"][2]


def test_an_ordinary_scene_keeps_an_ordinary_bounding_box(tmp_path):
    """Nothing above should touch imagery that is nowhere near the meridian."""
    item = _item(tmp_path, "ordinary", *_geographic(120.29, -2.0))
    assert item["geometry"]["type"] == "Polygon"
    assert item["bbox"][0] < item["bbox"][2]
