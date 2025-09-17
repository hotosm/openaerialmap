# OpenAerialMap STAC Ingester

This directory contains a deployment of the STAC ingester for HOTOSM based on the
STAC creation package, [stactools-hotosm](https://github.com/hotosm/stactools-hotosm).

## Getting Started

This project uses [uv](https://docs.astral.sh/uv/getting-started/installation/)
to manage Python dependencies.

Once `uv` is installed, you can install the dependencies by,

```bash
uv sync --all-groups
```

## Re-ingesting The Catalog

- The ingestion from the old metadata API runs as a Kubernetes CronJob
  on a 30 minute schedule.
- If anything is missed and ingestion must be run manually, a new Job
  can be spawned from the CronJob, overriding the ingestion dates:

```bash
# get the original yaml file
kubectl create job stac-ingest-oam-manual --from cronjob/stac-ingest-oam \
  --dry-run=client --output yaml > job.yaml

# edit the args in job.yaml
# modify the command in the 'args' section
# e.g. --uploaded-after 2024-01-01

# create job from the final yaml
kubectl create -f job.yaml
```
