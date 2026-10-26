# FA4528 independent D1 comparison

**PASS: all 96 metrics match across all four history windows.** Award identity sets also match exactly in every window. No figures were adjusted to force equality.

- Publication: `3185f41e-129b-455f-981e-3a6e0dc7bcd4`, published 2026-10-26T03:48:48.493Z.
- Classification date: **2026-10-26, America/New_York**.
- Fiscal scan through: 2026-10-26. FY2026 is prior FY; FY2027 is current FY.
- Independent source reads: 2026-10-26T04:24:21.285Z through 2026-10-26T05:09:18.151Z; 4,177 adapter calls, including interrupted/resumed work.
- The source scan independently fetched discovery, every award summary and fiscal transactions through the original source adapter and pacing/retry helper. D1 records did not construct the live-side results.
- USAspending HTTP 500 interruptions failed the check visibly; source-only checkpoints resumed within the same publication/day and configured six-hour lifetime. The published office stayed unchanged throughout. Original retry behavior was not modified.
- Only FA4528 award data is ingested. Directory labels cover 1,432 offices. Expansion remains disabled pending user review and storage planning.

Evidence: https://github.com/nhazelett/ContractingHQ/actions/runs/40269347006

## Measured read times

Default FY22 endpoint, including full download and JSON parsing: **94 ms, 100 ms, 107 ms**. These are GitHub-runner measurements, not a full browser/mobile-render benchmark.

| Window | Awards | Preflight download + parse |
| --- | ---: | ---: |
| All API history (FY08 onward) | 4,091 | 297 ms |
| FY22 onward (default) | 1,195 | 117 ms |
| FY25 onward | 436 | 61 ms |
| FY26 onward | 172 | 44 ms |

## All API history (FY08 onward)

| Metric | D1 | Independent live scan | Match |
| --- | ---: | ---: | :---: |
| Total awards | 4,091 | 4,091 | Yes |
| Active / upcoming (includes date review) | 82 | 82 | Yes |
| Current contracts (excludes date review) | 79 | 79 | Yes |
| Potentially completed | 4,009 | 4,009 | Yes |
| Needs date review | 3 | 3 | Yes |
| Current end ≤90 days | 18 | 18 | Yes |
| Active: current end ≤90 days | 18 | 18 | Yes |
| Current end ≤180 days | 32 | 32 | Yes |
| Active: current end ≤180 days | 32 | 32 | Yes |
| Current end ≤365 days | 54 | 54 | Yes |
| Active: current end ≤365 days | 54 | 54 | Yes |
| Potential end ≤90 days | 15 | 15 | Yes |
| Active: potential end ≤90 days | 15 | 15 | Yes |
| Potential end ≤180 days | 24 | 24 | Yes |
| Active: potential end ≤180 days | 24 | 24 | Yes |
| Potential end ≤365 days | 37 | 37 | Yes |
| Active: potential end ≤365 days | 37 | 37 | Yes |
| Recompete candidates | 37 | 37 | Yes |

Award identity differences: D1 only **0**, live only **0**.

## FY22 onward (default)

| Metric | D1 | Independent live scan | Match |
| --- | ---: | ---: | :---: |
| Total awards | 1,195 | 1,195 | Yes |
| Active / upcoming (includes date review) | 82 | 82 | Yes |
| Current contracts (excludes date review) | 79 | 79 | Yes |
| Potentially completed | 1,113 | 1,113 | Yes |
| Needs date review | 3 | 3 | Yes |
| Current end ≤90 days | 18 | 18 | Yes |
| Active: current end ≤90 days | 18 | 18 | Yes |
| Current end ≤180 days | 32 | 32 | Yes |
| Active: current end ≤180 days | 32 | 32 | Yes |
| Current end ≤365 days | 54 | 54 | Yes |
| Active: current end ≤365 days | 54 | 54 | Yes |
| Potential end ≤90 days | 15 | 15 | Yes |
| Active: potential end ≤90 days | 15 | 15 | Yes |
| Potential end ≤180 days | 24 | 24 | Yes |
| Active: potential end ≤180 days | 24 | 24 | Yes |
| Potential end ≤365 days | 37 | 37 | Yes |
| Active: potential end ≤365 days | 37 | 37 | Yes |
| Recompete candidates | 37 | 37 | Yes |

Award identity differences: D1 only **0**, live only **0**.

## FY25 onward

| Metric | D1 | Independent live scan | Match |
| --- | ---: | ---: | :---: |
| Total awards | 436 | 436 | Yes |
| Active / upcoming (includes date review) | 74 | 74 | Yes |
| Current contracts (excludes date review) | 73 | 73 | Yes |
| Potentially completed | 362 | 362 | Yes |
| Needs date review | 1 | 1 | Yes |
| Current end ≤90 days | 18 | 18 | Yes |
| Active: current end ≤90 days | 18 | 18 | Yes |
| Current end ≤180 days | 32 | 32 | Yes |
| Active: current end ≤180 days | 32 | 32 | Yes |
| Current end ≤365 days | 53 | 53 | Yes |
| Active: current end ≤365 days | 53 | 53 | Yes |
| Potential end ≤90 days | 13 | 13 | Yes |
| Active: potential end ≤90 days | 13 | 13 | Yes |
| Potential end ≤180 days | 21 | 21 | Yes |
| Active: potential end ≤180 days | 21 | 21 | Yes |
| Potential end ≤365 days | 32 | 32 | Yes |
| Active: potential end ≤365 days | 32 | 32 | Yes |
| Recompete candidates | 32 | 32 | Yes |

Award identity differences: D1 only **0**, live only **0**.

## FY26 onward

| Metric | D1 | Independent live scan | Match |
| --- | ---: | ---: | :---: |
| Total awards | 172 | 172 | Yes |
| Active / upcoming (includes date review) | 67 | 67 | Yes |
| Current contracts (excludes date review) | 66 | 66 | Yes |
| Potentially completed | 105 | 105 | Yes |
| Needs date review | 1 | 1 | Yes |
| Current end ≤90 days | 18 | 18 | Yes |
| Active: current end ≤90 days | 18 | 18 | Yes |
| Current end ≤180 days | 32 | 32 | Yes |
| Active: current end ≤180 days | 32 | 32 | Yes |
| Current end ≤365 days | 53 | 53 | Yes |
| Active: current end ≤365 days | 53 | 53 | Yes |
| Potential end ≤90 days | 13 | 13 | Yes |
| Active: potential end ≤90 days | 13 | 13 | Yes |
| Potential end ≤180 days | 20 | 20 | Yes |
| Active: potential end ≤180 days | 20 | 20 | Yes |
| Potential end ≤365 days | 27 | 27 | Yes |
| Active: potential end ≤365 days | 27 | 27 | Yes |
| Recompete candidates | 27 | 27 | Yes |

Award identity differences: D1 only **0**, live only **0**.

## Fiscal totals

Office-wide fiscal totals are independent of the selected history window and matched in each of the four comparisons. Net obligation cents are stored as exact text integers; this table formats them as dollars. Zero source amounts/counts are reported as zero, with no missing-amount records; they are not a claim that no unreported activity exists.

| Metric | D1 | Independent live scan | Match |
| --- | ---: | ---: | :---: |
| FY2026 net obligation cents | $19,486,003.77 | $19,486,003.77 | Yes |
| FY2026 contract count | 172 | 172 | Yes |
| FY2026 missing amounts | 0 | 0 | Yes |
| FY2027 net obligation cents | $0.00 | $0.00 | Yes |
| FY2027 contract count | 0 | 0 | Yes |
| FY2027 missing amounts | 0 | 0 | Yes |

The [JSON report](fa4528-verification.json) retains all 96 individual checks, raw cent values, identity differences, metadata, timing samples and the measured table storage report. See [storage analysis](fa4528-storage-report.md) and [delivery/setup/field inventory](portfolio-d1-delivery.md).
