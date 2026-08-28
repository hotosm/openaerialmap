-- Index the reconciler's sweep. Matches the baseline in init/0-main.sql, which
-- an existing database never re-runs.

BEGIN;

-- The sweep asks for the oldest non-terminal uploads every minute, and almost
-- every row in the table is terminal, so keep those out of the index entirely.
CREATE INDEX IF NOT EXISTS uploads_unfinished_idx
    ON uploads (updated_at)
    WHERE status NOT IN ('Uploaded', 'Succeeded', 'Failed', 'Error', 'Aborted');

COMMIT;
