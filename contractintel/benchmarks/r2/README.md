# FA4528 R2 storage benchmark

This is an isolated experiment, not the live Portfolio read path. It copies the existing completed FA4528 D1 publication; it makes no USAspending or SAM requests. The production Worker, its D1 source switch, live fallback, UI, CSV producer, parsing, pacing, retries and source cache remain in place.

## What is measured

1. Read-only, bounded D1 export of the office, completed publication and referenced ingest runs, fiscal totals, every award column, all exact history-window memberships and stored history pages.
2. Lossless gzip objects containing full award/history rows, including the original `raw_json` and `record_json` strings. Evidence chunks are addressed by their checksum, so unchanged chunks can be reused across publications.
3. Four compact portfolio response files and an evidence index. The R2 reader uses the same date/classification helpers and current America/New_York calendar date. `published_at` remains the original source publication time; `copied_at` is internal metadata.
4. Full response equality against D1, allowing only the honest `source: "r2"` marker instead of `"d1"`. The live browser currently accepts `"d1"`; no production promotion is attempted here.
5. All 96 existing count/fiscal comparisons, byte-for-byte CSV output from the original app export function across four datasets and both date bases, plus sample evidence responses.
6. An incomplete publication must retain the old pointer. A second unchanged upload pass must write zero objects.
7. End-to-end download/JSON timing against the isolated R2 reader and the current production D1 reader, plus source bytes, compressed bytes and bounded request counts.

This does not repeat the independent USAspending scan. That source comparison already passed for the D1 publication; this experiment verifies the D1-to-R2 conversion without changing or re-fetching those numbers.

## Scope and budgets

All new runtime settings are in `CONFIG.r2Pilot` at the top of `portfolio/ingest.mjs`. The workflow mirrors its 20-minute job limit and one-day artifact retention. Export SQL is restricted to `SELECT` before it reaches the existing D1 HTTP adapter, and measured D1 `rows_written` must remain zero. The only permitted office is FA4528.

Objects go to the separate private `kthq-contractintel-r2-fa4528-pilot` bucket. Its public managed-domain access must be disabled. There are finite export, compressed-byte, object-count and request budgets. At most two source versions are accepted; a third stops for review rather than deleting an old copy or growing indefinitely. This is a pilot guard, not a Cloudflare account-wide spending cap.

The runner creates a temporary Worker named with the GitHub run ID/attempt. It has an R2 binding and **no D1 binding, cron, assets, or production route**. All reads and uploads require a random per-run key, masked before use and installed through standard Wrangler secret input. It is not a GitHub PAT and is not needed for nightly dispatch. The temporary Worker is deleted in `finally`; the private objects remain for review. No D1 data is deleted.

The existing Cloudflare repository token is used. If R2 is not enabled or that token lacks R2 access, the job saves its completed local export/compression measurements, reports the blocker, and stops without changing the production source. No credentials or raw source datasets are uploaded as GitHub artifacts; only the measurement report is retained for one day.

## Run and review

The scoped push workflow is `.github/workflows/contractintel-r2-pilot.yml`. It uses the same ingestion concurrency group so a scheduled source publication cannot race the export. It does not require the deferred GitHub dispatch token.

```sh
node --test contractintel/benchmarks/r2/pilot.test.mjs
node contractintel/benchmarks/r2/run.mjs
```

The second command needs the existing `CLOUDFLARE_API_TOKEN` environment variable; never put its value in source or a command argument. The runner writes `out/fa4528-r2-report.json`. A failed cloud step does not erase the local conversion measurements.

Do not switch the live app or expand offices from a compression ratio alone. Review field parity, the real R2 timings, publication safety, measured operations, temporary-resource cleanup and source-update churn first. All-office extrapolations remain FA4528-only scenarios; they exclude traffic, other account usage and differences between office sizes.
