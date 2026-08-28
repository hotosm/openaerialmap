<!-- markdownlint-disable MD013 -->

# Ingestion

Everything that puts imagery into the OAM STAC catalogue.

- [Add a data provider](./new-provider.md) - write an ingestor for a new source.
- [Backfill](./backfill.md) - imagery is missing from the catalogue, fix it.
- [STAC extension](./schema.md) - the `oam:` fields, and moving Items between
  schema versions.

## The three routes in

All of them build STAC Items with the same package,
[`backend/stactools-hotosm`](https://github.com/hotosm/openaerialmap/tree/main/backend/stactools-hotosm),
so an Item looks the same however it arrived.

| Route                | Covers                              | Runs as                                                      |
| -------------------- | ----------------------------------- | ------------------------------------------------------------ |
| Uploader pipeline    | one upload at a time                | Argo workflow, `backend/uploader-api/pipeline`               |
| Legacy OAM API       | the old openaerialmap.org catalogue | `stac-ingest-oam` CronJob, every 30 min                      |
| Open data catalogues | Maxar, Vantor                       | `stac-ingest-maxar` and `stac-ingest-vantor` CronJobs, daily |

The CronJobs are in
[k8s-infra](https://github.com/hotosm/k8s-infra/tree/main/apps/oam) under
`apps/oam/`. They all run the `stac-ingester` image, built from
`backend/stac-ingester`.

!!! warning "The image tracks `main`"

    A change to `stactools-hotosm` only reaches the cluster once it is merged
    to `main` and the image rebuilds.

## The CLI

The image ships one command, `hotosm`. Each source gets a pair:

- `sync-<source>` writes straight to PgSTAC.
- `dump-<source>` writes NDJSON, for loading with `pypgstac` separately.

Plus one command for Collections:

- `sync-collection --catalog=<name>` creates or updates the Collection. Run it
  once before the first sync of a new source, or every Item lands orphaned.

`hotosm --help` lists what is currently registered.

## Sync windows

Every sync takes a window, either `--uploaded-since <seconds>` or
`--uploaded-after <date>`.

The window filters the **source**, and means something different for each one:

| Command       | The window filters on                                               |
| ------------- | ------------------------------------------------------------------- |
| `sync-oam`    | when the image was uploaded to the legacy API                       |
| `sync-maxar`  | the event date in `event_info.json`, not when imagery was published |
| `sync-vantor` | the Item's `published` property                                     |

Two things follow from that:

1. **Prefer a wide window.** Items already in PgSTAC are skipped before
   anything is rebuilt, so a wide window only costs a walk of the source
   catalogue. A narrow one loses imagery for good whenever a source publishes
   something with an older date than the window.
2. **A sync never rewrites an Item already in PgSTAC.** To change metadata on
   Items that are already there, see
   [rewriting existing Items](./backfill.md#rewriting-existing-items).

## Handling bad source data

Pass `--handle-exceptions IGNORE` to any sync or dump. Items that fail are
listed at the end of the run and do not stop the rest.

Every Item is validated against the [OAM extension](./schema.md) as it is
built, and upstream metadata is uneven, so all the CronJobs use it.

<!-- markdownlint-enable MD013 -->
