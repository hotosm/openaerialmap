# Batch Ingestion into OAM STAC Catalog

This package contains a set of command line interface (CLI) programs designed
to help ingest STAC data into the (PgSTAC based) OpenAerialMap STAC Catalog.
These CLI programs address two main use cases:

1. Backfilling historical data into PgSTAC as part of standing up a new STAC
   Catalog.
2. Updating the STAC Catalog to include new imagery added to an upstream data
   catalog since the last time that we ran the CLI program.

The second use case is a better fit for event driven rather than a batch
processing design, but this feature is still useful because,

- During the transition from the Open Imagery Network (OIN) metadata
  specification based catalog for Open Aerial Map, we decided that it would be
  more practical to pull from the existing OpenAerialMap catalog API rather
  than to push to the new STAC Catalog from this legacy catalog API.
- For 3rd party catalogs there is often no mechanism for receiving events
  about published imagery. For example the Maxar Open Data Program on
  [AWS Registry of Open Data](https://registry.opendata.aws/maxar-open-data/)
  does not include any way of subscribing to newly added data. We must check
  on a scheduled frequency.

To address these use cases, the CLI programs can ingest data through two
mechanisms described below.

## Dump to an intermediate format and ingest using `pypgstac` tools

Backfill operations can be difficult because they might take a very long time
and encounter errors in upstream data, but hopefully are only a one time
operation. These concerns can make it challenging to run the backfill as a
single operation, so the CLI programs in this package allow the user to split
the task into two steps:

1. Generate STAC Items from the upstream data source and save to an
   intermediate file.
2. Load the STAC Items into the PgSTAC data store powering the STAC API.

This operation could be performed locally and added to the STAC API using the
[make ingest](https://github.com/developmentseed/eoapi-k8s/blob/v0.7.5/docs/manage-data.md)
data management script from `eoapi-k8s`.

For example:

```bash
$ hotosm dump-collection --catalog=OAM --file collection.json
Saved the STAC Collection definition for Maxar to collection.json.
$ hotosm dump-oam --uploaded-after 2025-08-01 --file items.json
Looking for OAM metadata entities added since 2025-08-01 00:00:00+00:00
Found 38 metadata items added since 2025-08-01 00:00:00+00:00
Completed dumping 38 STAC Items to items.ndjson
$ make ingest
...
```

You might also consider adding `--handle-exceptions=IGNORE` to be able to
finish the STAC creation even if there are issues with the data upstream
(e.g., the OpenAerialMap had a `baloon` instead of `balloon`). Errors will be
printed out before the program exits so you can triage later.

## Ingest directly into PgSTAC

There is another set of CLI programs designed to keep the catalog up to date
that combine the steps of STAC creation and ETL into the PgSTAC database.
These programs should be more useful as scheduled tasks since they complete
the entire workflow.

When scheduling the STAC ingestion using something like a `cron` execution
schedule, you can use the `--uploaded-since` to provide a relative datetime
based on the scheduling frequency (e.g., 30 minutes). Because there might be
small delays between when the program is scheduled and when it begins running,
you should add a small amount of overlap in the `--uploaded-since` argument to
ensure there are no gaps. These CLI programs run the ETL step using the
"upsert" mode of PgSTAC, which should accomodate any STAC Items that are
created in sequential runs. For example, if you are scheduling the ETL step to
run every 30 minutes, consider running with `--uploaded-since=2100`
(35 minutes).
