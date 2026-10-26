# FA4528 R2 shadow updater

This package refreshes a separate private copy of **FA4528 only**. It is not the
live website's read path. It does not write D1 or replace its existing updater.
The browser's live USAspending fallback, pacing, retry, parsing, session cache,
Pause/Resume, field semantics and CSV export remain unchanged.

## What runs

- `ingest.mjs` runs in GitHub Actions, using the existing `createSourceFetch`,
  `resolve`, `documentFor`, fiscal helpers and America/New_York calendar.
- `format.mjs` is the previously tested lossless R2 format, moved out of the
  benchmark directory. The benchmark retains a compatibility re-export.
- `gateway.mjs` is deployed temporarily with a random, masked, encrypted Worker
  secret. The runner uses it to access private R2 bindings, then deletes it.
  It has no Cron, source-fetch code, D1 binding, public write route or deletion
  endpoint. Its baseline binding is read-only in code.
- `runner.mjs` initializes a separate shadow bucket from the already verified
  R2 copy, refreshes it, validates every field and all 32 CSV combinations, and
  emits a small measurement report. Source records stay in private R2.

All new limits are in `CONFIG.r2Nightly` at the top of `portfolio/ingest.mjs`.
Shared format limits remain in `CONFIG.r2Pilot`; source pacing, windows and
classification limits use the existing top-level CONFIG. The existing retry
helper keeps its explicitly exempt hardcoded values.

## Incremental refresh and recovery

1. Load the last complete immutable publication. Bootstrap from the verified
   pilot bucket only when the shadow bucket has no publication.
2. Discover awards changed in the configured 14-day lookback, using the same
   read-only search as the D1 ingest package.
3. Re-scan membership in all four source history windows. This retains the
   browser's action-window semantics instead of guessing membership from dates.
4. Fetch award and first-page transaction evidence only for changed, new, or
   previously unavailable awards. Reuse other stored raw records and normalized
   action rows exactly. A full backfill reconciles all evidence; it becomes due
   30 days after the last full reconciliation, rather than the last nightly run.
5. Recompute both fiscal years using the existing monthly transaction scan.
   Validate that every month and every page completed before publication.
6. Upload checksum-addressed chunks that do not already exist. Read the actual
   stored bytes back, validate checksums and compare every source/table field.
   The runner also checks the application payloads and original CSV exporter.
7. Switch the current manifest with an R2 conditional ETag write. Another writer
   cannot overwrite a newer publication. Reconcile a lost successful response.

One compressed checkpoint references the old baseline and stores only new
discovery state, changed evidence, fiscal pages and bounded attempt metadata.
It is saved atomically after search/fiscal pages, after groups of hydrated
awards, and on yield/failure. Unchanged awards do not each generate a checkpoint
write. Source, time, request, upload and storage guards fail without changing
the complete publication. A later job resumes its checkpoint. A same-day replay
of a completed job performs no source calls or R2 writes.

Source HTTP 500 is still an error, not a new retry policy. A failed job is marked
failed in GitHub and leaves both its checkpoint and the last complete copy.
It must be rerun; this package does not hide the failure.

## Cost boundaries and retention

The shadow bucket has a durable reservation ledger: 32 MiB maximum reserved
space, at most 160 objects, bounded mutable checkpoint/manifest slots, and at
most two published versions. Immutable objects are reused by checksum. The
third different publication stops for review; there is no automatic removal
of raw award JSON, raw evidence JSON, prior publications or orphan uploads.
Reservations for an interrupted upload remain conservative and can cause an
early stop. There is no garbage collector in this pilot.

Each GitHub job also has limits on source requests, HTTP requests, uploaded
bytes, chunk count and runtime. These are **application guardrails**, not a
Cloudflare account spending cap. A compressed read copy alone does not prove
all-office ingest costs. Measure actual change volume and decide retention
before enabling ongoing R2 refreshes or expanding offices.

## Execution and secrets

```sh
node --test contractintel/portfolio/r2/ingest.test.mjs contractintel/benchmarks/r2/pilot.test.mjs
CLOUDFLARE_API_TOKEN='<provided securely in the environment>' RUN_MODE=nightly node contractintel/portfolio/r2/runner.mjs
```

Use repository secrets, not a literal token in shell history. The existing
`CLOUDFLARE_API_TOKEN` repository secret is sufficient for the pilot. No new SAM
or GitHub key is required to test this updater. The temporary gateway key is
generated in the runner, masked before use and installed via Wrangler stdin.
Only the JSON measurement report is uploaded as an artifact, for one day.

`.github/workflows/contractintel-r2-update.yml` supports a manual run and a
limited push smoke test. It has no schedule. Register it on the default branch
before using GitHub's manual-dispatch UI. The existing production Cloudflare
07:00 UTC Cron and 10:00 UTC GitHub backup remain configured for the D1 package;
they are not silently redirected to this shadow updater.

For a later production promotion, wire the approved workflow into the existing
Cron dispatch bridge and keep GitHub schedule only as a backup. The missing
fine-grained GitHub token belongs in repository secret
`CONTRACTINTEL_GITHUB_TOKEN` (only this repository, Actions read/write); the
existing deployment installs it as encrypted Worker secret
`GITHUB_DISPATCH_TOKEN`. It is not needed until activation. If the repository
moves, update CONFIG repository/ref/workflow, workflow checkouts, secret
permissions and the deployment bridge. Ingest stays in GitHub Actions because
Workers-to-USAspending returned HTTP 525.

## Before promotion

- Review the saved FA4528 update report and any changed source counts.
- Confirm the source stamp advances only after a complete refresh.
- Confirm an interrupted run resumes and incomplete publication stays hidden.
- Confirm stored payloads and every CSV filter/date-mode combination agree.
- Select an approved retention/cleanup policy; the pilot stops at two versions.
- Configure the deferred GitHub dispatch key and test the Cron bridge.
- Separately enable and test R2 reads and D1/live fallback on the website.
- Expand beyond FA4528 only after the user's explicit approval.
