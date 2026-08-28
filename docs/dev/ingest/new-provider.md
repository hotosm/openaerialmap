# Add a data provider

How to ingest a new third-party catalogue, using
[`src/stactools/hotosm/vantor/`](https://github.com/hotosm/openaerialmap/tree/main/backend/stactools-hotosm/src/stactools/hotosm/vantor)
as the example to copy.

Providers publish a static STAC catalogue in a public bucket, which we flatten
into one OAM Collection. That rewrite is the same whoever the provider is - the
`oam:` properties, the `derived_from` link, the S3 alternate assets, the
extension - so it lives once in `opendata.py`. A provider is described
declaratively and supplies only what genuinely differs.

## Write the provider

Create a directory under `src/stactools/hotosm/` holding:

- **`stac.py`** - a `CATALOG = opendata.OpenDataCatalog(...)` with the
  Collection ID, description, providers and root catalogue URL, plus a
  `prepare_item(oam_item, item)` hook for anything provider specific: Item ID,
  title, `gsd`, asset fixups.
- **`sync.py`** - only if the default does not fit. By default Items are found
  by walking the provider's own catalogue with PySTAC. Write
  `new_stac_items(stac_io, session, after)` when the provider needs a shortcut
  through its own layout, and pair it with `all_catalog_ids(session)` if it has
  acquisition IDs worth summarising on the Collection.

Then register it in `catalogs.py`. The CLI derives `dump-<provider>`,
`sync-<provider>` and the `--catalog` choices from that, so there is nothing
else to wire up.

## What the default walk assumes

- **It reads the whole catalogue every run.** One request per linked document,
  all held in memory. Fine for thousands of Items. A provider with far more
  needs `new_stac_items` backed by a manifest, a bucket inventory, a STAC API
  search, or partitioned catalogues that can be pruned before their Items are
  read.
- **No STAC property means "published here".** `created` is when the
  _metadata_ was written, so a provider adding a historical Item publishes it
  with an old `created`, and filtering on that would drop the Item for good.
  Syncs subset by skipping Items already in PgSTAC instead. Set
  `timestamp_property` only for a provider that documents a property as
  meaning "added to this catalogue" - Vantor's `published`, for instance.

## What the shared code cannot do for you

- **Drop repeated links while walking.** Only the provider knows what a repeat
  is. The default walk identifies an Item by its HREF, so a catalogue linking
  one Item both directly and through a child Collection yields it once. Maxar
  drops repeats by ID instead, because an acquisition covering two events is
  filed under both and is still one Item.
- **Keep Item IDs unique across everything the provider publishes.** STAC
  scopes an ID to its Collection, but we flatten a provider into one OAM
  Collection, so two source Collections reusing an ID would overwrite each
  other. Give them distinct IDs in `prepare_item`. If two still collide,
  ingestion fails and names them rather than picking one.
- **Declare how you rewrite an ID.** If `prepare_item` changes `oam_item.id`,
  give the catalogue a `target_item_id(item_id)` doing the same rewrite - Maxar
  swaps `/` for `-` - so the "already ingested?" lookup queries the ID PgSTAC
  actually stores. Ingestion checks the two agree.

## Meet the schema

Every rewritten Item is validated against the
[OAM extension](./schema.md) before it is loaded, so a provider whose imagery
cannot satisfy the required fields fails the sync rather than reaching the
catalogue.

## Test it

`tests/vantor/` covers both modules, with fixtures generated from the live
bucket by `tests/vantor/data/generate_fixtures.py`. Upstream metadata is rarely
uniform, so pick fixtures that pin down the provider's quirks. The Vantor ones
include an Item that mislabels its COG.

## Schedule it

Open a PR on [k8s-infra](https://github.com/hotosm/k8s-infra/pulls) adding an
`apps/oam/sync-<provider>.yaml` CronJob, copying
[sync-vantor.yaml](https://github.com/hotosm/k8s-infra/blob/main/apps/oam/sync-vantor.yaml).
Give it `--handle-exceptions IGNORE`, so one bad Item does not cost the run.

Two things are easy to miss, both covered in
[apps/oam/README.md](https://github.com/hotosm/k8s-infra/blob/main/apps/oam/README.md):

1. Create the Collection once with `sync-collection` before the first sync, or
   every Item lands orphaned.
2. Merge to `main` first. The `stac-ingester` image tracks `main`, so until
   then the CronJob cannot see your provider.
