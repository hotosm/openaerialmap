# Changelog

<!-- https://keepachangelog.com/en/1.1.0/ -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

-

### Changed

-

### Fixed

-

### Removed

-

## [v0.2.1]

### Fixed

- URL to Maxar catalog events ([#18](https://github.com/hotosm/stactools-hotosm/pull/18))

## [v0.2.0]

### Added

- Allow ignoring exceptions in Item sync CLI ([#16](https://github.com/hotosm/stactools-hotosm/pull/16))
- Synchronize Collections in CLI ([#16](https://github.com/hotosm/stactools-hotosm/pull/16))
- Dump STAC Items to NDJSON in CLI ([#16](https://github.com/hotosm/stactools-hotosm/pull/16))

## [v0.1.0]

### Added

- First commit with license and developer setup ([#1](https://github.com/hotosm/stactools-hotosm/pull/1))
- Create STAC Collection and Items from existing catalog ([#2](https://github.com/hotosm/stactools-hotosm/pull/2))
- Add "created" based on "uploaded_at" OAM metadata ([#4](https://github.com/hotosm/stactools-hotosm/pull/4))
- Add functions to create OAM-flavored STAC from Maxar's open data catalog ([#5](https://github.com/hotosm/stactools-hotosm/pull/5))
- Add CLI to perform batch synchronization of STAC against OAM API and Maxar's open data catalog ([#10](https://github.com/hotosm/stactools-hotosm/pull/10))

### Fixed

- Include Collection ID in Items to support ingest via `pypgstac load` ([#3](https://github.com/hotosm/stactools-hotosm/pull/3))
- Ensure acquisition start comes before end. Populate Item datetime or start/end_datetime properly ([#4](https://github.com/hotosm/stactools-hotosm/pull/4))
- Use the same asset key ("visual") for visual assets in OAM and Maxar STAC Catalogs ([#10](https://github.com/hotosm/stactools-hotosm/pull/10))
- Ensure `oam:platform_type` is lower cased ([#12](https://github.com/hotosm/stactools-hotosm/pull/12))
- Ingest dependencies should be defined as an optional dependency, not extra ([#15](https://github.com/hotosm/stactools-hotosm/pull/15))

[Unreleased]: https://github.com/hotosm/stactools-hotosm/compare/v0.2.1...HEAD
[v0.2.1]: https://github.com/hotosm/stactools-hotosm/releases/tag/v0.2.1
[v0.2.0]: https://github.com/hotosm/stactools-hotosm/releases/tag/v0.2.0
[v0.1.0]: https://github.com/hotosm/stactools-hotosm/releases/tag/v0.1.0
