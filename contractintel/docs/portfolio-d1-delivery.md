# Portfolio D1 pilot — FA4528 only

This pilot adds a stored source before the existing live loader. The live source adapter, request helper, progressive loader, browser cache and evidence normalizer are unchanged. The shared date defaults now use the current calendar date in America/New_York, including DST; monetary/date parsing and classification rules remain unchanged.

## Prior Worker ingestion attempt — superseded by the runner design

The D1 schema, binding, public read path, source switch, Eastern date computations, authenticated endpoints, cron handler and verification tools are deployed. All 99 local/CI tests pass, and deployed assets match the working source. The live browser loader remains available.

Database: `kthq-contractintel-portfolio` (`7b24b846-e4ca-4a0b-8958-439567cec44f`). Only directory labels have been seeded; no office award publication has completed.

The actual FA4528 backfill failed before the first discovery page completed. Run `331ff3a9-7962-4089-be33-d3bf33ea1eac` started 2026-10-26T01:50:25.289Z and ended 2026-10-26T01:52:23.002Z with: `USAspending is temporarily unavailable. Retry shortly. Source HTTP 525 at /api/v2/search/spending_by_award/.` The invocation made four source attempts and retained its checkpoint. A separate request through the unchanged Worker proxy also timed out. An independent Node request using the same source adapter returned HTTP 200, 100 matching first-page candidates, and has-next=true. Those 100 candidates are not a total award count.

Deployment/diagnostic workflow: https://github.com/nhazelett/ContractingHQ/actions/runs/40256069992

No count comparison, under-two-second completed-office measurement, populated-table storage report, or all-office storage projection is claimed. These require an actual completed backfill; an empty awards table would give a misleading projection. No other office has been ingested.

The user approved this architecture change after a manual runner probe: run the same ingestion module in the existing trusted GitHub Actions runner, writing to the same D1 database, with nightly scheduling there. Keep the Cloudflare read path, fallback, page behavior, field mappings and FA4528 allowlist. The package now has a transactional D1 HTTP adapter and a Cron-to-workflow dispatch bridge. The original Worker-only failure is retained here as diagnostic history. Do not weaken TLS verification or substitute another source to hide the failure.

## Runner architecture and verified connectivity

The manual-only probe ran once on GitHub Actions: HTTP 200; connect 0.059839 s; TLS 0.106869 s; first byte 0.213990 s; total 0.251508 s. It used no secrets and no retries. Evidence: https://github.com/nhazelett/ContractingHQ/actions/runs/40257381619

Ingest now runs in GitHub Actions because Workers-to-USAspending failed with HTTP 525/timeouts while the runner request succeeded. The website and database remain on Cloudflare. The SAME `portfolio/ingest.mjs` package, CONFIG, original source adapter, original pacing/retry helper, staging, lease, idempotency and publication gate run under Node. `portfolio/d1-http.mjs` preserves prepared parameter binding and sends publication statements in ONE D1 HTTP batch. An execution-failure rollback probe is mandatory before running ingestion; a failed probe prevents ingestion. Unknown HTTP write outcomes are never blindly replayed. A lost publication response is reconciled against the completed publication ID before determining status.

Cloudflare keeps `0 7 * * *` as its PRIMARY Cron Trigger. `portfolio/dispatch.mjs` calls GitHub's workflow_dispatch API with the fixed office, mode and configured trusted ref. It makes no USAspending call. Accepted daily Cron dispatches are deduplicated in `ingest_dispatches` (migration 0002). Dispatch failure is recorded and thrown. An accepted dispatch is not an assertion that ingestion completed; `ingest_runs` and `office_publications` remain the completion evidence.

The registered default-branch workflow is `.github/workflows/contractintel-portfolio-ingest.yml`. It checks out the trusted `codex/contractintel` package. Its 10:00 UTC GitHub schedule is BACKUP only: a current New York date publication with no unfinished work causes a skip. There is no dependence on that backup to make the primary Cron work. A shared Actions concurrency group and D1 lease prevent overlapping ingest writers.

### Secret placement and rotation

| Secret | Repository secret | Cloudflare side |
| --- | --- | --- |
| Cloudflare deployment/D1 API token | `CLOUDFLARE_API_TOKEN` (existing `CLOUDFARE_API_TOKEN` spelling remains a compatibility fallback) | Not copied for Portfolio ingestion; only the runner needs it for D1 HTTP writes and deployment |
| SAM key | `SAM_API_KEY` | Existing Worker secret for Opportunities; Portfolio ingestion never uses SAM |
| GitHub dispatch token | `CONTRACTINTEL_GITHUB_TOKEN` | Copied at deployment through standard Wrangler secret input to encrypted Worker secret `GITHUB_DISPATCH_TOKEN`; never a Wrangler plaintext var |
| On-demand endpoint secret | Existing `PORTFOLIO_INGEST_SECRET` Worker secret | Used only to authenticate the administrative endpoint; rotate through Wrangler if needed |

Use a fine-grained GitHub token restricted to `nhazelett/ContractingHQ`, Actions read/write. Store it with GitHub's repository secret UI (Settings → Secrets and variables → Actions), or `gh secret set CONTRACTINTEL_GITHUB_TOKEN --repo nhazelett/ContractingHQ`. Do not commit it, paste it into workflow YAML, or print it. GitHub masks repository secret values; workflow steps do not enable shell tracing. The deployment reads the repository secret in an environment variable and pipes it to `wrangler secret put GITHUB_DISPATCH_TOKEN`. It is stored encrypted on Cloudflare and appears to the Worker only as `env.GITHUB_DISPATCH_TOKEN`. Rotation requires replacing the repository secret and redeploying the bridge. Missing/expired tokens produce explicit dispatch failure, never a false success.

A GitHub token cannot be created or retrieved by the connected repository tooling. Until that repository secret is configured and deployed, the runner can backfill using the existing Cloudflare token, but primary Cron dispatch is not operational. The deployment prints only a configuration status, never token values.

### If the repository moves

Move the entire `contractintel/portfolio` package, its migrations, imported `web` source/date/classification helpers, directory JSON, and both workflow files. Update CONFIG.githubRepository/githubWorkflow/githubRef, the ingest workflow checkout ref, and CI paths/concurrency as appropriate. Register the dispatch workflow on the new default branch. Recreate repository secrets (GitHub does not transfer their values through Git), issue or reauthorize the fine-grained dispatch token for the new repository, and redeploy its encrypted Cloudflare copy. The D1 database and public Worker URLs can stay where they are; no contract-data migration is needed unless the Cloudflare account/database also changes. Test one manual dispatch, then the Cron bridge, before enabling the backup schedule.

## Files

- `portfolio/migrations/0001.sql`: complete schema and query indexes, in a new separate database.
- `portfolio/runner.mjs`, `portfolio/d1-http.mjs`, `portfolio/dispatch.mjs`, `portfolio/migrations/0002.sql`: Node package entrypoint, transactional HTTP writes, Cron dispatch bridge and dispatch audit table.
- `.github/workflows/contractintel-portfolio-ingest.yml`: registered workflow_dispatch target, plus the later backup schedule.
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

07:00 UTC is 03:00 Eastern during daylight saving time and 02:00 during standard time. Cron only ingests FA4528. Each ingestion-package chunk uses at most three minutes of wall time, with checkpointing before its request/query budgets; the runner resumes yielded chunks. The Worker Cron only dispatches the runner. Existing helper timeouts/retries retain their approved exemption.

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

The endpoint now returns `dispatched` after GitHub accepts the job. Do not repeat that request to resume individual chunks: the runner package handles yielded chunks internally, and a later dispatch resumes a failed/interrupted checkpoint. Inspect GitHub Actions and ingest audit records for completion. Set mode to `nightly` for changed-award updates. Requests for other offices are rejected. No public GET starts ingestion.

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

The automated suite has 111 passing tests and uses Node SQLite and a minimal DOM fixture. No real-browser/mobile visual result is claimed by these tests.

## Pilot progress

`GET /api/office/FA4528/progress` returns only phase, search position, prepared/discovered award counts and the progress update timestamp. It exposes no source records, configuration or secrets. A progress status is not a completed publication. Worker deployment and long-running pilot jobs use separate concurrency groups; all ingest writers still share the same ingest group and D1 lease.

Raw transaction captures are keyed by award ID as well as endpoint. A regression test reproduces a late history response following an unavailable award; normalized and raw transaction IDs must match before staging/publication. The publication phase validates older staged checkpoints too and re-fetches any mismatched award evidence through the same original source adapter and pacing helper. This repairs source identity, not dashboard counts.

Nightly changed-award cursor timestamps use the same date-string conversion as the unchanged live source adapter. Source API date-window discovery follows its UTC-date convention, while all countdowns, date review and dataset classification use America/New_York. The two boundaries are deliberately distinct.

Nightly runs copy unchanged published evidence into staging inside D1 with one idempotent SQL operation, instead of downloading each unchanged record/history to the runner and sending it back. Changed/new awards still use the same source adapter and pacing. This reduces runner/D1 round trips while retaining exact history-window membership, every business field, the same source hashes, and the publication gate.

The independent count comparison uses the existing summary-only award-detail read: requested counts depend on award dates and availability, not modification history. It still fetches every source award summary independently and separately scans fiscal transactions. Stored modification/history identity is protected by publication validation. This removes redundant history requests from count verification without changing pacing or any count rules. Classification uses the New York date at comparison time; the report separately records the fiscal scan cutoff date.

The source-request reserve applies between complete award operations, not between the two requests inside an award read. The hard request cap aborts through the shared source signal and preserves the checkpoint. A regression test covers an odd number of discovery requests at this boundary.
