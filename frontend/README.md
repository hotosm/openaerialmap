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
