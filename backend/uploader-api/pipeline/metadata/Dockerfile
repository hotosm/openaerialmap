# syntax=docker/dockerfile:1
# Build from the pipeline/ workspace root so the shared uv.lock applies:
#   docker build -f metadata/Dockerfile pipeline/
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.11.29 /uv /uvx /bin/

ENV UV_MANAGED_PYTHON=false \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# git for the stactools-hotosm workspace source; build tools for any sdist-only dep.
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get install -y --no-install-recommends build-essential git && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app

# Workspace manifests + lock, then a frozen sync of just this member's deps.
COPY pyproject.toml uv.lock ./
COPY validate/pyproject.toml validate/
COPY convert/pyproject.toml convert/
COPY metadata/pyproject.toml metadata/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-editable --package oam-pipeline-metadata

# Test image (`just test metadata`): builder venv + test group + step source.
FROM builder AS test
ENV PATH=/app/.venv/bin:$PATH
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-editable \
        --package oam-pipeline-metadata --group test
COPY metadata/ /app/metadata/
CMD ["pytest", "metadata/tests"]

FROM python:3.12-slim AS prod
# Unbuffered + faulthandler so step logs flush immediately and tracebacks are
# complete; skip .pyc clutter.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONFAULTHANDLER=1 \
    PATH=/app/.venv/bin:$PATH

# libexpat1 required by rasterio's bundled GDAL.
RUN apt-get update && \
    apt-get install -y --no-install-recommends libexpat1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY metadata/metadata.py /app/metadata.py
# Fail the build early if the image or its deps are broken.
RUN python -c "import metadata"
ENTRYPOINT ["python", "metadata.py"]
