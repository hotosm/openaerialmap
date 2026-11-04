# Record imagery ownership on STAC Items

## Context and Problem Statement

Contributors need to find, fix and hand over the imagery they upload (roadmap
v2.3 and v2.4,
[discussion #332](https://github.com/hotosm/openaerialmap/discussions/332)).
To support this, we need to know who owns each STAC Item. The browse frontend
needs this to show "my imagery", and the uploader needs it to check who can
make changes.

We already record who uploaded an Item. Since OAM extension v0.3.0,
`oam:uploader_id` stores an account id in the format `provider|id`:

- `hotosm|<id>` for HOT Login accounts.
- `custom|anonymous` for anonymous uploads.
- `oam-legacy|<id>` for accounts from the legacy uploader.

The pipeline takes this value from `uploads.user_sub` when it reads the upload
metadata. Contributors cannot set it themselves.

The uploader id never changes, but ownership can. For example, a contributor
may hand imagery over to an organisation, an admin may reassign a duplicate,
or a HOT Login user may claim their legacy account. We also have no way to
identify organisations on Items yet.

We need to decide:

- Where to store ownership, and which record to use for permission checks.
- How to identify users and organisations.
- How browse can find "my imagery" without needing its own API.

## Considered Options

- **Keep ownership only in the uploader database.** Permission checks would
  stay local, but browse would need an authenticated API to list a user's
  imagery. We'd also maintain a second record of every Item alongside pgstac.
- **Reuse `oam:uploader_id` as the owner.** This avoids adding a field, but
  transferring imagery would overwrite who uploaded it. We need to keep that
  history for takedowns and the legacy migration.
- **Owner is always a user, with the organisation derived from membership.**
  A user can belong to several organisations, so membership can't say which
  one an Item is for. Imagery would also follow a person who leaves, and old
  uploads would move under an organisation they join. Listing an
  organisation's imagery would need its member list from HOT Login. Recording
  the organisation on the Item avoids all three.
- **Add `oam:owner_id` alongside `oam:uploader_id`.** This keeps the upload
  history while allowing ownership to change. Both fields use the identifier
  format already in the catalogue. The prefix tells us whether the owner is
  a user or an organisation, so we don't need a separate type field.

## Decision Outcome

We will add `oam:owner_id` to the STAC Item in OAM extension v0.4.0.
`oam:uploader_id` will continue to record who uploaded it and will never change.

### Identifying owners

The new field uses the same `provider|id` format as `oam:uploader_id`:

- Users: `hotosm|<id>`, as the uploader already writes today.
- Organisations: `hotosm-org|<id>`, using the HOT Login group id.

The group id is a stable UUID. An organisation can rename its slug, so we
cannot use the slug to identify the owner.

An Item can have at most one owner. To share it between several people, make an
organisation the owner. HOT Login organisation membership then determines
who can edit it. Teams could use the same approach, but adding an identifier
prefix would need a new extension version.

### Setting and changing ownership

When registering an Item, the uploader sets `oam:owner_id` to the uploader id.
There are a few exceptions:

- Anonymous uploads have no owner and stay unclaimed.
- Legacy Items use `oam-legacy|<id>` as the owner. The legacy migration can
  then transfer ownership by updating this field.
- Items with no uploader, such as the open data collections, have no owner.

Transfers, admin reassignments and legacy claims go through authenticated
uploader endpoints. These read the stored Item, update the owner and write it
back to pgstac (an upsert). We need to update the existing Item because
rebuilding it would drop its tilepack assets (see
`docs/dev/ingest/backfill.md`).

For Items already in pgstac, the stored `oam:owner_id` is the source of truth
for permission checks. This avoids keeping a separate ownership table in
sync with the catalogue. Until an Item reaches pgstac, the uploader uses
`uploads.user_sub` to check permissions.

### Finding my imagery

We will add `oam:owner_id` and `oam:uploader_id` as indexed pgstac queryables
(fields that STAC clients can filter by).

Browse can then find "my imagery" with a STAC search using a CQL2 filter:
`oam:owner_id = 'hotosm|<id>'`. The id comes from the HOT Login session.
This search is public, like the rest of the catalogue.

The coverage PMTiles also include `owner_id`, so the map can highlight the
same Items. These rebuild daily, so ownership changes appear in the list
before they appear on the map.

### Consequences

Ownership is available to any STAC client, and browse can filter by it without
an extra API. We can transfer imagery while keeping a record of who uploaded
it.

There are a few costs:

- Each ownership change writes an updated Item to pgstac. Only the uploader
  may make these changes.
- Owner ids are public. They contain opaque ids rather than names, but still
  link a person's uploads together, as public profiles will also do.
- We need a pgstac migration for the queryables, an extension release, and a
  backfill that copies `oam:uploader_id` into `oam:owner_id` for existing
  Items, with the exceptions above. Legacy Items synced before extension
  v0.3.0 have no `oam:uploader_id`, so their backfill needs to read the legacy
  API while it is still available.
- Organisation ownership depends on HOT Login keeping group ids stable.
