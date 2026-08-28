# Changelog

<!-- https://keepachangelog.com/en/1.1.0/ -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Add `dump-vantor` and `sync-vantor` for the Vantor Open Data Program.
- Add a shared `OpenDataCatalog` provider registry.
- Find Items by walking a provider's static STAC catalog by default, so a
  provider publishing spec-compliant STAC needs no crawling code
  (adapted from [@hfu](https://github.com/hfu)'s external STAC harvester).
- Validate every third-party Item against the OAM extension before loading it,
  as Items from the OAM metadata API already were.

### Changed

- Build Maxar commands and catalog options from the provider registry.
- Add provider, license, and product type metadata to third-party Items.
- Store each OAM extension schema version in a separate file.

### Fixed

- Fix Vantor `eo:bands` placement and missing `published` timezones.
- Skip duplicate metadata items a provider links from more than one place,
  which `dump-maxar` could write twice for an acquisition covering two events.
- Declare the OAM and alternate-assets extensions once, so an Item from a
  source that already declares them stays valid STAC.
- Fail, rather than overwrite, when two source Items land on one OAM Item ID.
- Look up Items already in PgSTAC by the ID they are stored under, so the
  lookup is no longer a no-op for Maxar, whose IDs are rewritten on ingest.
- Skip an event Collection a provider lists but no longer serves, which failed
  the whole Maxar sync.
- Predict rewritten Item IDs in `dump-<provider>`, so `dump-maxar` no longer
  rejects every Item it builds.
- Pass the Collection file to pypgstac as a str, which silently ignores a
  `Path`, making `sync-collection` a no-op.
- Require pypgstac >=0.9.11, whose loader no longer reports success while
  discarding every Item whose datetime falls outside a partition's constraint.

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
