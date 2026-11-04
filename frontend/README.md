## OpenAerialMap frontend

Vite + React. Two routes:

- `/` - landing page.
- `/browse` - MapLibre view over the STAC catalogue: pan/zoom, click
  footprints, filter, open in iD/JOSM, download the GeoTIFF.

Vector tiles come from two PMTiles archives (see
`utils/constants.ts`): a small density grid for the world view and a
larger per-image footprint file above `FOOTPRINT_MIN_ZOOM`. Full-res
overlays and iD/JOSM tile URLs resolve through TiTiler-PgSTAC.

### Development

```bash
pnpm install
pnpm run dev  # vite on :3000
```

Defaults point at the production PMTiles and TiTiler-PgSTAC. Override
via `.env` - see `.env.example` at the repo root.

### Sign-in

`VITE_HANKO_URL` adds the HOT Login button (`<hotosm-auth>`) to the
header, the same component the uploader uses. Unset, the header has no
sign-in and nothing else changes. The Hanko session is a cookie on the
parent domain, so signing in on the uploader also signs you in here.
`useAuthUser()` in `src/auth.ts` gives components the signed-in user.

Hanko answers only origins in its CORS allowlist, and the session
cookie is scoped to the parent domain, so a `localhost` frontend cannot
sign in. Testing it needs the app served over HTTPS from an origin the
Hanko instance allows.

### My imagery

Signed in, the sidebar gets two tabs. **My imagery** lists the Items
whose `oam:owner_id` is the user's `hotosm|<sub>` or the
`hotosm-org|<id>` of an organisation they belong to, from a CQL2 search
on `VITE_STAC_URL` (ADR 0011). The search is public and needs no token.

The owners come from HOT Login at `VITE_HANKO_URL` (`useOwners.ts`):
`/me` for the `sub`, which the `hanko-login` event does not always
carry, and `/api/groups?type=organization` for approved organisations.
Any member sees an organisation's imagery, as in Portal. Members of an
organisation get an Owner select to narrow the list. If Login cannot
list the organisations, the user's own imagery still loads. Both calls
need the Browse origin in Login's CORS allowlist.
The list is current, while the coverage PMTiles are rebuilt on a
schedule, so the map draws these footprints from the search results at
every zoom, with a dot per image below `FOOTPRINT_MIN_ZOOM`.

- The filter bar applies to the list on the client. Results load 100 at
  a time, so the count says so while more pages remain.
- In either tab, footprints whose PMTiles `owner_id` is one of those
  owners are outlined in `MY_IMAGERY_COLOUR`.
- `?view=mine` opens the tab directly. Signed out, it shows all imagery.
- Imagery the user may change (their own, or an organisation's where Login
  gives them the owner or manager role) gets a **Transfer…** button, which
  hands it to another of their owners through the uploader's
  `PATCH /api/v1/imagery/{id}` (`utils/imagery.ts`). Members only see.

To see your own uploads locally, `VITE_STAC_URL` has to point at the
local STAC API; it defaults to production.

### Credit

Layout, filter bar, disambig popup and preview/TMS handoff started
from [`cgiovando/oam-vibe`][vibe]. Notable changes from that base:

- **Two PMTiles instead of one.** A pre-baked density grid at z0–7 and
  per-image footprints at z8+. The vibe binned centroids from the
  footprint tiles client-side, which undercounts tippecanoe
  'drop-densest' simplification.
- **Filter-aware density.** Each density cell carries pre-baked count
  buckets (platform / license / year / recent windows), so world-zoom
  counts stay accurate under filtering. Multi-filter uses `min` as an
  upper bound.
- **STAC-native tile URLs.** Full-res overlays and iD/JOSM URLs resolve
  through TiTiler-PgSTAC; no S3 paths or bucket names hardcoded in the
  client.
- Ported from JSX to TypeScript, integrated with `@hotosm/ui`.
- Swap Tailwind for UnoCSS.

[vibe]: https://github.com/cgiovando/oam-vibe
