-- Remote-source ingest and external linkage. Matches the baseline in
-- init/0-main.sql, which an existing database never re-runs.

BEGIN;

ALTER TABLE uploads
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS external_url TEXT,
    ADD COLUMN IF NOT EXISTS source_url TEXT,
    ADD COLUMN IF NOT EXISTS dataset_meta JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS checksum TEXT,
    ADD COLUMN IF NOT EXISTS warning TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uploads_external_id_active_idx
    ON uploads (external_id)
    WHERE external_id IS NOT NULL
      AND status NOT IN ('Failed', 'Error', 'Aborted');

CREATE INDEX IF NOT EXISTS uploads_checksum_idx
    ON uploads (checksum)
    WHERE checksum IS NOT NULL;

COMMIT;
