-- Baseline schema for the OAM uploader (applied once, when the DB is empty).
-- Incremental changes go in numbered migrations under ../ (e.g. 001-*.sql),
-- applied by migrate-entrypoint.sh and tracked in the _migrations table.

-- Local mirror of the shared-auth (Hanko / OSM) identity.
-- `sub` is the canonical identifier in `provider|id` form, e.g. "hotosm|1234".
CREATE TABLE IF NOT EXISTS users (
    sub TEXT PRIMARY KEY,
    username TEXT,
    name TEXT,
    email_address TEXT,
    profile_img TEXT,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS users OWNER TO current_user;

-- Owner for anonymous uploads, so `uploads.user_sub` can stay NOT NULL
-- and we can filter by anonymous uploads
INSERT INTO users (sub, username, name)
VALUES ('custom|anonymous', 'anonymous', 'Anonymous')
ON CONFLICT (sub) DO NOTHING;

-- Per-upload job state. Replaces the prototype's in-memory dicts so state
-- survives restarts and works across replicas.
-- `callback_token` is a per-upload secret: the Argo workflow launched for this
-- upload passes it back (header X-Internal-Token) to authorise status updates.
CREATE TABLE IF NOT EXISTS uploads (
    id UUID PRIMARY KEY,
    user_sub TEXT NOT NULL REFERENCES users(sub) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    title TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    workflow_name TEXT,
    -- Nullable: set to NULL when a job reaches a terminal state, which revokes
    -- the token so it can't be reused after the workflow finishes.
    callback_token TEXT,
    -- Values come from UploadStatus in app/db/models.py.
    status TEXT NOT NULL DEFAULT 'Processing',
    message TEXT NOT NULL DEFAULT '',
    -- The columns below are repeated in ../1-remote-source-ingest.sql, which is
    -- what an existing database gets: the baseline only runs on an empty one.
    -- Idempotency key from the system that asked for this upload, by
    -- convention "<source>:<id>" (e.g. "dronetm:<project-uuid>"). Never parsed.
    external_id TEXT,
    -- Public backlink to whatever produced the imagery; becomes the STAC item's
    -- `rel: via` link. Not the fetch source, which is never published.
    external_url TEXT,
    -- Set when the pipeline fetches the bytes itself, NULL for browser
    -- multipart uploads. Cleared once the bytes arrive; a presigned URL is a
    -- bearer token for someone else's bucket.
    source_url TEXT,
    -- Dataset metadata the uploader supplied, read back by the pipeline over
    -- the callback token rather than passed as workflow shell arguments.
    dataset_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- sha256 multihash of the original bytes, computed by the pipeline.
    checksum TEXT,
    -- Non-fatal notices (e.g. byte-identical duplicate) shown with the status.
    warning TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS uploads OWNER TO current_user;

CREATE INDEX IF NOT EXISTS uploads_user_sub_idx ON uploads (user_sub);
CREATE INDEX IF NOT EXISTS uploads_status_idx ON uploads (status);

-- Partial: a failed or aborted attempt must not lock an external system out of
-- ever publishing that dataset.
CREATE UNIQUE INDEX IF NOT EXISTS uploads_external_id_active_idx
    ON uploads (external_id)
    WHERE external_id IS NOT NULL
      AND status NOT IN ('Failed', 'Error', 'Aborted');

CREATE INDEX IF NOT EXISTS uploads_checksum_idx
    ON uploads (checksum)
    WHERE checksum IS NOT NULL;

-- The reconciler sweeps the oldest non-terminal uploads every minute, and
-- almost every row is terminal, so keep those out of the index entirely.
CREATE INDEX IF NOT EXISTS uploads_unfinished_idx
    ON uploads (updated_at)
    WHERE status NOT IN ('Uploaded', 'Succeeded', 'Failed', 'Error', 'Aborted');
