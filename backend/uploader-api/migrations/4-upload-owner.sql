-- Imagery published for an organisation. Matches the baseline in
-- init/0-main.sql, which an existing database never re-runs.

ALTER TABLE uploads
    -- Owner of the imagery as `hotosm-org|<HOT Login group id>`, chosen at
    -- upload by one of its members. NULL: the uploading account owns it.
    ADD COLUMN IF NOT EXISTS owner_id TEXT;
