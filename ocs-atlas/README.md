# OCS Supplier Atlas

Public-source supplier discovery for contracting officers. The country dossier describes the operating environment; the atlas connects suppliers to recorded country experience, capabilities, and public buyers. Created September 24, 2026.

## Run and review

From the repository root:

```sh
node scripts/ocs-server.mjs
```

Open `http://127.0.0.1:8897/ocs-supplier-atlas.html`. Use an HTTP server, not `file://`, because the page loads local data and modules. No build or package installation is required. The atlas uses a full navigation from the tools hub, because the site's soft navigation does not initialize this module as a new session.

## Working features

- World country/territory selector and interactive MapLibre map, with OpenFreeMap basemap.
- USAspending prime contracts, reported contract subawards, and country-filtered IDVs. Each source has independent loading, empty, failure, snapshot, and pagination states.
- All federal buyers including DoD, DoD-only, and civilian-only. Civilian records are filtered after page retrieval and can require more pages to find matches.
- Country **place of performance** filter, keyword, NAICS, PSC, and dates; recipient country is a separate attribute. Territories use the existing dossier's USA/state mapping.
- Optional worldwide contract-obligation map. Same dates, keyword, NAICS, PSC, and all-buyer/DoD scope, without the selected-country restriction. Gold circles represent positive net obligations; this is separate from supplier counts. Not offered for civilian-only scope.
- Recipient origin, reported prime/sub relationships, buyers, capability codes, record recency, repeated suppliers, and coverage gaps.
- Exact UEI joins. No fuzzy cross-source company merging or inherited subsidiary experience. Conflicting country addresses stay unknown. Recognized generic awardee labels are excluded from company leads but retained in source record counts.
- Supplier evidence panels, possible GLEIF identity matches, source links, locally saved shortlists, visible-evidence CSV and shortlist JSON exports.
- Live public SAM discovery through a local credential gateway, exact-UEI registration profiles, and PUBLIC snapshot ingestion.
- Country dossier link with selected country, plus a tools-hub entry.

The initial Saudi seed is an actual, bounded public API pull, not illustrative supplier data. The seed contains the query and retrieval timestamp. In the first pull, the 100 prime-award rows included State and DoD; the selected subcontract and IDV queries returned no records. Empty results are not evidence of no subcontracting, no applicable vehicles, or no local market. Use Explore country for current data and additional pages for broader coverage.

## Model and interpretation

1. Keep registration address, reported work location, and search country distinct. A query match is not a substitute for a missing reported location.
2. Supplier circles use country-level aggregates. Lines illustrate origin-to-research-country relationships, not routes. Separate logistics markers use reported public-directory coordinates. No installation-access inventory, personnel, operational feeds, or access inference is collected or generated.
3. Retain source identifiers, query scope, retrieval dates, record dates, descriptions, and URLs. API search links are labeled as search links when a direct subaward URL is unavailable.
4. Source date filters do not mean all displayed performance dates are within the chosen range. Counts reflect loaded records. More pages may change patterns. Deduplicate repeated records; preserve distinct subaward parent relationships.
5. Keep prime, subcontract, and vehicle amounts separate. An award is not proof of successful completion, current capacity, contracting eligibility, or permission to enter an installation.
6. A missing UEI, geocode, source, or record is explicitly unknown. Registration status is not inferred from an award's recipient UEI.
7. Source content is escaped, external URLs are constrained, and spreadsheet exports guard formula-like text.

## SAM connection

The atlas now has a local public SAM gateway. Store a **public API key** outside the project in `%LOCALAPPDATA%/KTHQ/ocs/sam-public-key.txt`, or supply `SAM_API_KEY` to the local server process. `SAM_PUBLIC_KEY_FILE` can select another file outside the web root. Never put the key into the webpage, a URL, chat, or a committed file. The gateway reads the file on demand; use Check connection after saving it.

For a small, explicitly bounded country pull using a locally configured public-data key:

```sh
node scripts/ocs-sam-public.mjs --country SAU --pages 1
```

The script reads `SAM_API_KEY` from the environment and requests only registration, core data, and assertions. Use a public-data key. The converter additionally requires the public-display flag and copies only an allowlist of business identity, country/city, status, and classification fields. It never saves the credential or raw API response. SAM limits synchronous responses to 10 rows per page; account-specific daily quotas apply. A one-page pull is deliberately not a full supplier census.

To normalize an official PUBLIC Entity API JSON export obtained separately:

```sh
node scripts/ocs-sam-public.mjs --public-json /path/SAM_PUBLIC_entities.json --as-of 2026-09-24
```

This accepts Entity API JSON, not the differently structured monthly ZIP/delimited extract. Do not rename restricted exports to satisfy the filename check. Unmarked or non-public-display entities are skipped. Files are written under `ocs-atlas/data/sam/`, partitioned by country. A metadata manifest lists available countries. Snapshots may also be loaded in the Sources & coverage panel for the current browser session. Date-window and federal-buyer filters do not filter SAM registrations. Imported snapshot completeness remains unverified unless established by the acquisition process.

**Next ingestion milestone:** implement the documented monthly PUBLIC extract download/layout, reconcile removals and expired registrations, record full/delta completeness, and schedule refreshes after a functioning public-data connection is available. Do not substitute paged searches for a claimed complete global inventory.

## Refresh the preview data

```sh
node scripts/ocs-refresh-seed.mjs
node --test tests/ocs-atlas.test.mjs
```

The seed refresh requests one 100-row page per award layer and preserves the previous seed if prime retrieval fails. It is manual; no recurring job or public deployment has been created.

## Additional source backlog

| Source / layer | Evidence sought | Gate before integration |
| --- | --- | --- |
| SAM monthly PUBLIC extract | Global registered supplier catalog, status and capability changes | Working key, actual format validation, completeness and removal reconciliation |
| Etimad Open Data API | Saudi supplier-to-host-government award relationships | Production endpoint, dataset IDs, named supplier fields and reuse terms |
| TED / UK Find a Tender | Other-government contract awards and supplier experience | Source-specific classifications, coverage, IDs, and pagination |
| World Bank IPF awards | Supplier, borrower country, project and award history | Validate current API and exact supplier matching |
| SAM exclusions / ITA CSL | Dated official screening records and possible identity matches | Keys, exact identity resolution, source-specific restriction semantics |
| Parent IDVs linked from country awards | Vehicles used by orders in the selected country | Award-detail and parent linkage adapter; do not infer orderability |
| GLEIF relationships | Reported accounting parent relationships | Match exact identifiers first; distinguish legal entity, branch, subsidiary and parent |
| Additional logistics context | Terminal-level port data, industrial areas, customs and road/rail networks | Validate public sources, status meanings, reuse rights and granularity |

Etimad Contracts Plus is documented but paid and marketed to financial services. It is excluded from the public-only baseline pending access/reuse validation. The source directory distinguishes external research links from integrated feeds.

## Foundry / Envision handoff

Keep the data model independent of the map: `Supplier`, `Identifier`, `RegistrationSnapshot`, `Award`, `ReportedSubaward`, `Buyer`, `Country`, `SourceRecord`, `ResearchQuery`, `SourceCoverage`, `LogisticsFacility`, `LogisticsSnapshot`, `TransportFeature`, `TransportExtract`, and `ResearchPacket`. A source record retains its original identifier, timestamps, query, and source URL. Supplier-to-award links use exact UEI where available; unresolved names stay separate. A parent relation never transfers award history or approvals to subsidiaries.

These entities can become Foundry object types and links, with transformations preserving source lineage and Workshop providing the map, supplier table, and evidence panel. Available connectors, egress, and map features depend on the Envision deployment. This prototype does not assume access to any restricted dataset.

## Primary references and dependencies

- [USAspending award API](https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/contracts/v2/search/spending_by_award.md)
- [USAspending geographic API](https://github.com/fedspendingtransparency/usaspending-api/blob/master/usaspending_api/api_contracts/contracts/v2/search/spending_by_geography.md)
- [USAspending source disclosures](https://www.usaspending.gov/data/about-the-data-download.pdf)
- [SAM Entity API](https://open.gsa.gov/api/entity-api/) and [public extracts](https://open.gsa.gov/api/sam-entity-extracts-api/)
- [GLEIF API](https://www.gleif.org/en/lei-data/gleif-api)
- [Etimad Open Data API guide](https://portal.etimad.sa/getattachment/7b1b7823-1fe8-41bb-8b07-334ce5306ce8/opendata-api-igOpenData-API-IG.pdf?disposition=attachment)
- [Foundry Workshop map](https://www.palantir.com/docs/foundry/workshop/widgets-map)
- MapLibre GL JS **5.6.2**, vendored from the npm distribution with license in `vendor/`. [MapLibre](https://maplibre.org/).
- [OpenFreeMap](https://openfreemap.org/) Positron tiles; attribution is displayed by the map. Basemap/font availability is independent of award-source availability.
- Country metadata adapted from [mledoze/countries](https://github.com/mledoze/countries), retrieved September 24, 2026; ODbL license in `data/countries-LICENSE.txt`. Country points are illustrative country positions, not geocoded vendor sites. This adapted country dataset remains available under ODbL.

Additional source access and production publication are outstanding connection/release tasks; public SAM is connected locally. The atlas is a working local prototype with explicit coverage gaps.

## Verification — September 24, 2026

- 15 automated checks passed for source queries, identity joins, geography, reporting gaps, monetary separation, exports, and public-only normalization.
- Live Saudi all-buyer and DoD-only prime searches succeeded. The initial all-buyer seed yields 38 company leads from 100 source rows after excluding a generic recipient representing 11 rows; supplier addresses cover six countries.
- Positive-result U.S. subaward and vehicle requests both returned HTTP 200 and normalized successfully. Saudi empty results remain explicitly empty for that query.
- Worldwide all-buyer activity returned 218 country aggregates in the browser. A separate DoD query returned 187 country aggregates. Counts are source responses for the chosen window, not a count of sovereign states.
- Browser checks covered map rendering, source evidence, DoD filtering, GLEIF possible matches, shortlist persistence/removal, export preview with original query context, pattern views, and a 390-pixel mobile viewport. No browser console errors were observed during these checks.
- The preview browser did not expose a download event to the test harness. Export serialization and the visible export contents were verified; download and copy actions are available from the export preview.

## Expanded research and logistics — September 24, 2026

- Airfield layer: 86,126 OurAirports directory entries, all with coordinates in this pull. Default types are large, medium and small airports. Type controls include heliports, seaplane bases, closed airports and the full directory. Longest reported non-closed runway, surface, codes and scheduled airline service are source attributes, not capacity determinations.
- Port layer: 17,527 distinct UN/LOCODE maritime locations; 11,737 mapped, 5,790 retained without coordinates. The public pre-release is labeled explicitly. Locations may identify towns/port areas; not an exhaustive terminal inventory. Status and original source dates remain visible. Full source rights, limits and transformations are in `data/logistics/SOURCES.md`.
- Logistics loads on demand, clusters worldwide points, supports selected-country/worldwide scope and name/code search, and exports filtered records with source metadata. It does not join logistics proximity to supplier country centroids or imply transport routes. Data are static snapshots and award filters do not filter facilities.
- Refresh logistics manually: `python scripts/ocs-refresh-logistics.py`. No key required; published machine-readable files are used. No recurring refresh has been scheduled.
- Bulk award history loads up to ten additional 100-record pages per enabled source, stops at completion/error, supports stop/resume, and preserves completed pages. Large pulls remain bounded; another click continues. The current query is cached in memory; the most recent successful query is also saved in browser storage where available. Restore is explicit and dated. Explore country starts a fresh query from page one.
- Company profiles summarize reported work countries, buyers, classifications, dates and gaps. Worldwide prime-award history searches by UEI, removes country/capability filters, preserves dates/buyer scope, and checks returned UEI exactly before joining. Pagination is explicit. An API date-window match may include awards with older start dates; this is not lifetime award history. Additional evidence remains outside country results and must be saved/updated to preserve it.
- Compare 2–4 shortlisted companies using saved evidence, query scopes, source counts, work countries, registration evidence and verification questions. Source links and complete JSON exports are included. No scoring or eligibility/access determination.
- Automated verification: 20 tests cover original source behavior plus logistics filtering, invalid coordinates, exact company identity, separate query scopes and complete bundled snapshot validation.

- Live expanded company-history test returned 67 exact-UEI prime awards across 15 reported work countries; saved comparison showed original query scopes and source links. A country-history pull resumed after a transient source failure, retained 1,100 records, and stopped after its current page. Test shortlist entries were removed.

- Final map QA verified worldwide directory counts, clickable logistics clusters, Saudi source details, missing-coordinate visibility, and a 390-pixel mobile layout. Cluster labels use a font from the active basemap; a default unavailable font had delayed rendering and was corrected. Facilities are grouped into world-pixel cells at broad zooms; close zooms show their original source coordinates.

## Requirements workspace and transport context

- Twelve OCS capability presets offer keyword and broad NAICS searches separately. Shortcuts replace keyword/NAICS/PSC together while retaining the selected country, dates and buyer scope. They are practitioner research recipes, not automated capability assessments or solicitation-code recommendations. Industry labels refer to the [2022 Census NAICS manual](https://www.census.gov/naics/reference_files_tools/2022_NAICS_Manual.pdf).
- OpenStreetMap transport context loads only on request for the current viewport. It includes motorway/trunk/primary/secondary roads and links, rail/narrow-gauge ways, and nodes tagged `barrier=border_control`. It excludes other road classes and border ways/relations; absence is not evidence of no network or crossing. These are mapped features, not routing, freight capacity, access or availability determinations.
- Choose a facility in the directory and use **Explore transport around this facility**, or zoom into the map and select **Load map area**. The queried rectangle remains outlined until replaced or the research country changes. Panning and layer toggles do not request additional data.
- Each query is limited to 2 degrees in each dimension, a 25-second source timeout, and 1,500 features. One extra result detects truncation; dense areas may return only a subset of feature types. Partial/error responses are rejected, the previous extract is retained and identified, and source HTTP 429/406 triggers a 30-second cooldown. Requests are sequential; the last three areas are cached in the session. Bounds, query, source base timestamp, retrieval timestamp, omitted invalid records and truncation accompany GeoJSON exports.
- Attribution: [OpenStreetMap contributors, ODbL 1.0](https://www.openstreetmap.org/copyright). Exported geometry remains under ODbL. Feature links identify the exact public map record. API: [Overpass](https://wiki.openstreetmap.org/wiki/Overpass_API); query semantics: [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL); [border-control tag](https://wiki.openstreetmap.org/wiki/Tag:barrier=border_control).
- The public Overpass endpoint is suitable for bounded manual prototype use. Before a shared release, provide a service-level usage budget and shared cache or a supported extract/hosting service; per-browser limits do not control aggregate traffic. No background/global network extraction has been scheduled.
- **Capture current search** freezes visible company evidence, query scope, view filters, source counts, pagination and errors. Up to 12 captures are saved in local browser storage, with an explicit 2,000-record cap per search. Capture is blocked while sources are loading. Storage failure leaves a session copy and requests an export. Source rows excluded as generic recipients remain represented in source coverage counts, not as supplier leads.
- **Preview research packet** combines those captures with the current shortlist, enabled logistics directories (up to 250 filtered records per kind), and the current transport extract. It produces a printable standalone HTML report and structured JSON companion. Evidence sections are open initially for printing. Logistics/transport are captured at packet preparation, independently of earlier award searches. Rerun restores the source query fields; original view filters and enabled sources remain documented in the capture. Direct source links, timestamps, scope and incomplete coverage accompany the evidence.
- This remains a local, unauthenticated prototype. Access controls are deferred to a separate pre-release task; this change does not publish the application.

Validation: `node --test tests/ocs-atlas.test.mjs tests/ocs-logistics-research.test.mjs tests/ocs-workspace.test.mjs`.

Workspace verification: 27 automated checks passed. Browser testing verified a successful Saudi communications query (50 source records, 47 company-evidence records, three supplier leads), timeout/retry handling, captured-search persistence and rerun, standalone report preview, and JSON contents. A Jeddah viewport returned 1,326 roads and 46 rail features; map source details, layer toggles, session cache and packet provenance were checked. A separate larger-area response reached the 1,501-result sentinel and confirmed truncation handling. Desktop and 390-pixel layouts were inspected. One successful public-data example capture remains in the preview browser; the failed test capture was removed.

## Readable transport evidence and independent panels

Road names and source references are displayed separately. A bare source `ref=60` appears as **Route 60**, and missing names read **name not recorded**. The packet explains references and source segments, groups road/rail records by matching name/reference/class without claiming route continuity, and keeps border-control points in their own section with source coordinates and reported operators. Every segment and its original attributes remain in JSON; grouped HTML retains individual source links. References follow the [OpenStreetMap ref definition](https://wiki.openstreetmap.org/wiki/Key:ref).

Above 760 pixels, research controls and map/results each have their own scroll area. The country/view controls stay at the top of the right pane, with a supplier shortcut and Map return action. Ordinary wheel scrolling passes through the map; cooperative map gestures require Ctrl/Command to zoom with the wheel. Smaller screens keep normal page scrolling. Keyboard users can focus either pane.

Verification: 29 tests pass, including legacy numeric road labels, missing names, preserved per-segment identity, separate checkpoint records, escaping and source links. A live Jeddah extract contained 961 segments, summarized into 72 label groups with individual records retained. Browser checks confirmed independent left/right scrolling, wheel scrolling over the map, Map return, and normal mobile flow at 390 pixels. No browser console errors were observed.

## Live public SAM discovery and saved research notes

The local server binds only to `127.0.0.1`, keeps the key outside the static site, and exposes same-origin status and search endpoints. It requests only entity registration, core data and assertions using a public key, requires public-display permission in each returned entity, excludes unknown or mismatched identities, and returns an allowlist of business fields. It does not retain raw SAM responses, source request URLs, credentials, banking, tax or personal-contact fields. This is a local connector, not a deployed authentication system.

Open **Find registered suppliers** in the left rail. Criteria are registered country, legal name, declared NAICS description, full six-digit NAICS, four-character PSC, and active/expired status. Supplied criteria are combined; award dates, buyers and award keywords do not apply. Results load ten source records per page. Displayed counts distinguish source matches from records omitted by public-display and identity checks. The synchronous API has a 10,000-result ceiling; refine queries rather than claiming a complete country or global census. A separate exact-UEI profile lookup removes discovery filters and joins only the exact returned identifier.

The gateway allows one upstream request at a time, caches normalized pages for 30 minutes, and enforces a default local budget of 10 requests per UTC day. Failed upstream requests count toward that budget. The counter lives beside the key file, outside the served project. HTTP 429 imposes a cooldown; no automatic retry loop runs. `SAM_DAILY_BUDGET` can set a documented account-appropriate ceiling (1–1,000); this local counter cannot track other tools using the same key. `OCS_PORT` changes the local port. Restart the server after changing environment variables; key-file edits are read on demand.

Company profiles separate declared registration data from prime/subaward evidence and show status, expiration, reported address, source update, retrieval time, declared industry and codes. No automatic eligibility or access assessment is made. **Save note & shortlist evidence** preserves a practitioner's reason for considering the company and outstanding verification questions, together with the displayed source version. Notes and registration evidence appear in HTML and JSON research packets; CSV evidence includes registration-query provenance. Live discovery remains session data until captured or saved; repeat requests can use the gateway cache.

Tests: `node --test tests/ocs-atlas.test.mjs tests/ocs-logistics-research.test.mjs tests/ocs-workspace.test.mjs tests/ocs-sam.test.mjs`.

Live SAM verification: 36 automated checks pass. Saudi active-registration discovery loaded two pages (20 of 200 source matches); a separate six-digit NAICS 541320 query returned all nine matches. Exact-UEI lookup joined a registration to its existing award evidence, and shortlist notes persisted after reload and appeared with dated registration/query evidence in the research packet. Four upstream requests were used; repeated pages used the local cache. The key remains outside the served project and browser.


## Country selection on the map — September 25, 2026

Click a country area to use the same research-country workflow as the dropdown, retaining the selected supplier source and logistics layer choices. Hovering identifies the country and highlights it; the active research country has a persistent light fill and outline. Contractor pins/lines, logistics locations, global activity bubbles and transport features take priority so clicks still open their evidence. Ocean clicks do not pick the nearest country. Switching countries clears the previous city-focus text and contractor-focus selection.

`data/country-boundaries.json` contains public-domain Natural Earth map units: 1:50m polygons, supplemented by 1:10m Gibraltar and Bouvet Island shapes. The polygons cover 249 of the atlas's 250 country/territory entries. The U.S. Minor Outlying Islands use a separate labeled country-reference navigation point; the dropdown remains available for all entries. Boundary shapes are generalized navigation aids and follow the source's treatment of disputed areas, not legal or sovereignty determinations. Source URLs, retrieval time, license and hashes are retained. Refresh with `python scripts/ocs-refresh-country-boundaries.py`. Source: [Natural Earth terms](https://www.naturalearthdata.com/about/terms-of-use/).

## Contractor connections — September 25, 2026

The default map view now draws dotted address-to-work relationships from individual prime/subaward records. Endpoints use city/postal matching or a single explicitly named airfield, with a clearly labeled country-reference fallback where only the country can be placed. No line is inferred from SAM registration, a parent vehicle, or the selected research country. The connection inspector isolates a company on the map; the supplier list is unchanged. Lines and endpoints open the contractor name, address/work precision, dated source awards and related facility-name evidence. Colors distinguish in-country, U.S.-origin abroad and other foreign-origin relationships. These are evidence links, not travel routes or verified current performance.

Program views default to loaded country orders. A bounded country-check button checks up to eight catalog holders per action, retains successful earlier evidence through failures, supports stop/source changes, and refreshes completed checks explicitly. The dated Saudi AFCAP snapshot checks all eight catalog parent contracts: seven direct orders across two reported recipients (five KBR Services and two V2X). It preserves raw public API queries/responses and exact parent/agency validation. KBR's records resolve Houston to Prince Sultan Air Base using an explicit description expansion of PSAB and the public OurAirports directory; dates include historical and presently reported periods. A missing structured work city is never silently rewritten.

Refresh the bounded Saudi example manually with `node scripts/ocs-refresh-program-orders.mjs`. Other countries/programs need explicit live checks. Snapshot loading itself uses no external requests or SAM quota. Coverage remains limited to the dated discovered roster and reported direct children; neither supplier availability nor an exhaustive market inventory is implied. Matching methods are documented in `data/places/SOURCES.md`.

## Exclusive supplier sources and city mapping — September 25, 2026

One radio group selects Prime contracts, Subcontracts, Contract Vehicles, SAM Registered vendors, AFCAP, LOGCAP or WEXMAC. Only the selected source feeds current results, map points, metrics and visible-evidence exports; a saved shortlist remains an explicitly separate cross-session view. Source-specific controls appear only where relevant. SAM responses cannot reactivate that source after a user switches away. Program switching discards in-flight checks. Airfield, port and transport overlays remain independent. Desktop panels retain independent scrolling.

The location selector separates vendor addresses from reported work locations, with an optional combined view. City/postal reference points replace supplier country-centroid circles and implied route lines. The public GeoNames snapshot contains 235,878 populated places and 1,826,904 postal entries, split into compressed country files loaded locally on demand. See `data/places/SOURCES.md` for attribution, precision, coverage and matching rules. No vendor addresses are transmitted to a geocoder. Unknown and ambiguous locations remain unplaced and counted. The city/postal finder changes map focus only. In Saudi Arabia, Jeddah resolves as an approximate city center; the reference snapshot has no Saudi postal entries.

Reported recipient region/postal and work postal fields are preserved separately through normalization, profiles and CSV. Loaded-result search also includes reported city and postal fields. Captured searches identify the selected supplier source and map location role, and contain only the displayed source records; related contract programs remain available as separately identified company-profile context. Existing captures and shortlist evidence are retained.

## Contract program evidence — September 25, 2026

The Contract programs panel groups AFCAP V, LOGCAP V and WEXMAC controls. Selecting programs filters supplier results and map origin circles to matching entities and adds their verified parent-award records. The worldwide-holder view is separate from the loaded-country-order view. Program badges open company details; order badges identify country-linked records and whether a reported performance period includes the current UTC date. Availability is always unverified. Neither award presence nor an apparent ordering window establishes current capacity, authorization, successful performance or installation access.

The initial public USAspending catalog contains 103 parent contracts: eight AFCAP V, four LOGCAP V and 91 WEXMAC records. These are dated award records, not a current authorized-contractor roster. Keyword discovery is incomplete: WEXMAC awards whose descriptions omit the program name, including earlier 2.0 records, can be absent. WEXMAC versions are copied only when explicit; TITUS and unstated versions are identified separately. AFCAP IV/III and LOGCAP program-support contracts are deliberately excluded. Current recipient legal names and UEIs follow the API; names are not fuzzy-matched to historical publicity or parent companies.

Each accepted parent record retains its original query, source description, exact generated contract key, UEI, retrieval time and source URL. No contract ceiling is presented as money available to spend. Country fields on parent vehicles are removed from performance evidence because a vehicle address does not demonstrate country work. Public source discovery pulls are bundled beside the normalized catalog. Refresh manually with `node scripts/ocs-refresh-programs.mjs`; rebuild from bundled pulls with `--from-snapshots`. Failed refreshes leave the existing catalog intact. Discovery is bounded at 100 records per query; source pagination flags remain in coverage. No recurring refresh is configured.

The order checker lists up to 100 direct child awards for a selected parent, then retrieves the selected country's matching award records. It verifies the complete returned award identifier, parent identifier AND parent agency, and country before accepting each order. Order recipient identities come from the order record, never from the parent. Searches cover all reported dates and all buyers, independently of the main award search filters. Territory queries verify the atlas's existing USA/state mapping while preserving the source's reported USA country and territory state code. Grandchild/indirect awards are not included. Additional pages are explicit, each country lookup is capped at three pages, errors retain completed evidence, and stop/country changes discard in-flight results. Date labels reject invalid, missing, future or inverted periods. No label asserts actual ongoing performance.

The documented quoted-ID search syntax returned HTTP 503 in live tests. Unquoted candidate IDs work; acceptance still requires exact complete identifiers and parent links. This distinction is covered by automated tests. Source failures never become claims of no work. Live validation returned 22 direct orders for AFCAP parent FA805120D0008, including two Saudi records, one with a reported period encompassing the check date and one with an ended period. The country-only view returned one company. LOGCAP source errors were surfaced with manual retry and unchanged earlier evidence.

Research packets retain the selected program view, discovery query coverage, parent records, loaded order page counts/errors and source versions. CSV includes program/version/role and parent identifiers; JSON also retains the detailed lookup queries. Use the capture/shortlist controls to preserve session evidence. Automated verification: 43 tests pass across the atlas, SAM, logistics, transport, packets and program logic. Browser checks verified program toggles, exact-parent country lookup, clickable badges, date labels, failure/retry handling and captured HTML packet evidence. A successful AFCAP example remains in the preview packet. The broader UI reorganization remains the next task.


## Automatic SAM discovery and exclusions preview

Selecting SAM or changing country now automatically requests the first public registration page, defaulting to active registrations. **Include expired registrations** broadens the status filter. Name and capability filters apply on change/blur or Enter; incomplete NAICS/PSC fields do not send requests. Additional pages remain explicit. Session results are reused for 30 minutes. In-flight searches are serialized and changes coalesced; old results cannot overwrite another country, mode, or supplier source. Imported snapshots suspend pending live display updates.

The SAM panel also offers **Active exclusion records - firms (preview)** using the [official public Exclusions API v4](https://open.gsa.gov/api/exclusions-api/). It queries active Firm records by reported exclusion-address country and optional company name. This is not a search of every basis for non-awardability. Only allowlisted firm identity, address, exclusion type/program/agency, actions, FASCSA indicator, comments and retrieval/query provenance reach the browser. Individual and vessel records, inactive records, and country mismatches are omitted and counted. Unknown UEIs remain separate records. Exclusion dates and addresses never become award-performance dates or contractor flows. Profiles, CSV and research packets preserve scope and source evidence. No-match, expired, and missing registration results are not eligibility clearance.

Both API routes share the existing local key handling, request budget, cache TTL, origin/header controls and safe error handling. No credentials or raw upstream errors are returned. No automatic paging or retry loop was added.

Validation: 65 automated checks and isolated browser fixture checks cover automatic active/expired results, exclusions, country changes, serialized stale-response handling, cache reuse, optional pagination, identity separation, export provenance and the shared budget. Fixture records were clearly labeled TEST ONLY on a separate local port and were never placed in the live atlas. The live exclusions test returned HTTP 400; its cause remains unresolved, and the existing ten-request daily allowance was exhausted, so live exclusion retrieval is **not yet verified**. The UI labels it preview and links to official SAM search for manual verification. Follow up on the rejected request when the request budget is available; do not mistake an error for an empty result or increase the configured ceiling without an account-appropriate basis.


## Supplier cards and dated status badges

Supplier cards now show reported city/region/postal/country addresses separately from documented award work locations, full latest award start/report dates, a dated direct source link, evidence counts, and holder/parent program associations. Country-only places remain explicitly coarse; missing work locations stay visible. Registration and vehicle dates do not become award experience. Existing profile, shortlist, map and program actions remain available.

Registration badges use loaded SAM evidence only: reported active, reported expired, status unknown, conflicting status, or recheck needed when a reported active registration has passed its stated expiration. Historical records do not override newer dated registrations; conflicting same-day or undated records remain flagged for review. Active exclusion records and explicit SAM exclusion flags have separate dated badges. Missing exclusion evidence never produces an eligibility-clearance badge. Program associations are labeled separately from country-order evidence.

Validation: 70 automated checks pass, including five new status/provenance/escaping checks. Browser verification covered the saved Saudi AFCAP cards, KBR detail navigation, desktop layout and a 390px-wide layout. No SAM requests were consumed for this change. Live exclusions verification remains outstanding as documented above.


## KTHQ peer preview and hosted SAM — September 25, 2026

The shareable preview is deployed directly at `https://kthq.org/ocs-supplier-atlas.html`, with `noindex,nofollow` metadata and no new navigation, tools, dossier or sitemap links. It is public to anyone with the address, not access-restricted. The deployment is built from current production plus atlas-specific files, preserving unrelated site changes.

SAM now uses the dedicated Cloudflare service described in `../ocs-backend/README.md`. The public key is a Worker secret; local and hosted previews share the same persistent quota/cache. The user authorized a 1,000-request daily ceiling without confirming the upstream entitlement; upstream rate limiting is still respected. The UI shows the shared remaining allowance and the reset time in the viewer's timezone.

The prior live exclusions failure is resolved: SAM rejects the optional response-section projection, so the gateway requests its standard public response and retains only allowlisted fields. Positive U.S. exclusions and Saudi registrations were verified live, as was a valid empty Saudi exclusion result. The current automated suite contains 76 passing checks. Peers' notes and shortlists remain in their own browser storage; exports are local downloads.


## Full registration loading — September 25, 2026

Selecting SAM Registered vendors now follows all matching public registration pages automatically. GSA's Entity Management API limits each synchronous response to ten records and the first 10,000 search results; 200 matches therefore require 20 uncached upstream calls. This does not change the account's upstream entitlement or the hosted 1,000-request daily ceiling. Country/status/name/capability filters remain in effect, and entities not publicly displayed cannot be included.

A progress panel above the map reports loaded records against SAM's match count, remaining possible uncached calls, and completion/partial status. Stop retains loaded records and lets the current request finish; Resume continues from the next page. Rate-limit/transport errors retain earlier pages and require an explicit retry of the failed page. Switching country or source cancels queued work, and stale responses cannot replace the current search. Firm-exclusion searches remain explicitly paginated.

Automatic pages are spaced by at least 2.2 seconds, keeping search plus status refresh below the service's per-IP limit. Normalized pages and completed browser searches reuse the existing 30-minute caches. Automated coverage now totals 81 tests, including automatic completion, pause/resume during a request, late-page error recovery, source switching, complete-cache reuse, and API result ceilings.


## Capability and location filters — September 25, 2026

The **Find the right vendors** controls filter loaded company evidence without issuing SAM or USAspending searches. Seven dated research categories use NAICS/PSC code families: construction, lodging, transportation, fuel/lubricants, equipment rental, food/catering, and maintenance/repair. The visible code-rule disclosure links the 2022 Census NAICS and April 2024 PSC manuals. Matching is against complete reported code tokens; company-name keywords and missing codes never imply capability. Cards distinguish self-declared SAM codes, award codes, and vehicle codes.

An optional 25–500 km city/postal radius uses the bundled GeoNames reference and spherical straight-line distance. Users choose vendor addresses or reported award work locations independently from the map display mode. Radius matching accepts unique city/postal matches only: no country-centroid distances, no inferred work from SAM/exclusion/vehicle records, and no service-area or road-routing claim. Unlocated companies and companies with no known point inside are counted separately. Companies with a nearby point are sorted by that reference distance. Other evidence for a matching company remains available; the card explains that capability and location can come from different records. The map's separate Move map control does not filter suppliers.

Country changes clear the radius center. In-flight center lookups cannot apply to another country, and source updates reuse local reference data. CSV and captured research packets retain capability/radius criteria, matching codes and per-record location reference distances alongside source records. Existing shortlisting and comparison controls continue to use the filtered list.

Validation: 87 automated tests pass, including six tests for code-token boundaries, declaration/award distinctions, coordinate validation, dateline distances, circle geometry, country-only exclusion, SAM/work separation, combined evidence, escaping, export criteria and stale city lookup protection. Live local-browser verification loaded all 200 active Saudi registrations, found seven construction leads with known address reference points within 50 km of Jeddah, and exported seven rows with the applied criteria. Nine construction leads lacked resolvable address locations; these were excluded rather than placed at a country reference point. Counts are a dated research example, not an exhaustive capability inventory.
