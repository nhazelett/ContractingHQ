-- Automatic rollout metadata only; award and publication tables are untouched.
CREATE TABLE IF NOT EXISTS portfolio_seed_rankings (
 ranking_id TEXT PRIMARY KEY,
 fiscal_year INTEGER NOT NULL,
 source_sha256 TEXT NOT NULL,
 source_json TEXT NOT NULL,
 directory_sha256 TEXT NOT NULL,
 ranking_json TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS portfolio_rollout_jobs (
 office_dodaac TEXT PRIMARY KEY REFERENCES offices(dodaac),
 origin TEXT NOT NULL CHECK(origin IN ('seed','demand')),
 seed_rank INTEGER,
 ranking_id TEXT REFERENCES portfolio_seed_rankings(ranking_id),
 priority INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','importing','verifying','ready','stopped')),
 checkpoint_ref TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 lease_id TEXT,
 lease_until TEXT,
 not_before TEXT,
 last_error TEXT,
 publication_version TEXT,
 requested_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS portfolio_rollout_next ON portfolio_rollout_jobs(status,priority,seed_rank,office_dodaac);
