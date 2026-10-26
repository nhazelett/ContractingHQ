# FA4528 R2 benchmark — passed

The cheaper storage copy passed its cloud benchmark on **October 26, 2026**. The live app continues to use D1. No other office was copied and no new USAspending/SAM scan was started.

## Results

| Check | Result |
| --- | --- |
| Existing awards copied | 4,091 |
| Full raw/source table round-trip | Exact match across all exported columns in seven tables |
| Full Portfolio API payloads | Match in every sampled response across all four windows, except the truthful `source: r2` marker |
| Dataset, expiry, recompete and fiscal metrics | 96 of 96 match |
| Original CSV producer | 32 of 32 byte-for-byte checks match, across four datasets and both date bases |
| Evidence API samples | 3 of 3 match; all stored raw and normalized evidence also passed whole-export equality |
| Incomplete R2 publication | Rejected; previous complete pointer retained |
| Unchanged second upload pass | 0 object writes |
| USAspending/SAM requests | 0 |
| D1 writes | 0 |
| Private R2 objects written | 48 (47 data objects plus the publication pointer) |
| Temporary test Workers | Both removed; source app and its routes untouched |

The export read the existing completed publication `3185f41e-129b-455f-981e-3a6e0dc7bcd4`, whose source timestamp remains **2026-10-26T03:48:48.493Z**. Countdown/classification calculations use the current date in America/New_York. Copying does not make the source appear newly updated.

Evidence: https://github.com/nhazelett/ContractingHQ/actions/runs/40358010992

## Measured storage

| Measurement | Bytes | Decimal MB |
| --- | ---: | ---: |
| Lossless source export encoded as JSON | 47,611,199 | 47.611 |
| Compressed data/evidence plus four view files | 4,166,154 | 4.166 |
| Complete R2 copy including publication pointer | 4,179,186 | 4.179 |
| Existing physical D1 database (earlier measurement) | 46,964,736 | 46.965 |

This is lossless compression. The original `raw_json` and `record_json` strings, NULLs, exact monetary strings and history evidence remain intact. Operational locks, staging and unrelated office data were not copied.

## Paired download/JSON timings

Five samples per source and window, from one GitHub-hosted runner. These are API download/parse times, not full browser/mobile-render measurements or global latency guarantees.

| Window | Awards | R2 median | R2 range | D1 median | D1 range |
| --- | ---: | ---: | ---: | ---: | ---: |
| All API history | 4,091 | 440 ms | 350–489 ms | 771 ms | 530–959 ms |
| FY22 onward (default) | 1,195 | 270 ms | 200–386 ms | 416 ms | 258–516 ms |
| FY25 onward | 436 | 202 ms | 183–279 ms | 214 ms | 195–406 ms |
| FY26 onward | 172 | 173 ms | 168–182 ms | 193 ms | 190–228 ms |

## Field preservation map

| Existing data | Where the experimental copy keeps it |
| --- | --- |
| Every `awards` column, full raw award JSON and normalized record JSON | Compressed evidence chunks, keyed by content checksum |
| Every `award_history_pages` column, normalized actions, raw page JSON, page number, has-next and source hash | Same evidence chunks |
| Exact `award_windows` memberships | Compressed metadata object |
| Complete `fiscal_totals` rows, cents, distinct award IDs, missing-amount counts and coverage | Metadata object; identical fiscal response fields in each view |
| Office directory row and confidence/source label | Metadata object |
| Completed office publication and referenced ingest-run evidence | Metadata object |
| Every loaded record field the UI and CSV use | Four prebuilt window files, with dynamic date fields recomputed by the original helpers |
| Contract details/history endpoint shape | Evidence index plus the relevant compressed chunk |
| Updated stamp | Original publication timestamp, not copy time |
| Live fallback, pause/resume, six-hour cache, existing UI and CSV controls | Production code remains in place, using D1/live as before |

The experimental API uses `source: "r2"`; the current browser source adapter only accepts `"d1"`. That deliberate metadata difference is reported rather than hidden. Enabling R2 in the live source switch is a later change.

## Cost implications and limits

Using this measured FA4528 copy for every office gives the following **linear scenarios**, not forecasts:

| Scenario | Stored bytes | Decimal GB |
| --- | ---: | ---: |
| One copy for each of 1,432 FA4528-sized offices | 5,984,594,352 | 5.985 |
| Two full copies, before sharing any unchanged objects | 11,969,188,704 | 11.969 |

R2 Standard currently includes 10 GB-month, one million Class A operations and ten million Class B operations monthly. Storage beyond its allowance is $0.015/GB-month. Under those assumptions and with otherwise-unused account allowances, the one-copy scenario fits included R2 storage; the two-copy upper bound is roughly $0.03/month in storage overage after whole-GB rounding. These exclude the Workers minimum, CPU/request use, operations, other account usage and differences between office sizes.

The completed experiment used 289 R2 reads and 48 R2 writes, including integrity and failure tests. The unchanged second pass made no new object writes. Content-addressed evidence can be reused when it does not change. A fully changed copy every night would cost more operations; no claim is made that all offices or real nightly change rates fit a fixed monthly bill.

The current D1 ingestion pipeline has **not** been replaced. Its whole-office staging and window rebuild write pattern must still be removed from the multi-office design. This benchmark proves data conversion, storage size, read performance and publication safety; it does not yet prove source-ingest throughput, bulk-import equivalence, real nightly update churn, monthly billing or every office's size.

Official pricing: https://developers.cloudflare.com/r2/pricing/

## Scope and cleanup

The bucket `kthq-contractintel-r2-fa4528-pilot` remains private and contains the completed FA4528 copy. It has no public managed domain. Benchmark reads/uploads required a masked per-run secret. The temporary test Workers were deleted using the existing Workers API permission; no broader KV permission was added. The initial address-propagation and Wrangler cleanup problems were fixed and the cloud test was rerun successfully.

All runtime limits live in `CONFIG.r2Pilot`. The pilot caps source/export bytes, object count, uploaded bytes, request counts and stored source versions. A third source version stops for review instead of deleting old copies or accumulating data. These are application guards, not an account-wide billing cap.

Nightly GitHub dispatch credentials remain deferred until the user is home. No sign-in or credential request is required to review these benchmark results. Expansion and production promotion remain off.

[Complete measurements](fa4528-r2-benchmark.json) · [Benchmark source and run instructions](../benchmarks/r2/README.md) · [Original D1/live verification](fa4528-verification.md)
