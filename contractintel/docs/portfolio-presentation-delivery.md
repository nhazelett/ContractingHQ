# Portfolio presentation redesign — delivery map

Portfolio only. Opportunities remains unchanged pending review.

The original methodology text, footer, controls/option values, CSV field definitions and data/loading functions are protected by regression tests. A new-visitor presentation gate delays the existing office scan until selection; recognized URL/remembered offices keep their direct entry behavior. No source API, cache, pacing, parsing, classification or fiscal math was changed.

| # | Confirmed inventory item | Location after Portfolio redesign |
| --- | --- | --- |
| 1 | Office picker, department/search, Change office, ?office= | First-visit office question; same picker returns to header after selection. URL parameter retained. |
| 2 | Progressive USAspending loading, Pause/Resume, partial and complete states | Thin rail below header; expanded counts and retry information in Loading details. |
| 3 | Six-hour in-page request cache | Unchanged implementation; no cache or pacing changes. |
| 4 | Export all filtered Register matches as CSV | Header Export register CSV; all original fields and flags retained across pages. |
| 5 | Portfolio dark/light toggle | Header, unchanged; saved preference retained. |
| 6 | Overview, Expiring, Register, Set-asides views | My office / Ending soon in primary navigation; All contracts / Who can bid in office secondary navigation. Original anchors retained. |
| 7 | Four dataset choices | Advanced → Dataset; active value displayed as a chip. |
| 8 | Four history windows | Advanced → History; active value displayed as a chip. |
| 9 | Current/potential end-date basis | Advanced → End dates; active value displayed as a chip. Source values unchanged. |
| 10 | All four original headline cards and their subsidiary counts | One new 12-month headline; three original cards in More about this office; original 180/90-day card in 90- and 180-day breakdown. |
| 11 | Next-ten ending-contract list and full-register link | My office → Contracts ending soon; See all ending contracts and All contracts links below list. |
| 12 | Set-aside mix | How this office buys → Who can bid; full view remains in secondary navigation. |
| 13 | Net obligations-by-FY chart, current year partial | How this office buys → Money spent by fiscal year; YTD flag retained. |
| 14 | Fiscal comparison, four totals, independent loading controls | How this office buys → Fiscal-year comparison. Existing auto-start, Pause/Continue/Retry and math unchanged. |
| 15 | Register search, filters, contract rows and pagination | All contracts; simple rows by default, search above, filters in Advanced, pagination below. |
| 16 | Contract source-evidence modal and USAspending link | Open any contract; existing modal/drawer and official link retained. |
| 17 | All five methodology sections, verbatim | How this data works; exact original text preserved. Moved loading explanation appended. |
| 18 | Portfolio footer disclaimer, verbatim | Portfolio footer after office selection, unchanged text. |
| 19 | View source service status | How this data works → View source service status; same status modal. |
| 20 | Skip-to-register link | Same skip link; now explicitly focuses All contracts. |
| 21 | Opportunities office selector and scope behavior | Unchanged on Opportunities; deferred until Portfolio review. |
| 22 | Opportunities CSV export | Unchanged in Opportunities header. |
| 23 | Opportunities dark/light toggle | Unchanged in Opportunities header. |
| 24 | Title/solicitation search, phrases and exclusions | Unchanged on Opportunities. |
| 25 | National versus selected-office scope | Unchanged on Opportunities. |
| 26 | Opportunities Search and Reset filters | Unchanged on Opportunities. |
| 27 | All Opportunities Refine filters and their choices | Unchanged on Opportunities; future drawer work deferred. |
| 28 | Six Opportunities quick views | Unchanged on Opportunities. |
| 29 | Eight Opportunities result columns and newest-posted ordering | Unchanged on Opportunities; fixed newest-first order retained. |
| 30 | Opportunities Previous/Next | Unchanged below Opportunities results. |
| 31 | Opportunity source-evidence modal and SAM.gov link | Unchanged on Opportunities. |
| 32 | Opportunity index/search/detail/description loading messages | Unchanged on Opportunities. |
| 33 | Opportunities search, ordering and source disclaimers, verbatim | Unchanged footnote and footer on Opportunities. |
| 34 | Shared branding, Home/navigation and office context | Name, logo and header colors unchanged. Portfolio navigation follows new view hierarchy; office context links retained. |
| 35 | Remembered office, URL priority and directory result counts | Explicit/remembered valid offices open directly; new visitors choose first. Directory search/counts retained. |
| 36 | Bounded browser previews and Updating markers | Unchanged snapshot storage and refresh; Updating shown in simple rows and ending lists. |
| 37 | Detailed staged loading/status information and explanatory card | One-line rail plus Loading details; full explanatory status text moved into methodology. |
| 38 | Retry missing details, source errors, Resume and disabled/completed controls | Loading details → Retry missing details; errors remain visible; Pause/Resume under header and register resume retained. |
| 39 | Headline-card click-through filters | More about this office, 180/90-day breakdown, new 12-month headline and ending-list links; original filter actions retained. |
| 40 | Expiring groups, counts/values, inline evidence and Show more | Ending soon; same 0–90 / 91–180 / 181–365-day groups, expansion and incremental display. |
| 41 | Register-specific set-aside filter | All contracts → Advanced → Who can bid; exact source-valued selections retained. |
| 42 | All thirteen Register status/window choices | All contracts → Advanced → Show; same values and options. |
| 43 | All eight Register sorts and direction | All contracts → Advanced → Sort and Ascending/Descending. |
| 44 | Fifteen-column chooser and required PIID | All contracts → Advanced → Show detailed columns / Columns. Original nine-column detailed defaults retained. |
| 45 | Row selection, lifecycle shades/badges, pending/error states, countdowns and hover text | Simple rows, ending lists and detailed columns; technical fields and exact source values remain in Details. |
| 46 | Fifty-row paging, matching/loaded totals, ranges and sticky/scrolling results | All contracts footer and result container; simple or detailed view uses the same results and paging. |
| 47 | All contract detail fields and Retry details | Contract Details; one primary ending date with the other subordinate, plus full source fields in additional details. |
| 48 | Recent/all transactions, 200 older actions, modification timeline and 100-row expansion | Contract Details → source transactions and modification/option evidence; all existing controls retained. |
| 49 | Modification/option qualifications, gaps, ties, incomplete history and None Found meaning | Contract Details → Modification and option evidence; same source calculations and caveats. |
| 50 | Interactive category counts, percentages, values, swatches and Register drill-down | How this office buys and Who can bid view; plain display labels, exact source labels in tooltips and filter values. |
| 51 | Fiscal monthly progress, blank/unavailable states, retry and YTD semantics | How this office buys → Fiscal-year comparison and chart; compact fiscal loading/Pause also available in rail. |
| 52 | Portfolio anchors, contract links, Back behavior, filters and keyboard view navigation | Same #overview / #expiring / #register / #set-asides and award links; native navigation and arrow/Home/End handlers retained. |
| 53 | Opportunity defaults, dynamic facets and quick-view/filter interactions | Unchanged on Opportunities. |
| 54 | Shareable Opportunity filters/page/office/notice URLs and Back/Escape | Unchanged on Opportunities. |
| 55 | Opportunity indexed count, coverage windows, partial/failure warnings and check time | Unchanged coverage panel on Opportunities. |
| 56 | Opportunity posting/deadline precision and uncertainty states | Unchanged result rows and detail view on Opportunities. |
| 57 | Full opportunity metadata, descriptions, documents, contacts and source guidance | Unchanged Opportunity Details. |
| 58 | Opportunity description loading/cached/unavailable/shortened states | Unchanged Opportunity Details. |
| 59 | Opportunity empty/error/retained-result/retry/directory/version recovery | Unchanged on Opportunities. |
| 60 | Opportunity 50-row pages, counts, pinned dataset and full CSV source fields | Unchanged on Opportunities. |
| 61 | Accessibility and responsive behavior on both pages | Portfolio: skip/focus/keyboard retained, drawers labeled, default/detailed/evidence rows stack below 640px. Opportunities unchanged pending its turn. |

## Validation

85 Node tests: 71 existing tests plus 14 presentation/component/invariant checks. Protected module hashes (normalizing line endings and final blank lines only), nine data/export function bodies, expiration/category/countdown/value logic, all original IDs/select values, methodology text, footer and CSV field definitions are checked. HTML nesting and static control bindings were also checked. Live asset and API smoke checks run at deployment.

Full application DOM execution was rejected by automatic approval review after detecting outbound telemetry to dc.services.visualstudio.com with an unspecified payload. That run was not resumed; the process was no longer active when a stop was attempted. The test runner and its temporary dependencies are not part of the deployed app. Safer isolated EventTarget/DOM-fixture unit tests passed without an HTML loader, application execution or network. No graphical browser-control tool is available; 390px visual layout and every native browser interaction remain manual checks, not claimed as passed.

## Manual review

1. In a fresh/private window, choose an office with search/department filters; verify ?office= and remembered-office entry bypass the first-visit question.
2. Navigate My office, Ending soon, All contracts and Who can bid; try Back, direct anchors, keyboard arrows/Home/End, skip link and dark mode.
3. Open Advanced; exercise all dataset/history/date choices and clear nondefault chips. Verify one primary date and the quiet alternative date.
4. At 390px, check simple/detailed/evidence cards, both drawers, every filter, sort/direction, column chooser, page controls and close/focus behavior.
5. Export a filtered dataset with more than 50 results; confirm all matches and original CSV columns are present.
6. Pause/resume portfolio and fiscal scans independently; inspect partial counts, retry delays, missing-detail retry and Updating previews.
7. Open contract details, older actions, full transaction and modification histories, source links, methodology and service status. Check the five original methodology sections and footer.
8. Open More about this office, the 90/180-day breakdown and How this office buys; verify card click-throughs, category drill-down, fiscal totals and YTD chart. Opportunities should remain unchanged.
