# Humanitarian OpenStreetMap Team OpenAerialMap Extension Specification

- **Title:** Humanitarian OpenStreetMap Team OpenAerialMap (OAM) Extension
- **Identifier:** <https://docs.imagery.hotosm.org/oam/v0.2.0/schema.json>
- **Field Name Prefix:** oam
- **Scope:** Item
- **Extension [Maturity Classification](https://github.com/radiantearth/stac-spec/tree/master/extensions/README.md#extension-maturity):** Proposal
- **Owners**: @ceholden @gadomski

This extension documents metadata used by the Humanitarian OpenStreetMap Team (HOT)'s OpenAerialMap (OAM) project.
It builds on common STAC metadata by defining some optional common metadata as required attributes and defines
the expected values for common metadata.

- Examples:
  - [Item example](./examples/item.json): Shows the basic usage of the extension in a STAC Item
- [JSON Schema](./json-schema/schema.json)
- [Changelog](./CHANGELOG.md)

## Fields

The fields in the table below can be used in these parts of STAC documents:

- [ ] Catalogs
- [ ] Collections
- [x] Item Properties (incl. Summaries in Collections)
- [ ] Assets (for both Collections and Items, incl. Item Asset Definitions in Collections)
- [ ] Links

| Field Name                                                                                            | Type   | Description                                                                                                                                                                                |
| ----------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| oam:producer_name                                                                                     | string | **REQUIRED**. The name of the imagery data producer. The producer must also be included in the "Provider" field of STAC Items if the producer is not consistent for the entire Collection. |
| oam:platform_type                                                                                     | string | **REQUIRED**. The platform type (kite, balloon, UAV, aircraft, satellite)                                                                                                                  |
| [gsd](https://github.com/radiantearth/stac-spec/blob/master/commons/common-metadata.md#gsd)           | number | **REQUIRED**. The Ground Sampling Distance                                                                                                                                                 |
| [license](https://github.com/radiantearth/stac-spec/blob/master/commons/common-metadata.md#licensing) | string | If provided for STAC Items, must be a Creative Commons (CC) license.                                                                                                                       |
| oam:product_type                                                                                      | string | The kind of imagery held by the data asset, which determines how it is displayed.                                                                                                          |
| oam:product_type_source                                                                               | string | Whether the product type was `declared` by a person or `detected` from the raster.                                                                                                        |
| oam:footprint_source                                                                                  | string | Whether the Item geometry traces the valid pixels (`mask`) or is the bounding rectangle (`bbox`).                                                                                          |
| oam:footprint_area                                                                                    | number | Area covered by the Item geometry, in square metres.                                                                                                                                      |
| oam:acquisition_time_estimated                                                                        | boolean | `true` when the acquisition datetime was estimated rather than supplied by the data provider.                                                                                             |
| oam:acquisition_source                                                                                | string | Where the acquisition datetime came from. Omitted when the data provider supplied it.                                                                                                     |
| oam:external_id                                                                                       | string | Identifier for this imagery in the external system that submitted it.                                                                                                                     |

### Additional Field Information

#### oam:platform_type

The type of the observation platform used to acquire the imagery. The platform type may be,

- `kite`
- `balloon`
- `uav`
- `aircraft`
- `satellite`

#### oam:product_type

The kind of imagery held by the data asset, which selects the display
parameters written to the [render extension](https://github.com/stac-extensions/render).

- `visual` - a photograph, displayed as-is
- `multispectral` - more bands than can be displayed at once
- `sar` - synthetic aperture radar
- `elevation` - height values rather than a picture
- `pseudocolor` - a single band displayed through a colour palette

`oam:product_type_source` is `declared` if a person set the type, `detected` if
it was inferred from the raster.

#### oam:footprint_source

`mask` if the Item geometry traces the raster's valid pixels, `bbox` if it is
the bounding rectangle. `oam:footprint_area` is the area it covers, in square
metres.

#### oam:acquisition_source

Where an estimated acquisition datetime came from: `file-tags` (the image
file's EXIF or TIFF tags) or `ingest` (the time of ingestion, when nothing
better was available). `oam:acquisition_time_estimated` is `true` in both
cases.

#### Provider

The imagery data provider must be defined for each STAC Item. This data provider should also be included
as a ["provider"](https://github.com/radiantearth/stac-spec/blob/master/commons/common-metadata.md#provider-object)
link with contact information.

#### License

Imagery for OAM must be licensed as either,

- `CC-BY-SA-4.0`
- `CC-BY-4.0`
- `CC-BY-NC-4.0`

## Contributing

All contributions are subject to the
[STAC Specification Code of Conduct](https://github.com/radiantearth/stac-spec/blob/master/CODE_OF_CONDUCT.md).
For contributions, please follow the
[STAC specification contributing guide](https://github.com/radiantearth/stac-spec/blob/master/CONTRIBUTING.md) Instructions
for running tests are copied here for convenience.

### Running tests

The same checks that run as checks on PR's are part of the repository and can be run locally to verify that changes are valid.
To run tests locally, you'll need `npm`, which is a standard part of any [node.js installation](https://nodejs.org/en/download/).

First you'll need to install everything with npm once. Just navigate to the root of this repository and on
your command line run:

```bash
npm install
```

Then to check markdown formatting and test the examples against the JSON schema, you can run:

```bash
npm test
```

This will spit out the same texts that you see online, and you can then go and fix your markdown or examples.

If the tests reveal formatting problems with the examples, you can fix them with:

```bash
npm run format-examples
```
