# Allowlist STAC collections shown in Browse

## Context and Problem Statement

Browse only showed the `openaerialmap` collection because both the frontend
and tile generator assumed it. Imagery in other pgSTAC collections therefore
did not appear, including in the low-zoom density grid.

Not every collection belongs in an imagery browser. For example,
`cop-dem-glo-30` contains elevation data. Deployments need an explicit way to
choose which collections Browse includes.

## Considered Options

- **Include every pgSTAC collection.** Simple, but includes non-imagery data.
- **Hardcode collections in the frontend.** Requires a frontend release for
  each catalogue change and can drift from generated tiles.
- **Configure an allowlist for the tile generator.** Chosen.

## Decision Outcome

The tile generator reads a comma-separated `FOOTPRINT_COLLECTIONS` allowlist.
It defaults to `COLLECTION`, preserving existing deployments.

Each footprint carries its `collection`, and each density cell carries
`count_col_<collection>` alongside the total `count`. This lets the frontend
list and filter collections at both footprint and density zoom levels.

### Consequences

- Collection membership is controlled by deployment configuration rather than
  frontend code.
- The default remains single-collection and backward compatible.
- Widening the allowlist changes `count` to include every selected collection.
  `global-tms` reads the same value, so it must use
  `count_col_openaerialmap` before a deployment widens the allowlist.
- Item IDs are unique only within a collection. The frontend must namespace
  IDs before enabling collections that may contain duplicate item IDs.
- Combined density filters remain approximate because they intersect bucket
  counts with `min()`; see issue #282.
