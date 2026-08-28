<!-- markdownlint-disable MD046 -->

# Backfill

Imagery exists at the source but is not in the catalogue. Work through this in
order.

## 1. Confirm it is actually missing

For legacy OAM imagery, the STAC Item ID is the legacy `_id`:

```bash
ID=6a90f57bf93a44f85f488422
curl -s "https://api.openaerialmap.org/meta?_id=$ID" | jq '.meta.found'
curl -so /dev/null -w '%{http_code}\n' \
  "https://api.imagery.hotosm.org/stac/collections/openaerialmap/items/$ID"
```

`found: 1` and a `404` means it was never ingested.

For Maxar and Vantor, compare the source bucket against the API:

```bash
curl -so /dev/null -w '%{http_code}\n' \
  "https://api.imagery.hotosm.org/stac/collections/maxar-opendata/items/<id>"
```

Maxar IDs contain slashes at the source and are stored with `-` instead.

## 2. Read the Job logs

```bash
kubectl -n oam get jobs -l app=stac-ingest-oam --sort-by=.metadata.creationTimestamp
kubectl -n oam logs job/stac-ingest-oam-<id> --tail=100
```

A run prints what it found, what it skipped, and what it ingested:

```text
Found 6600 metadata items added since 2024-01-01 00:00:00+00:00
Skipping 6524 Items already in PgSTAC
Completed ingesting 76 STAC Items
```

Item errors are listed after that and do not fail the Job.

!!! warning "`Completed ingesting N` is not proof"
That number is how many Items the run **built**, not how many PgSTAC
accepted. If the same count comes back every run, the Items are not
landing - go to [step 4](#4-if-nothing-lands).

## 3. Run a backfill

A sync skips Items already in PgSTAC, so a wide window is safe.

```bash
kubectl -n oam create job oam-backfill --from=cronjob/stac-ingest-oam \
  --dry-run=client --output yaml > job.yaml
```

Edit the `hotosm sync-oam` line in `job.yaml` to widen the window:

```text
hotosm sync-oam --uploaded-after 2024-01-01 --handle-exceptions IGNORE
```

Then:

```bash
kubectl create -f job.yaml
kubectl -n oam logs -f job/oam-backfill
kubectl -n oam delete job oam-backfill
```

The same works for `stac-ingest-maxar` and `stac-ingest-vantor`.

## 4. If nothing lands

The loader can report success and store nothing. Check the versions first:

```bash
psql -c "select pgstac.get_version();"
kubectl -n oam exec job/<job> -- pip show pypgstac | head -2
```

`pypgstac` below **0.9.11** against a pgstac database of 0.9.10 or earlier
silently discards Items:

1. Before 0.9.11, `partitions` is a materialized view, and the loader reads
   partition bounds from it.
2. Stale or mis-parsed bounds make the loader think the partition already
   covers the new dates, so it never widens the partition's `CHECK`
   constraint.
3. The insert violates that constraint. The retry then re-runs on a spent
   generator, writes zero rows, and returns success.

The fix is `pypgstac>=0.9.11`, which reads live bounds and widens the
constraint itself. No repair is needed afterwards - the next sync picks the
Items up.

To see the real constraint, rather than what the view claims:

```sql
select id, key from pgstac.collections where id = 'openaerialmap';
select pg_get_constraintdef(oid) from pg_constraint
  where conrelid = 'pgstac._items_<key>'::regclass and contype = 'c';
```

## Rewriting existing Items

A sync skips Items already in PgSTAC, so it cannot change them. To push new
metadata over Items that are already there, dump and load instead:

```bash
hotosm dump-maxar --uploaded-after 2023-01-01 --handle-exceptions IGNORE \
  --file maxar.ndjson
pypgstac load items --method upsert maxar.ndjson
```

`dump-<source>` writes everything it is given, and `upsert` overwrites.

## Audit a date range

List legacy Items missing from PgSTAC:

```bash
uv run python - <<'PY'
import datetime as dt
import requests
from stactools.hotosm.oam_metadata_client import OamMetadataClient

after = dt.datetime(2026, 8, 20, tzinfo=dt.UTC)
stac = "https://api.imagery.hotosm.org/stac/collections/openaerialmap/items"
for m in OamMetadataClient.new().get_all_items(after):
    if requests.get(f"{stac}/{m.id}").status_code == 404:
        print(m.uploaded_at, m.id, m.title)
PY
```

<!-- markdownlint-enable MD046 -->
