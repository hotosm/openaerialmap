ARG PYTHON_VERSION=3.13

FROM python:${PYTHON_VERSION}-slim AS builder
COPY --from=ghcr.io/astral-sh/uv:0.12.1 /uv /uvx /bin/

ENV UV_MANAGED_PYTHON=false \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

# Build deps: libpq for psycopg[c], git for the hotosm-auth git dependency.
RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get install -y --no-install-recommends build-essential git libpq-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

ENV CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt
WORKDIR /app

RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --no-install-project --no-editable --no-dev

COPY . /app
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-editable --no-dev

# Test image (`just test uploader`): builder venv + test group, runs app/tests.
FROM builder AS test
# helm, so the chart rendering tests run in CI rather than silently skipping.
# From the official image so buildx picks the right architecture.
COPY --from=alpine/helm:3.19.0 /usr/bin/helm /usr/local/bin/helm
ENV PATH=/app/.venv/bin:$PATH
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --no-editable --group test
CMD ["pytest", "tests"]

FROM python:${PYTHON_VERSION}-slim AS prod
# libpq5 for psycopg; postgresql-client (psql/pg_isready) + gettext-base
# (envsubst) for the migration entrypoint.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        libpq5 postgresql-client gettext-base && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=builder /app /app
# Migrations run as an init-container / one-shot service via this entrypoint.
COPY migrations/ /opt/migrations/
COPY migrate-entrypoint.sh /migrate-entrypoint.sh
RUN chmod +x /migrate-entrypoint.sh
ENV PATH=/app/.venv/bin:$PATH

EXPOSE 8080
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
