ARG PYTHON_VERSION=3.12
ARG PLATFORM=linux/amd64



FROM debian:bookworm-slim AS tippecanoe
WORKDIR /src
RUN apt-get update \
  && apt-get -y install \
    git make gcc g++ libsqlite3-dev zlib1g-dev
RUN git clone https://github.com/felt/tippecanoe.git
WORKDIR /src/tippecanoe
RUN make -j
RUN make install



FROM python:${PYTHON_VERSION}-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_MANAGED_PYTHON=false
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV PYTHONUNBUFFERED=1

# Install dependencies for,
# * Git sources
# * building wheels (if needed)
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get install -y build-essential git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

WORKDIR /app

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --locked --no-install-project --no-editable

COPY . /app

# Sync the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-editable

FROM python:${PYTHON_VERSION}-slim AS prod

VOLUME /app/output

# "psycopg" needs lib-pq
# "rasterio" needs libexpat1
# "tippecanoe" needs libsqlite3-0
RUN apt-get update && \
    apt-get install -y \
        libexpat1 \
        libpq-dev \
        libsqlite3-0 \
    && apt-get clean && \
    rm -rf /var/lib/apt/lists/* \
    && mkdir -p /app/output

WORKDIR /app
COPY --from=builder --chown=app:app /app /app
COPY --from=tippecanoe /src/tippecanoe/tippecanoe* /usr/local/bin/
COPY --from=tippecanoe /src/tippecanoe/tile-join /usr/local/bin/
# See scripts/README.md for details on the script used
COPY scripts/gen_coverage_vector.py /app/gen_coverage_vector.py

ENV PATH=/app/.venv/bin:$PATH

CMD ["python", "-u", "gen_coverage_vector.py"]
