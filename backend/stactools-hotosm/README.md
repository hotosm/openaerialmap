# STAC Tools for Humanitarian OpenStreetMap Team's OpenAerialMap

Builds OpenAerialMap STAC Items and Collections from the legacy metadata API,
Maxar, and Vantor.

Third-party catalogs are registered in `src/stactools/hotosm/catalogs.py`. See
[Adding a new data provider](../../docs/dev/new-provider.md).

This package is used by:

- `backend/stac-ingester` - the bulk/scheduled ingester image
- `backend/uploader-api/pipeline/metadata` - the per-upload pipeline step

See the [`hotosm` CLI guide](../../docs/dev/backend/stactools-hotosm.md).

## Getting started

Install dependencies with
[uv](https://docs.astral.sh/uv/getting-started/installation/):

```bash
uv sync --all-extras
```

### Tests

```bash
./scripts/test
```

Run commands from this directory.

### Code checks

```bash
./scripts/format     # ruff format
./scripts/lint       # ruff check
./scripts/typecheck  # mypy
```

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for repository-wide checks.

## Versioning

There is no separate release process. Consumers use the version on `main`.

The `__version__` is kept only as a static string for STAC provenance.

## STAC Extension

`stac-extension/` defines the OpenAerialMap STAC extension. See its
[README](./stac-extension/README.md).

Each schema version has one source file under
`stac-extension/json-schema/v{version}/schema.json`. The current version is:

```text
https://docs.imagery.hotosm.org/oam/v0.2.0/schema.json
```

Do not edit a released schema. The `docs/oam/` and
`src/stactools/hotosm/schemas/oam/` symlinks publish and bundle each version.

To create a new version:

1. Copy the current schema to
   `stac-extension/json-schema/v{new}/schema.json`. Update its `$id` and
   `definitions.stac_extensions` version.
2. Symlink `docs/oam/v{new}/schema.json` and
   `src/stactools/hotosm/schemas/oam/v{new}/schema.json` to it.
3. Add the version to `OAM_EXTENSION_SUPPORTED_VERSIONS`, set
   `OAM_EXTENSION_DEFAULT_VERSION`, and add its `sha256` to
   `RELEASED_SCHEMA_SHA256` in `tests/test_stac_extension.py`.
4. Update `stac-extension/package.json`, the example Item, and the extension
   README and CHANGELOG.

Tests pin released schemas and check the symlinks and `$id` values.

Older Items may still use the previous schema URL:
`https://hotosm.github.io/stactools-hotosm/oam/v0.1.0/schema.json`.
