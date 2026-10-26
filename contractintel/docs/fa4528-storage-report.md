# FA4528 D1 pilot — measured storage

Measured 2026-10-26T03:54:12Z after publication `3185f41e-129b-455f-981e-3a6e0dc7bcd4` at 2026-10-26T03:48:51Z. Only FA4528 award data has been published. All 1,432 office directory labels are present.

## Measured table payload

| Table | Rows | Logical bytes | MiB |
| --- | ---: | ---: | ---: |
| award_history_pages | 4,091 | 7,042,351 | 6.716 |
| award_windows | 5,894 | 312,107 | 0.298 |
| awards | 4,091 | 31,824,938 | 30.351 |
| fiscal_totals | 2 | 8,090 | 0.008 |
| ingest_dispatches | 0 | 0 | 0.000 |
| ingest_lock | 1 | 1 | 0.000 |
| ingest_office_progress | 1 | 902 | 0.001 |
| ingest_runs | 64 | 78,767 | 0.075 |
| ingest_stage | 0 | 0 | 0.000 |
| office_publications | 1 | 145 | 0.000 |
| offices | 1,432 | 413,626 | 0.394 |

Physical D1 database: **46,964,736 bytes (44.789 MiB)**. Sum of logical table payloads: **39,680,927 bytes (37.843 MiB)**. These differ because physical storage includes SQLite records, indexes, allocation and unused pages. Per-table numbers sum the byte lengths of stored column values; they do not apportion physical index/record overhead. Staging is empty after publication.

## 1,432-office scenario

Directory data is fixed once. Published variable payload for FA4528 is 39,187,486 bytes (awards + window membership + history + fiscal totals).

`413,626 + 39,187,486 × 1,432 = 56,116,893,578 bytes`

That is **56.117 GB decimal / 52.263 GiB before index/SQLite overhead**, temporary staging, audit growth, other databases and future data growth. It is a linear scenario using one office, not a forecast: portfolio sizes and history depths vary widely.

Awards account for **81.2%** of the variable payload; history pages account for **18.0%**. History therefore does **not** dominate. The history table contains 2,892,977 bytes of normalized actions and 3,557,369 bytes of raw page JSON; its remaining bytes are identity, hashing and metadata. Removing raw history JSON hypothetically saves 9.1% of variable payload, or about 5.094 GB in this linear scenario. Approximately 51.023 GB would remain before overhead. **No raw award/history data has been removed.**

The main storage lever to investigate before expansion is avoiding redundant representations in the award table while retaining the full raw award and every current page field. Any redesign must re-run field preservation and count parity checks. If normalized action rows later replace raw history pages, preserve source order, page boundaries, IDs, has-next flags and every evidence field. That is a proposal requiring approval, not an implemented retention change.

Cloudflare currently includes the first 5 GB of account D1 storage on Workers Paid, then charges $0.75 per GB-month. At 56.117 GB, the simplified storage-only overage would be about $38.34/month above that allowance, excluding overhead, existing storage and query/write usage. It is **not** a quote or a cap. Each D1 database has a 10 GB hard limit, so this scenario cannot fit in one database. Do not expand the office allowlist before storage/cost planning and explicit approval.

Official references:
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/reference/faq/

Evidence:
- Completed backfill and initial measurement: https://github.com/nhazelett/ContractingHQ/actions/runs/40261595775
- Read-only retained-publication/storage measurement: https://github.com/nhazelett/ContractingHQ/actions/runs/40264575700

## Verification status

The backfill completed. The initial independent comparison stopped after about 300 of 4,091 source awards when USAspending returned a temporary-unavailable error. That did not alter the published office. A targeted comparison against the same publication is running with the existing summary-only source read, four exact history windows and a separate fiscal transaction scan. No count parity or endpoint timing claim is made until the final report is available.

Primary Cloudflare Cron dispatch is awaiting repository secret `CONTRACTINTEL_GITHUB_TOKEN` and deployment to encrypted Worker secret `GITHUB_DISPATCH_TOKEN`. The daily Cloudflare Cron remains primary; GitHub schedule is backup only.
