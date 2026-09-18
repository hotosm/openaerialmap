<!-- markdownlint-disable MD046 -->

# Backfill or update Items

Use this guide when source imagery is missing from PgSTAC, or when an existing
Item needs to be rebuilt with new metadata.

For missing imagery, follow the steps below in order.

## 1. Confirm the Item is missing

For legacy OAM imagery, the STAC Item ID is the legacy `_id`:

```bash
ID=6a90f57bf93a44f85f488422
curl -s "https://api.openaerialmap.org/meta?_id=$ID" | jq '.meta.found'
curl -so /dev/null -w '%{http_code}\n' \
  "https://api.imagery.hotosm.org/stac/collections/openaerialmap/items/$ID"
```

`found: 1` from the legacy API and `404` from the STAC API confirms that the
Item is missing from PgSTAC.

For Maxar and Vantor, compare the source bucket against the API:

```bash
curl -so /dev/null -w '%{http_code}\n' \
  "https://api.imagery.hotosm.org/stac/collections/maxar-opendata/items/<id>"
```

Maxar IDs contain slashes at the source and are stored with `-` instead.

## 2. Check the Job logs

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

With `--handle-exceptions IGNORE`, Item errors are listed at the end without
stopping the Job.

!!! warning "`Completed ingesting N` is not proof"

    This is the number of Items built, not the number accepted by PgSTAC. If
    every run reports the same Items, continue to
    [step 4](#4-if-items-still-do-not-appear).

## 3. Run a backfill

A sync skips Items already in PgSTAC, so using a wide date range is safe.

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

The same process works with the `stac-ingest-maxar` and
`stac-ingest-vantor` CronJobs.

## 4. If Items still do not appear

Check the PgSTAC and `pypgstac` versions:

```bash
psql -c "select pgstac.get_version();"
kubectl -n oam exec job/<job> -- pip show pypgstac | head -2
```

`pypgstac` versions before **0.9.11** can report success without writing Items
when used with PgSTAC 0.9.10 or earlier. The loader reads stale partition
bounds, the insert fails, then an empty retry returns successfully.

Upgrade to `pypgstac>=0.9.11`. The next sync should pick up the missing Items;
no database repair is needed.

To see the real constraint, rather than what the view claims:

```sql
select id, key from pgstac.collections where id = 'openaerialmap';
select pg_get_constraintdef(oid) from pg_constraint
  where conrelid = 'pgstac._items_<key>'::regclass and contype = 'c';
```

## Updating existing Items

A sync skips Items already in PgSTAC, so it cannot update them. Dump the source
and upsert the result instead:

```bash
hotosm dump-maxar --uploaded-after 2023-01-01 --handle-exceptions IGNORE \
  --file maxar.ndjson
pypgstac load items --method upsert maxar.ndjson
```

`dump-<source>` rebuilds the Items without checking PgSTAC. `upsert` then
inserts missing Items and replaces existing ones.

## Find all missing legacy Items in a date range

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
