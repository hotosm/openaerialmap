# OpenAerialMap STAC Ingester

Runs the OAM STAC ingester using
[stactools-hotosm](../stactools-hotosm/) as a path dependency. Build the image
from `backend/`:

```bash
docker build -f backend/stac-ingester/Dockerfile --target prod backend
```

## Setup

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), then run:

```bash
uv sync --all-groups
```

## Re-ingesting the catalog

The `stac-ingest-oam` CronJob runs every 30 minutes. Its time windows overlap,
and Items already in PgSTAC are skipped. Failed runs are retried automatically
unless the missing upload is older than the overlap window.

## Missing images

Use the legacy `_id` as the STAC Item ID:

```bash
ID=6a90f57bf93a44f85f488422
curl -s "https://api.openaerialmap.org/meta?_id=$ID" | jq '.meta.found'
curl -so /dev/null -w '%{http_code}\n' \
  "https://api.imagery.hotosm.org/stac/collections/openaerialmap/items/$ID"
```

`found: 1` and a `404` means the Item was not ingested.

### Check the logs

```bash
kubectl -n oam get jobs -l app=stac-ingest-oam --sort-by=.metadata.creationTimestamp
kubectl -n oam logs job/stac-ingest-oam-<id> --tail=100
```

Item errors appear at the end of the log and do not fail the Job.

### Backfill

`sync-oam` skips existing Items, so it is safe to use a wide date range.

```bash
kubectl create job stac-ingest-oam-backfill --from=cronjob/stac-ingest-oam \
  --dry-run=client --output yaml > job.yaml
```

In `job.yaml`, replace the `hotosm sync-oam` line with:

```text
hotosm sync-oam --uploaded-after 2026-08-20 --handle-exceptions IGNORE
```

Then run:

```bash
kubectl create -f job.yaml
kubectl -n oam logs -f job/stac-ingest-oam-backfill
kubectl -n oam delete job stac-ingest-oam-backfill
```

Use `--uploaded-after` for a fixed backfill date.

### Audit a date range

List legacy Items missing from PgSTAC:

```bash
uv run python - <<'EOF'
import datetime as dt
import requests
from stactools.hotosm.oam_metadata_client import OamMetadataClient

after = dt.datetime(2026, 8, 20, tzinfo=dt.UTC)
stac = "https://api.imagery.hotosm.org/stac/collections/openaerialmap/items"
for m in OamMetadataClient.new().get_all_items(after):
    if requests.get(f"{stac}/{m.id}").status_code == 404:
        print(m.uploaded_at, m.id, m.title)
EOF
```
