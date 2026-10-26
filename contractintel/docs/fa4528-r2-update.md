# FA4528 R2 updater verification

The isolated nightly updater completed a real FA4528 source refresh and published
a complete private R2 copy. The live website still reads its working D1
publication and retains the existing live USAspending fallback. No additional
offices were ingested. No raw award or evidence data was deleted.

## Measured runs

| Check | Result |
| --- | --- |
| Real refresh | [Run 40368929097](https://github.com/nhazelett/ContractingHQ/actions/runs/40368929097), passed |
| Latest-code cold replay | [Run 40370349310](https://github.com/nhazelett/ContractingHQ/actions/runs/40370349310), passed |
| Refreshed source stamp | October 26, 2026, 1:31:28 PM America/New_York |
| Source awards | 4,091 |
| USAspending requests for refresh | 76 |
| New / removed / changed awards | 0 / 0 / 0 |
| Files reused / newly uploaded at publication | 42 / 5 |
| Complete publication, compressed | 4,166,799 bytes |
| Actual shadow bucket contents | 4,910,564 bytes across 55 objects |
| Reserved storage budget | 13,380,106 bytes; conservative reservations, not actual usage |
| D1 requests / writes from updater | 0 / 0 |
| Same-day replay source calls / R2 writes | 0 / 0 |
| Latest cold replay | 56 gateway HTTP requests, 53 R2 reads, zero writes |
| Temporary test Workers | Deleted after each completed or failed run |
| Public bucket access | Disabled |

The first refresh took about 3 minutes 16 seconds including temporary gateway
setup, initial copying of the verified baseline, source scans, publication and
cleanup. It uploaded 17,030,360 bytes and used 186 R2 writes / 770 reads, including
bootstrap, checkpoint and budget-ledger operations. These operation counts are
**not** a steady-state daily estimate.

After that measurement, checkpoints were batched in groups of five search/fiscal
pages, verified immutable objects were cached within each runner process, and
prior evidence groups were preserved across insertions/removals. The latest
cold replay verifies the final package against the existing publication. A
second full daily refresh with those optimizations has not been measured: the
pilot already has its two permitted versions and will stop before a third.
No extra version was created to bypass that guard.

## Page and export checks

The actual uploaded raw/normalized table data was read back and compared field
for field before the current manifest changed. All four application payloads
matched the staged source data. The original, unchanged CSV exporter passed
eight dataset/date-mode combinations per window, **32 checks** total.

| Source history window | Awards before | Awards after | Active/upcoming after | Dates unclear after |
| --- | ---: | ---: | ---: | ---: |
| All API history, FY08 onward | 4,091 | 4,091 | 82 | 3 |
| FY22 onward, default | 1,195 | 1,195 | 82 | 3 |
| FY25 onward | 436 | 436 | 74 | 1 |
| FY26 onward | 172 | 172 | 67 | 1 |

Active/upcoming includes the date-review subset, matching the existing
classification. Every reported before/after count agrees in the JSON report,
including both date bases, completed contracts, 90/180/365-day windows and
recompete candidates.

| Fiscal year | Net obligations | Distinct contracts | Transactions | Missing amounts |
| --- | ---: | ---: | ---: | ---: |
| FY2026 | $19,486,003.77 | 172 | 278 | 0 |
| FY2027, through October 26 | $0.00 | 0 | 0 | 0 |

The zero current-year totals are what the source reported. The updater did not
adjust them. This is an incremental refresh from the previously independently
verified baseline, **not** a new independent 4,091-award detail backfill.
There were no changed awards on this refresh, so a busy day's change volume
and all-office monthly cost remain unmeasured.

## Publication, recovery and limits

The package uses the existing source fetch/retry, parsing, fiscal and
classification helpers. They have not been rewritten. Only new R2 ingest limits
were added to the config object at the top of `portfolio/ingest.mjs`.

The runner stores one compressed checkpoint referencing its complete baseline.
Search-window membership is fully scanned; unchanged raw award/evidence rows
are reused. Fiscal totals are recomputed from the existing monthly source
scan. Every required window, fiscal month and page must be complete. Candidate
objects are checksum-addressed and immutable. The current manifest changes
last, with an R2 ETag condition, after complete read-back validation. A failed
run cannot overwrite a newer publication.

Checkpoints save after configured page batches, window boundaries and groups
of newly hydrated awards, plus on yield/failure. An abrupt process termination
can repeat a few read-only source requests; it does not publish a partial
portfolio. The same logical work ID and fixed candidate publication time
make resumed publication deterministic. Lost successful publication responses
are reconciled before retry.

The durable R2 reservation ledger enforces a **32 MiB** shadow-bucket budget and
at most **160 objects**, plus the **two-version** publication limit. No raw-data
garbage collection or automatic prior-version deletion is enabled. These
application controls are not a Cloudflare account billing cap.

## Fields and existing behavior

No page field changes source in production during this experiment. The future
R2 copy retains every exported SQL field, including the raw JSON strings.

| Page field / behavior | Current live source | Preserved R2 shadow source |
| --- | --- | --- |
| Office name, DoDAAC, department, parent, location, directory labels | Existing directory / D1 | Complete FA4528 `offices` row in compressed metadata; the full picker remains unchanged |
| PIID, parent PIID, recipient / UEI, description | Existing `record_json` and award source | Award rows and literal `record_json` / `raw_json` in evidence chunks |
| NAICS / PSC codes and descriptions | Award source and D1 columns | Same normalized columns and raw source fields |
| Set-aside, award type, competition, pricing | Award source and D1 columns | Same normalized columns, record fields and raw award JSON |
| Start date, current PoP end, potential final end, signed / modified / latest action | Existing parsing and D1 | Same dates and raw inputs; no change to current/potential meaning |
| Current value, obligations, exercised / potential option values | Existing cent-string fields | Same exact cent strings; no floating-point conversion |
| Dataset bucket, date review, days to end, recompete classification | Existing helpers | Inputs plus stored derived fields; serving recomputes using current America/New_York date |
| Option evidence, latest modification / exercised option, recent transactions | Stored first history page and live older pages | Exact normalized action rows, raw first-page JSON, has-next and source hashes; unavailable pages remain eligible for live fallback |
| Four history windows | Existing action-window searches | Explicit `award_windows` membership from the same source searches |
| Prior/current FY totals and contract counts | Existing monthly transaction scans | Two complete `fiscal_totals` rows, exact cents, distinct award IDs, missing counts, coverage dates |
| Freshness stamp and publication gate | Completed D1 publication | Completed run metadata and immutable R2 manifest; stamp advances only after publication |
| Filters, tabs, details, CSV, theme, accessibility, disclaimers | Existing browser code | Unchanged; no page or data-key edits |
| Live fallback, pacing, retry, Pause/Resume, six-hour session cache | Existing browser path | Preserved; R2 is not enabled in the live source switch |

The original `web/source.mjs`, `source-requests.mjs`,
`portfolio-progress.mjs` and `app.mjs` were not edited.

## Files and validation

Implementation:
- `portfolio/r2/ingest.mjs`: resumable refresh and publication.
- `portfolio/r2/format.mjs`: lossless format, stable grouping, restore helpers.
- `portfolio/r2/gateway.mjs`: temporary authenticated R2 access and durable quotas.
- `portfolio/r2/cache.mjs`: immutable reads cached only within one runner job.
- `portfolio/r2/runner.mjs`: cloud setup, bounded runner, measurement report, cleanup.
- `portfolio/r2/ingest.test.mjs`: 12 new integration tests.
- `portfolio/r2/README.md`: execution, limits, secrets and activation notes.
- `portfolio/ingest.mjs`: new settings only; old ingest behavior is preserved.
- `benchmarks/r2/core.mjs`: compatibility re-export of the shared format.
- `benchmarks/r2/run.mjs`: bounded temporary-credential provisioning retries.
- `.github/workflows/contractintel-r2-update.yml`: isolated test/manual workflow.

The **18 R2 tests** pass, including the six original format/read checks. New
tests cover fresh-live-path/CSV parity, source failures and resume, failed
validation, missing fiscal pages, wrong-office identities, version/byte quotas,
unchanged replay, New York midnight, added/removed awards, lost acknowledgements,
stable evidence grouping and cache boundaries. Existing dashboard/API
validation and deployed asset/opportunity smoke checks also pass.

No D1 schema migration, new SAM key or new GitHub key is required for this test.
The workflow is registered on main by commit
`2a231c5fb8d68908cc8bb017188ab3eb90059209`; the application branch remains
`codex/contractintel`. The application PR is still draft and unmerged.

## Activation and short manual checks

The existing Cloudflare Cron remains at 07:00 UTC and the existing GitHub
backup at 10:00 UTC. They still target the D1 workflow. This new R2 workflow
has no schedule and is not silently promoted.

The user-deferred repository secret `CONTRACTINTEL_GITHUB_TOKEN` is still
needed for the primary Cron dispatch bridge. It should be restricted to this
repository with Actions read/write; the existing deployment stores it as the
encrypted Worker secret `GITHUB_DISPATCH_TOKEN`. Ingest runs in GitHub Actions
because Workers-to-USAspending returned HTTP 525. Repository moves require
updating the config repository/ref/workflow, checkout refs, token permissions
and deployment bridge. Secrets belong in repository/Worker secrets, never
source files or logs.

Before any production R2 promotion:
1. Review the count and raw-field report and confirm FA4528 scope.
2. Run the manual workflow on the same day: expect retained data, no source calls,
   no writes and no false freshness-stamp advancement.
3. Verify interrupted/failure cases using the integration tests.
4. Review retention before allowing a third version; the pilot currently stops.
5. Configure the deferred dispatch key and verify the Cron bridge.
6. Separately test the site's R2 read switch, older-evidence fallback and CSV
   before moving production away from D1.

Shared website-folder synchronization remains deferred.

