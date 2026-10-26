# Portfolio coverage dashboard
Open /coverage.html, also linked from the Portfolio header.

The read-only /api/office/coverage/details endpoint measures only the configured
FA4528 and FA4800 buckets. Other directory offices remain live scans. It never
starts ingestion, calls USAspending, downloads source records, or decompresses
large checkpoints. Manual refresh avoids background polling.

Each office uses bounded R2 HEAD/list calls and the existing current manifest.
Actual stored bytes and object counts come from a bounded prefix listing.
Truncated listings explicitly show a lower bound. The configured per-office
storage guard is displayed separately; neither is an account billing cap.

New gateway checkpoint writes attach a small, whitelisted summary as R2 custom
metadata: phase, status, discovered/prepared counts, cumulative source requests,
and the last recorded HTTP status. This adds no objects or writes. Existing
checkpoints acquire summaries on their next batch using the updated gateway.
No record bodies, raw errors, award identifiers, or credentials are exposed.

Saved progress is not a heartbeat. The dashboard links directly to each
workflow for authoritative running/queued/failed status and errors. Source
verification remains required for FA4800 admission. No read gate, source helper,
publication rule, data field, CSV, or source request pacing changed.

Checks:
- node --test contractintel/tests/*.test.mjs
- node --test contractintel/portfolio/r2/offices.test.mjs contractintel/portfolio/r2/ingest.test.mjs
- node contractintel/qa/coverage-dom.mjs (happy-dom dependency)
- Open at 390px and desktop; check theme, office/location search, pagination,
  refresh/retry, storage units, workflow links, and links back to an office.
- Expect detailed progress counters only after a new gateway writes metadata.
