# FA4528 recovery safeguard

## Status

This change is a code safeguard, not evidence that production was recovered.
No production publication, D1 row, R2 object, checkpoint, credential or schedule
was changed while preparing it. The retained good copy has not been downloaded
or verified. Do not merge/deploy or resume publication before preserving it.

The November 5 refresh removed 1,613 awards from the oldest history window. The
November 6 job discovered 4,092 awards but failed during hydration with source
HTTP 500 before publication. Its report is not a data backup. The expected
recovery counts must be established from actual retained bytes and a complete
source comparison, not assumed from this historical report.

## What the safeguard checks

- Every publication compares removed award IDs, not just net count change.
  Additions cannot conceal deletions. Each of the four history windows is
  compared independently, including memberships for awards retained elsewhere.
- More than 100 removals, or at least 10 removals exceeding 5% of a prior set,
  stops publication. A nonempty set becoming empty always stops. Limits are in
  `CONFIG.publicationSafety`; there is no force or environment-variable bypass.
- The R2 preparation path, direct cache promotion, authoritative D1 import and
  legacy D1 ingest all enforce the check. D1 reads only IDs and memberships for
  this comparison, not large raw award/evidence fields.
- New discovery checkpoints record consecutive pages and terminal-page evidence
  for each window. Completion requires matching distinct membership counts.
  Existing pending checkpoints without this evidence stop for preservation and
  review. They are not silently discarded or upgraded. This also affects pending
  checkpoints for other offices if the code is deployed.
- The R2 runner validates pending checkpoint evidence before retention cleanup
  or authority-cache repair. Direct cache promotion requires baseline tables for
  an existing publication. Legacy D1 publication now checks its baseline version
  inside the atomic publication batch, like the authoritative importer.

The limits detect anomalous changes; they are not independent proof that a
source scan is complete. Small legitimate removals remain possible. Unexpected
large removals require source investigation, not a casual limit increase.

## Preserve before recovery

Use the owner's already-authorized Cloudflare account/session. Do not create
new credentials, expose a private bucket publicly, or retry a denied endpoint
through a different route.

1. Keep all FA4528 writers paused while preservation and restoration are in
   progress. Identify both the Cloudflare dispatch and GitHub backup routes;
   cancelling one job alone is not a lasting pause. Confirm no writer is active.
2. From private R2 bucket `kthq-contractintel-r2-fa4528-nightly`, download
   `pilot/FA4528/current.json`, `pilot/FA4528/checkpoint.json.gz`, and
   `pilot/FA4528/budget.json`. Preserve the current publication receipt and a D1
   export using Cloudflare's supported export/backup facilities as well.
3. Read `previous_manifest.key` from current.json. Download that exact compressed
   manifest, then every `objects[].key` referenced by the current and previous
   manifests. Save bytes under their original keys in a private recovery folder
   outside the bucket and automatic cleanup. Do not assume a historical key.
4. SHA-256-check every compressed object against its descriptor. Validate both
   manifest identities, restore all tables with `restoreBundle`, compare every
   history-window snapshot and fiscal total, and record exact award-ID counts.
   A missing or corrupt referenced object is a blocker, not a successful backup.
5. Preserve another verified private copy of the recovery folder. Do not resume
   publishing until the backup is complete and independently readable.

Current and previous versions are protected only while referenced. Once a new
publication rotates them, the formerly previous version can be deleted in that
same successful run: the 24-hour grace is measured from upload time, not from
retirement. A pointer-only rollback is not a repair of authoritative D1.

## Restore through authority

1. Compare the verified retained tables, current D1 export and complete source
   discovery by award ID and all four window memberships. Retain newer current
   records and their evidence where valid; do not blindly replace them with old
   data. Confirm fiscal coverage and any source changes independently.
2. Prepare a new candidate publication with the original full award fields,
   raw JSON, history pages, memberships and complete fiscal data. Preserve the
   failed checkpoint before any explicit restart of discovery. Reusing hydrated
   rows requires identity and source validation; changing only checkpoint flags
   is not a supported recovery.
3. Record a matching validation receipt and publish through `publishD1` so its
   staged round-trip checks and atomic version assertion apply. Re-export D1
   and verify it matches the candidate exactly before changing R2.
4. Build/promote R2 from the verified authoritative export with the identical
   D1 publication version. Verify all four application payloads and CSV date/
   dataset combinations, then sample evidence through the authorized live app.
5. Record before/after counts and IDs, D1/R2 version agreement, checksums, source
   request totals, storage/operation measurements and any remaining gaps. Only
   then restore schedules and observe the next bounded refresh.

The existing runner creates a temporary Worker and gateway credential. Do not
run it if new-credential creation is outside the approved recovery scope.
Application source/storage/request ceilings are not an account billing cap.

## Local verification

```sh
python -m unittest discover -s contractintel/tests -v
node --test contractintel/tests/*.test.mjs contractintel/portfolio/r2/*.test.mjs contractintel/benchmarks/r2/*.test.mjs
node --check contractintel/web/app.mjs
node --check contractintel/portfolio/r2/runner.mjs
```

Regression cases include the 1,613-award loss, additions hiding removals,
per-window loss with unchanged total awards, both thresholds, empty scans,
legacy/incomplete checkpoints, receipt-backed D1 deletion attempts, direct R2
promotion without a baseline, and a concurrent D1 publication change.
