-- Owner for anonymous uploads. Matches the baseline in init/0-main.sql, which
-- an existing database never re-runs.

INSERT INTO users (sub, username, name)
VALUES ('custom|anonymous', 'anonymous', 'Anonymous')
ON CONFLICT (sub) DO NOTHING;
