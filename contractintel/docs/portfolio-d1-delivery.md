# Portfolio D1 pilot — FA4528 only

This pilot adds a stored source before the existing live loader. The live source adapter, request helper, progressive loader, browser cache and evidence normalizer are unchanged. The shared date defaults now use the current calendar date in America/New_York, including DST; monetary/date parsing and classification rules remain unchanged.

## Current pilot result — upstream connection blocked

The D1 schema, binding, public read path, source switch, Eastern date computations, authenticated endpoints, cron handler and verification tools are deployed. All 99 local/CI tests pass, and deployed assets match the working source. The live browser loader remains available.

Database: `kthq-contractintel-portfolio` (`7b24b846-e4ca-4a0b-8958-439567cec44f`). Only directory labels have been seeded; no office award publication has completed.

The actual FA4528 backfill failed before the first discovery page completed. Run `331ff3a9-7962-4089-be33-d3bf33ea1eac` started 2026-10-26T01:50:25.289Z and ended 2026-10-26T01:52:23.002Z with: `USAspending is temporarily unavailable. Retry shortly. Source HTTP 525 at /api/v2/search/spending_by_award/.` The invocation made four source attempts and retained its checkpoint. A separate request through the unchanged Worker proxy also timed out. An independent Node request using the same source adapter returned HTTP 200, 100 matching first-page candidates, and has-next=true. Those 100 candidates are not a total award count.

Deployment/diagnostic workflow: https://github.com/nhazelett/ContractingHQ/actions/runs/40256069992

No count comparison, under-two-second completed-office measurement, populated-table storage report, or all-office storage projection is claimed. These require an actual completed backfill; an empty awards table would give a misleading projection. No other office has been ingested.

Proposed exception awaiting user approval under Hard Rule 4: run the same ingestion module in the existing trusted GitHub Actions runner, writing to the same D1 database, with nightly scheduling there. Keep the Cloudflare read path, fallback, page behavior, field mappings and FA4528 allowlist. This requires a transactional D1 REST adapter for the Node runner and a revised trigger arrangement; those changes have not been made. Do not weaken TLS verification or substitute another source to hide the failure.

## Files

- `portfolio/migrations/0001.sql`: complete schema and query indexes, in a new separate database.
- `portfolio/ingest.mjs`: one new CONFIG object, resumable staging/publishing, leases, nightly changes and full backfill, fiscal scans, audit records.
- `portfolio/read.mjs`: office snapshot, lazy stored evidence, NY-derived fields, table storage measurement.
- `portfolio/http.mjs`: public reads and secret-authenticated administrative POST/status/storage routes.
- `portfolio/deploy.mjs`: idempotent database creation/migration/directory seed and generated binding config.
- `portfolio/compare.mjs`, `portfolio/verify.mjs`: independent source scan and comparison for all four history windows, with detailed mismatches and timing samples.
- `worker/api.mjs`: new routes and scheduled handler; original source routes remain intact.
- `web/portfolio-store.mjs`, `web/calendar.mjs`: optional stored source and shared Eastern date.
- `web/app.mjs`, `web/index.html`, `web/presentation.mjs`: source selection, fiscal adapter, evidence reads, freshness stamp, UI asset version.
- `web/format.mjs`, `web/lifecycle.mjs`, `web/overview.mjs`, `web/register.mjs`: only the default current-date source changes.
- `tests/portfolio-d1.test.mjs`, `tests/fixtures/portfolio-d1.mjs`: SQLite-backed integration tests with mocked USAspending.
- `tests/portfolio-presentation.test.mjs`: verifies the original live path after stripping only the explicitly approved routing/calendar additions. Original baseline hashes are retained.
- `.github/workflows/contractintel-preview.yml`: preparation, deployment, FA4528 backfill, source comparison, storage report artifact.
- `opportunities/smoke.mjs`: verifies additional deployed assets; Opportunities business logic stays unchanged.

## Wrangler

Deployment preparation adds the actual new database UUID to this binding, preserving OPPORTUNITIES_DB:

```json
{
  "d1_databases": [{
    "binding": "PORTFOLIO_DB",
    "database_name": "kthq-contractintel-portfolio",
    "database_id": "7b24b846-e4ca-4a0b-8958-439567cec44f",
    "migrations_dir": "../portfolio/migrations"
  }],
  "triggers": {"crons": ["0 7 * * *"]},
  "limits": {"cpu_ms": 30000}
}
```

07:00 UTC is 03:00 Eastern during daylight saving time and 02:00 during standard time. Cron only ingests FA4528. One invocation uses at most three minutes of wall time, with checkpointing before its request/query budgets; subsequent invocations resume. Existing helper timeouts/retries retain their approved exemption.

## Exact manual setup commands

Run from the repository root. Use existing Cloudflare authentication; never put an API token in source.

```powershell
npx --yes wrangler@4.140.0 d1 create kthq-contractintel-portfolio
```

Add the returned binding UUID to `contractintel/worker/wrangler.jsonc`, then:

```powershell
npx --yes wrangler@4.140.0 d1 execute kthq-contractintel-portfolio --remote --file contractintel/portfolio/migrations/0001.sql --config contractintel/worker/wrangler.jsonc
node contractintel/portfolio/deploy.mjs
npx --yes wrangler@4.140.0 deploy --config contractintel/worker/wrangler.jsonc
npx --yes wrangler@4.140.0 secret put PORTFOLIO_INGEST_SECRET --config contractintel/worker/wrangler.jsonc
```

`deploy.mjs` needs the existing `CLOUDFLARE_API_TOKEN` environment variable, creates the named database if missing, seeds all 1,432 DIRECTORY labels (not their awards), and installs the cron/binding config. The trusted deployment workflow performs the equivalent steps. Its one-time administrative secret stays in the runner shell and the Worker secret store; it is not saved to repository files or reports. To use the endpoint yourself later, set your own secret with Wrangler and keep its value in your local environment.

```powershell
$env:PORTFOLIO_INGEST_SECRET = Read-Host 'Portfolio ingest secret'
$pilotHeaders = @{ 'X-ContractIntel-Ingest-Secret' = $env:PORTFOLIO_INGEST_SECRET }
Invoke-RestMethod -Method Post -Uri 'https://kthq-contractintel.nickhazelett.workers.dev/api/admin/portfolio/ingest' -Headers $pilotHeaders -ContentType 'application/json' -Body '{"office":"FA4528","mode":"backfill"}' -TimeoutSec 240
```

Repeat only while the response status is `yielded`. A `busy` response means another invocation owns the lease; wait for it to finish. Set mode to `nightly` for changed-award updates. Requests for other offices are rejected. No public GET starts ingestion.

```powershell
Invoke-RestMethod -Uri 'https://kthq-contractintel.nickhazelett.workers.dev/api/admin/portfolio/status' -Headers $pilotHeaders
Invoke-RestMethod -Uri 'https://kthq-contractintel.nickhazelett.workers.dev/api/admin/portfolio/storage' -Headers $pilotHeaders | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 contractintel/portfolio/fa4528-storage.json
node contractintel/portfolio/verify.mjs
```

The verifier writes `portfolio/fa4528-report.json`. It independently scans source discovery, award details, initial transaction evidence and prior/current FY transactions. It never uses D1 rows to construct the live-side numbers. It reports mismatches rather than adjusting either result.

## Completeness, costs and storage

- An office is eligible only after a completed publication, including all four exact source search windows, initial evidence pages and complete prior/current FY totals. Empty offices can publish zero records.
- Staging and publication are separate; a D1 transactional batch publishes a whole office. Failure retains the prior publication. Leases prevent overlapping ingest writers.
- Search and initial history batch sizes retain the existing adapter's 100/200 values; they are documented in CONFIG but the immutable source adapter owns those values. New changed-award discovery uses CONFIG.searchBatch.
- Nightly hydration fetches awards modified in the configured last 14 days. Full discovery of each history window still verifies membership; fiscal totals still scan transactions. A periodic full reconciliation is configured for 30 days.
- Initial stored evidence is the same first 200 actions used by the live page. Older-history controls still use the live source if a page is not stored. Evidence is fetched lazily so it does not inflate the initial Portfolio response.
- Publication audit timestamps may change on repeated runs. Unchanged award and history business records are not rewritten; checkpoint and audit writes are intentional.
- A 256 MiB pilot database guard, a single-office allowlist, request/query/runtime budgets and finite CI chunk count bound this pilot. These are application safeguards, not an account-wide Cloudflare billing cap. Paid-plan overages remain possible across the account.
- Storage reports list measured logical bytes by table, plus D1's physical database size and raw-versus-normalized history payload sizes. Logical bytes exclude SQLite record/index overhead; physical size includes indexes and unused allocated pages.
- The all-office projection is fixed directory bytes plus FA4528's published award/window/history/fiscal payload multiplied by 1,432. This is a linear scenario, not a reliable estimate for differently sized offices. No expansion is performed.
- If history dominates, recommend retaining normalized source action rows and dropping raw history-page JSON after publication, while preserving every field the current UI uses, order, page boundaries, has-next flags and the full raw AWARD record. This is a proposal only, pending measured results and user approval.

## Field preservation inventory

Every existing field is retained in `awards.record_json` with its current key and meaning; named SQL columns permit indexed reads and future recomputation.

| Page/source field | Stored source / computation |
| --- | --- |
| Office code, name, reported name, department, command, base, location, confidence | `offices`; the shipped directory remains available to both pickers |
| Parent office | `offices.parent_dodaac`, NULL unless a real parent is supplied; command is not misrepresented as an office parent |
| `award_id` / generated unique award ID | `awards.generated_unique_award_id`; preserved as `award_id` in record JSON |
| `piid` | `awards.piid` |
| `parent_piid` | `awards.parent_piid` |
| `description` | `awards.description`; original full description remains in record/raw JSON |
| `recipient` | `awards.recipient_name` |
| Recipient UEI | `awards.recipient_uei`; recipient_uei source field, never a DUNS identifier |
| Office assignment and label | `awards.office_dodaac`, record `office_code` and `office_name` |
| NAICS code / description | `awards.naics_code`, `naics_description` |
| PSC code / description | `awards.psc_code`, `psc_description` |
| Set-aside / who can bid | `awards.set_aside_description`, existing label mapping; original code stored separately |
| Award type | `awards.award_type_code`, `award_type_description` |
| Competition / pricing | `awards.competition`, `pricing_type` |
| PoP start | `awards.pop_start_date`; record `start_date` |
| Current PoP end | `awards.current_pop_end_date`; record `current_end_date` |
| Potential final end | `awards.potential_final_end_date`; record `potential_end_date` |
| Current value / Award Amount | `awards.current_value_cents` from base-and-exercised-options; record `award_amount_cents` |
| Base/exercised options value | `awards.base_exercised_options_cents`, same source meaning as current value |
| Potential value | `awards.potential_value_cents` from base-and-all-options; no substitution for current value |
| Source lifetime net obligations | `awards.total_obligation_cents`; record `obligation_cents` |
| Date signed | `awards.date_signed`, original award signing date |
| Last modified | `awards.source_last_modified_date`; record `last_modified_date` |
| Latest source action | `awards.latest_action_date`, same initial transaction-page precedence as live incorporation |
| Latest reported modification | `awards.latest_mod_number`, existing modification summarizer |
| Latest option-exercise modification | `awards.latest_option_mod_number`, existing source G-code rules |
| Total PoP text / status / register status filters | Existing functions applied to stored dates, current New York date |
| Days remaining on either date basis | Recomputed from stored dates at serve time and in the browser using America/New_York |
| Current/uncertain/completed/review classification and reason | Existing lifecycle function; stored ingest snapshot plus NY serve-time recomputation |
| Active dataset / potentially completed / date review / all | Existing scope functions; review remains a subset of the broad active scope |
| Recompete candidates | Existing potential-end evidence checks and 365-day window; no inference of a solicitation |
| Ending 90/180/365 counts and rows | Existing expiryRows rules, selected dataset/basis and NY date |
| History-window membership | `award_windows`, populated by the same four exact source searches |
| Set-aside mix counts and values | Existing setAsideGroups over loaded records |
| FY obligations and distinct contract counts | `fiscal_totals` after the independent monthly transaction scan; prior/current office-wide semantics unchanged |
| Partial/current FY indicator | Existing fiscal-year functions with NY current date; coverage stored explicitly |
| Null/missing fiscal amounts | `missing_amount_count`; UI keeps totals unavailable instead of treating missing values as zero |
| Transaction ID, action date, mod number, action code/description, obligation change, excerpt | `award_history_pages.actions_json`, same normalized action shape and order |
| Per-mod reported start/current/potential dates | Preserved as source supplies them; current normalizer returns NULL, so no option-period dates are fabricated |
| Modification sequence gaps, same-day ties, missing mod numbers, option and PoP-change evidence, counts and notes | Existing summarizeModifications applied to stored normalized actions |
| Evidence page, has-next, older-history link | `award_history_pages.page`, `has_next`; live fallback for unstored pages |
| Source link | Record `source_url`, unchanged USAspending award deep link |
| Details unavailable / detail error | `awards.details_unavailable`, `detail_error`, preserved in record JSON |
| Details pending / history pending / source refresh pending | Existing live loader state; completed D1 records do not masquerade as pending |
| Updated stamp | `office_publications.published_at`, displayed in Eastern time |
| Export columns, monetary formatting and selected matches | Existing CSV definition and formatter, using the same loaded row keys |
| Raw source record for recomputation | `awards.raw_json`; initial raw transaction page retained separately |

All existing tabs, office controls, search/status/set-aside filters, date-mode/history selectors, column chooser, pagination, dark mode, CSV export, methodology/source-status modal, disclosures and links remain available. Pause/resume and the six-hour session cache remain on the live path. The new Data source selector is under Advanced.

## Manual checks

1. Open `/?office=FA4528`: verify a completed stored portfolio and an Eastern Updated stamp; no live scan should start.
2. Compare My office, Ending soon and All contracts across all four history windows and both date modes.
3. Open source evidence, modification details and older-history controls; verify the first page is stored and older pages can still load live.
4. Export filtered CSV and check PIIDs, descriptions, dates, money and modification columns.
5. Select Advanced → Data source → Live USAspending, pause/resume, and compare completed counts.
6. Open another office such as FA4800; it must use live loading and must not create an ingestion job.
7. Check dark mode, keyboard focus, drawers, and stacked contract rows at 390 px.
8. Trigger an authenticated bounded run; repeat while yielded, and inspect audit/status. An unauthenticated POST must return 401.
9. Review `fa4528-report.json` for four-window count equality, fiscal equality, timing samples and table storage. Any difference blocks expansion.
10. Test a source failure or disabled D1 binding in a local test environment; retain prior complete data and verify live fallback.

The automated suite uses Node SQLite and a minimal DOM fixture. No real-browser/mobile visual result is claimed by these tests.
