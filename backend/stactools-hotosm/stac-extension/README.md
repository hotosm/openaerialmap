# Humanitarian OpenStreetMap Team OpenAerialMap Extension Specification

- **Title:** Humanitarian OpenStreetMap Team OpenAerialMap (OAM) Extension
- **Identifier:** <https://docs.imagery.hotosm.org/oam/v0.2.0/schema.json>
- **Field Name Prefix:** oam
- **Scope:** Item
- **Extension [Maturity Classification](https://github.com/radiantearth/stac-spec/tree/master/extensions/README.md#extension-maturity):** Proposal
- **Owners**: @ceholden @gadomski

Defines STAC metadata used by HOT's OpenAerialMap project.

- [Item example](./examples/item.json)
- [JSON Schema](./json-schema/v0.2.0/schema.json)
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

Where the acquisition datetime came from: `user`, `file-tags`, or `ingest`.
Set `oam:acquisition_time_estimated` for `file-tags` and `ingest`.

#### Provider

Set `oam:producer_name` and add the producer as the first STAC
[`provider`](https://github.com/radiantearth/stac-spec/blob/master/commons/common-metadata.md#provider-object).

#### License

Imagery for OAM must be licensed as either,

- `CC-BY-SA-4.0`
- `CC-BY-4.0`
- `CC-BY-NC-4.0`

## Contributing

Follow the [STAC Code of Conduct](https://github.com/radiantearth/stac-spec/blob/master/CODE_OF_CONDUCT.md)
and [contributing guide](https://github.com/radiantearth/stac-spec/blob/master/CONTRIBUTING.md).

### Running tests

Install dependencies:

```bash
npm install
```

Check Markdown and examples:

```bash
npm test
```

Format examples:

```bash
npm run format-examples
```
