<!-- markdownlint-disable MD013 MD046 -->

# OAM STAC schema

STAC provides the common structure for imagery metadata. The OAM extension
adds the small amount of metadata needed by OpenAerialMap.

The current extension is:

```text
https://docs.imagery.hotosm.org/oam/v0.2.0/schema.json
```

Every Item is validated while it is built. Invalid Items are reported and are
not loaded into PgSTAC.

## Minimum fields for imagery

The JSON schema requires these three properties:

| Property            | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| `gsd`               | Ground resolution in metres per pixel                        |
| `oam:platform_type` | `kite`, `balloon`, `uav`, `aircraft`, or `satellite`         |
| `oam:producer_name` | Name of the person or organisation that produced the imagery |

An Item also needs the following standard STAC fields to work properly in OAM:

| Field                 | What OAM expects                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `id`                  | Unique within the OAM Collection. Avoid `/`, as it breaks API Item URLs.                                          |
| `geometry`            | Image outline as GeoJSON in longitude/latitude (EPSG:4326).                                                       |
| `bbox`                | Bounds in `[west, south, east, north]` order.                                                                     |
| `properties.datetime` | Capture time. For a time range, use `start_datetime` and `end_datetime`, but keep `datetime` with a `null` value. |
| `properties.title`    | Short, readable name shown in the frontend.                                                                       |
| `properties.license`  | `CC-BY-4.0`, `CC-BY-SA-4.0`, or `CC-BY-NC-4.0`.                                                                   |
| `providers`           | Put the producer first. Its `name` must match `oam:producer_name`.                                                |
| `assets.visual`       | Public URL of the Cloud Optimized GeoTIFF (COG) used by the tile server and download link.                        |
| `assets.thumbnail`    | Optional PNG or JPEG preview for the frontend card.                                                               |
| `stac_extensions`     | Include the current OAM extension URL shown above.                                                                |

For providers, put contact details in `description` if they can be published.
The first provider should normally have the `producer` and `licensor` roles.

!!! tip "Imagery crossing the date line"

    Split the geometry into two polygons at 180°. A wrapped bbox has its west
    value first even though it is larger, for example
    `[179.5, -16, -179.5, -15]`. Without this, the image may appear to cover
    most of the world.

## Useful optional fields

These fields are not needed for every source. Add them when the provider
supplies the information; there is no need to invent values.

### Display and search

| Field                                        | Purpose                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `properties.start_datetime` / `end_datetime` | Capture period instead of a single time.                                 |
| `properties.created`                         | When the metadata record was created.                                    |
| `properties.instruments`                     | Camera or sensor names.                                                  |
| `properties.renders`                         | Band selection, colour ramp and other display settings for non-RGB data. |
| `properties.oam:product_type`                | `visual`, `multispectral`, `sar`, `elevation`, or `pseudocolor`.         |
| `properties.oam:product_type_source`         | `declared` when set by a person; `detected` when inferred from the file. |

### Source and processing details

| Field                                       | Purpose                                                              |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `properties.oam:footprint_source`           | `mask` for the valid-pixel outline or `bbox` for a rectangle.        |
| `properties.oam:footprint_area`             | Covered area in square metres.                                       |
| `properties.oam:acquisition_time_estimated` | `true` if the capture time was estimated.                            |
| `properties.oam:acquisition_source`         | Where an estimated time came from: `user`, `file-tags`, or `ingest`. |
| `properties.oam:external_id`                | ID from the system that submitted the imagery, such as an ODM task.  |
| `properties.processing:*`                   | Software, version, time and lineage used to create the image.        |

### Assets and links

| Field                         | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `assets.visual.file:size`     | Download size in bytes.                                 |
| `assets.visual.file:checksum` | File checksum.                                          |
| `assets.visual.bands`         | Band names, including `eo:common_name` where known.     |
| `assets.visual.proj:*`        | Native projection, raster size and transform.           |
| `assets.original`             | Untouched source file.                                  |
| `assets.metadata`             | Stable copy of the source metadata.                     |
| `assets.tms` / `assets.wmts`  | Existing tile service, used by some older OAM Items.    |
| `assets.*.alternate`          | Another URL for the same asset, usually an `s3://` URL. |
| `links[rel=derived_from]`     | Original STAC Item from an external provider.           |
| `links[rel=via]`              | Public information page for the imagery.                |

The [extension README](https://github.com/hotosm/openaerialmap/blob/main/backend/stactools-hotosm/stac-extension/README.md)
contains the complete field definitions.

## Where the schema lives

The source files are under
[`backend/stactools-hotosm/stac-extension/json-schema/`](https://github.com/hotosm/openaerialmap/tree/main/backend/stactools-hotosm/stac-extension/json-schema).
They are linked into two places:

- `docs/oam/`, which publishes the schema on this site;
- `src/stactools/hotosm/schemas/oam/`, which bundles it with the Python
  package for local validation.

Validation uses the bundled copy, so it does not depend on the docs site being
available.

## Schema versions

| Version  | Notes                                                      |
| -------- | ---------------------------------------------------------- |
| `v0.2.0` | Current version. Supports all `oam:` fields listed above.  |
| `v0.1.0` | Only supports `oam:platform_type` and `oam:producer_name`. |

Released schemas must not change. Old Items continue to point to the version
they were created with. Some older Items use the archived URL
`https://hotosm.github.io/stactools-hotosm/oam/v0.1.0/schema.json`; external
clients may still use it for validation.

Adding a required field needs a new schema version. Otherwise existing Items
would immediately fail validation. See the package
[README](https://github.com/hotosm/openaerialmap/blob/main/backend/stactools-hotosm/README.md#stac-extension)
for the release steps.

## Updating existing Items

Rebuilding an Item applies the current schema version. A normal sync cannot do
this because it skips IDs already in PgSTAC. Dump the source and load it with
upsert instead:

```bash
hotosm dump-oam \
  --uploaded-after 2016-01-01 \
  --handle-exceptions IGNORE \
  --file oam.ndjson

pypgstac load items --method upsert oam.ndjson
```

Repeat with `dump-<provider>` for an external provider. See
[Backfill](./backfill.md#updating-existing-items) for more detail.

<!-- markdownlint-enable MD013 MD046 -->
