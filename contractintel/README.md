# ContractIntel

Public contracting-office portfolios for KTHQ. Pilot offices: FA4800 (633 CONS,
Langley), FA4855 (27 SOCONS, Cannon), FA8101 (AFSC/PZIO, Tinker).

## Status

The schema, Python ingestion, read-only Worker API, static dashboard, and guarded
GitHub workflows are implemented on `codex/contractintel`. The SAM access check
passed on 2026-10-20 for both Opportunities and Contract Awards. This verifies
those requests, not the account's precise daily entitlement. SAM matching and
nightly opportunity ingestion remain v2 work; the v1 pipeline uses public
USAspending bulk transaction exports only.

A real one-day source sample (2025-09-30) validated 41 transactions across 40
awards for the three pilots. Langley's 24 transactions sum to $2,583,738.53.
These are sample-window totals, not full FY totals or a complete active inventory.
The sample is ignored local runtime data and is not published to the production site.

## Layout

- `web/`: static HTML, CSS, JavaScript; no external fonts, analytics, or browser API keys.
- `worker/`: stored-data API with parameterized SQL, version pinning, pagination,
  an IP request limiter, and five-minute caching of immutable version requests.
- `ingest/`: standard-library Python download, reconstruction, and deployment tools.
- `migrations/`: D1-compatible schema; version 1 has 14 application tables plus the migration ledger.
- `tests/`: ingestion, financial-formatting, API, and real-dataset verification.
- `docs/runbook.md`: account setup, guarded publication, refresh, and recovery.

## Validation

```sh
python -m unittest discover -s contractintel/tests -v
node --test contractintel/tests/*.test.mjs
node --check contractintel/web/app.mjs
node contractintel/tests/verify-dataset.mjs PATH/TO/dataset.sqlite
```

The optional local preview uses Node 24's built-in SQLite module:

```sh
node contractintel/dev-server.mjs PATH/TO/dataset.sqlite
```

It binds only `127.0.0.1:8898`. Browser validation is incomplete: the desktop
page loaded successfully, but the execution environment's automatic review
stopped the preview server after reporting an unexpected telemetry connection.
The application's preview imports only Node core modules and the read-only API;
the cause of that connection has not been established. Do not claim the
interactive or mobile browser checks passed.

## Data semantics

Amounts use signed integer cents and are serialized as decimal strings in API
responses. Ingestion rejects sub-cent, non-finite, missing-required, or unsafe
integer values. Negative and zero obligations are retained. Current/potential
value deltas are summed once per transaction, never by summing repeated award
totals. A missing value delta makes the derived corresponding value unknown.

Latest loaded award state follows `(action_date, modification_number,
transaction_unique_key)` order. Fiscal years start October 1. Historical office,
NAICS, and PSC come from each transaction. Row count and `number_of_actions`
are distinct. Raw CSV fields and archive SHA-256 hashes remain available for audit.

Reconstruction discovers awards touching any pilot office, then includes their
other transactions from all retained Air Force partitions. It cannot establish
complete histories for transfers to other agencies or source periods not loaded.
Matching a source award's reported total does not prove every zero-dollar action
was captured. `history_complete` therefore remains false in this source scope.

The UI distinguishes missing coverage from zero activity. Unexpired dates are
reported dates, not a determination that a contract is active. Equal current and
potential end dates do not prove that no options remain. There is no inferred
contract title; the source description is displayed.

## Source references

- https://api.usaspending.gov/docs/endpoints
- https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/contracts/v2/bulk_download/awards.md
- https://open.gsa.gov/api/get-opportunities-public-api/
- https://open.gsa.gov/api/contract-awards/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/r2/pricing/
