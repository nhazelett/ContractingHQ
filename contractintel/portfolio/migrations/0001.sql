PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS offices (
 dodaac TEXT PRIMARY KEY CHECK(length(dodaac)=6), name TEXT NOT NULL, reported_name TEXT,
 department TEXT, parent_dodaac TEXT, command TEXT, base TEXT, location TEXT, confidence TEXT,
 raw_json TEXT NOT NULL CHECK(json_valid(raw_json))
);
CREATE TABLE IF NOT EXISTS ingest_runs (
 id TEXT PRIMARY KEY, mode TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT,
 status TEXT NOT NULL, offices_touched INTEGER NOT NULL DEFAULT 0, rows_written INTEGER NOT NULL DEFAULT 0,
 rows_read INTEGER NOT NULL DEFAULT 0, source_requests INTEGER NOT NULL DEFAULT 0,
 error_count INTEGER NOT NULL DEFAULT 0, errors_json TEXT NOT NULL DEFAULT '[]',
 config_json TEXT NOT NULL, resume_from_run_id TEXT
);
CREATE TABLE IF NOT EXISTS office_publications (
 office_dodaac TEXT PRIMARY KEY REFERENCES offices(dodaac), published_run_id TEXT NOT NULL REFERENCES ingest_runs(id),
 coverage_start TEXT NOT NULL, coverage_end TEXT NOT NULL, windows_json TEXT NOT NULL,
 award_count INTEGER NOT NULL, fiscal_complete INTEGER NOT NULL, schema_version INTEGER NOT NULL,
 published_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS awards (
 generated_unique_award_id TEXT PRIMARY KEY, piid TEXT NOT NULL, parent_piid TEXT,
 office_dodaac TEXT NOT NULL REFERENCES offices(dodaac), recipient_name TEXT, recipient_uei TEXT, description TEXT,
 naics_code TEXT, naics_description TEXT, psc_code TEXT, psc_description TEXT,
 set_aside_code TEXT, set_aside_description TEXT, award_type_code TEXT, award_type_description TEXT,
 competition TEXT, pricing_type TEXT, pop_start_date TEXT, current_pop_end_date TEXT, potential_final_end_date TEXT,
 date_signed TEXT, source_last_modified_date TEXT, latest_action_date TEXT,
 current_value_cents TEXT, total_obligation_cents TEXT, base_exercised_options_cents TEXT, potential_value_cents TEXT,
 lifecycle_kind TEXT NOT NULL, dataset_bucket TEXT NOT NULL, date_review_flag INTEGER NOT NULL,
 classification_reason TEXT NOT NULL, days_to_current_end INTEGER, days_to_potential_end INTEGER,
 recompete_candidate INTEGER NOT NULL, derived_as_of TEXT NOT NULL,
 latest_mod_number TEXT, latest_option_mod_number TEXT, details_unavailable INTEGER NOT NULL DEFAULT 0,
 detail_error TEXT, history_has_next INTEGER NOT NULL DEFAULT 0,
 record_json TEXT NOT NULL CHECK(json_valid(record_json)), raw_json TEXT NOT NULL CHECK(json_valid(raw_json)),
 source_hash TEXT NOT NULL, published_run_id TEXT NOT NULL REFERENCES ingest_runs(id)
);
CREATE INDEX IF NOT EXISTS awards_office ON awards(office_dodaac,generated_unique_award_id);
CREATE INDEX IF NOT EXISTS awards_current_end ON awards(office_dodaac,current_pop_end_date,generated_unique_award_id);
CREATE INDEX IF NOT EXISTS awards_potential_end ON awards(office_dodaac,potential_final_end_date,generated_unique_award_id);
CREATE INDEX IF NOT EXISTS awards_dataset ON awards(office_dodaac,dataset_bucket,generated_unique_award_id);
CREATE INDEX IF NOT EXISTS awards_date_review ON awards(office_dodaac,date_review_flag,generated_unique_award_id);
CREATE TABLE IF NOT EXISTS award_windows (
 generated_unique_award_id TEXT NOT NULL REFERENCES awards(generated_unique_award_id) ON DELETE CASCADE,
 window_start TEXT NOT NULL, PRIMARY KEY(generated_unique_award_id,window_start)
);
CREATE INDEX IF NOT EXISTS windows_lookup ON award_windows(window_start,generated_unique_award_id);
CREATE TABLE IF NOT EXISTS award_history_pages (
 generated_unique_award_id TEXT NOT NULL REFERENCES awards(generated_unique_award_id) ON DELETE CASCADE,
 page INTEGER NOT NULL, actions_json TEXT NOT NULL CHECK(json_valid(actions_json)), raw_json TEXT NOT NULL CHECK(json_valid(raw_json)),
 has_next INTEGER NOT NULL, source_hash TEXT NOT NULL, published_run_id TEXT NOT NULL REFERENCES ingest_runs(id),
 PRIMARY KEY(generated_unique_award_id,page)
);
CREATE TABLE IF NOT EXISTS fiscal_totals (
 office_dodaac TEXT NOT NULL REFERENCES offices(dodaac), fiscal_year INTEGER NOT NULL,
 net_obligation_cents TEXT NOT NULL, distinct_contract_count INTEGER NOT NULL, transaction_count INTEGER NOT NULL,
 missing_amount_count INTEGER NOT NULL, coverage_start TEXT NOT NULL, coverage_end TEXT NOT NULL,
 complete INTEGER NOT NULL, award_ids_json TEXT NOT NULL, published_run_id TEXT NOT NULL REFERENCES ingest_runs(id),
 PRIMARY KEY(office_dodaac,fiscal_year)
);
CREATE TABLE IF NOT EXISTS ingest_office_progress (
 office_dodaac TEXT PRIMARY KEY REFERENCES offices(dodaac), run_id TEXT NOT NULL REFERENCES ingest_runs(id),
 work_id TEXT NOT NULL, mode TEXT NOT NULL, status TEXT NOT NULL, checkpoint_json TEXT NOT NULL,
 started_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS progress_office_status ON ingest_office_progress(office_dodaac,status,run_id);
CREATE TABLE IF NOT EXISTS ingest_stage (
 work_id TEXT NOT NULL, record_kind TEXT NOT NULL, record_key TEXT NOT NULL,
 data_json TEXT NOT NULL CHECK(json_valid(data_json)), PRIMARY KEY(work_id,record_kind,record_key)
);
CREATE TABLE IF NOT EXISTS ingest_lock (singleton INTEGER PRIMARY KEY CHECK(singleton=1), owner TEXT, lease_until TEXT);
INSERT OR IGNORE INTO ingest_lock(singleton) VALUES(1);
