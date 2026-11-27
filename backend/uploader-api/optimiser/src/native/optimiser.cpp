// Writes the same COG as pipeline/convert/convert.py, so the server skips
// conversion. Keep the two in step.
#include "optimiser.h"

#include <cpl_conv.h>
#include <cpl_error.h>
#include <cpl_string.h>
#include <cpl_vsi.h>
#include <gdal.h>
#include <gdal_utils.h>

#include <initializer_list>

namespace {

const char* const NODATA_VRT = "/vsimem/rgb-nodata.vrt";

const std::initializer_list<const char*> COG_ARGS = {
    "-of", "COG",
    // The mask becomes alpha, which the COG driver stores as a mask band.
    "-b", "1", "-b", "2", "-b", "3", "-b", "mask", "-colorinterp_4", "alpha",
    "-a_nodata", "none",
    "-co", "COMPRESS=JPEG", "-co", "QUALITY=90", "-co", "BLOCKSIZE=512",
    "-co", "OVERVIEWS=IGNORE_EXISTING", "-co", "OVERVIEW_RESAMPLING=AVERAGE",
    "-co", "BIGTIFF=IF_SAFER", "-co", "NUM_THREADS=ALL_CPUS",
};

bool isVisual(GDALDatasetH ds) {
    const int count = GDALGetRasterCount(ds);
    if (count != 3 && count != 4) return false;
    if (GDALGetRasterDataType(GDALGetRasterBand(ds, 1)) != GDT_Byte) return false;
    if (count == 3) return true;
    return GDALGetRasterColorInterpretation(GDALGetRasterBand(ds, 4)) == GCI_AlphaBand;
}

GDALDatasetH translate(const char* dst, GDALDatasetH src, std::initializer_list<const char*> argv,
                       const char* extra = nullptr) {
    CPLStringList args;
    for (const char* arg : argv) args.AddString(arg);
    if (extra) args.AddString(extra);
    GDALTranslateOptions* opts = GDALTranslateOptionsNew(args.List(), nullptr);
    GDALDatasetH out = GDALTranslate(dst, src, opts, nullptr);
    GDALTranslateOptionsFree(opts);
    return out;
}

// Band nodata would hide valid pixels that are 0 in band 1 only.
// NODATA_VALUES masks only pixels that are nodata in every band.
GDALDatasetH allBandsNodata(GDALDatasetH src) {
    const double nodata = GDALGetRasterNoDataValue(GDALGetRasterBand(src, 1), nullptr);
    const CPLString value = CPLSPrintf("%.17g", nodata);
    const CPLString values = "NODATA_VALUES=" + value + " " + value + " " + value;
    return translate(NODATA_VRT, src,
                     {"-of", "VRT", "-b", "1", "-b", "2", "-b", "3", "-a_nodata", "none", "-mo"},
                     values.c_str());
}

std::string lastError(const char* fallback) {
    const char* msg = CPLGetLastErrorMsg();
    return (msg && *msg) ? msg : fallback;
}

}  // namespace

std::string Optimiser::run(const std::string& srcPath, const std::string& dstPath) {
    GDALAllRegister();
    // As in convert.py. GDAL's default ZSTD temp file also runs out of WASM memory.
    CPLSetConfigOption("COG_TMP_COMPRESSION", "NONE");
    CPLErrorReset();
    GDALDatasetH src = GDALOpen(srcPath.c_str(), GA_ReadOnly);
    if (!src) return lastError("Could not read this file as a GeoTIFF.");
    if (!isVisual(src)) {
        GDALClose(src);
        return "This is not a colour photo (8-bit RGB or RGBA), so it can't be optimised. "
               "Upload it as it is. Elevation and multispectral files are kept lossless.";
    }

    const bool nodataMask = GDALGetMaskFlags(GDALGetRasterBand(src, 1)) & GMF_NODATA;
    GDALDatasetH input = nodataMask ? allBandsNodata(src) : src;
    GDALDatasetH out = input ? translate(dstPath.c_str(), input, COG_ARGS) : nullptr;
    // Closing writes the last bytes, so it can still fail, e.g. when the disk is full.
    const bool written = out && GDALClose(out) == CE_None;
    const std::string error = written ? "" : lastError("Optimising failed.");

    if (input && input != src) GDALClose(input);
    GDALClose(src);
    VSIUnlink(NODATA_VRT);
    return error;
}
