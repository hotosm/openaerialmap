# OpenAerialMap STAC Ingester

The image behind the `stac-ingest-*` CronJobs. It ships the `hotosm` CLI from
[stactools-hotosm](../stactools-hotosm/), which it takes as a path dependency
so the two cannot drift apart.

Build it from `backend/`:

```bash
docker build -f backend/stac-ingester/Dockerfile --target prod backend
```

## Setup

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then:

```bash
uv sync --all-groups
```

## Docs

- [Ingestion overview](../../docs/dev/ingest/index.md) - the routes in, the
  CLI, and how sync windows behave.
- [Backfill](../../docs/dev/ingest/backfill.md) - imagery missing from the
  catalogue.
- [Add a data provider](../../docs/dev/ingest/new-provider.md).
