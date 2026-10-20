# On-demand ContractIntel

The preview uses the public USAspending API. No SAM key is required by this path.
The supplied Claude FY22–26 directory provides 1,432 selectable six-character office codes.
Award assignment follows the user's requested PIID-prefix rule. USAspending keyword searches
produce candidates; the Worker rejects every candidate whose award PIID does not begin with
the selected code, including matches only in parent identifiers or descriptions.

## Loading and coverage

- Default action window: FY22 onward. FY25, FY26, and all searchable API history (FY08 onward) are available.
- Search pages contain up to 100 candidates. Details and 200 recent actions load per matching award.
- Two award requests maximum in flight, paced at least 700 ms apart. Pause/continue retain the current batch.
- Automatic continuation is opt-in and pauses after at most 1,000 additional candidates per run.
- Every office is available on demand; the entire department is never fetched in the background.
- Counts, local text filters, CSV, and sorting cover loaded records only. Partial coverage is visible.
- The default register is All loaded awards, sorted by upcoming potential final end (current end fallback), soonest first, then past and unknown ends.
- Public reporting delays and source search/detail indexing differences remain. An indexed award with a 404 detail is retained with unavailable fields; Retry missing details retries only those awards. Other source failures pause loading without erasing progress.
- Search continuation converts the source's epoch-millisecond End Date cursor to an ISO date; passing the returned numeric string verbatim produces a source 503.

## Values and modifications

Award Amount comes from the cumulative base_exercised_options award value, not obligation totals
or a sum of partial transaction deltas. Current and potential ends remain distinct.
Latest mod and latest option-exercise mod come from reported transactions; G identifies option exercise.
The detail view can page through older actions. Missing option evidence never means no options.

The public transactions endpoint omits per-mod PoP dates. Those fields stay null; the app does not
attribute the latest award-level PoP to an earlier mod. Option counts, current option year, and
the latest option that changed PoP cannot be established without additional source evidence.

## Storage and cost controls

The deployed Worker has **no D1 or R2 binding**. It uses ephemeral Cloudflare Cache API responses
with a six-hour TTL and a per-IP 120 requests/minute read limiter. No archives, stored office
imports, cron trigger, paid plan, or increased usage allowance is added. Existing small R2
archives and D1 snapshot are retained separately. The GitHub history workflow remains disabled.
Cloudflare service quotas still apply; this is not a promise of unlimited API capacity.

The old stored-data handler remains in worker/stored-api.mjs solely for the retained historical
pipeline tests. It is not imported by the deployed Worker.

## Validation

Run: node --test contractintel/tests/*.test.mjs

26 checks cover the retained snapshot behavior, exact money/date handling, prefix exclusions,
input validation, rate limits, shared caching, unavailable source records, option evidence,
and final-end ordering. Live API checks verified Langley continuation without duplicate awards,
Army office W9124J, and BOS FA480024C0006: 44 source actions, latest P00043, latest option P00034,
current and potential end 2025-08-31, cumulative award value $28,779,919.15.

Official source contracts: https://github.com/fedspendingtransparency/usaspending-api/tree/master/usaspending_api/api_contracts/contracts/v2
