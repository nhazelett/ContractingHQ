CREATE TABLE IF NOT EXISTS opp_runs(id TEXT PRIMARY KEY,checked_at TEXT NOT NULL,coverage_json TEXT NOT NULL,row_count INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS opp_active(singleton INTEGER PRIMARY KEY CHECK(singleton=1),run_id TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS opp_notices(
 run_id TEXT NOT NULL,notice_id TEXT NOT NULL,posted_key TEXT NOT NULL,data_json TEXT NOT NULL,description_ref TEXT,
 office_code TEXT GENERATED ALWAYS AS (json_extract(data_json,'$.office_code')) STORED,
 agency_name TEXT GENERATED ALWAYS AS (json_extract(data_json,'$.agency_name')) STORED,
 naics TEXT GENERATED ALWAYS AS (json_extract(data_json,'$.naics')) STORED,
 psc TEXT GENERATED ALWAYS AS (json_extract(data_json,'$.psc')) STORED,
 set_aside_code TEXT GENERATED ALWAYS AS (json_extract(data_json,'$.set_aside_code')) STORED,
 place_state TEXT GENERATED ALWAYS AS (json_extract(data_json,'$.place_state')) STORED,
 notice_type TEXT GENERATED ALWAYS AS (json_extract(data_json,'$.notice_type')) STORED,
 source_active INTEGER GENERATED ALWAYS AS (json_extract(data_json,'$.source_active')) STORED,
 deadline_date TEXT GENERATED ALWAYS AS (json_extract(data_json,'$.deadline.date')) STORED,
 PRIMARY KEY(run_id,notice_id));
CREATE INDEX IF NOT EXISTS opp_newest ON opp_notices(run_id,posted_key DESC,notice_id);
CREATE INDEX IF NOT EXISTS opp_office ON opp_notices(run_id,office_code,posted_key DESC);
CREATE INDEX IF NOT EXISTS opp_agency ON opp_notices(run_id,agency_name,posted_key DESC);
CREATE INDEX IF NOT EXISTS opp_naics ON opp_notices(run_id,naics,posted_key DESC);
CREATE VIRTUAL TABLE IF NOT EXISTS opp_search USING fts5(run_id UNINDEXED,notice_id UNINDEXED,title,solicitation);
CREATE TABLE IF NOT EXISTS opp_descriptions(notice_id TEXT PRIMARY KEY,description_text TEXT,checked_at TEXT,truncated INTEGER NOT NULL DEFAULT 0,loading_until TEXT);
CREATE TABLE IF NOT EXISTS opp_usage(day TEXT PRIMARY KEY,requests INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS opp_refresh(singleton INTEGER PRIMARY KEY CHECK(singleton=1),last_attempt TEXT,last_error TEXT,lease_until TEXT);
