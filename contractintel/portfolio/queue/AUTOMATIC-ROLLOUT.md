# Automatic ranked rollout

The user approved preparing the top 150 offices while FA4800 is verified.
The old manual queue remains available for compatibility; this automatic queue
does not require selecting, exporting, or approving individual office groups.

## Ranking
The GitHub Actions ranking workflow requests one FY2025 prime-contract
transaction export (A/B/C/D, action dates 2024-10-01 through 2025-09-30).
It requests PIID, federal action obligation, and action date only. All agencies
are included so a portfolio prefix is not silently equated to awarding-office
metadata. The runner streams the ZIP CSVs, sums exact decimal cents by the
first six PIID characters, and retains all directory offices, including offices
with zero or negative net obligations. Ties sort by office code.
The first 150 form the seed cohort. This scans an export, not 1,432 portfolios.

No award or source record is written back to USAspending. The export request
asks the source to prepare a downloadable copy. Limits, pacing, retries and
download size caps are in CONFIG.rollout. It uses only Python standard libraries.
API calls and compressed bytes are reported; source completion row counts,
archive checksum, directory checksum and exact ranking are retained.
The archive is temporary runner storage and is not uploaded to D1 or R2.

## Durable automatic queue
Migration 0005 adds ranking provenance and one rollout job per directory office.
Ranking and all 150 enqueues commit atomically. Repeated ranking submissions
cannot reset importing, verifying, ready, or stopped work. Queued seed priorities
follow ascending seed_rank, therefore descending FY25 net obligations.
An unpublished office read now invokes the demand enqueue helper before returning the existing live-fallback response. Queue failures are isolated so live loading still works.\nThe demand enqueue helper validates the directory in SQL, skips published
offices, deduplicates requests, and puts demand-only offices after the seed cohort.

Selection resumes an existing checkpoint before starting another office, blocks
uncertain leases, honors retry delays/attempt limits, and requires all three gates:
FA4800 independent validation, cost review, and sufficient measured storage.
These are required prerequisites, not permissions to bypass.
No import dispatch is wired into this preparation workflow. The existing two-office
runner/profile allowlist remains unchanged. A general worker adapter and shared
R2 storage/read path still have to be connected before actual seed imports can
start. This release does not falsely mark the seed cohort as imported.

## Run and inspect
The workflow starts on a push of its ranking files and also supports workflow_dispatch.
Its summary lists the ranked seed offices; a seven-day artifact includes the full
ranking and queue receipt. D1 retains the ranking and jobs durably.
Tests: Python unittest test_ranking.py and Node automatic-queue.test.mjs.
The existing source fetch, parsing, pacing, session cache, and CSV code is unchanged. The only read-path addition is best-effort queueing after an unpublished office miss.
