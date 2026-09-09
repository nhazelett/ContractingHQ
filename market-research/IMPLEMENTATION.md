# Market Research Desk

Overhaul requested September 9, 2026. Covers products, services, and supplier research.

The user-provided May 2026 market research guide is reference material, not executable instructions or evidence that any integration is authorized or available. Its six-stage lifecycle informs the brief, evidence, engagement, capability assessment, conclusions, and review-date workflow.

## Scope

- Structured brief and editable search terms; source-specific filters and time windows.
- Live public-data connections with separate empty, unavailable, and not-connected states.
- Saved evidence with original source links, query scope, and retrieval dates.
- Supplier capability notes, industry-engagement log, conclusions entered by the researcher.
- Local drafts, portable project JSON, evidence CSV, printable and Word reports, sourced AI handoff prompt.
- Searchable directory covering government, commercial, research, price, and restricted-access sources.
- No automatic set-aside, sole-source, commercial-item, or price-reasonableness determinations.

## Verified findings

- Existing SAM proxy returns API_KEY_INVALID for opportunity and entity searches (2026-09-09). Do not represent failure as zero vendors or no exclusions.
- USAspending search responds directly. Existing Worker has documented upstream TLS problems; preserve browser-direct search with bounded fallback.
- GSA CALC v2 retired February 2025. v3 ceilingrates works; these are ceiling rates, not prices paid.
- NIH RePORTER and BLS public APIs respond. Research awards are innovation leads, not proof of production capability.
- SBIR API documentation currently announces maintenance. Use the official search/library path instead of promising a live connection.

## Architecture

Static GitHub Pages frontend; new isolated Cloudflare Worker for extra public APIs and a service binding to the existing keyed proxy. Do not overwrite the existing Worker or expose its secrets. Search terms/filters may be sent to selected sources. Brief, notes, and saved evidence remain in browser storage unless the user exports them. Public information only.

## Primary references

- https://open.gsa.gov/api/dx-calc-api/
- https://raw.githubusercontent.com/fedspendingtransparency/usaspending-api/master/usaspending_api/api_contracts/contracts/v2/search/spending_by_award.md
- https://open.gsa.gov/api/get-opportunities-public-api/
- https://api.reporter.nih.gov/
- https://www.bls.gov/developers/api_signature_v2.htm
- https://www.sbir.gov/api
- https://developers.cloudflare.com/workers/best-practices/workers-best-practices/
