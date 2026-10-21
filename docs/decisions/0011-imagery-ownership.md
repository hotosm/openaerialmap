# Record imagery ownership on STAC Items

## Context and Problem Statement

Contributors need to list, fix and hand over the imagery they upload (roadmap
v2.3 and v2.4, discussion #332). Every Item therefore needs an owner that the
browse frontend can filter by, and that the uploader can check before it
changes anything.

Part of this already exists. Since OAM extension v0.3.0, Items carry
`oam:uploader_id` as `provider|id`: `hotosm|<id>` for HOT Login accounts,
`custom|anonymous` for anonymous uploads, and `oam-legacy|<id>` for accounts
from the legacy uploader. The uploader takes it from `uploads.user_sub` when the
pipeline reads its metadata, so a contributor cannot set it themselves.

That records who uploaded an Item, which never changes. Ownership does:
imagery moves to an organisation, an admin reassigns a duplicate, a HOT Login
user claims their legacy account. Organisations have no identifier on Items
yet.

We need to decide:

- Where the owner lives, and which copy is authoritative.
- How users and organisations are identified.
- How the browse frontend finds "my imagery" without an API of its own.

## Considered Options

- **Keep ownership only in the uploader database.** Permission checks stay
  local, but browse would need an authenticated API to list anyone's imagery,
  and we'd keep a second record of every Item next to pgstac. No.
- **Reuse `oam:uploader_id` as the owner.** No new field, but a transfer would
  overwrite who uploaded the imagery, and the name would stop being true.
  Provenance matters for takedowns and for the legacy migration, so we passed.
- **Add `oam:owner_id` next to `oam:uploader_id`.** What we chose. The upload
  record stays fixed, the owner can change, and both use the format the
  catalogue already has. The prefix already says whether the owner is a user
  or an organisation, so a separate type field adds nothing.

## Decision Outcome

**The field.** OAM extension v0.4.0 adds `oam:owner_id`, with the same
`provider|id` pattern as `oam:uploader_id`. Users are `hotosm|<id>`, exactly as
the uploader writes them today. Organisations are `hotosm-org|<id>`, using the
HOT Login group id, a UUID that never changes, rather than the slug, which an
organisation can rename. `oam:uploader_id` never changes after upload.

**Who writes it.** The uploader sets `oam:owner_id` to the uploader id when it
registers an Item, unless the upload was anonymous. Transfers, admin
reassignment and legacy claims go through
authenticated uploader endpoints, which read the stored Item, set the property
and upsert it. Rebuilding the Item instead would drop its tilepack assets (see
`docs/dev/ingest/backfill.md`).

**Source of truth.** For catalogued Items, pgstac. The uploader checks
permissions against the stored `oam:owner_id`, so there is no ownership table
to drift out of sync with the catalogue. Imagery that is not in pgstac yet is
decided by `uploads.user_sub`.

**Unattributed Items.** Anonymous uploads get no owner and stay unclaimed.
Legacy Items take their `oam-legacy|<id>` as owner, so the legacy migration can
hand them over by rewriting one field. Items with no uploader at all, such as
the open data collections, have no owner.

**Finding it.** `oam:owner_id` and `oam:uploader_id` become indexed pgstac
queryables. "My imagery" in browse is a STAC search filtered with CQL2
(`oam:owner_id = 'hotosm|<id>'`), with the id taken from the HOT Login session.
The search is public, like the rest of the catalogue. The coverage PMTiles also
carry `owner_id` so the map can highlight the same Items. They rebuild daily,
so the list is fresher than the map.

### Consequences

The good: ownership sits on the Item itself, so any STAC client can read it
and browse can filter by it without a new API. Transfers keep the record of
who uploaded what.

The cost:

- Every ownership change rewrites a pgstac Item, so only the uploader may do
  it.
- Owner ids are public. They are opaque ids rather than names, but they do
  link a person's uploads together, which public profiles will do anyway.
- It needs a pgstac migration for the queryables, a backfill of existing Items
  from `oam:uploader_id`, and an extension release. Legacy Items synced before
  extension v0.3.0 have no `oam:uploader_id` either, so their backfill reads
  the legacy API while it is still up.
- Organisation ids depend on HOT Login keeping them stable.

Items also publish `oam:uploader_email`; #343 stops that, separately from this
decision.
