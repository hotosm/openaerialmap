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
