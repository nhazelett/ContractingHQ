# Market Research Tool — Improvement Log

## CHANGELOG

| Cycle | Change | Score before → after | Test result |
|---|---|---|---|
| 0 | Baseline audit. PROXY_BASE was already set and the worker IS live; real blocker was USAspending 525 from the worker + unkeyed USPTO/OpenCorporates. | 1 full / 4 partial / 4 zero | 6 of 9 sources verified live via worker; USAspending dead |
| 1 | USAspending fetched directly from the browser (keyless, CORS confirmed via `CORS_ORIGIN_ALLOW_ALL=True` in usaspending-api source); worker kept as fallback with 3x retry. Fixed field names to current API contract ('Start Date'/'End Date'/'NAICS'/'PSC'). | Item 1: 0 → full* | api.usaspending.gov confirmed reachable from non-worker clients (live GET on awards endpoint); request shape verified against API contract; render gate pending (Chrome unavailable) |
| 2 | Small Business Landscape panel: parallel `recipient_type_names` queries (small_business + 8(a)/HUBZone/WOSB/SDVOSB), distinct-vendor aggregation, explicit color-coded FAR 19.104-1 rule-of-two verdict on screen and in memo. | Items 2, 3: partial/0 → full* | Aggregation, dedup, category counts, and all three verdict branches pass fixture tests in Node |
| 3 | Codes & Size Standard summary strip: dominant NAICS/PSC detection from awards, SBA size standard lookup (api.sba.gov direct → new worker `/reference/size-standards` fallback → honest "unavailable" state), memo section. | Item 4: partial → full* | Normalizer handles 3 response shapes in tests; SBA API shape unverifiable from this session — flagged for post-deploy check |
| 4 | Existing Vehicles panel: IDV_* type-code query against USAspending; holder, ceiling, last-date-to-order; memo lines. | Item 6: partial → full* | Same verified endpoint/contract as spend; render gate pending |
| 5 | Commercial availability signal: samples top 8 awards' `/api/v2/awards/{id}/` details, computes % acquired under commercial item procedures + avg offers + set-aside share; explicit statement in summary strip and memo. | Item 5: 0 → full* | Live GET on awards detail endpoint confirmed exact field names; parser passes real-fixture test |
| 6 | Memo determination auto-drafted from findings (purchase history, rule of two, commercial signal, vehicles, exclusions negative finding), CO review note, FAR Part 10 line, signature blocks. Federal Register switched to relevance ranking (browser-direct + worker). | Items 8, 9: partial → full* | Sample memo generated end-to-end through the same code path (docx 8.5.0); determination text reviewed |

\* pending the one thing this session could not do: render the page in a browser. See TEST GATE below.

## Final rubric scorecard

| # | Item | Score | How the tool answers it |
|---|---|---|---|
| 1 | Spend history: who/how much/period/vehicles | Full* | Spend panel (top 25 by $, agency, NAICS/PSC, PoP, links) + determination paragraph with totals and agency list |
| 2 | Sources + size/socioeconomic status | Full* | Small Business Landscape: distinct small firms w/ dollars + 8(a)/HUBZone/WOSB/SDVOSB counts; SAM entity panel for registration |
| 3 | Rule of two stated explicitly | Full* | Color-coded POSITIVE/WEAK/NONE verdict citing FAR 19.104-1, on screen and as memo language |
| 4 | NAICS/PSC + SBA size standard | Full* | Summary strip + memo: dominant or user NAICS, title, size standard (13 CFR 121.201; FAR 19.102); honest fallback link if lookup fails |
| 5 | Commercial availability signal | Full* | % of sampled awards under commercial item procedures (FPDS), strong/mixed/weak reading |
| 6 | Opportunities + vehicles | Full* | SAM opps panel (live-verified) + Existing Vehicles IDV panel |
| 7 | Exclusion/integrity flags | Full | SAM exclusions live-verified; negative finding now stated explicitly in memo (FAR 9.404) |
| 8 | Capability/IP/regulatory/market context | Partial | FR now relevance-ranked (browser-direct); news live; patents still needs free PatentsView key (deploy step) |
| 9 | Signable memo | Full* | Data-derived determination paragraphs, sources-consulted with counts, signature blocks; sample generated end-to-end |

## TEST GATE — what still needs a browser (5 minutes, Nick)

Chrome extension was not connected this session, so the three-keyword render test could not be executed. Everything testable without a browser was tested (live worker routes, live USAspending GET endpoints, request shapes against API contracts, all new logic against fixtures in Node). To close the gate, open the updated `market-research-tool.html` (locally or after pushing) and run:

1. `facilities support services` — expect spend panel populated (no more 525), rule-of-two verdict, summary strip with NAICS 561210 + size standard, vehicles panel, commercial signal line.
2. `Palantir` — expect SAM entities (4 registrations), spend history, zero exclusions, news.
3. `generators` + NAICS `335312` — expect NAICS-filtered spend, size standard shown in employees (not receipts), rule-of-two verdict.
4. Click Memo on any of them and skim the Determination section.

If the SBA size standard line says "lookup unavailable" before the worker redeploy, that's the expected fallback; if it still says it after redeploy, check `/reference/size-standards` per the worker README.

## Deploy steps still owed (Nick)

1. Push to GitHub: `market-research-tool.html` (drag-and-drop). This alone revives the tool — all critical fixes are frontend.
2. Redeploy the worker (`wrangler deploy` from `market-research-worker/`) for the size-standards fallback route, FR relevance fallback, and 525 retry. Steps in `market-research-worker/README.md`.
3. Optional: `wrangler secret put USPTO_KEY` (free key from patentsview.org) to light up the Patents panel.
4. Optional: OpenCorporates key (paid) — see "did not build" below before bothering.

## Did NOT build, and why

- **OpenCorporates integration effort** — paid API, 200 req/mo free tier, and corporate-registry data doesn't change any FAR Part 10 conclusion a CO signs. GLEIF + SAM entity already cover identity. Not worth a key.
- **More sources (FPDS ATOM, GSA eLibrary scrape, DSBS scrape)** — the rubric was reachable from USAspending + SAM alone; each of these adds fragility (XML scraping, no API) without changing what the CO can conclude. Rule-of-two evidence already comes from FPDS via USAspending.
- **Charts/visualizations of spend** — decision-clarity lives in the verdict sentences and the memo, not in a bar chart. Skipped.
- **Multi-year date range picker** — SAM caps at 1 year; a mixed-window UI invites inconsistent memos. The 12-month window is stated on screen and in the memo instead.
- **Embedded static SBA size-standards table** — my training-data numbers could be stale (SBA revised in 2024, proposed increases Aug 2025); shipping wrong size standards in a signable memo is worse than an honest "lookup unavailable" fallback. Live lookup + worker cache instead.
- **GLEIF noise filtering** — fuzzy foreign matches are visible but harmless; tightening the filter risks hiding real subsidiaries. Left as-is.

## Architecture note

Single-file HTML + Cloudflare Worker/KV preserved. New pattern introduced: keyless CORS-open APIs (USAspending, Federal Register, SBA) are called directly from the browser with the worker as fallback; keyed APIs (SAM, NewsAPI, OpenCorporates, PatentsView) stay worker-only. This is what fixed the 525 and it removes the worker as a single point of failure for the tool's core data.
