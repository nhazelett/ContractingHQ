# FA4528 live R2 promotion — October 26, 2026

FA4528 is live on R2, with D1 and the original browser loader as fallback.
No other office was imported. The current and previous complete copies are
retained; unreferenced older files become eligible for cleanup after 24 hours.

## Evidence

- Live checks returned source r2 across all four windows: 4,091 / 1,195 / 436 /
  172 awards. Three evidence samples per window passed. The browser stored-source
  adapter and fiscal converter accepted the real responses.
- GitHub credential checks returned HTTP 200 for workflow access and HTTP 204
  for a real R2 workflow dispatch. That dispatched job passed.
- A real third-publication rollover passed: 76 source requests, zero changed
  awards, 42 reused files and five new publication files. All raw/table fields,
  all four application payloads and 32 CSV combinations passed read-back checks.
- The rollover published at 3:26:27 PM America/New_York. Its source publication ID
  is df1c13c5-b103-4c2a-9d99-35c94cc7f6e1.
- Shadow/test-bucket name is retained for continuity, but it is now the live
  FA4528 bucket: kthq-contractintel-r2-fa4528-nightly.
- Measured stored contents after rollover: 5,412,819 bytes, 61 objects. Five
  obsolete files were correctly retained by the 24-hour grace period. No
  production file was old enough for deletion during this run.
- Same-day replay performed zero source calls and zero writes.
- 21 focused tests passed, including rollover, current/previous deletion
  protection, grace-period cleanup, stale-ETag rejection, source failures,
  missing fiscal pages, every preserved field, CSV, NY dates and D1 fallback.
- Existing dashboard/API tests and deployed opportunity checks passed.

The cleanup deletion path was tested with aged fixtures. Real old-file deletion
will become eligible after the grace period; it has not been claimed as
observed in production today. This quiet refresh does not establish busy-day
or all-office cost. The original independent FA4528 source comparison remains
the baseline; this refresh does not pretend to repeat every detail read.

Workflows:
- [Live deployment and source smoke](https://github.com/nhazelett/ContractingHQ/actions/runs/40386483749)
- [Real retention rollover](https://github.com/nhazelett/ContractingHQ/actions/runs/40386483722)

## Source and feature inventory

Every field in the earlier
[full preserved-field inventory](fa4528-r2-update.md#fields-and-existing-behavior)
remains present. Its historical “shadow only” deployment statements are
superseded by this promotion; its field mappings are unchanged.

| Field / behavior | Live location |
| --- | --- |
| PIID, description, recipient, dates, values, competition and set-asides | Same record JSON in each R2 history-window snapshot |
| UEI, NAICS/PSC, award type, source columns and raw award JSON | Lossless evidence chunks |
| Option evidence, mods, normalized actions and raw first history page | Evidence chunks; unstored pages fall back through D1/live |
| Four source-window memberships | Same source search results; explicit metadata and snapshots |
| Prior/current FY cents, distinct contracts, transaction/missing counts | Complete fiscal rows in each snapshot |
| Classification, dates unclear, countdowns, recompete candidates | Existing helpers, recalculated on current America/New_York day |
| Freshness | Successful source publication timestamp; replay does not advance it |
| Picker, location search, tabs, filters, exports, modals, theme, accessibility, disclaimers | Existing browser UI; no controls removed |
| Live fetching, request pacing, retries, session cache and pause/resume | Existing fallback code unchanged |

## Schedules and recovery

Cloudflare Cron stays at 07:00 UTC and selects the R2 workflow when the live
binding is present. The registered 10:00 UTC GitHub backup selects R2.
The old D1 package remains selectable for manual recovery. Current and previous
R2 manifests are complete and validated before cleanup; partial jobs cannot
publish or delete protected copies.

Storage/object/source/runtime guards remain configured in the single ingest
CONFIG object. They fail rather than grow past their application budgets.
These are not account billing caps.

## Short manual checks

1. Refresh FA4528: default FY22 window should show 1,195 loaded awards.
2. Select all history: confirm 4,091 awards.
3. Open contract details and source evidence; try older transaction pages.
4. Toggle both end-date bases and datasets; export a filtered CSV.
5. Open another office: confirm its live-loading controls still work.
6. Review the next nightly run and grace-period cleanup report before expansion.

[Open FA4528](https://kthq-contractintel.nickhazelett.workers.dev/?office=FA4528)

FA4800 is the next proposed expansion. All-office rollout remains disabled.
Shared website-folder sync remains deferred.
