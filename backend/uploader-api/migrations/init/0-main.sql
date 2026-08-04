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
    status TEXT NOT NULL DEFAULT 'Processing',
    message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS uploads OWNER TO current_user;

CREATE INDEX IF NOT EXISTS uploads_user_sub_idx ON uploads (user_sub);
CREATE INDEX IF NOT EXISTS uploads_status_idx ON uploads (status);
