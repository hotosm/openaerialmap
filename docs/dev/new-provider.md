# Adding a new data provider

This document walks through the process of adding a new data provider to the HOT
OpenAerialMap (HOT OAM) STAC Catalog.

## Creating STAC items

The code to create STAC items for the OpenAerialMap STAC Catalog lives in this
repo at `backend/stactools-hotosm`. For an example of creating a HOT OAM STAC
item from existing Maxar items, see
`backend/stactools-hotosm/src/stactools/hotosm/maxar/stac.py`. Create a new
branch, create a new directory for your provider, and write the code. Be sure
to include tests. When it's ready, open a pull request (PR) with your changes.

See the package
[README](https://github.com/hotosm/openaerialmap/blob/main/backend/stactools-hotosm/README.md)
and [Batch Ingestion](./backend/stactools-hotosm.md) for more.

## Add ingestion

Create a PR on [hotosm/k8s-infra](https://github.com/hotosm/k8s-infra/pulls)
to add a new
[manifest](https://github.com/hotosm/k8s-infra/tree/main/kubernetes/manifests)
that syncs your data on a schedule.
See
[sync-maxar](https://github.com/hotosm/k8s-infra/blob/main/kubernetes/manifests/sync-maxar.yaml)
for a representative example.
