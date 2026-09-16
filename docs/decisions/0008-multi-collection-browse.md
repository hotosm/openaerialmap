# Browse more than one STAC collection, behind an allowlist

## Context and Problem Statement

OAM's browser has always shown one collection, `openaerialmap`, because the
frontend hardcoded that name and the tile generator queried for it.

pgSTAC already holds more. `vantor-opendata`, `maxar-opendata`,
`noaa-emergency-response` and `cop-dem-glo-30` are all indexed, and
`stactools-hotosm` exists so that more provider catalogues can be added. None
of them reach a person browsing the map.

That matters most in the case OAM exists for. During a response the useful
question is "what imagery covers this place", not "what imagery covers this
place and happens to sit in the collection HOT uploaded to". Below zoom 8 the
density grid is the only surface the browser has, so a region covered solely
by a partner catalogue read as an empty map at the zoom most people start at.

The question is not whether to show other collections, but which, and who
decides.

## Considered Options

- **Everything in pgSTAC.** Simple, and wrong. `cop-dem-glo-30` is elevation
  data, not aerial imagery, and would appear as browsable imagery with no
  meaningful thumbnail. Which collections belong in an imagery browser is an
  editorial judgement, not a database query.
- **A second hardcoded list in the frontend.** Moves the problem without
  solving it: the answer to "what shows up in OAM" would still be a constant
  in a TypeScript file, invisible to whoever runs the deployment.
- **An allowlist in the deployment, read by the tile generator.** Chosen.

## Decision Outcome

`FOOTPRINT_COLLECTIONS` is an env var on the tile generator holding a
comma-separated list of collections. Footprints and density both take it, and
it defaults to `COLLECTION`, so an unconfigured deployment behaves exactly as
it does today.

Each footprint carries its `collection`, and each density cell carries
`count_col_<collection>` alongside the total `count`. One archive answers both
"how much imagery is here" and "whose", which is what lets the browser's
Source filter keep working when the map is zoomed out past the footprint
layer.

### Consequences

- Good: the set of collections OAM browses becomes a deployment value someone
  can read and change, rather than a constant compiled into the frontend.
- Good: adding a provider catalogue to the browser costs one env var, not a
  frontend release.
- Good: per-source counts survive zooming out, so a filtered view does not
  lie at world zoom.
- Bad: **`count` changes meaning when the allowlist is widened.** It becomes
  the total across every collection in the list rather than `openaerialmap`
  alone. `global-tms` serves the same archive as a public raster product and
  renders bare `count` (`backend/global-tms/chart/templates/configmap.yaml`),
  so widening the allowlist silently changes what that product shows. A
  consumer that means "OAM coverage" must read `count_col_openaerialmap`.
  **The deployment is the gate here, not the merge:** the default keeps
  `count` identical, and the allowlist must not be widened until global-tms
  is updated.
- Bad: item IDs are unique per collection, not globally. The browser dedupes,
  caches bounds and names raster layers by bare ID. There are no collisions
  across the two collections in use today, since OAM IDs are 24 or 36
  characters and Vantor's are 16, but IDs need namespacing by collection
  before a third is added.
- Bad: filter counts are intersected with `min()` across buckets, so a source
  filter combined with a second filter can show a non-zero cell for a
  combination no single image satisfies. Pre-existing, and now reachable
  through one more control.
- Bad: nothing appears until a deployment sets the var. The frontend change
  is inert on its own.
