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

## STAC Metadata

Items are read by the browse map, the tile server, and the STAC API
search. The tables below separate out **mandatory** from **optional**
fields.

<!-- markdownlint-disable MD013 -->

### Required

Leave one out and the item is rejected, invisible on the map, or undisplayable.

| Field                          | What to put in it                                                                                                                                                                      | What needs it                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                           | A unique name. Don't use `/` in it                                                                                                                                                     | Item lookups in the API break on slashes - swap them for `-`                                                                                         |
| `geometry`                     | The image outline as GeoJSON, in lat/lon (EPSG:4326)                                                                                                                                   | The shape drawn on the browse map                                                                                                                    |
| `bbox`                         | `[west, south, east, north]` of that outline                                                                                                                                           | "What imagery is in this area?" search                                                                                                               |
| `stac_extensions`              | Must include `https://docs.imagery.hotosm.org/oam/v0.2.0/schema.json`                                                                                                                  | Marks the item as OAM imagery, and turns on validation of the `oam:` fields below                                                                    |
| `properties.datetime`          | When the image was taken                                                                                                                                                               | The card, and the date filter. For a capture period, set it to `null` and give `start_datetime` / `end_datetime` - but the key must still be present |
| `properties.title`             | A human-readable name                                                                                                                                                                  | Card and sidebar heading                                                                                                                             |
| `properties.gsd`               | Pixel size on the ground, in metres                                                                                                                                                    | The resolution filter. Imagery without it is hidden whenever that filter is used                                                                     |
| `properties.oam:platform_type` | One of `kite`, `balloon`, `uav`, `aircraft`, `satellite`                                                                                                                               | The platform filter (drone / aircraft / satellite)                                                                                                   |
| `properties.oam:producer_name` | **Name** of the organisation or person who made the imagery, e.g. `Maxar`. Not an email address                                                                                        | Attribution. Must match the first `providers` entry                                                                                                  |
| `properties.license`           | One of `CC-BY-4.0`, `CC-BY-SA-4.0`, `CC-BY-NC-4.0`                                                                                                                                     | The license filter. OAM only hosts open imagery, so anything else is rejected                                                                        |
| `providers`                    | Producer first, with `name` (same as `oam:producer_name`), `roles: ["producer", "licensor"]`, and the **contact** in `description` - an email, or a team name if none can be published | Cards show `providers[0].name`; `description` is how people get in touch                                                                             |
| `assets.visual`                | Link to the imagery as a Cloud Optimized GeoTIFF (COG). Must be named `visual`                                                                                                         | The tile server draws from it, and it's the card's download link                                                                                     |
| `assets.thumbnail`             | Link to a small PNG preview                                                                                                                                                            | The browse card picture. Items still work without one, but the card is blank                                                                         |

!!! tip "Imagery that crosses the date line"

    Split the `geometry` into two polygons either side of the 180° meridian,
    and write the `bbox` west edge first even though it's the bigger number
    (e.g. `[179.5, -16, -179.5, -15]`) - that's how a reader knows it wraps.
    Otherwise the item draws as a stripe across the whole map.

### Optional

The uploader works these out from the image file. An ingested catalogue
usually won't have them and OAM copes without, so fill in what your source
provides and skip the rest.

| Field                                        | What it is                                                                               | What you get for it                                                                                    |
| -------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `properties.start_datetime` / `end_datetime` | Start and end of capture                                                                 | Shows a date range instead of a single moment                                                          |
| `properties.created`                         | When the item was added to OAM                                                           | Tells "added recently" apart from "photographed recently"                                              |
| `properties.instruments`                     | Camera or sensor name, as a list                                                         | Sensor shown on the card                                                                               |
| `properties.renders`                         | Display hints: which bands, how to stretch them, which colour ramp, what counts as empty | Makes non-photo imagery (elevation, radar, multispectral) viewable. Without it the map shows raw bands |
| `properties.oam:product_type`                | `visual`, `multispectral`, `sar`, `elevation` or `pseudocolor`                           | Picks the display hints above. Guessed from the file when not given                                    |
| `properties.oam:product_type_source`         | `declared` if a person set the type, `detected` if it was guessed                        | Says how much to trust the type                                                                        |
| `properties.oam:footprint_source`            | `mask` if the outline follows the real image edge, `bbox` if it's just the rectangle     | Says how tight the outline on the map is                                                               |
| `properties.oam:footprint_area`              | Covered area in square metres                                                            | Coverage stats                                                                                         |
| `properties.oam:acquisition_time_estimated`  | `true` when nobody supplied a capture date                                               | Warns that the date is a best guess                                                                    |
| `properties.oam:acquisition_source`          | Where the guessed date came from: `file-tags` or `ingest`                                | Says how good that guess is                                                                            |
| `properties.oam:external_id`                 | An ID from the system that sent the imagery, e.g. an ODM task                            | Links the item back to that system                                                                     |
| `properties.processing:*`                    | `software`, `version`, `lineage`, `datetime` - what produced the file and how            | Provenance                                                                                             |
| `assets.visual.file:size`                    | File size in bytes                                                                       | Download size on the card                                                                              |
| `assets.visual.file:checksum`                | Checksum of the file                                                                     | Lets anyone confirm the download wasn't corrupted                                                      |
| `assets.visual.bands`                        | Band names, with `eo:common_name` where known (`red`, `nir`, ...)                        | Lets OAM pick sensible red/green/blue bands for display                                                |
| `assets.visual.proj:*`                       | Native projection, image size, transform                                                 | Saves tools from opening the file to find out                                                          |
| `assets.original`                            | Link to the untouched original file                                                      | Archival, in case the converted copy is ever wrong                                                     |
| `assets.metadata`                            | Link to the item's own JSON                                                              | A stable copy of the record                                                                            |
| `assets.tms` / `assets.wmts`                 | Link to an existing tile service                                                         | Used instead of OAM's tile server (older OAM items)                                                    |
| `assets.*.alternate`                         | A second link to the same file, usually `s3://`                                          | Direct bucket access for people who prefer it                                                          |
| `links[rel=derived-from]`                    | Link to the original item in your catalogue                                              | Provenance for ingested imagery - worth adding for any third-party source                              |
| `links[rel=via]`                             | Link to a public page about the imagery                                                  | A "more info" backlink                                                                                 |

<!-- markdownlint-enable MD013 -->

!!! note "Extension versions"

    Every `oam:` field here is defined in OAM extension **v0.2.0**. Older items
    list v0.1.0, which knows only `oam:platform_type` and `oam:producer_name`
    and rejects any other `oam:` field; that URL still serves the old
    definition, so those items keep validating. Point new items at v0.2.0, and
    add any `oam:` field of your own to the schema before using it.
