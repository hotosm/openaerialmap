# STAC Tools for Humanitarian OpenStreetMap Team's OpenAerialMap

Builds the STAC Items and Collections for OpenAerialMap, from both the legacy
OAM metadata API and the Maxar Open Data Program.

This package used to live at <https://github.com/hotosm/stactools-hotosm> but
is now part of this monorepo:

- `backend/stac-ingester` - the bulk/scheduled ingester image
- `backend/uploader-api/pipeline/metadata` - the per-upload pipeline step

Usage of the `hotosm` CLI is documented in
[the developer guide](../../docs/dev/backend/stactools-hotosm.md).

## Getting started

Dependencies are managed with [uv](https://docs.astral.sh/uv/getting-started/installation/):

```bash
uv sync --all-extras
```

Linting and commit checks are handled by the repo-root `pre-commit` config, not
a per-package one. See the root [CONTRIBUTING.md](../../CONTRIBUTING.md).

Note that ruff resolves its configuration per directory, so this package keeps
the stricter rule set (pydocstyle among others) declared in its own
`pyproject.toml`, rather than inheriting the rest of `backend/`.

### Tests

```bash
./scripts/test
```

These scripts are also what CI runs, in
`.github/workflows/backend-stactools-test.yml`. They use paths relative to this
directory, so run them from here.

### Formatting, Linting, and Type Checking

```bash
./scripts/format     # ruff format
./scripts/lint       # ruff check
./scripts/typecheck  # mypy
```

## Versioning

There is no separate release process since moving to the monorepo.
All consuming tools simple use the `main` version in this repo.

The `__version__` is kept only as a static string for STAC provenance.

## STAC Extension

`stac-extension/` defines the OpenAerialMap STAC extension - see its
[README](./stac-extension/README.md).

`json-schema/schema.json` is the source of truth for the **current** version,
both for editing and for the local validation in `tests/test_stac_extension.py`.
It is published at

```text
https://docs.imagery.hotosm.org/oam/v0.2.0/schema.json
```

which is its `$id`, and the URI `create_item` puts in `stac_extensions`.

Publishing happens through the mkdocs site: `docs/oam/v{version}/schema.json`
symlinks to the schema for that version, so every push that changes one
redeploys it along with the docs. Superseded versions are frozen as real files
under `src/stactools/hotosm/schemas/oam/v{version}/`, with the `docs/oam`
symlink pointing at the frozen copy.

To create a new version:

1. Freeze the outgoing one: copy `json-schema/schema.json` over
   `src/stactools/hotosm/schemas/oam/v{old}/schema.json` and point
   `docs/oam/v{old}/schema.json` at it. Its URI must keep serving the old
   definition, which names itself in `$id` and in the `stac_extensions`
   `contains` check - serve the new schema there and every Item using it stops
   validating.
2. Bump `$id` in `json-schema/schema.json`, then symlink `docs/oam/v{new}/` and
   `schemas/oam/v{new}/` to it.
3. Add the version to `OAM_EXTENSION_SUPPORTED_VERSIONS` and set
   `OAM_EXTENSION_DEFAULT_VERSION`.
4. Update `stac-extension/package.json`, the example Item, and the extension
   README and CHANGELOG.

`test_published_versions_are_frozen` checks steps 1-3 for every supported
version.

The schema was previously served from GitHub Pages on the standalone repo, at
`https://hotosm.github.io/stactools-hotosm/oam/v0.1.0/schema.json`. That URL is
still in the `stac_extensions` array of Items ingested before the move.
