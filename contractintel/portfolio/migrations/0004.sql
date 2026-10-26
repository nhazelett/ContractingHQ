-- Authoritative D1 publication receipts; staged records use existing ingest_stage.
CREATE TABLE IF NOT EXISTS portfolio_publication_receipts (
 publication_id TEXT PRIMARY KEY,
 office_dodaac TEXT NOT NULL,
 content_sha256 TEXT NOT NULL,
 comparison_json TEXT NOT NULL CHECK(json_valid(comparison_json)),
 validated_tables_json TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(validated_tables_json)),
 status TEXT NOT NULL,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS publication_receipts_office ON portfolio_publication_receipts(office_dodaac,status);
CREATE TABLE IF NOT EXISTS portfolio_publication_assertions (
 assertion_id TEXT PRIMARY KEY,
 valid INTEGER NOT NULL CHECK(valid=1)
);
