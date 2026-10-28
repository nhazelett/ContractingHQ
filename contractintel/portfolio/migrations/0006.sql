CREATE TABLE IF NOT EXISTS portfolio_rollout_control (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 review_json TEXT,
 lease_id TEXT,
 lease_until TEXT,
 reserved_r2_bytes INTEGER NOT NULL DEFAULT 0,
 paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1))
);
INSERT OR IGNORE INTO portfolio_rollout_control(singleton) VALUES(1);
CREATE TABLE IF NOT EXISTS portfolio_rollout_days (
 day TEXT PRIMARY KEY,
 source_requests INTEGER NOT NULL DEFAULT 0,
 runtime_ms INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS portfolio_rollout_assertions (
 id TEXT PRIMARY KEY,
 valid INTEGER NOT NULL CHECK(valid=1)
);
CREATE UNIQUE INDEX IF NOT EXISTS portfolio_rollout_one_lease
 ON portfolio_rollout_jobs((1)) WHERE lease_id IS NOT NULL;
