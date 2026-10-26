CREATE TABLE IF NOT EXISTS ingest_dispatches (
 dispatch_key TEXT PRIMARY KEY, request_id TEXT NOT NULL, started_at TEXT NOT NULL,
 lease_until TEXT NOT NULL, accepted_at TEXT, status TEXT NOT NULL, http_status INTEGER
);
