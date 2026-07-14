# Consolidate composable services into one monorepo

## Context and Problem Statement

The old OAM was already composable in shape, not a monolith. It was
made up of:

- A Node API backed by a hosted MongoDB.
- A static S3-hosted frontend.
- `marblecutter`, an AWS Lambda tiling service invoked per image on
  ingest.
- A global mosaic maintained by volunteers on the side.
- Various supporting infrastructure spread across AWS services.

That separation was actually a strength: when one piece failed, the
rest kept working, and the stack ran with minimal maintenance for
years on that basis. The problem wasn't the architecture, it was the
sprawl. The system lived across 5-10 repositories, some of the moving
parts (like the mosaic) were volunteer-run and only loosely connected
to the rest, and no single place described how it all fit together.
Onboarding, debugging, and cross-cutting changes were painful because
no one had the whole picture.

The rebuild still covers several jobs that don't move at the same
pace, and we want to keep them decoupled:

- Cataloguing (STAC API, ingester).
- Global mosaic generation (batch, scheduled).
- Tile serving for clients that can't use PMTiles (global-tms).
- On-demand tile archive generation (tilepack API).
- User-facing frontend (and a separate uploader UI).

The question is how to organise them so we keep the fault-isolation
that served us well, but don't repeat the multi-repo sprawl.

## Considered Options

- **One deployable, one runtime**: collapse everything into a single
  service. Rejected: throws away the isolation the old stack had, and
  forces every piece onto the same release cadence.
- **Separate services in separate repos** (the shape of the old
  stack): keeps isolation but reproduces the sprawl and the "no one
  has the whole picture" problem we're trying to leave behind.
- **Separate services in a shared monorepo**: keep each piece
  independently deployable, but colocate them so cross-cutting
  changes, docs, and architecture live in one place.

## Decision Outcome

Keep the composable shape, but consolidate into a single monorepo.
Each piece ships on its own:

- `backend/stac-api`, `backend/stac-ingester` - catalogue.
- `backend/global-mosaic` - scheduled PMTiles build (now a
  first-class scheduled service in the stack rather than a
  side-of-desk effort).
- `backend/global-tms` - raster fallback tiler (new component
  replacing the old marblecutter Lambda; see MADR 0003).
- `backend/tilepack-api` - on-demand MBTiles/PMTiles packaging (new).
- `frontend/` - browse UI (the uploader is a separate app entirely).

They all live in one repo so cross-service changes stay in one
commit, docs (this folder!) live alongside the code, and a new
contributor can read the whole system in one place. The landing page
ties the different UIs together for end users.

### Consequences

- ✅ Failures stay contained, same as before: if tilepack or
  global-mosaic goes down, the browse UI is unaffected. This is the
  property that kept the old stack alive on minimal maintenance and
  we want to preserve it.
- ✅ Each piece can release on its own schedule. The mosaic job can
  ship without waiting on a frontend deploy, and the other way round.
- ✅ Use the right tool for each job: Go for the tilepack API, Python
  for the mosaic pipeline, React for the UI.
- ✅ One place to understand the whole system: shared docs, shared
  CI, shared refactors, and no more hunting across 5-10 repos to
  trace a request end-to-end.
- ✅ Previously-volunteer pieces (the global mosaic) are now
  first-class citizens with the same review and deploy story as the
  rest.
- ❌ More components than before: we've added tilepack-api and
  global-tms on top of the pieces the old stack already had. More to
  keep healthy in production.
- ❌ New contributors still have to learn where each service lives
  and how they fit together - the monorepo makes that easier, not
  free.
