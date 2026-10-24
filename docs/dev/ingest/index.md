<!-- markdownlint-disable MD013 -->

# Ingesting data

Ingestion takes raster metadata from a source, converts it to OAM's STAC
format, then saves it to PgSTAC. The imagery and elevation files stay where
they are: OAM stores metadata and links to them.

## How it works

Every source follows the same basic flow:

1. Find new source records.
2. For scheduled syncs, skip anything already in PgSTAC.
3. Convert each source record to an OAM STAC Item.
4. Validate it against the [OAM schema](./schema.md).
5. Save it to PgSTAC, where the STAC API and OAM frontend can use it.

The conversion code lives in
[`backend/stactools-hotosm`](https://github.com/hotosm/openaerialmap/tree/main/backend/stactools-hotosm).
This keeps the output consistent, whether an image came from the OAM uploader
or an external catalogue.

## Ingestion sources

| Source                      | How it runs                                       | Schedule           |
| --------------------------- | ------------------------------------------------- | ------------------ |
| OAM uploader                | Argo workflow in `backend/uploader-api/pipeline`  | Once per upload    |
| Legacy OAM API              | `stac-ingest-oam` CronJob                         | Every 30 minutes   |
| Maxar and Vantor            | One `stac-ingest-<provider>` CronJob per provider | Every 3 hours      |
| Copernicus GLO-30 elevation | `stac-ingest-glo30` Job                           | Once when deployed |

The Jobs and CronJobs are defined in
[`apps/oam/` in k8s-infra](https://github.com/hotosm/k8s-infra/tree/main/apps/oam).
They use the `stac-ingester` image from `backend/stac-ingester`.

Changes to `stactools-hotosm` are available in the cluster after they are
merged to `main` and the image has rebuilt.

## CLI commands

The `stac-ingester` image provides the `hotosm` command.

- `sync-<source>` converts new Items and writes them to PgSTAC.
- `dump-<source>` converts Items and saves them as NDJSON. It does not write
  to PgSTAC.
- `sync-collection --catalog=<name>` creates or updates a Collection. Run this
  before the first Item sync for a new source.

Run `hotosm --help` to see the available sources.

## Choosing a sync window

Each scheduled imagery sync needs either `--uploaded-since <seconds>` or
`--uploaded-after <date>`. The meaning of this window depends on the source:

| Command       | Date used                         |
| ------------- | --------------------------------- |
| `sync-oam`    | Upload date from the legacy API   |
| `sync-maxar`  | Event date from `event_info.json` |
| `sync-vantor` | Item `published` date             |

Use a generous window. Existing Items are skipped before conversion, so the
main cost is reading more source metadata. A window that is too narrow can
miss imagery published with an older date.

A normal sync never updates an Item already in PgSTAC. How to update existing
metadata depends on the collection, because an upsert replaces the whole Item
and `openaerialmap` carries assets written after ingest: see
[Updating existing Items](./backfill.md#updating-existing-items).

## Errors

All scheduled imagery syncs use `--handle-exceptions IGNORE`. A bad source
Item is reported at the end, while the rest continue. Without this option, the
first bad Item stops the run.

## Related guides

- [Add a data provider](./new-provider.md)
- [Understand the OAM schema](./schema.md)
- [Backfill or update Items](./backfill.md)
- [Ingest Copernicus GLO-30 elevation](./elevation.md)

<!-- markdownlint-enable MD013 -->
