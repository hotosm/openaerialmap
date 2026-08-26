# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

## [v0.2.0]

### Added

- `oam:product_type`, `oam:product_type_source` - what kind of imagery the data
  asset holds, and whether that was declared or detected.
- `oam:footprint_source`, `oam:footprint_area` - how the Item geometry was
  derived, and the area it covers.
- `oam:acquisition_time_estimated`, `oam:acquisition_source` - marks an
  estimated acquisition datetime, and where it came from.
- `oam:external_id` - identifier in the system that submitted the imagery.

All optional, and the required fields are unchanged, so a v0.1.0 Item is a
valid v0.2.0 Item once its `stac_extensions` entry is updated.

### Changed

- The schema is now published from `https://docs.imagery.hotosm.org/oam/v0.1.0/schema.json`,
  and `$id` points there. The previous location,
  `https://hotosm.github.io/stactools-hotosm/oam/v0.1.0/schema.json`, served the
  same v0.1.0 definition from the now-archived standalone repository.

## [v0.1.0]

### Added

- First definition of the OAM STAC extension.

[Unreleased]: https://github.com/hotosm/openaerialmap/tree/main/backend/stactools-hotosm/stac-extension
[v0.2.0]: https://docs.imagery.hotosm.org/oam/v0.2.0/schema.json
[v0.1.0]: https://docs.imagery.hotosm.org/oam/v0.1.0/schema.json
