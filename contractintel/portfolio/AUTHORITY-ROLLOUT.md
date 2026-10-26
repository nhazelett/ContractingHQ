# Approved repair and rollout sequence
Approved 2026-10-26:
1. D1 awards/evidence/fiscal data is authoritative. R2 snapshots must record the
   D1 publication version and be generated from full-field D1 readback.
2. FA4800 saved work must pass the complete independent-source, field, window,
   fiscal and CSV validation gate before D1 publication and cache admission.
3. Seed approximately 150 offices in descending FY25 net obligation order over
   several nights. Rank by the same PIID-prefix office definition used by the app.
   Do not crawl all 1,432 offices. Queue non-seeded offices on first request while
   keeping the existing live loader intact.
4. After rollout, propose action-date delta discovery plus weekly rediscovery.
   Record current full-discovery and changed-discovery requests per office first.
5. Retry temporary gateway failures inside jobs with bounded backoff/jitter.
   Healthy bounded continuations should exit successfully; terminal failures,
   mismatches and exhausted total budgets must still fail and alert.
6. Cloudflare Access must cover coverage.html and the detailed coverage endpoint.
   Remove public nav/sitemap entries; no unguessable-path substitute.

Implemented in the D1 repair:
- Resumable unpublished SQL staging, a content-bound validation receipt, complete
  SQL extraction/readback checks and atomic publication with an expected-version
  assertion. Failed staging/publication preserves the previous complete data.
- R2 manifests carry d1_publication_version. Production reads reject a cache
  version that does not match office_publications.published_run_id in D1.
- Prepared source work is independent of cache publication, so long verification
  and D1 staging happen outside the source chunk deadline.
- Existing FA4528 cache is regenerated from its actual D1 publication. A legacy
  R2 copy is not silently imported over D1.
- Node validates full checkpoints; the short-lived Worker checks authenticated
  bounded summaries and compressed checksums without inflating the full record
  set. Small legacy fixtures remain supported under a strict decompression cap.
- API retries include jitter and preserve conditional writes. A lost successful
  PUT is reconciled by exact stored checksum rather than blindly overwritten.
- Full/changed discovery, fiscal, detail and evidence request counts are recorded
  separately for subsequent maintenance and rollout measurements.

Pending gates, not claimed complete:
- Deployed D1/R2 audit and FA4800 full independent comparison.
- End-to-end cumulative request/active-minute/elapsed-minute/compressed-byte
  metrics per 1,000 awards; include retries rather than just the last batch.
- FY25 ranking acquisition/validation, seed execution and first-request warming.
- Cloudflare Access installation and unauthenticated-route verification.
- Action-date delta plus weekly rediscovery proposal after measured rollout.

The existing source filters, parser, retries, pacing, live session cache and
CSV headers remain unchanged. New ingest limits live in CONFIG.
