# KTHQ Market Research Desk

A static research workspace for products, services, and named suppliers, with a small Cloudflare source gateway. The May 2026 market-research guide supplied by the site owner informed the workflow; it is reference material, not executable instructions or a substitute for current acquisition policy.

## Workflow and coverage

- Define mission need, outcomes, research objectives, constraints, scale, and acquisition context.
- Search selected sources independently with bounded requests, cancellation, source coverage notes, paging, and visible connection errors.
- Keep evidence with stable citation IDs, original URLs, retrieval timestamps, record dates, search scope, excerpts, and verification notes.
- Assess supplier capability by UEI when available; name-only groups remain unverified leads.
- Record industry engagement and write researcher conclusions about commercial alternatives, competition, vehicles, pricing, risks, and next steps.
- Export/import a project JSON file, export evidence CSV, and create Word, text, or print-preview reports. The AI prompt contains saved evidence and notes only; KTHQ does not call a generative model.

There are 15 search adapters and 42 additional library entries (57 research routes, not 57 independently connected data feeds). Library entries include commercial catalogs, manufacturer discovery, required sources, small-business research, wage/rate tools, vehicles, innovation, industrial-base resources, and authorized-access systems. Access labels are distinct from search availability.

The selected date window is source-specific. USAspending applies its award search filter; returned performance or ordering dates may extend outside that window. SAM notices are limited to 360 days. CALC+ does not inherit award dates or location filters. NIH projects and CPI observations use their own coverage, stated beside results.

Award amounts are not unit prices, CALC+ ceilings are not prices paid, and historical small-business tags do not establish current certification. The workspace makes no automatic rule-of-two, commerciality, responsibility, or exclusion-clearance determinations.

## Connection status verified September 9 2026

- USAspending: real browser searches returned awards, small-business award history, and IDV records. Direct browser requests are primary because the legacy Worker path has intermittent upstream TLS/timeout issues. Slow or failed responses remain visible and independently retryable.
- GSA CALC+ v3: live records verified, including labor category, vendor, ceiling rate, experience, education, worksite, and contract.
- GLEIF: live legal-entity records verified; full-text results can include related names and financial funds, so identity review is necessary.
- NIH RePORTER: live project records, organization, UEI, abstract, funding, and dates verified.
- BLS: live browser CPI-U observations verified. Missing observations remain missing, not zero.
- SAM opportunities, entity registration, and exclusions: the existing legacy SAM credential returns API_KEY_INVALID. Results explicitly show unavailable, with official-search links. Renew SAM_KEY on the existing kthq-market-research Worker; never put the key in site files.
- NewsAPI: existing connection returned live news; optional because relevance varies.
- Brave commercial web search, PatentsView, and OpenCorporates: optional connections, not assumed available. The library and manual evidence capture work without them. No subscription was purchased.

## Development

From the repository root, serve the static site with `python -m http.server 8766 --bind 127.0.0.1`, then open `/market-research-tool.html`. Run `node --test tests/market-research.test.mjs`.

The shared source definitions and normalizers are in `sources.mjs` and `core.mjs`. The UI is `desk.mjs` / `desk.css`; `report.mjs` builds Word documents. The local docx 8.5.0 bundle retains its upstream MIT license.

For the gateway, run `npm ci` in `market-research-backend`, then `npm run check` or `npm run deploy`. The configured Worker is `kthq-research-desk`; it uses a service binding to the existing `kthq-market-research` Worker without replacing its code or secrets. Optional commercial search can be connected with `wrangler secret put BRAVE_API_KEY` in the backend directory after obtaining an appropriately licensed account. Generated types can be refreshed with `wrangler types` and are not committed.

The gateway only accepts known sources and search parameters, bounds source responses to 3 MB, times out upstream requests, rate-limits clients, caches successful public results for 10 minutes, sanitizes errors, and accepts browser origins for KTHQ and local development. It does not receive project notes or evidence files. Operational logs contain source ID and status, not keys or search content. Static hosting is the repository's existing GitHub Pages deployment.

## Verification

Automated tests cover filter semantics, invalid dates/codes, source authentication failures, malformed responses, missing prices, source URLs, citation stability, project import, supplier grouping, report coverage, CSV formula handling, response limits, CORS, rate limiting, optional credentials, and prototype-property source rejection.

Browser checks covered product, service, supplier, and CPI searches; independent source failures; cancellation; evidence capture and notes; supplier assessment; engagement; report preview; Word generation; local reload persistence; JSON import; stable citation gaps; and a 390-pixel mobile layout without horizontal page overflow.

The shared Word builder produced a valid DOCX package whose XML, citations, source status, and external hyperlinks were checked. Browser Word generation completed without console errors. In-app browser download events were not exposed, and the packaged visual Word renderer could not run because LibreOffice is absent on this machine; no Word page-render validation is claimed. The browser report preview was checked.

## Data and recovery

Research files are local to a browser/device and are not cloud-synced. Use Export project for backups and Open project to restore them. A project supports 300 evidence records, 100 engagement entries, and the latest 100 search runs. Search result pages are limited to five per source; refine the query for targeted coverage. Previously saved evidence retains its original retrieval context when a later search runs.

To roll back the frontend, revert the overhaul commit through Git. The new Worker is separate from the legacy service; the old gateway and credentials remain available. Never deploy the historical local Worker snapshot over the live legacy Worker without reviewing its current code and bindings.
