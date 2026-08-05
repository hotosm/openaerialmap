"""Build the OAM STAC item for an uploaded raster.

Use the bulk ingester's stactools package so both paths emit the same extension.
Add archival assets, checksums, dynamic browse hints, provenance, band metadata,
and the valid-pixel footprint without changing the analysis COG.

Usage: metadata.py <cog> <user-meta> <out-dir> <id> <url> <bucket> <key>
"""

import datetime as dt
import hashlib
import json
import logging
import math
import os
import re
import sys

import numpy as np
import rasterio
from pyproj import Geod
from pystac import Asset, MediaType
from pystac.extensions.file import FileExtension
from rasterio import Affine, features
from rasterio.enums import ColorInterp, Resampling
from rasterio.warp import transform_bounds, transform_geom
from shapely.geometry import mapping, shape
from shapely.ops import unary_union
from stactools.hotosm.oam_metadata import OamMetadata
from stactools.hotosm.stac import create_item

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [metadata] %(message)s",
)
log = logging.getLogger("metadata")

PRODUCT_TYPES = {"visual", "multispectral", "sar", "elevation", "pseudocolor"}
RENDER_EXT_URI = "https://stac-extensions.github.io/render/v2.0.0/schema.json"
PROC_EXT_URI = "https://stac-extensions.github.io/processing/v1.2.0/schema.json"
EO_EXT_URI = "https://stac-extensions.github.io/eo/v1.1.0/schema.json"

_CI_COMMON = {
    ColorInterp.red: "red",
    ColorInterp.green: "green",
    ColorInterp.blue: "blue",
}
_DESC_COMMON = {
    "red": "red",
    "green": "green",
    "blue": "blue",
    "nir": "nir",
    "rededge": "rededge",
    "red edge": "rededge",
    "swir": "swir",
    "pan": "pan",
    "coastal": "coastal",
    "yellow": "yellow",
}


def _parse_dt(value: str | None) -> dt.datetime | None:
    """Parse an ISO 8601 datetime, tolerating a trailing Z."""
    if not value:
        return None
    try:
        return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def _file_tags(paths: list[str | None]) -> dict:
    """GDAL default + EXIF domain tags from the first readable path.

    The original upload comes first: EXIF rarely survives COG conversion.
    """
    for path in paths:
        if not path or not os.path.exists(path):
            continue
        try:
            with rasterio.open(path) as src:
                tags = dict(src.tags())
                tags.update(src.tags(ns="EXIF"))
                return tags
        except Exception:
            log.warning("Could not read tags from %s", path)
    return {}


def _tag_datetime(tags: dict) -> dt.datetime | None:
    """Capture datetime from file tags, else None.

    Weak signal: processed orthomosaics usually lack these tags, and
    TIFFTAG_DATETIME may be the processing time rather than capture.
    """
    for key in ("EXIF_DateTimeOriginal", "TIFFTAG_DATETIME"):
        raw = (tags.get(key) or "").strip()
        # EXIF format is "YYYY:MM:DD HH:MM:SS"; some writers (e.g. ODM)
        # append a timezone offset. Normalise the date part to ISO.
        m = re.match(r"^(\d{4}):(\d{2}):(\d{2})(.*)$", raw)
        if not m:
            continue
        try:
            parsed = dt.datetime.fromisoformat(
                f"{m[1]}-{m[2]}-{m[3]}{m[4]}".replace("Z", "+00:00")
            )
        except ValueError:
            continue
        # Assume UTC when no offset is stored.
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=dt.UTC)
    return None


def _tag_sensor(tags: dict) -> str | None:
    """Camera make + model from EXIF tags, else None."""
    make = (tags.get("EXIF_Make") or "").strip()
    model = (tags.get("EXIF_Model") or "").strip()
    if make and model.lower().startswith(make.lower()):
        return model
    return " ".join(p for p in (make, model) if p) or None


def _tag_software(tags: dict) -> tuple[str, str] | None:
    """(name, version) from TIFFTAG_SOFTWARE (e.g. "ODM 3.6.1"), else None."""
    raw = (tags.get("TIFFTAG_SOFTWARE") or "").strip()
    if not raw:
        return None
    name, _, version = raw.rpartition(" ")
    if name and any(c.isdigit() for c in version):
        return name, version
    return raw, "unknown"


def _detect_product_type(src: rasterio.DatasetReader) -> str:
    """Infer a product type for bulk and legacy inputs that omit it.

    Ambiguous single-band rasters remain multispectral to avoid unsafe elevation
    or visual assumptions.
    """
    dtype = src.dtypes[0]
    if src.count == 1 and ColorInterp.palette in src.colorinterp:
        return "pseudocolor"
    if src.count == 1:
        # Integer and complex single-band data is too ambiguous to call elevation.
        return "elevation" if dtype.startswith("float") else "multispectral"
    if src.count == 3 and dtype == "uint8":
        return "visual"
    if src.count == 4 and dtype == "uint8":
        # Distinguish RGBA from RGB with a near-infrared fourth band.
        if ColorInterp.alpha in src.colorinterp or _looks_like_alpha(src, 4):
            return "visual"
        return "multispectral"
    return "multispectral"


def _looks_like_alpha(src: rasterio.DatasetReader, band: int) -> bool:
    """Return True when a band reads like an alpha channel (almost all 0/255)."""
    scale = max(1.0, max(src.width, src.height) / 512)
    h, w = max(1, int(src.height / scale)), max(1, int(src.width / scale))
    arr = src.read(band, out_shape=(h, w), resampling=Resampling.nearest)
    near_binary = np.count_nonzero((arr == 0) | (arr == 255))
    return near_binary / arr.size >= 0.98


def _resolve_product_type(
    user_md: dict, src: rasterio.DatasetReader
) -> tuple[str, str]:
    """Return (product_type, source).

    A valid declared type, else an auto-detected one. source is "declared" or
    "detected" so consumers know whether a human confirmed it.
    """
    declared = str(user_md.get("product_type", "")).strip().lower()
    if declared in PRODUCT_TYPES:
        return declared, "declared"
    detected = _detect_product_type(src)
    log.info("product_type not declared; auto-detected %r", detected)
    return detected, "detected"


def _band_info(src: rasterio.DatasetReader) -> list[dict]:
    """Build STAC 1.1 band metadata used for output and RGB selection.

    Prefer color interpretation over band descriptions for common names.
    """
    infos = []
    for i in range(src.count):
        desc = (src.descriptions[i] or "").strip()
        common = _CI_COMMON.get(src.colorinterp[i]) or _DESC_COMMON.get(desc.lower())
        info: dict = {"name": f"b{i + 1}"}
        if common:
            info["eo:common_name"] = common
        if desc:
            info["description"] = desc
        infos.append(info)
    return infos


def _rgb_band_indexes(bands: list[dict]) -> list[int] | None:
    """Find 1-based RGB indexes by common name; band order is not guaranteed."""
    idx = {b.get("eo:common_name"): i + 1 for i, b in enumerate(bands)}
    rgb = [idx.get(c) for c in ("red", "green", "blue")]
    return rgb if all(rgb) else None


def _display_bands(product_type: str, bands: list[dict]) -> list[int]:
    """Choose one band for scalar data, named RGB bands when available, or 1-3."""
    if product_type in ("elevation", "sar", "pseudocolor") or len(bands) < 3:
        return [1]
    if product_type == "multispectral":
        rgb = _rgb_band_indexes(bands)
        if rgb:
            return rgb
    return [1, 2, 3]


def _read_color_table(src: rasterio.DatasetReader) -> dict[int, list[int]] | None:
    """Read the source palette as {value: [r, g, b, a]}."""
    try:
        ct = src.colormap(1)
    except (ValueError, IndexError):
        return None
    return {int(v): [int(c) for c in rgba] for v, rgba in ct.items()} or None


def _paletted_thumb(src: rasterio.DatasetReader, palette: dict) -> np.ndarray:
    """3-band RGB thumbnail built by mapping the index band through the palette."""
    scale = max(1.0, max(src.width, src.height) / 1000)
    h, w = max(1, int(src.height / scale)), max(1, int(src.width / scale))
    band = src.read(1, out_shape=(h, w), resampling=Resampling.nearest)
    thumb = np.zeros((3, h, w), dtype="uint8")
    for value, rgba in palette.items():
        m = band == value
        for c in range(3):
            thumb[c][m] = rgba[c]
    return thumb


def _browse(
    src: rasterio.DatasetReader, product_type: str, bands: list[dict]
) -> tuple[list[int], str | dict | None, list[list[float]] | None, np.ndarray]:
    """Build render parameters and a small browse image.

    Keep RGB uint8 unchanged. Stretch other data with the same percentile ranges
    sent to TiTiler, and preserve source palettes for pseudocolor rasters.
    """
    idx = _display_bands(product_type, bands)
    if product_type == "pseudocolor":
        palette = _read_color_table(src)
        if palette:
            return idx, palette, None, _paletted_thumb(src, palette)
    colormap: str | dict | None = None
    if product_type == "elevation":
        colormap = "terrain"
    elif product_type == "sar" or (len(idx) == 1 and product_type != "pseudocolor"):
        colormap = "gray"

    # Reuse one small read for the thumbnail and statistics.
    scale = max(1.0, max(src.width, src.height) / 1000)
    h, w = max(1, int(src.height / scale)), max(1, int(src.width / scale))
    arr = src.read(
        indexes=idx, out_shape=(len(idx), h, w), resampling=Resampling.bilinear
    ).astype("float64")
    if src.nodata is not None:
        arr[arr == src.nodata] = np.nan

    rescale: list[list[float]] | None = None
    if src.dtypes[0] != "uint8" or product_type in ("elevation", "sar"):
        rescale = []
        for band in arr:
            lo, hi = np.nanpercentile(band, [2, 98])
            if not (np.isfinite(lo) and np.isfinite(hi)) or hi <= lo:
                lo, hi = np.nanmin(band), np.nanmax(band)
            if not np.isfinite(hi) or hi <= lo:
                lo, hi = 0.0, 1.0
            rescale.append([float(lo), float(hi)])

    thumb = np.zeros(arr.shape, dtype="uint8")
    for i, band in enumerate(arr):
        lo, hi = rescale[i] if rescale else (0.0, 255.0)
        scaled = (band - lo) / (hi - lo) * 255.0 if hi > lo else band
        thumb[i] = np.clip(np.nan_to_num(scaled, nan=0.0), 0, 255).astype("uint8")
    return idx, colormap, rescale, thumb


def _write_thumbnail(thumb: np.ndarray, out_path: str) -> None:
    """Write the browse array as a 1- or 3-band 8-bit PNG."""
    count = 3 if thumb.shape[0] >= 3 else 1
    with rasterio.open(
        out_path,
        "w",
        driver="PNG",
        height=thumb.shape[1],
        width=thumb.shape[2],
        count=count,
        dtype="uint8",
    ) as dst:
        dst.write(thumb[:count])


def _renders(
    product_type: str,
    idx: list[int],
    colormap: str | dict | None,
    rescale: list[list[float]] | None,
    nodata: float | None,
) -> dict:
    """Titiler render hints (render extension) so the browse is generated on demand."""
    browse = {"assets": ["visual"], "title": product_type.capitalize(), "bidx": idx}
    if rescale:
        browse["rescale"] = rescale
    if isinstance(colormap, dict):
        browse["colormap"] = colormap
    elif colormap:
        browse["colormap_name"] = colormap
    # Visual COG borders use 0; other data keeps its source nodata value.
    browse_nodata = 0 if product_type == "visual" else nodata
    if browse_nodata is not None:
        browse["nodata"] = browse_nodata
    renders = {"browse": browse}
    if product_type == "elevation":
        renders["hillshade"] = {
            "assets": ["visual"],
            "title": "Hillshade",
            "algorithm": "hillshade",
        }
    return renders


def _footprint(
    src: rasterio.DatasetReader,
) -> tuple[dict, list[float], float] | None:
    """Trace valid pixels into an EPSG:4326 geometry, bounding box, and area.

    Uses the raster's own mask (alpha / declared nodata); decimation bounds the
    cost. Returns None when there's no mask to trace (caller falls back to the
    bbox rectangle) - we deliberately do NOT treat all-zero pixels as nodata,
    since legitimate black (water, shadow) would be holed out.
    """
    try:
        scale = max(1.0, max(src.width, src.height) / 2000)
        h, w = max(1, int(src.height / scale)), max(1, int(src.width / scale))
        mask = src.dataset_mask(out_shape=(h, w))
        if mask.all():
            # A fully valid mask has the same footprint as the bounding box.
            return None
        if not mask.any():
            return None
        transform = src.transform * Affine.scale(src.width / w, src.height / h)
        polys = [
            shape(geom)
            for geom, val in features.shapes(mask, mask=mask > 0, transform=transform)
            if val > 0
        ]
        if not polys:
            return None
        merged = unary_union(polys)
        merged = shape(transform_geom(src.crs, "EPSG:4326", mapping(merged)))
        merged = merged.simplify(1e-5, preserve_topology=True)
        area = abs(Geod(ellps="WGS84").geometry_area_perimeter(merged)[0])
        return mapping(merged), list(merged.bounds), area
    except Exception:
        log.exception("Footprint tracing failed; falling back to bbox")
        return None


def _load_provenance(cog_path: str) -> dict | None:
    """Read the convert step's <cog>.json provenance sidecar, if present."""
    try:
        with open(f"{cog_path}.json") as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def _file_meta(path: str) -> tuple[str, int]:
    """Return (multihash SHA-256, size) for the STAC file extension."""
    digest = hashlib.sha256()
    size = 0
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            digest.update(chunk)
            size += len(chunk)
    # "1220" = multihash prefix for sha2-256 (code 0x12, length 0x20).
    return "1220" + digest.hexdigest(), size


def _apply_file_meta(asset, path: str) -> None:
    """Set file:checksum + file:size on an asset."""
    checksum, size = _file_meta(path)
    FileExtension.ext(asset, add_if_missing=True).apply(size=size, checksum=checksum)


def build_item(
    cog_path: str,
    user_meta_json: str,
    out_dir: str,
    item_id: str,
    public_endpoint: str,
    bucket: str,
    key: str,
    original_path: str | None = None,
) -> None:
    """Assemble OamMetadata, create the STAC item, and write outputs."""
    os.makedirs(out_dir, exist_ok=True)
    with open(user_meta_json) as f:
        user_md = json.load(f)

    folder = "/".join(key.split("/")[:-1])
    filename = key.rsplit("/", maxsplit=1)[-1]
    asset_base_url = f"{public_endpoint.rstrip('/')}/{bucket}/{folder}"
    cog_filename = f"cog-{filename}"

    thumbnail_path = os.path.join(out_dir, "thumbnail.png")
    item_path = os.path.join(out_dir, "metadata.json")

    with rasterio.open(cog_path) as src:
        product_type, product_type_source = _resolve_product_type(user_md, src)
        bands = _band_info(src)
        idx, colormap, rescale, thumb = _browse(src, product_type, bands)
        src_nodata = src.nodata
        _write_thumbnail(thumb, thumbnail_path)

        fp = _footprint(src)
        if fp:
            geojson, bbox, footprint_area = fp
            footprint_source = "mask"
        else:
            bbox = list(transform_bounds(src.crs, "EPSG:4326", *src.bounds))
            geojson = {
                "type": "Polygon",
                "coordinates": [
                    [
                        [bbox[0], bbox[1]],
                        [bbox[2], bbox[1]],
                        [bbox[2], bbox[3]],
                        [bbox[0], bbox[3]],
                        [bbox[0], bbox[1]],
                    ]
                ],
            }
            footprint_area = None
            footprint_source = "bbox"
        footprint_wkt = shape(geojson).wkt
        projection_wkt = src.crs.to_wkt()
        # Convert pixel size to metres and average non-square pixels.
        if src.crs.is_geographic:
            # Degrees: approximate metres at the image-centre latitude.
            center_lat = (bbox[1] + bbox[3]) / 2.0
            m_per_deg = 111320.0
            x_m = abs(src.res[0]) * m_per_deg * math.cos(math.radians(center_lat))
            y_m = abs(src.res[1]) * m_per_deg
        else:
            # Convert projected units, including feet, to metres.
            try:
                _, to_metres = src.crs.linear_units_factor
            except Exception:
                to_metres = 1.0
            x_m = abs(src.res[0]) * to_metres
            y_m = abs(src.res[1]) * to_metres
        gsd = float((x_m + y_m) / 2.0)

    # Imports that bypass the API may need file tags or ingest time as a fallback.
    # These fallback dates are marked as estimates.
    now = dt.datetime.now(dt.UTC)
    tags = _file_tags([original_path, cog_path])
    start = _parse_dt(user_md.get("acquisition_start"))
    acquisition_source = "user"
    if start is None:
        start = _tag_datetime(tags)
        acquisition_source = "file-tags" if start else "ingest"
    if start is None:
        log.warning("No acquisition date from user or file tags; using ingest time")
        start = now
    end = _parse_dt(user_md.get("acquisition_end")) or start

    image_url = f"{asset_base_url}/{cog_filename}"
    thumbnail_url = f"{asset_base_url}/thumbnail.png"
    metadata_url = f"{asset_base_url}/metadata.json"

    oam = OamMetadata(
        id=item_id,
        title=user_md.get("title") or item_id,
        contact=user_md.get("contact") or user_md.get("provider") or "unknown",
        provider=user_md.get("provider") or "unknown",
        # The OAM schema does not allow an unknown platform.
        platform=user_md.get("platform") or "uav",
        sensor=user_md.get("sensor") or _tag_sensor(tags),
        license=user_md.get("license"),
        acquisition_start=start,
        acquisition_end=end,
        uploaded_at=now,
        geojson=geojson,
        bbox=bbox,
        footprint_wkt=footprint_wkt,
        projection_wkt=projection_wkt,
        gsd=gsd,
        # create_item reads projection data from the local COG. The URL is
        # replaced before the item is saved.
        image_url=cog_path,
        image_file_size=os.path.getsize(cog_path),
        thumbnail_url=thumbnail_url,
        metadata_url=metadata_url,
    ).sanitize()

    item = create_item(oam)
    item.assets["visual"].href = image_url

    # Ingest time (STAC Common). Distinct from datetime, which is acquisition.
    item.properties["created"] = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    if acquisition_source != "user":
        item.properties["oam:acquisition_time_estimated"] = True
        item.properties["oam:acquisition_source"] = acquisition_source

    item.properties["oam:product_type"] = product_type
    item.properties["oam:product_type_source"] = product_type_source
    item.properties["oam:footprint_source"] = footprint_source
    if footprint_area is not None:
        item.properties["oam:footprint_area"] = footprint_area
    item.properties["renders"] = _renders(
        product_type, idx, colormap, rescale, src_nodata
    )
    if RENDER_EXT_URI not in item.stac_extensions:
        item.stac_extensions.append(RENDER_EXT_URI)

    # STAC 1.1 uses bands with eo:common_name on the asset.
    item.assets["visual"].extra_fields["bands"] = bands
    if EO_EXT_URI not in item.stac_extensions:
        item.stac_extensions.append(EO_EXT_URI)

    prov = _load_provenance(cog_path)
    if prov:
        opts = prov.get("cog_options", {})
        software = prov.get("software", {})
        item.properties["processing:software"] = software
        # Keep the filterable primary version separate from the software map.
        if software.get("oam-uploader-convert"):
            item.properties["processing:version"] = software["oam-uploader-convert"]
        item.properties["processing:lineage"] = (
            f"Lossless COG (compress {opts.get('compress')} level {opts.get('level')}, "
            f"predictor {opts.get('predictor')}) derived from the archived original; "
            "per-band GDAL checksums matched the source (corruption check)."
        )
        if prov.get("created_at"):
            item.properties["processing:datetime"] = prov["created_at"]
        if PROC_EXT_URI not in item.stac_extensions:
            item.stac_extensions.append(PROC_EXT_URI)

    # Preserve source software details even without a provenance sidecar.
    source_software = _tag_software(tags)
    if source_software:
        item.properties.setdefault("processing:software", {}).setdefault(
            *source_software
        )
        if PROC_EXT_URI not in item.stac_extensions:
            item.stac_extensions.append(PROC_EXT_URI)

    _apply_file_meta(item.assets["visual"], cog_path)
    if original_path and os.path.exists(original_path):
        item.add_asset(
            "original",
            Asset(
                href=f"{asset_base_url}/{filename}",
                title="Original upload (unmodified)",
                media_type=MediaType.GEOTIFF,
                roles=["data"],
            ),
        )
        _apply_file_meta(item.assets["original"], original_path)

    item.save_object(dest_href=item_path, include_self_link=False)
    log.info(
        "STAC item %s written to %s (product_type=%s, gsd=%.3fm, assets=%s)",
        item_id,
        item_path,
        product_type,
        gsd,
        sorted(item.assets.keys()),
    )


if __name__ == "__main__":
    try:
        log.info("Building STAC item from args: %s", sys.argv[1:9])
        build_item(*sys.argv[1:9])
    except Exception:
        log.exception("Metadata build failed")
        sys.exit(1)
