-- Queue control state only. No award, fiscal, or publication tables are changed.
CREATE TABLE IF NOT EXISTS portfolio_import_queue (
 singleton INTEGER PRIMARY KEY CHECK(singleton=1),
 revision INTEGER NOT NULL,
 state_json TEXT NOT NULL CHECK(json_valid(state_json)),
 updated_at TEXT NOT NULL
);
