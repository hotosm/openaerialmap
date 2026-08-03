# Build the frontend from scratch on Vite + React + UnoCSS + hotosm/ui + Web Awesome

## Context and Problem Statement

The old OAM frontend is tightly coupled to the MongoDB API and has
years of patterns baked in that don't line up with STAC, PMTiles, or
the current HOTOSM design system. Reworking it would cost about as
much as starting fresh.

We want a frontend that:

- Talks to STAC / titiler-pgstac / PMTiles directly, with nothing
  custom in between.
- Looks and feels like the rest of the HOTOSM tools.
- Easy to fix / quick to change with a small team.

## Considered Options

- **Refactor the old frontend in place**: the frontend has been lovingly
  maintained by Kontur for free, but now we are working with STAC, our
  needs have shifted. It's quite antiquated JavaScript now & needs a
  full overhaul of coding patterns and dependencies.
- **Adopt [stac-map](https://github.com/developmentseed/stac-map) as
  the frontend, restyled and with our own basemaps**: we actually
  tried this. A save state of the repo using stac-map can
  [be found here](https://github.com/hotosm/openaerialmap/tree/save/stac-map-frontend).
  It's a solid STAC viewer, but user feedback said the
  UI was too generic for OAM (1) not meeting feature parity with the old
  frontend (2) it will look slightly different to all our other tools.
  The argument in favour was around contributing to an open source
  community & reducing our maintenance, but overall this was
  outweighed.
- Built on the surpirisingly simple yet effective _vibe-coded_ SPA
  [developed by cgiovando](https://github.com/cgiovando/oam-vibe) and further
  refined in [this repo](https://github.com/cgiovando/oam-frontend).
  Would need aligning with the rest of HOTOSM tools + design.
- Entirely new **Vite + React SPA**: lightweight, can easily match the
  HOTOSM stack, and there's nothing to run on the server.

## Decision Outcome

After reviewing the code within the vibe-coded frontend by cgiovando,
we discovered:

1. It was already pretty functional as-is, but had a flaw that the frontend
   asset aggregation would probably fall down in real world testing on the
   30,000+ asset repository, against the ~5000 image test dataset.
2. The code was surprisingly simple and not over-engineered, lending itself
   to having the primary components copied across to a new frontend.

An approach to solve the scalability was proposed via backend asset
aggregation / tileset generation, so we decided on built on top of this
frontend, while ensuring:

- **Vite + React 19 + TypeScript** for the app itself.
- **UnoCSS** for styling (small runtime, minimal config).
- **`@hotosm/ui`** so we pick up HOTOSM design tokens and components
  and stay in step with the other HOTOSM tools.
- **Web Awesome** (`@awesome.me/webawesome`) for general UI bits that
  `@hotosm/ui` doesn't cover.
- **MapLibre GL + pmtiles** for the map, talking directly to
  titiler-pgstac and the PMTiles archive.

All code was reviewed by HOT's Sr. Tech Lead before being merged into
the current frontend code you see today.

See [HOTOSM decision 0003](https://docs.hotosm.org/decisions/0003-react)
for the org-wide React choice this follows.

### Consequences

- ✅ Clean start against the new STAC/PMTiles stack, with no legacy
  compatibility code to carry.
- ✅ It's an SPA, so there's no server to run. Deploys as static
  files.
- ✅ Consistent with other HOTOSM tools via `@hotosm/ui`, so users
  moving between sites see the same shell.
- ❌ Rewrite cost: any feature the old site had, we have to build
  again rather than inherit.
- ❌ Community: rolling our own means we don't get the benefit of, or
  contribute back to, the shared STAC / open-source viewer effort
  (e.g. stac-map). We end up with something specific to OAM rather
  than something other STAC users can also use.
