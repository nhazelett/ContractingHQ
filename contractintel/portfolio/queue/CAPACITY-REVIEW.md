# Ranked rollout capacity and maintenance — October 28, 2026

## Measured basis

FA4800: 7,968 awards, authoritative publication
90245098-ed8a-43e2-995b-d9c9e817de19, 32,393 source calls,
299.843 source-job minutes across 109 attempts, and 8,675,837 compressed
publication bytes. Total stored office bytes were 24,482,018. Job minutes
include staging/backoff and are not a billable-runner measurement.

The post-publication read-only audit found 12,059 published awards across
FA4528 and FA4800, 142,479,360 physical D1 bytes and zero staged rows.
All 150 ranked offices remained queued; no automatic import had begun.

The previous projection incorrectly treated aggregate multi-office payload
as one office. storageReport now divides by the measured publication count
and labels the result an illustrative average, never a forecast.

## Enabled operating limits

- One office writer at a time; continue an unfinished office before another.
- Up to 72,000 source calls and 20 hours of automatic queue job runtime per
  America/New_York day. Existing separate pilot workflows have their own limits.
- Preserve the existing source pacing and retries. Daily limits are application
  work budgets, not an account-wide spending cap.
- D1 hard application guard: 8 GiB, below the provider's 10 GB database limit.
- Reserve 512 MiB for D1 publication work. Stop assigning new offices if that
  reservation would cross 6 GiB; existing-office refresh may use remaining
  room under the 8 GiB hard guard.
- Independent R2 guard: 8 GiB. Measure every object in all four managed buckets,
  following every listing cursor. Never use a truncated listing as a baseline.
- Additional 96 MiB R2 headroom protects the separate legacy pilot buckets.
- Reserve 256 MiB for an automatic office while it writes. After publication,
  settle to its durable R2 ledger reservation, including checkpoint/verification
  slots and retained objects. Re-reserve growth room before a later refresh.
- Larger automatic-office format/checkpoint limits leave the original pilot
  profiles unchanged. Oversized or inconsistent offices still stop for review;
  no truncated inventory is published.

## Activation and failure handling

The activation workflow waits for the exact commit's validated preview
deployment. It confirms the full independent FA4800 receipt and matching
complete cost report. A temporary authenticated LIST-only Worker measures
managed R2 buckets without reading object bodies or exposing keys. The
temporary Worker must be deleted before recording the review gate.

The initial review can be recorded only before automatic work begins, with
no active/uncertain lease or prior storage reservations. It is bound to the
native FA4800 version and capacity configuration version. Repeated activation
retains the existing baseline rather than double-counting later shared-bucket
office data. No approval or validation check is bypassed.

Queue claims reserve daily work and storage atomically. Missing reports,
uncertain completions and terminal data/storage errors retain reservations.
The existing pause/reconciliation behavior remains in place.

## Maintenance

Every successful automatic publication schedules the next refresh for 24
hours later. The controller requeues due offices under the same daily budgets,
prioritizes due maintenance after already-running work, and resets per-cycle
attempts. Stored publication versions remain readable during refresh.

Routine maintenance uses the existing changed-evidence reuse plus full
discovery/window/fiscal scans, field/CSV validation and D1-before-R2 publication.
Initial imports retain the full independent comparison gate. The existing
30-day full reconciliation remains. Delta discovery plus weekly full
rediscovery remains a later measured optimization, not an implemented claim.

## Partition plan

Keep current published offices in the current database. Before crossing the
6 GiB assignment threshold:

1. Provision and validate another Portfolio D1 database with the same schema.
2. Store durable office-to-database assignments in the control database.
3. Route ingest and all office snapshot/evidence reads using that assignment.
4. Keep the directory/queue/control data in the control database; gather
   coverage across shards without inferring a missing office is empty.
5. Verify complete publication and R2 parity in the new shard before admission.
6. Preserve existing office versions in place; no silent relocation.

Shard provisioning/routing is not implemented in this release. The assignment
stop prevents an assumed 150-office fit from becoming a capacity incident.
The ranked queue can start now and will stop before that work is required.
Actual completion time depends on office sizes, source latency, retries and
maintenance load; the FA4800 sample is not a forecast for the top 150.
