# Add a data provider

This guide covers external providers that publish a public STAC catalogue,
such as Maxar or Vantor.

OAM puts each provider into one Collection. The shared code in `opendata.py`
handles most of the conversion. A provider only needs to describe its
Collection and fix any source-specific metadata.

Use
[`vantor/`](https://github.com/hotosm/openaerialmap/tree/main/backend/stactools-hotosm/src/stactools/hotosm/vantor)
as the simplest working example.

## 1. Check the source data

Before writing code, check that:

- the root STAC Catalog or Collection is publicly readable;
- each Item links to imagery that OAM can access;
- the root document declares a licence accepted by OAM;
- the metadata contains, or lets us derive, the
  [required OAM fields](./schema.md#minimum-fields-for-imagery).

If the source is not STAC, it will need its own reader, similar to the legacy
OAM API. The steps below assume the source is already STAC.

## 2. Add the provider

Create `src/stactools/hotosm/<provider>/` with an empty `__init__.py` and a
`stac.py` file. In `stac.py`, define an `OpenDataCatalog`:

```python
from pystac import Provider, ProviderRole

from stactools.hotosm import opendata


CATALOG = opendata.OpenDataCatalog(
    key="Example",
    collection_id="example-opendata",
    collection_description="Example open imagery",
    catalog_url="https://example.org/stac/catalog.json",
    producer_name="Example",
    platform_type="satellite",
    providers=[
        Provider(
            name="Example",
            url="https://example.org",
            roles=[ProviderRole.PRODUCER, ProviderRole.LICENSOR],
        )
    ],
)
```

The default implementation will:

1. Walk the source catalogue and find its Items.
2. Clone each Item and remove its old Collection links.
3. Add the provider, `oam:` properties and OAM schema URL.
4. Keep a `derived_from` link to the source Item.
5. Add S3 links as alternate asset URLs where possible.
6. Validate the result.

Register `CATALOG` in `src/stactools/hotosm/catalogs.py`. This automatically
adds `dump-example`, `sync-example`, and `Example` as a `--catalog` choice.

## 3. Fix provider-specific metadata

Most catalogues need a small `prepare_item` function. It receives the cloned
OAM Item and the original source Item:

```python
from pystac import Item


def prepare_item(oam_item: Item, source_item: Item) -> None:
    oam_item.properties["title"] = source_item.properties["title"]
    oam_item.properties.setdefault("gsd", source_item.properties["pan_gsd"])
```

Pass it to `OpenDataCatalog` as `prepare_item=prepare_item`.

Use this hook to fix fields that genuinely differ for the provider, such as:

- a missing `title` or `gsd`;
- incorrect asset names or media types;
- relative asset URLs;
- Item IDs that are not safe in an API path.

Do not add the standard `oam:` properties, providers or provenance links here.
The shared code already does that.

### Item IDs

IDs must be unique within the new OAM Collection and should not contain `/`.
This matters because source Collections are flattened into one Collection, but
STAC only requires IDs to be unique inside their original Collection.

If you change an ID in `prepare_item`, add a matching function and pass it as
`target_item_id`:

```python
def target_item_id(item_id: str) -> str:
    return item_id.replace("/", "-")
```

The sync uses this function when checking PgSTAC for existing Items. It also
checks that `prepare_item` produced the expected ID. See Maxar for a complete
example.

## 4. Decide how to find new Items

By default, every sync walks the full STAC catalogue. It removes duplicate
links by Item URL, then asks PgSTAC which Item IDs already exist. This is the
best option for a small catalogue and does not require a `sync.py` file.

There are two reasons to customise this behaviour.

### The catalogue has a reliable published date

Set `timestamp_property` only if the provider documents that field as the date
an Item was added to its catalogue. Vantor, for example, filters on its
`published` property.

Do not use `created` without checking its meaning. It is often the date the
metadata was created, so newly published historical imagery may have an old
value and never be ingested.

### The catalogue is too large to walk

Add `sync.py` and implement:

```python
def new_stac_items(stac_io, session, after):
    yield from ...
```

Use a provider index, manifest, STAC API search, or partitioned catalogue to
avoid reading every Item. The function must also remove any provider-specific
duplicates. Maxar is an example: the same acquisition can appear under more
than one event, so it deduplicates by Item ID.

If the provider has useful acquisition IDs for the Collection summary, also
implement `all_catalog_ids(session)` and pass it to `OpenDataCatalog`.

## 5. Test locally

Add tests under `tests/<provider>/` for both normal Items and any odd source
metadata you found. Keep small source documents as fixtures rather than making
live network requests in tests.

From `backend/stactools-hotosm`, run:

```bash
uv run hotosm dump-collection --catalog Example --file collection.json
uv run hotosm dump-example \
  --uploaded-after 2020-01-01 \
  --handle-exceptions IGNORE \
  --file items.ndjson

./scripts/test
```

Check `collection.json`, the output Items, and any errors printed after the
dump. Each Item is schema-validated during conversion.

The date option is still required for the default catalogue walk, but it only
filters Items when `timestamp_property` is set. Otherwise a dump contains the
full source catalogue.

## 6. Deploy the sync

After the OpenAerialMap change is merged, add
`apps/oam/sync-<provider>.yaml` to
[`k8s-infra`](https://github.com/hotosm/k8s-infra/tree/main/apps/oam). Copy the
Vantor CronJob and keep `--handle-exceptions IGNORE`, so one bad Item does not
stop the rest.

Create the Collection before the first Item sync:

```bash
hotosm sync-collection --catalog Example
```

The `stac-ingester` image tracks OpenAerialMap's `main` branch. Wait for the
new image before starting the CronJob, otherwise the provider command will not
exist yet.
