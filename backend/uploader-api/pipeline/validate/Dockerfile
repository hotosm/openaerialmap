# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.11.29 /uv /uvx /bin/

# Keep generated script shebangs valid when copying the venv between stages.
ENV UV_MANAGED_PYTHON=false \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get install -y --no-install-recommends build-essential && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

ENV CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /src/uploader-api/pipeline

# Workspace manifests + lock, then a frozen sync of just this member's deps.
COPY uploader-api/pipeline/pyproject.toml uploader-api/pipeline/uv.lock ./
COPY uploader-api/pipeline/validate/pyproject.toml validate/
COPY uploader-api/pipeline/convert/pyproject.toml convert/
COPY uploader-api/pipeline/metadata/pyproject.toml metadata/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-editable --package oam-pipeline-validate

FROM python:3.12-slim AS prod
# Unbuffered + faulthandler so step logs flush immediately and tracebacks are
# complete; skip .pyc clutter.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONFAULTHANDLER=1 \
    PATH=/app/.venv/bin:$PATH

# libexpat1 is required by rasterio's bundled GDAL.
RUN apt-get update && \
    apt-get install -y --no-install-recommends libexpat1 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY uploader-api/pipeline/validate/validate.py /app/validate.py
# Fail the build early if the image or its deps are broken.
RUN python -c "import validate"
ENTRYPOINT ["python", "validate.py"]
