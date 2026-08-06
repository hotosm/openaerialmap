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

`json-schema/schema.json` is the source of truth, both for editing and for the
local validation in `tests/test_stac_extension.py`. It is published at

```text
https://docs.imagery.hotosm.org/oam/v0.1.0/schema.json
```

which is its `$id`, and the URI `create_item` puts in `stac_extensions`.

Publishing happens through the mkdocs site: `docs/oam/v0.1.0/schema.json` is a
symlink to this file, so every push that changes it redeploys the schema along
with the docs. To cut a new extension version, copy the symlink to
`docs/oam/v{version}/schema.json`, bump `$id` and
`OAM_EXTENSION_DEFAULT_VERSION`, and leave the older paths in place - Items
already in pgstac keep pointing at them.

The schema was previously served from GitHub Pages on the standalone repo, at
`https://hotosm.github.io/stactools-hotosm/oam/v0.1.0/schema.json`. That URL is
still in the `stac_extensions` array of Items ingested before the move.
