PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
INSERT OR IGNORE INTO schema_migrations VALUES (1, CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS offices (code TEXT PRIMARY KEY CHECK(length(code)=6), label TEXT NOT NULL, installation TEXT NOT NULL);
INSERT OR IGNORE INTO offices VALUES ('FA4800','633 CONS','Langley AFB'),('FA4855','27 SOCONS','Cannon AFB'),('FA8101','AFSC/PZIO','Tinker AFB');
CREATE TABLE IF NOT EXISTS office_name_history (office_code TEXT NOT NULL REFERENCES offices(code), source_name TEXT NOT NULL, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, PRIMARY KEY(office_code,source_name));
CREATE TABLE IF NOT EXISTS dataset_versions (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL, published_at TEXT,
  status TEXT NOT NULL CHECK(status IN ('staging','validated','published','failed')),
  coverage_start TEXT NOT NULL, coverage_end TEXT NOT NULL, scope TEXT NOT NULL,
  completeness TEXT NOT NULL, transaction_count INTEGER NOT NULL DEFAULT 0,
  award_count INTEGER NOT NULL DEFAULT 0, net_obligation_cents INTEGER NOT NULL DEFAULT 0,
  CHECK(coverage_start<=coverage_end)
);
CREATE TABLE IF NOT EXISTS active_dataset (singleton INTEGER PRIMARY KEY CHECK(singleton=1), version_id TEXT NOT NULL REFERENCES dataset_versions(id));
CREATE TABLE IF NOT EXISTS source_files (
  sha256 TEXT PRIMARY KEY, r2_key TEXT NOT NULL, source_url TEXT NOT NULL,
  request_json TEXT NOT NULL CHECK(json_valid(request_json)), downloaded_at TEXT NOT NULL,
  byte_count INTEGER NOT NULL CHECK(byte_count>=0), row_count INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS ingest_runs (
  id TEXT PRIMARY KEY, version_id TEXT REFERENCES dataset_versions(id), started_at TEXT NOT NULL,
  ended_at TEXT, status TEXT NOT NULL, message TEXT NOT NULL DEFAULT '', source TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ingest_checkpoints (source TEXT NOT NULL, partition_key TEXT NOT NULL, last_success_at TEXT NOT NULL, source_sha256 TEXT REFERENCES source_files(sha256), PRIMARY KEY(source,partition_key));
CREATE TABLE IF NOT EXISTS api_usage_daily (source TEXT NOT NULL, day TEXT NOT NULL, requests INTEGER NOT NULL CHECK(requests>=0), budget INTEGER NOT NULL CHECK(budget>0), PRIMARY KEY(source,day));
CREATE TABLE IF NOT EXISTS awards (
  version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  award_id TEXT NOT NULL, piid TEXT NOT NULL, parent_piid TEXT,
  office_code TEXT NOT NULL, office_name TEXT NOT NULL, award_type TEXT, recipient TEXT,
  recipient_uei TEXT, description TEXT, naics TEXT, psc TEXT, set_aside TEXT,
  competition TEXT, pricing_type TEXT, igf TEXT,
  start_date TEXT, current_end_date TEXT, potential_end_date TEXT,
  first_action_date TEXT NOT NULL, latest_action_date TEXT NOT NULL,
  obligation_cents INTEGER NOT NULL, current_value_cents INTEGER, potential_value_cents INTEGER,
  transaction_count INTEGER NOT NULL, number_of_actions INTEGER NOT NULL,
  source_url TEXT, latest_transaction_id TEXT NOT NULL, history_complete INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(version_id,award_id)
);
CREATE INDEX IF NOT EXISTS awards_office ON awards(version_id,office_code,current_end_date,award_id);
CREATE INDEX IF NOT EXISTS awards_parent ON awards(version_id,parent_piid);
CREATE TABLE IF NOT EXISTS transactions (
  version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  transaction_id TEXT NOT NULL, award_id TEXT NOT NULL,
  piid TEXT NOT NULL, parent_piid TEXT, action_date TEXT NOT NULL, fiscal_year INTEGER NOT NULL,
  modification_number TEXT NOT NULL, office_code TEXT NOT NULL, office_name TEXT NOT NULL,
  recipient TEXT, naics TEXT, psc TEXT, obligation_cents INTEGER NOT NULL,
  current_value_delta_cents INTEGER, potential_value_delta_cents INTEGER,
  number_of_actions INTEGER NOT NULL, source_sha256 TEXT NOT NULL REFERENCES source_files(sha256),
  raw_json TEXT NOT NULL CHECK(json_valid(raw_json)),
  PRIMARY KEY(version_id,transaction_id)
);
CREATE INDEX IF NOT EXISTS transactions_award ON transactions(version_id,award_id,action_date,modification_number,transaction_id);
CREATE INDEX IF NOT EXISTS transactions_fy ON transactions(version_id,office_code,fiscal_year,naics,psc);
CREATE TABLE IF NOT EXISTS fy_obligations (
  version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  office_code TEXT NOT NULL, fiscal_year INTEGER NOT NULL,
  dimension TEXT NOT NULL CHECK(dimension IN ('all','naics','psc')), code TEXT NOT NULL,
  obligation_cents INTEGER NOT NULL, transaction_count INTEGER NOT NULL, number_of_actions INTEGER NOT NULL,
  PRIMARY KEY(version_id,office_code,fiscal_year,dimension,code)
);
CREATE TABLE IF NOT EXISTS opportunities (
  notice_id TEXT PRIMARY KEY, solicitation_number TEXT, office_code TEXT, title TEXT NOT NULL,
  posted_date TEXT, response_deadline TEXT, naics TEXT, psc TEXT, notice_type TEXT,
  active INTEGER NOT NULL DEFAULT 1, source_url TEXT, fetched_at TEXT NOT NULL,
  raw_json TEXT NOT NULL CHECK(json_valid(raw_json))
);
CREATE TABLE IF NOT EXISTS award_opportunity_matches (
  version_id TEXT NOT NULL, award_id TEXT NOT NULL, notice_id TEXT NOT NULL REFERENCES opportunities(notice_id),
  matcher_version TEXT NOT NULL, score INTEGER NOT NULL CHECK(score BETWEEN 0 AND 100),
  reasons_json TEXT NOT NULL CHECK(json_valid(reasons_json)), matched_at TEXT NOT NULL,
  PRIMARY KEY(version_id,award_id,notice_id,matcher_version),
  FOREIGN KEY(version_id,award_id) REFERENCES awards(version_id,award_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS data_quality_issues (
  version_id TEXT NOT NULL REFERENCES dataset_versions(id) ON DELETE CASCADE,
  record_id TEXT NOT NULL, code TEXT NOT NULL, detail TEXT NOT NULL,
  PRIMARY KEY(version_id,record_id,code)
);
