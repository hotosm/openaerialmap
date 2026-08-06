ARG PYTHON_VERSION=3.12
ARG PLATFORM=linux/amd64

FROM python:${PYTHON_VERSION}-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /uvx /bin/

ENV UV_MANAGED_PYTHON=false
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy

RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get install -y build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

ENV UV_PROJECT_ENVIRONMENT=/app/.venv
WORKDIR /src/stac-ingester

# Include the local path dependency before syncing.
COPY stactools-hotosm/ /src/stactools-hotosm/
COPY stac-ingester/pyproject.toml stac-ingester/uv.lock ./

# Install dependencies
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-install-project --no-editable

COPY stac-ingester/ ./

# Sync the project
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --locked --no-editable

FROM python:${PYTHON_VERSION}-slim AS prod

# "rasterio" needs libexpat1
RUN apt-get update && \
    apt-get install -y libexpat1 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder --chown=app:app /app /app

ENV PATH=/app/.venv/bin:$PATH

CMD ["/app/.venv/bin/hotosm", "--help"]
