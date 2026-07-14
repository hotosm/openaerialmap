# Build the frontend from scratch on Vite + React + UnoCSS + hotosm/ui + Web Awesome

## Context and Problem Statement

The old OAM frontend is tightly coupled to the MongoDB API and has
years of patterns baked in that don't line up with STAC, PMTiles, or
the current HOTOSM design system. Retrofitting it would cost about as
much as starting fresh, and we'd end up with roughly the same shape.

We want a frontend that:

- Talks to STAC / titiler-pgstac / PMTiles directly, with nothing
  custom in between.
- Looks and feels like the rest of the HOTOSM tools.
- Stays quick to change with a small team.

## Considered Options

- **Refactor the old frontend in place**: slows down every change,
  and hard to justify given the API is being rewritten underneath.
- **Adopt [stac-map](https://github.com/developmentseed/stac-map) as
  the frontend, restyled and with our own basemaps**: we actually
  tried this. It's a solid STAC viewer, but user feedback said the
  UI was too generic/complex for OAM and it didn't cover the browse
  and filtering flows we need. Bending it into shape was heading
  towards a rewrite anyway.
- **Next.js or another SSR framework**: heavier than we need for what
  is basically a map with a sidebar talking to public read-only APIs.
- **Vite + React SPA, with UnoCSS, `@hotosm/ui` and
  `@awesome.me/webawesome`**: lightweight, matches the HOTOSM stack,
  and there's nothing to run on the server.

## Decision Outcome

A new SPA in `frontend/`:

- **Vite + React 19 + TypeScript** for the app itself.
- **UnoCSS** for styling (small runtime, minimal config).
- **`@hotosm/ui`** so we pick up HOTOSM design tokens and components
  and stay in step with the other HOTOSM tools.
- **Web Awesome** (`@awesome.me/webawesome`) for general UI bits that
  `@hotosm/ui` doesn't cover.
- **MapLibre GL + pmtiles** for the map, talking directly to
  titiler-pgstac and the PMTiles archive.

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
