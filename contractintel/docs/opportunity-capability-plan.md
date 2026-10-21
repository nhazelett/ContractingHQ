# ContractIntel: opportunity capability plan

Research date: 2026-10-21. This is a delivery plan, not a claim that the features below are deployed.

## Direction

Build an opportunity discovery and research workflow around the existing office portfolio. Prioritize federal opportunity discovery, then tracking and capture, then broader intelligence and sources. State/local remains a later phase, as previously requested. Match useful workflows rather than HigherGov's visual layout or every adjacent product category.

The first usable release should let someone answer: What is the requirement? Is it relevant to me? When do I need to act? What changed? What evidence supports the answer?

## Evidence and current baseline

HigherGov's public documentation describes advanced federal notice filtering, opportunity details with documents and related notices, favorites, no-bid suppression, saved searches, notifications, and pursuit workflows. It also covers multiple federal sources, forecasts, awards, companies, buyers, vehicles, pricing, and state/local procurement. Public marketing and help pages establish advertised capability; the authenticated product has not been audited end-to-end.

ContractIntel currently provides office selection, USAspending portfolio loading, fiscal totals, date classification, end-date filtering, descriptions, set-aside analysis, transaction evidence, CSV export, and tab/deep-link navigation. It does not currently provide a posted-opportunity index, durable notice history, saved-search alerts, or user capture workspaces.

The deployed Worker has no D1 or R2 binding. Existing historical ingestion code and retained storage are not a live opportunity service. The repository contains a SAM probe workflow using the `SAM_API_KEY` secret, and its README records a successful access probe on 2026-10-20. That is not verification of today's entitlement, quota, or ongoing operational readiness. Revalidate with a bounded request before enabling ingestion; do not request or display a replacement credential unnecessarily.

## Capability mapping

| Capability | Current ContractIntel | Next implementation |
| --- | --- | --- |
| Federal posted opportunities | Not present | SAM notice ingestion, search, and details |
| Advanced filters | Loaded office-award filters | Agency/office, keyword, NAICS, PSC, set-aside, location, notice type, posted date, due date, source status |
| Notice detail and documents | Award transactions and source links | Notice description, contacts, attachments, source link, source-check timestamp |
| Favorites and no-bid | Not present | Personal saved items and reversible no-bid exclusion |
| Saved searches | Not present | Named filter state, reopening, updating, and shareable query links |
| Change tracking and alerts | Not present | Durable observed versions, deadline/document changes, opt-in digests |
| Capture pipeline | Not present | Stages, notes, next action, owner, bid/no-bid rationale |
| Incumbent and office intelligence | Office award portfolio | Evidence-backed related awards, vendors, buying history and likely incumbent candidates |
| Forecasts and potential recompetes | Date-derived recompete candidates | Separate forecast records and confidence-labelled notice/award associations |
| DIBBS, vehicles and other federal feeds | Not present | Source-specific adapters after the SAM workflow works |
| State/local opportunities | Deferred | Source registry, jurisdiction adapters, coverage reporting and deduplication |
| Labor pricing, grants, M&A, broad people data | Not present | Separate future product decisions; outside the initial opportunities target |

## Delivery sequence

### 1. Federal discovery and details

Create an Opportunities workspace alongside the existing Portfolio workspace. Preserve portfolio tabs and the office picker. Opportunities should allow searching the selected office or a broader federal scope; the selected office must not silently constrain a national search. Map notices through reported organization hierarchy rather than inferring their office from solicitation numbers.

Use a description/title-led table with deadline, agency/office, notice type, set-aside, NAICS/PSC, place of performance, and posting date. Keep identifiers visible as secondary metadata. Detail view shows the full description, official documents, contacts, source status, reported deadline and source links. Clicking back retains filters and position. Support CSV and shareable search URLs.

Quick views: active-source solicitations, sources sought/presolicitations, deadlines within 7/30 days, deadlines requiring review, saved items. Award notices, forecasts and inferred recompetes must remain distinguishable from solicitations. A future deadline alone does not establish that an opportunity is open or that a user is eligible.

Build keyword phrase/include/exclude and structured filters against our own index. The SAM API's title parameter is not equivalent to searching full descriptions or attachment contents. Do not label title-only upstream queries as full-text search. Document-content search is a separate ingestion step after reliable description indexing.

Definition of done:

- Real SAM records work for FA4800 and at least one other office, plus a broader agency search.
- Filters operate on the indexed dataset, with published scope and coverage, rather than only the visible page.
- Every page reports last successful source check and any partial refresh/backfill.
- Unknown deadlines, unknown source status and date/time-zone uncertainty remain visible.
- Source failure retains the last validated index; errors cannot replace it with an empty successful dataset.
- Pagination, duplicate notices, cancellations, missing descriptions and source rate limits are tested.
- Existing portfolio loaders and CSV behavior pass regression checks.

### 2. Saved work and change tracking

Add named searches, favorites and reversible no-bid labels, followed by a private user workspace for cross-device persistence and alerts. A browser-only pilot may save locally, but must say so and cannot be described as a shared account or an alert service.

Store immutable observed notice versions. Show field-level differences for deadline, status, set-aside, title and requirement text; use attachment manifests/content fingerprints for changed documents, not merely attachment counts. A notice fetched twice with identical content must not generate two alerts.

Add opt-in notification frequency, unsubscribe, last evaluation time and delivery state. Email delivery requires authenticated ownership, verified destination, scheduled evaluation, deduplication and an actual email service. No background notifications are enabled by this plan. No messages are sent while building the feature.

SAM's search API supplies the latest version; it does not retrospectively provide every amendment. Label our timeline as observed history beginning at first capture. Recover earlier history only from an appropriate official history/data source and identify its provenance.

### 3. Opportunity-to-award intelligence

Connect a notice to related office awards and likely incumbents using identifiers when available, then transparent agency/office, requirement, classification, place and date evidence. Distinguish confirmed source links from candidate matches. Show ambiguous candidates rather than silently choosing a winner. Do not treat a passed PoP as a confirmed solicitation, award, closeout or recompete.

Add vendor profiles, office buying patterns, awardee concentration, set-aside history, and relevant prior requirements. Historical set-aside use is not evidence of present vendor eligibility. An incumbent's possible ineligibility needs current certification/size evidence, not an inference from an older award or a graduation date alone.

### 4. Capture workflow

Create a simple pipeline: discovered, researching, bid decision, preparing response, submitted, won/lost/no-bid. Include notes, next-action date, owner and supporting evidence. Let users work from a table or board. Keep team roles and shared work private; anonymous visitors must never see another user's capture notes.

### 5. Broader coverage

Add agency forecasts, DIBBS and selected vehicle integrations based on demand and official access. Each adapter needs coverage, update cadence and document-access rules. Then implement state/local as a source-adapter program, with a small set of jurisdictions proven before promising nationwide coverage. There is no single state/local feed equivalent to a national SAM notice source.

## Data and service design

Retain the current vanilla JS presentation and read-only public award path. Introduce opportunity ingestion and search as a separate service boundary. Do not retrofit opportunity semantics into the award register or restart the USAspending scan when switching workspaces.

Recommended starting components: normalized notice records, immutable raw/observed snapshots, a persistent metadata/full-text index, read APIs, and refresh jobs. Cloudflare D1 supports FTS5 and is a candidate for initial search; R2 is a candidate for raw snapshots and permitted document content. Measure the expected volume, reads, writes, retention and existing capacity before choosing bindings or enabling schedules. Existing legacy tables must not be repurposed without a migration and recovery plan.

The upstream SAM key stays in server/ingestion secrets. User browsing should query a shared index; the browser must not receive the key, credential-bearing description URLs or upstream authenticated request URLs. Reuse the existing GitHub secret where appropriate. Do not change secret access or infrastructure permissions merely to simplify implementation.

Public index fields include source plus source notice ID; title; solicitation number; type; reported agency/office hierarchy; NAICS/PSC; set-aside code and description; location; source active flag; posting date; response deadline with original precision/timezone; separately retrieved description text; public source link; source-check time; and coverage/version metadata. Description URLs returned by SAM are references, not requirement prose.

Separate private workspace data from public source records. Saved searches need a versioned filter schema so they can be replayed exactly and evaluated by the alert worker later.

Refresh checkpoints must track requested scope, date windows, pages completed, source response count, quota usage and last validated publication. SAM requires posted-date windows (maximum one year per query) and pagination. A recent-posting window can miss older still-relevant notices, so coverage/backfill must be explicit. Do not claim a complete inventory after reading the first page or a recent date window.

Start with a measured, bounded refresh and record the entitlement returned/confirmed for this account. Set a request budget, retry/backoff behavior and stop conditions before scheduling. Exact freshness promises depend on source updates, our budget and coverage. Older notices need rechecking, not only searches for newly posted notices. Shared refreshes and retaining the previous validated index avoid multiplying source calls per visitor.

## Differentiators to pursue

- Requirement-first discovery connected directly to the office portfolio.
- A concise explanation of why an opportunity matched the user's filters.
- A visible distinction between a posted notice, an agency forecast, a confirmed related award and an inferred recompete signal.
- A change summary that answers what the user needs to review now, with links to the evidence.
- Clear coverage and timestamps without making the main view a wall of caveats.
- Citation-backed document extraction and bid requirements later; estimates, generated summaries and source facts remain separately labelled.

These are intended advantages to validate with users, not claims that ContractIntel already outperforms HigherGov.

## Work completed in this increment

`opportunities/notice.mjs` establishes a source-qualified notice model, reported office mapping, deadline precision/timezone handling, credential-free public source URLs, and observed metadata comparison. Its tests use synthetic records and make no live SAM requests. It is not imported by the live application and does not provision storage, change loading behavior, activate schedules or create a new public tab.

Next implementation slice: bounded SAM source revalidation and ingestion checkpointing, followed by the indexed read API and first Opportunities table. Only release the workspace once it works with real records and accurately displays its coverage.

## Primary references

- HigherGov federal discovery and filters: https://docs.highergov.com/find-opportunities/federal-contracts
- Search behavior: https://docs.highergov.com/highergov-basics/search-basics
- Saved searches and alerts: https://docs.highergov.com/highergov-basics/saved-searches-and-alerts
- Favorites, tracking, no-bid: https://docs.highergov.com/highergov-basics/favoriting-tracking-and-no-bidding
- Awards and incumbents: https://docs.highergov.com/market-intelligence/find-and-analyze-federal-contracts
- Forecasts and recompetes: https://docs.highergov.com/find-opportunities/forecasted-opportunities-and-expiring-awards
- State/local coverage: https://www.highergov.com/state-local/
- Broader product scope: https://www.highergov.com/market-intelligence/
- GSA SAM public opportunities API: https://open.gsa.gov/api/get-opportunities-public-api/
- Cloudflare D1 SQL capabilities: https://developers.cloudflare.com/d1/sql-api/sql-statements/
- Cloudflare scheduled execution: https://developers.cloudflare.com/workers/configuration/cron-triggers/
