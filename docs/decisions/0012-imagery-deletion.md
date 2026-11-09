# Delete imagery in two steps: hide, then purge

## Context and Problem Statement

Contributors need to delete imagery they uploaded, and admins need to take
imagery down (discussion
[#332](https://github.com/hotosm/openaerialmap/discussions/332)). The
discussion asks for a policy rather than a button: a soft delete with a grace
period, a hard delete on request, and an answer for imagery that is already in
use in a response.

That last point shapes the design. Editors and the Tasking Manager load
imagery through TiTiler URLs that name the Item, such as
`/collections/openaerialmap/items/<id>/tiles/...`. TiTiler finds the COG
through pgstac, so once an Item leaves pgstac, every mapping project using it
loses its imagery at once. OAM cannot tell which Items are in use.

Some other facts constrain the options:

- pgstac has no built-in way to hide a stored Item, so the STAC API lists
  everything it holds.
- Uploaded and legacy Items share the `openaerialmap` collection. The legacy
  sync inserts any legacy Item that pgstac does not have, so a legacy Item
  removed from pgstac comes back within 30 minutes.
- The production bucket is shared and ACL-based. An asset `href` can point
  anywhere, so deleting files by `href` could remove someone else's objects.
- The uploader keeps each upload's files under one prefix,
  `<owner prefix>/<upload id>/`: the original, the COG, the metadata, the
  thumbnail and any tilepack archives.

We need to decide:

- What a soft delete does to the Item, the map and existing links.
- How long the grace period is and what happens when it ends.
- Who can delete, restore and purge.

## Considered Options

- **Remove the Item from pgstac and keep a copy in the uploader database.**
  Deleted imagery disappears from every client at once, and restoring means
  inserting the copy again. However, links in use stop working immediately,
  and the copy is a second store of Items, which `AGENTS.md` rules out.
- **Move the Item to a hidden collection.** Collections are public, so the
  Item would still be listed. Its tile URLs name the old collection, so links
  in use would break anyway.
- **Mark the Item with a new `oam:deleted_at` field.** The Item stays in
  pgstac, so links keep working during the grace period. It needs a release of
  the OAM extension, and only clients that know OAM would understand the
  field.
- **Mark the Item with `expires` from the STAC
  [Timestamps extension](https://github.com/stac-extensions/timestamps).**
  This works like the option above, but with a field STAC already defines for
  "valid until". It needs no OAM extension release, because the OAM schema
  only constrains `oam:` fields. The extension is at Pilot maturity.

Either mark leaves the Item visible in the STAC API. Hiding it there too is a
separate step that builds on the mark: a default filter in our STAC API app,
or in a proxy in front of it. TiTiler reads pgstac directly, so links would
keep working. It depends on how the API is deployed, so it is left for a
follow-up.

## Decision Outcome

We will mark deleted Items in pgstac with `expires`, set to the end of their
grace period, and declare Timestamps v1.1.0 in their `stac_extensions`. OAM
treats an Item that has `expires` as deleted. When that time passes, the
uploader purges the Item from pgstac and removes its files.

We do not set `unpublished`. The Item stays published until the purge, and
after it there is no Item left to carry the field.

### Deleting and restoring

The rule for who can delete is the same as for transfers: the Item's owner,
or an owner or manager of the organisation that owns it. Anonymous uploads
have no owner, so only an admin can delete them. Deleting goes through the
uploader, which sets `expires` on the stored Item. Until that time passes, the
same people can restore the Item from My imagery, which removes the field.

Only uploaded Items can be deleted this way, meaning those with a row in
`uploads`. The legacy sync would bring back a purged legacy Item, and its files
are not in our bucket. Legacy imagery is out of scope until the legacy
migration.

While an Item has `expires`:

- Browse leaves it out, apart from a Deleted list in My imagery that shows the
  days left and a Restore button.
- The coverage PMTiles skip it, so it leaves the map at the next rebuild,
  within 15 minutes.
- The global TMS skips it: the mosaic search it registers with TiTiler gets
  the same filter.
- The duplicate check at upload ignores it, so the same file can be uploaded
  again.
- The tilepack API refuses to build archives for it.
- The uploader refuses to transfer or edit it until it is restored.
- The STAC API and TiTiler's Item endpoints still serve it, so a project
  using it keeps working. STAC clients can leave it out with the CQL2 filter
  `expires IS NULL`.

The confirmation dialog explains that existing links stop working when the
grace period ends.

### Grace period and purge

The grace period is 30 days. Each Item carries its own date, so changing the
length later only affects new deletions. A sweeper in the uploader, started
like the reconciler, purges Items whose `expires` has passed. A purge:

1. Deletes the Item from pgstac. A crash after this point leaves orphaned
   files rather than an Item that points at missing ones.
2. Deletes every object under the upload's own prefix, taken from
   `uploads.s3_key` and never from asset `href`s.
3. Records the purge on the upload row, so "Your uploads" shows the imagery as
   deleted rather than linking to a missing Item.

### Purging before the grace period ends

Only admins can purge immediately. This covers takedowns, such as imagery
showing people, sensitive sites or content without the rights to publish
it, and an owner's request for their own imagery. Owners cannot skip the grace
period themselves, so a mistaken deletion never breaks a mapping project at
once.

The admin panel will use the same purge. Until it exists, a maintainer runs
the purge with a command.

### History

Every delete, restore and purge is recorded with the account that made it, in
the same history table as transfers (`imagery_changes`). For admin purges,
the record also includes a reason.

## Consequences

Deleting imagery no longer breaks the projects that use it without warning, and
contributors can undo a mistake for 30 days. pgstac remains the only place where
Items are stored, and any STAC client can read when an Item will go.

There are a few costs:

- Deleted imagery stays public through the STAC API and its file URLs until it
  is purged. The same goes for the STAC browsers we package (stac-map and
  STAC Browser), which list whatever the API returns. Anything that must
  disappear at once goes through an admin takedown.
- Every consumer that lists imagery has to skip Items with `expires`. In this
  repository, those are Browse, the coverage generator, the global TMS, the
  duplicate check and tilepack.
- The rule applies to every collection. A provider collection that set
  `expires` on live imagery would be hidden too, and we would then limit the
  rule to `openaerialmap`.
- As with the owner, the mark only survives writers that patch the stored
  Item. One that rebuilds the Item would undo a deletion (see
  `docs/dev/ingest/backfill.md`).
- In production, the uploader needs `s3:DeleteObject` on the bucket, limited
  to its own prefixes if the bucket policy allows it.
- Before the first purge in production, we need to check three things about
  the bucket: whether it keeps object versions, whether a CDN caches the
  files, and whether older uploads were copied when it was renamed. A purge
  only removes the current objects under the upload's prefix.
- A tilepack job that is running when the Item is purged can still write an
  archive. To catch it, the sweeper clears the prefix of a purged upload once
  more on a later pass.
