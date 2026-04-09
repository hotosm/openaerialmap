# syntax=docker/dockerfile:1
ARG PYTHON_IMG_TAG=3.13

# ---------------------------------------------------------------------------
# Build stage – compile native wheels (rasterio, GDAL bindings)
# ---------------------------------------------------------------------------
FROM python:${PYTHON_IMG_TAG}-slim-trixie AS build

ARG PMTILES_VERSION=1.30.1

# Build-time deps: headers + compilers for rasterio/GDAL wheels
RUN set -ex \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential \
        gcc \
        g++ \
        libgdal-dev \
        libgeos-dev \
        libproj-dev \
        curl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Fetch the pmtiles CLI (static Go binary) – done in the build stage so
# we can drop curl from the final image.
RUN curl -fsSL \
        "https://github.com/protomaps/go-pmtiles/releases/download/v${PMTILES_VERSION}/go-pmtiles_${PMTILES_VERSION}_Linux_x86_64.tar.gz" \
        | tar -xz -C /usr/local/bin pmtiles

WORKDIR /project

# Install uv
COPY --from=ghcr.io/astral-sh/uv:0.11.4 /uv /bin/uv

ARG PYTHON_IMG_TAG=3.13
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_NO_CACHE=1 \
    UV_PYTHON="python${PYTHON_IMG_TAG}" \
    UV_PROJECT_ENVIRONMENT=/opt/python

COPY pyproject.toml uv.lock /project/

RUN uv sync --locked --no-editable --no-dev

# ---------------------------------------------------------------------------
# Runtime stage – minimal image with only shared libraries
# ---------------------------------------------------------------------------
FROM python:${PYTHON_IMG_TAG}-slim-trixie AS runtime

ARG PYTHON_IMG_TAG=3.13
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PATH="/opt/python/bin:$PATH"

# Runtime-only shared libs (no headers, no compilers)
RUN set -ex \
    && apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        ca-certificates \
        libgdal36 \
        libgeos-c1t64 \
        libproj25 \
    && rm -rf /var/lib/apt/lists/*

# Python packages from the build stage
COPY --from=build /opt/python /opt/python

# pmtiles CLI from the build stage
COPY --from=build /usr/local/bin/pmtiles /usr/local/bin/pmtiles

WORKDIR /app
COPY generate.py /app/generate.py

# GDAL tuning for remote COG reads
ENV VSI_CACHE=TRUE \
    VSI_CACHE_SIZE=67108864 \
    GDAL_CACHEMAX=128 \
    GDAL_HTTP_MERGE_CONSECUTIVE_RANGES=YES \
    GDAL_DISABLE_READDIR_ON_OPEN=EMPTY_DIR \
    CPL_VSIL_CURL_ALLOWED_EXTENSIONS=".tif,.tiff" \
    GDAL_INGESTED_BYTES_AT_OPEN=16384 \
    GDAL_HTTP_MAX_RETRY=3 \
    GDAL_HTTP_RETRY_DELAY=2 \
    GDAL_HTTP_MULTIPLEX=YES \
    GDAL_HTTP_TCP_KEEPALIVE=YES \
    CPL_VSIL_CURL_USE_HEAD=NO

ENTRYPOINT ["python", "/app/generate.py"]
