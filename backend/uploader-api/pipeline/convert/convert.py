"""Create lossy WEBP COGs for visual RGB(A), lossless ZSTD COGs otherwise."""

import datetime as dt
import json
import logging
import os
import sys
from xml.sax.saxutils import escape

import numpy as np
import rasterio
from rasterio.enums import ColorInterp, MaskFlags
from rasterio.shutil import copy as rio_copy
from rasterio.windows import Window

logging.basicConfig(
    level=os.environ.get("LOG_LEVEL", "INFO"),
    format="%(asctime)s %(levelname)s [convert] %(message)s",
)
log = logging.getLogger("convert")

# Every step opens the original the same way validate checked it.
READ_DRIVER = "GTiff"

COMPRESS = os.environ.get("COG_COMPRESS", "ZSTD")
# Level 12 was the measured time/size sweet spot for OAM orthophotos;
# higher levels became very slow for marginal compression gains.
LEVEL = os.environ.get("COG_LEVEL", "12")
BLOCKSIZE = os.environ.get("COG_BLOCKSIZE", "512")
# "average" gives smoother zoomed-out imagery than nearest.
OVERVIEW_RESAMPLING = os.environ.get("COG_OVERVIEW_RESAMPLING", "average")
NUM_THREADS = os.environ.get("COG_NUM_THREADS", "ALL_CPUS")
# Rebuild uploaded overviews to keep derivatives consistent.
OVERVIEWS = os.environ.get("COG_OVERVIEWS", "IGNORE_EXISTING")
GDAL_CACHEMAX = os.environ.get("COG_GDAL_CACHEMAX", "512")  # MB (values <100000)
VERIFY = os.environ.get("COG_VERIFY", "on").lower() != "off"
VALIDATE = os.environ.get("COG_VALIDATE", "on").lower() != "off"
TMPDIR = os.environ.get("CPL_TMPDIR", "/data/tmp")
# "off" keeps visual imagery lossless.
VISUAL_COMPRESS = os.environ.get("COG_VISUAL_COMPRESS", "WEBP").upper()
if VISUAL_COMPRESS not in ("WEBP", "JPEG", "OFF"):
    raise ValueError(
        f"COG_VISUAL_COMPRESS must be WEBP, JPEG or off: {VISUAL_COMPRESS}"
    )
VISUAL_QUALITY = os.environ.get("COG_VISUAL_QUALITY", "90")
LOSSY_MAX_MAE = float(os.environ.get("COG_LOSSY_MAX_MAE", "10"))
PIPELINE_VERSION = os.environ.get("OAM_PIPELINE_VERSION", "dev")


def _predictor_for(dtype: str) -> str:
    """COG predictor: floating-point differencing for float data, else horizontal."""
    return "FLOATING_POINT" if dtype.startswith(("float", "complex")) else "STANDARD"


def _declared_product_type(meta_path: str) -> str:
    """Read the user-declared product_type from meta.json, "" if absent."""
    try:
        with open(meta_path) as f:
            return str(json.load(f).get("product_type", "")).strip().lower()
    except (OSError, ValueError, AttributeError):
        return ""


def _lossy_visual(src: rasterio.DatasetReader, declared: str) -> bool:
    """Return whether this source meets the lossy visual contract."""
    if VISUAL_COMPRESS == "OFF":
        return False
    if src.dtypes[0] != "uint8" or src.count not in (3, 4):
        return False
    # Even when declared visual: an untagged band 4 may be NIR, not alpha.
    if src.count == 4 and src.colorinterp[3] != ColorInterp.alpha:
        return False
    if declared:
        return declared == "visual"
    return True


def _source(path: str, band: str) -> str:
    """VRT SimpleSource XML for one band (or "mask,1") of a file."""
    return (
        f'<SimpleSource><SourceFilename relativeToVRT="0">{escape(path)}'
        f"</SourceFilename><SourceBand>{band}</SourceBand></SimpleSource>"
    )


def _mask_source(src_path: str, src: rasterio.DatasetReader, tmpdir: str) -> str:
    """Source for alpha matching the dataset mask.

    Band nodata masks are per band, so a valid pure-red pixel would be masked
    by band 1; NODATA_VALUES gives GDAL's all-bands-nodata mask instead.
    """
    if MaskFlags.nodata not in src.mask_flag_enums[0]:
        # Alpha band, internal mask, or all valid.
        return _source(src_path, "mask,1")
    nodata = " ".join([repr(src.nodata)] * 3)
    inner = os.path.join(tmpdir, "rgb-nodata.vrt")
    with open(inner, "w") as f:
        f.write(
            f'<VRTDataset rasterXSize="{src.width}" rasterYSize="{src.height}">'
            f'<Metadata><MDI key="NODATA_VALUES">{nodata}</MDI></Metadata>'
            + "".join(
                f'<VRTRasterBand dataType="Byte" band="{b}">'
                f"{_source(src_path, str(b))}</VRTRasterBand>"
                for b in (1, 2, 3)
            )
            + "</VRTDataset>"
        )
    return _source(inner, "mask,1")


def _rgba_vrt(src_path: str, src: rasterio.DatasetReader, tmpdir: str) -> str:
    """Expose RGB plus the source dataset mask as alpha."""
    path = os.path.abspath(src_path)
    sources = [_source(path, str(b)) for b in (1, 2, 3)]
    sources.append(_mask_source(path, src, tmpdir))
    bands = "".join(
        f'<VRTRasterBand dataType="Byte" band="{i}">'
        f"<ColorInterp>{ci}</ColorInterp>{source}</VRTRasterBand>"
        for i, (source, ci) in enumerate(
            zip(sources, ("Red", "Green", "Blue", "Alpha")), start=1
        )
    )
    # Keep dataset tags (e.g. EXIF dates) that metadata.py may fall back on.
    mdi = "".join(
        f'<MDI key="{escape(k, {chr(34): "&quot;"})}">{escape(v)}</MDI>'
        for k, v in src.tags().items()
    )
    return (
        f'<VRTDataset rasterXSize="{src.width}" rasterYSize="{src.height}">'
        f"<SRS>{escape(src.crs.to_wkt())}</SRS>"
        f"<GeoTransform>{', '.join(map(repr, src.transform.to_gdal()))}</GeoTransform>"
        f"<Metadata>{mdi}</Metadata>{bands}</VRTDataset>"
    )


def _verify_lossy(src_path: str, dst_path: str) -> None:
    """Fail on changed georeferencing, any mask difference, or gross pixel error.

    Compares against the source itself, not the VRT, so a wrong VRT is caught.
    """
    with (
        rasterio.open(src_path, driver=READ_DRIVER) as src,
        rasterio.open(dst_path, driver=READ_DRIVER) as dst,
    ):
        for attr in ("width", "height", "crs", "transform"):
            if getattr(src, attr) != getattr(dst, attr):
                raise ValueError(
                    f"{attr} changed: {getattr(src, attr)} -> {getattr(dst, attr)}"
                )
        # Full-resolution mask check in bounded tiles; note tiles with data.
        size = 2048
        with_data = []
        for row in range(0, src.height, size):
            for col in range(0, src.width, size):
                win = Window(
                    col, row, min(size, src.width - col), min(size, src.height - row)
                )
                want = src.dataset_mask(window=win) > 0
                got = dst.dataset_mask(window=win) > 0
                if not np.array_equal(want, got):
                    raise ValueError(
                        f"validity mask changed near col {col} row {row}: "
                        f"{np.count_nonzero(want != got)} pixels differ"
                    )
                if want.any():
                    with_data.append(win)
        # Mean abs error over valid pixels of up to 25 evenly spread data tiles.
        diff, n = 0.0, 0
        if with_data:
            picks = np.linspace(0, len(with_data) - 1, min(25, len(with_data)))
            for i in sorted({int(p) for p in picks}):
                win = with_data[i]
                valid = src.dataset_mask(window=win) > 0
                a = src.read((1, 2, 3), window=win).astype("int16")
                b = dst.read((1, 2, 3), window=win).astype("int16")
                diff += float(np.abs(a - b)[:, valid].sum())
                n += 3 * int(valid.sum())
        mae = diff / n if n else 0.0
        if mae > LOSSY_MAX_MAE:
            raise ValueError(f"lossy error too high: MAE {mae:.2f} > {LOSSY_MAX_MAE}")
    log.info("Lossy verification passed (mask exact, sampled MAE %.2f)", mae)


def _verify_lossless(src_path: str, dst_path: str) -> None:
    """Fail on changed full-resolution GDAL checksums.

    GDAL checksums are 16-bit smoke tests, not cryptographic proof.
    """
    with (
        rasterio.open(src_path, driver=READ_DRIVER) as src,
        rasterio.open(dst_path, driver=READ_DRIVER) as dst,
    ):
        if src.count != dst.count:
            raise ValueError(f"band count changed: {src.count} -> {dst.count}")
        for b in range(1, src.count + 1):
            s, d = src.checksum(b), dst.checksum(b)
            if s != d:
                raise ValueError(f"band {b} checksum mismatch: {s} != {d} (lossy)")
    log.info("Checksum verification passed (all band checksums match)")


def _validate_cog(dst_path: str) -> None:
    """Fail if the output is not a valid COG (rio-cogeo / GDAL layout check)."""
    from rio_cogeo.cogeo import cog_validate

    valid, errors, warnings = cog_validate(dst_path, quiet=True)
    for w in warnings:
        log.warning("COG validator: %s", w)
    if not valid:
        raise ValueError(f"output is not a valid COG: {errors}")
    log.info("COG layout validation passed")


def _write_provenance(dst_path: str, cog_options: dict) -> None:
    """Write conversion details for metadata.py to add to the STAC item.

    Capture versions here because this image performs the conversion.
    """
    prov = {
        "created_at": dt.datetime.now(dt.UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "software": {
            "oam-uploader-convert": PIPELINE_VERSION,
            "rasterio": rasterio.__version__,
            "GDAL": rasterio.__gdal_version__,
        },
        "cog_options": {
            "blocksize": BLOCKSIZE,
            "overview_resampling": OVERVIEW_RESAMPLING,
            **cog_options,
        },
    }
    with open(f"{dst_path}.json", "w") as f:
        json.dump(prov, f)


def convert_to_cog(src_path: str, dst_path: str, meta_path: str | None = None) -> None:
    """Translate a raster into a COG with metadata beside the input by default."""
    src_mb = os.path.getsize(src_path) / 1e6 if os.path.exists(src_path) else -1
    if meta_path is None:
        meta_path = os.path.join(os.path.dirname(src_path), "meta.json")
    declared = _declared_product_type(meta_path)
    with rasterio.open(src_path, driver=READ_DRIVER) as src:
        dtype = src.dtypes[0]
        lossy = _lossy_visual(src, declared)
        os.makedirs(TMPDIR, exist_ok=True)
        vrt_xml = _rgba_vrt(src_path, src, TMPDIR) if lossy else None

    creation: dict = {
        "blocksize": BLOCKSIZE,
        "overviews": OVERVIEWS,
        "overview_resampling": OVERVIEW_RESAMPLING,
        "bigtiff": "IF_SAFER",
        "num_threads": NUM_THREADS,
    }
    if lossy:
        # Predictors do not apply to lossy codecs.
        opts = {
            "compress": VISUAL_COMPRESS,
            "quality": VISUAL_QUALITY,
            "lossy": True,
            # The COG driver turns alpha into a 1-bit mask band for JPEG.
            "mask": "mask band" if VISUAL_COMPRESS == "JPEG" else "alpha",
        }
        creation.update(compress=opts["compress"], quality=VISUAL_QUALITY)
    else:
        predictor = os.environ.get("COG_PREDICTOR", _predictor_for(dtype))
        opts = {"compress": COMPRESS, "predictor": predictor, "lossy": False}
        creation.update(compress=COMPRESS, predictor=predictor)
        # LEVEL only applies to ZSTD / LERC_ZSTD in the COG driver.
        if COMPRESS.upper() in ("ZSTD", "LERC_ZSTD"):
            opts["level"] = LEVEL
            creation["level"] = LEVEL
    log.info(
        "Converting %s (%.1f MB, dtype=%s, declared=%r) -> %s [COG driver, %s]",
        src_path,
        src_mb,
        dtype,
        declared,
        dst_path,
        opts,
    )

    # Talos-in-Docker misreports free space, so only local tests disable the guard.
    # Production stores scratch data here and retains GDAL's default check.
    env = {
        "GDAL_NUM_THREADS": NUM_THREADS,
        "GDAL_CACHEMAX": int(GDAL_CACHEMAX),
        "CPL_TMPDIR": TMPDIR,
    }
    # An open dataset rather than a path, so the copy goes through READ_DRIVER.
    with rasterio.Env(**env):
        if vrt_xml:
            with rasterio.open(vrt_xml) as src:
                rio_copy(src, dst_path, driver="COG", **creation)
        else:
            with rasterio.open(src_path, driver=READ_DRIVER) as src:
                rio_copy(src, dst_path, driver="COG", **creation)

    if VERIFY:
        if lossy:
            _verify_lossy(src_path, dst_path)
        else:
            _verify_lossless(src_path, dst_path)
    if VALIDATE:
        _validate_cog(dst_path)
    _write_provenance(dst_path, opts)


if __name__ == "__main__":
    try:
        convert_to_cog(*sys.argv[1:4])
        log.info("COG written to %s", sys.argv[2])
    except Exception:
        log.exception("COG conversion failed")
        sys.exit(1)
