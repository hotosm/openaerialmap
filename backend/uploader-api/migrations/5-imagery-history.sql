-- Matches the baseline in init/0-main.sql, which an existing database never
-- re-runs.

-- Changes made to published imagery through the uploader (owner transfers,
-- later licence changes), so a change can be traced to who made it.
CREATE TABLE IF NOT EXISTS imagery_changes (
    id BIGSERIAL PRIMARY KEY,
    -- STAC Item id; the Item itself lives in pgstac.
    item_id TEXT NOT NULL,
    -- Item property that changed, e.g. `oam:owner_id`.
    field TEXT NOT NULL,
    -- Account that made the change, as `provider|id`.
    actor_sub TEXT NOT NULL,
    old_value TEXT,
    new_value TEXT,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE IF EXISTS imagery_changes OWNER TO current_user;

CREATE INDEX IF NOT EXISTS imagery_changes_item_id_idx
    ON imagery_changes (item_id);
