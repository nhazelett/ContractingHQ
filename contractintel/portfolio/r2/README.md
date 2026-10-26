# FA4528 live R2 portfolio

FA4528 now reads its published private R2 snapshot first. Missing/damaged copies
fall back to D1, then the browser's existing live USAspending path. All other
offices continue using their existing path. No new office has been ingested.

[Live-promotion verification and field preservation](../../docs/fa4528-r2-promotion.md).

The original browser parsing, pacing, retry, pause/resume, session cache, CSV
headers, date modes, classifications and controls are preserved. The only
browser adapter change accepts the honest R2 source marker.

## Updates and retention

The existing Cloudflare 07:00 UTC Cron dispatches the registered R2 workflow
when the production R2 binding is present. The 10:00 UTC GitHub schedule is
backup and uses the same R2 runner. The original D1 runner remains available as
an explicit manual recovery backend. Every R2-writing workflow shares the
contractintel-r2-shadow-ingest concurrency group; this serialization is also
required for cleanup. No other R2 writer may bypass that group.

The runner reuses unchanged raw/normalized evidence, rechecks all four history
windows and both fiscal years, and saves bounded resumable checkpoints.
All candidate bytes are downloaded and verified before a conditional manifest
write publishes the new office. Source HTTP 500 remains a failed job with saved
progress; existing source retry helpers are unchanged.

Before publication, the exact current manifest is archived as a compressed,
checksum-addressed object. The candidate retains its own version and the prior
version, plus a pointer to that archive. Cleanup protects the current objects,
all previous-publication objects and that archive. It can remove only other
tracked immutable objects, after CONFIG.r2Nightly.retentionGraceMs (24 hours).
Unknown ages and missing/invalid previous archives stop or defer cleanup.
Stale publication ETags reject deletion. Budget reservations are released only
after deletion; interrupted reconciliation conservatively retains reservations.

Cleanup runs both before staging (to make room within the guard) and after
publication. Recently retired objects can remain during the grace period.
The 32 MiB / 160-object reservation guard still stops growth safely; it is not
a Cloudflare account billing cap. Raw award/evidence JSON stays intact in both
retained complete copies. No normalized-field or raw-page stripping occurs.

All new ingest thresholds live at the top of portfolio/ingest.mjs. Serving
recomputes classification/countdown fields using today in America/New_York.

## Verification and credentials

Run:
```sh
node --test contractintel/portfolio/r2/ingest.test.mjs contractintel/benchmarks/r2/pilot.test.mjs contractintel/tests/portfolio-r2-read.test.mjs
```

Use the existing repository Cloudflare secret for the runner. Temporary gateway
credentials are randomly generated, masked, installed via Wrangler stdin and
removed with the temporary Worker. Source data stays in private R2; only small
measurement reports are uploaded as one-day artifacts.

The repository secret CONTRACTINTEL_GITHUB_TOKEN is installed as encrypted
Worker secret GITHUB_DISPATCH_TOKEN. A live permission check successfully read
the workflow (HTTP 200) and dispatched the R2 job (HTTP 204). The real next
Cloudflare timer firing is separate from this explicit dispatch test.

Ingest runs in GitHub Actions because Workers-to-USAspending returned HTTP 525.
If the repository moves, update CONFIG repository/ref/workflow, checkouts,
registration on the default branch and token permissions/deployment secrets.

Before another office is enabled, keep the same per-office count/field gate
and measure its size and nightly work. FA4800 is the proposed next office.
