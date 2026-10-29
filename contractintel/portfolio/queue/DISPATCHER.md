# Automatic dispatcher

## Execution path
Cloudflare's existing scheduled trigger still dispatches verified-pilot maintenance.
The Worker entry wrapper also dispatches the automatic office controller, independently
of maintenance. It makes no USAspending requests in Cloudflare.
The GitHub controller reserves one D1 claim and then starts the existing R2 ingest
runner with an explicit directory-validated automatic profile. That runner verifies
the durable claim before opening its office's storage. Its source fetch, pacing,
retry, parsing, comparison metrics, and publication code remain shared with the pilots.

No new-office execution is enabled by this deployment. portfolio_rollout_control.review_json
is NULL by default. It must contain a measured cost/capacity review tied to the exact
independently validated FA4800 D1 publication before either Cron or an Actions job can
reserve work. Required JSON fields:
- fa4800_publication_version: exact current native D1 publication ID
- costs_reviewed: true
- baseline_r2_bytes: complete measured existing managed R2 bytes, including retained
  versions, checkpoints and the pilot baseline, taken before automatic office imports

Do not populate that review from estimates or an incomplete listing. After FA4800's
comparison, report requests/minutes/compressed bytes per 1,000 awards and D1 table
sizes. Review projected capacity before enabling any additional office.

## Durable execution and limits
One global claim, one office lease and daily America/New_York budget reservations
commit in one D1 batch. A CHECK assertion rolls back competing/stale claims.
Source calls reserve the existing maximum per job, including retries. Runtime reserves
the existing full job budget. Completion refunds only measured unused work.
Resume a saved office before starting another. Transient source failures yield through
the existing runner and retry after a configured delay. Terminal failures pause the
queue. An expired or missing-report claim keeps its reservation for reconciliation;
there is no blind timeout retry that could run a second writer.
A matching native D1 receipt plus admitted R2 report is required for Ready.
After a bounded job completes, Actions dispatches the next controller invocation.
Daily limits stop continuation; Cloudflare Cron restarts it on a later day.
A finite controller chain stops after CONFIG.rollout.maxControllerBatches.

The original pilots keep their separate workflows/buckets and are excluded from
automatic claims. Their requests are NOT charged to this new queue's daily ledger.
These are application work/storage guards, NOT a Cloudflare account spending cap.

Shared R2 storage uses one new private bucket and an office-prefixed ledger, rather
than 150 Worker bindings. A conservative per-office maximum R2 reservation plus
baseline R2 bytes, measured D1 bytes and a publication staging allowance must fit
the total storage guard. Each source/D1/R2 writer also retains its existing local limits.
The current small guards intentionally may stop well before 150 offices fit.
Do not claim the entire ranked cohort will fit before the cost/capacity review.

The source maintenance package remains partially delta based: unchanged award evidence
is reused; discovery/window/fiscal scans still repeat. The action-date discovery and
weekly full-rediscovery proposal remains a separate measured optimization.
Existing-pilot maintenance stays scheduled. Automatic jobs in this release perform
the seed/demand import and mark it ready; a recurring maintenance policy for the newly
imported cohort must be configured as part of the capacity review, before broad activation.

## Read path and fallback
New offices use their own directory-validated profile in the shared private R2 binding.
A valid admission and the current authoritative D1 publication version are required.
Unavailable, unpublished or damaged snapshots continue through D1 and the existing live
browser loader. Published automatic offices appear in coverage; on-demand queueing is
still best effort and never replaces the browser fallback.

## Deployment and repository portability
Migration 0006 adds control/usage/assertion tables and a unique active-office lease index.
Deployment adds the shared private R2 bucket/binding, retains the existing Cron, and runs
migrations idempotently. No source credentials are written into workflows or reports.
Register contractintel-rollout.yml on the default branch so GitHub accepts dispatches;
it checks out CONFIG.githubRef, as the pilot workflows do.
If the repository moves, update CONFIG.githubRepository/githubRef and workflow
registration/checkout, copy the existing repository secrets, and reauthorize the
Cloudflare-side encrypted GITHUB_DISPATCH_TOKEN for the new repository.
Ingest runs in Actions because Workers-to-USAspending encountered HTTP 525 failures.

## Verification
148 application tests and 18 R2 source/preservation tests pass locally. Coverage includes
competing reservations, no-review gate, independent-publication gate, unused-budget
refund, stale completion, expired lease, terminal pause, daily/storage limits, dispatch
deduplication, directory/pilot isolation, and the real source package -> independent
comparison -> native D1 -> shared R2 -> served snapshot fixture.

Before activation, verify the live controller reports awaiting_fa4800_and_cost_review
and has made no new-office source requests. Confirm both original pilot workflows and
page live loading remain functional. Then review actual FA4800 metrics/capacity.

## October 28 capacity/maintenance update
The limits and pending items above describe the original preparation release. See CAPACITY-REVIEW.md for the current activation measurements, separate capacity limits, daily maintenance and partition stop.
