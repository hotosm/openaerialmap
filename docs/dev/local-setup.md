# Local Development Setup

Run the full OAM stack locally with a single command using Docker Compose.

## Prerequisites

- Docker (with Compose v2)
- [just](https://github.com/casey/just) command runner
- Python 3 (only for `populate-prod`)

## Quick Start

```sh
# Start all core services
just start all

# Load sample data from production
just test populate-prod
```

Open <http://imagery.localhost:8080> to view the frontend.

> `*.localhost` resolves to `127.0.0.1` per
> [RFC 6761](https://datatracker.ietf.org/doc/html/rfc6761), so no
> `/etc/hosts` entry is needed.

## Architecture

All services are behind a single nginx reverse proxy on port 8080,
using `*.imagery.localhost` subdomains:

- `imagery.localhost:8080/`: `frontend`, Vite dev server with HMR
- `imagery.localhost:8080/stac/`: `stac-api`, `stac-fastapi-pgstac`
- `imagery.localhost:8080/raster/`: `raster`, `titiler-pgstac` tiler
- `s3.imagery.localhost:8080`: `rustfs`, S3-compatible object storage
  console
- `tms.imagery.localhost:8080`: `tms-nginx`, global TMS tiles
  (`tms` profile)

This mirrors the production URL structure,
`api.imagery.hotosm.org/stac` and `/raster`, so the same
`VITE_STAC_*` env vars work in both environments.

No service ports are exposed directly to the host. Only nginx on port
8080 and PostgreSQL on port 5439 are exposed, and PostgreSQL is TCP
only, not HTTP-proxied.

> `*.localhost` resolves to `127.0.0.1` per
> [RFC 6761](https://datatracker.ietf.org/doc/html/rfc6761), so no
> `/etc/hosts` entry is needed.

### Services

**Core** (always started):

- `database` - PostgreSQL + pgstac
- `stac-api` - STAC API with Transaction Extension enabled
- `raster` - Raster tile server (titiler-pgstac)
- `frontend` - React app via Vite dev server
- `nginx` - Reverse proxy, single entry point
- `rustfs` - S3-compatible object storage (RustFS)
- `rustfs-init` - One-shot bucket creation

**Optional** (`--profile tms`):

- `get-tiles`, `martin`, `tileserver`, `tms-nginx`: global coverage
  tile services, extended from `backend/global-tms/compose.yaml`

## Commands

| Command                    | Action                                   |
| -------------------------- | ---------------------------------------- |
| `just start all`           | Start core services                      |
| `just start all-tms`       | Start core + global TMS tiles            |
| `just start stop`          | Stop all services                        |
| `just start logs`          | Follow all logs                          |
| `just start logs stac-api` | Follow logs for one service              |
| `just test populate-prod`  | Ingest sample items from production STAC |
| `just start clean`         | Stop all services and delete volumes     |

## Populating Data

`just test populate-prod` fetches the `openaerialmap` collection and
recent items from the production STAC API, then ingests them into the
local instance via the Transaction Extension. Asset hrefs are kept
as-is. They point to publicly readable COGs on S3 that titiler can
render directly.

Configure the number of items with:

```sh
POPULATE_ITEMS=50 just test populate-prod
```

## Ports

Only one port is exposed to the host:

| Port | Service | Access                                           |
| ---- | ------- | ------------------------------------------------ |
| 8080 | nginx   | `http://imagery.localhost:8080` (and subdomains) |

All other services communicate internally via the Docker network.

## Configuration

The compose file reads from `.env` at the repo root via
`set dotenv-load` in the root Justfile. Copy `.env.example` to `.env`
to customise values:

```sh
cp .env.example .env
```

Key variables for local development:

| Variable                | Default | Purpose                         |
| ----------------------- | ------- | ------------------------------- |
| `VITE_STAC_ITEMS_LIMIT` | `40`    | Max items per request           |
| `POPULATE_ITEMS`        | `20`    | Items to fetch in populate-prod |

## Troubleshooting

**Frontend not loading**: Check that the `build` target in
`frontend/Dockerfile` completed. The frontend container needs
`pnpm install` to succeed first. Run `just start logs frontend` to
inspect.

**STAC API returns 404**: The database may still be initialising. Wait
for `just start logs database` to show "database system is ready to
accept connections", then retry.

**Tile rendering not working after populate**: titiler needs pgstac
search indexes. Items ingested via the Transaction Extension are
indexed automatically, but it may take a moment. Refresh the page.
