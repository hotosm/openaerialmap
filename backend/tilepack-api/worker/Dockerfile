FROM python:3.13-slim

ARG PMTILES_VERSION=1.30.1

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates curl gdal-bin libgdal-dev \
    && curl -fsSL \
        "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz" \
        | tar -xz -C /usr/local/bin pmtiles \
    && apt-get purge -y --auto-remove curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN pip install --no-cache-dir \
        "rio-tiler==9.0.5" \
        "rasterio>=1.5.0" \
        "boto3==1.42.85" \
        "httpx==0.28.1"

COPY generate.py /app/generate.py

# GDAL tuning for remote COG reads - matches the settings used by
# the stac-api service. Without these, rio-tiler is dramatically
# slower on every tile because GDAL re-opens the file and re-reads
# the header each time.
ENV VSI_CACHE=TRUE \
    # 64 MB — enough for 8 concurrent tile readers to keep their
    # IFD headers and a few recent range-read blocks cached. The
    # worker only reads one 256x256 tile per thread at a time so
    # the original 512 MB was pure waste.
    VSI_CACHE_SIZE=67108864 \
    # 128 MB raster block cache — again, we are reading individual
    # tiles not doing a full raster scan, so 512 MB was overkill.
    GDAL_CACHEMAX=128 \
    GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES \
    GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR \
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff" \
    # Cap per-thread VSICURL initial read to 16 KB. The default
    # (16 KB in recent GDAL) is fine, but being explicit avoids
    # surprises if the base image ships a different GDAL version.
    GDAL_INGESTED_BYTES_AT_OPEN=16384 \
    # Retry transient S3 errors instead of failing the tile.
    GDAL_HTTP_MAX_RETRY=3 \
    GDAL_HTTP_RETRY_DELAY=2

ENTRYPOINT ["python", "/app/generate.py"]
