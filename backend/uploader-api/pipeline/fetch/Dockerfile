# syntax=docker/dockerfile:1
FROM python:3.12-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.11.29 /uv /uvx /bin/

# Keep generated script shebangs valid when copying the venv between stages.
ENV UV_MANAGED_PYTHON=false \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/app/.venv

ENV CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /src/uploader-api/pipeline

# Workspace manifests + lock, then a frozen sync of just this member's deps.
# Every member's manifest has to be present for the lock to be usable, even
# though only this one gets installed. No build tooling: these are all wheels.
COPY uploader-api/pipeline/pyproject.toml uploader-api/pipeline/uv.lock ./
COPY uploader-api/pipeline/fetch/pyproject.toml fetch/
COPY uploader-api/pipeline/validate/pyproject.toml validate/
COPY uploader-api/pipeline/convert/pyproject.toml convert/
COPY uploader-api/pipeline/metadata/pyproject.toml metadata/
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-editable --package oam-pipeline-fetch

# Test image (`just test fetch`): builder venv + test group + step source.
FROM builder AS test
ENV PATH=/app/.venv/bin:$PATH
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-install-project --no-editable \
        --package oam-pipeline-fetch --group test
COPY uploader-api/pipeline/fetch/ ./fetch/
COPY uploader-api/app/uploads/url_guard.py ./fetch/url_guard.py
CMD ["pytest", "fetch/tests"]

FROM python:3.12-slim AS prod
# Unbuffered + faulthandler so step logs flush immediately and tracebacks are
# complete; skip .pyc clutter.
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONFAULTHANDLER=1 \
    PATH=/app/.venv/bin:$PATH

WORKDIR /app
COPY --from=builder /app/.venv /app/.venv
COPY uploader-api/pipeline/fetch/fetch.py /app/fetch.py
# One copy of the address rules, shared with the API.
COPY uploader-api/app/uploads/url_guard.py /app/url_guard.py
# Fail the build early if the image or its deps are broken.
RUN python -c "import fetch"
ENTRYPOINT ["python", "fetch.py"]
