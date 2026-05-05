# Weekly Update — May 4, 2026

**Status:** Run completed. 2 new FR entries, 5 new GAO entries, 0 new ASBCA entries.

## Federal Register / FAR-DFARS
- **2 new entries** added to a new `weekOf: "May 4, 2026"` block at index 0 of `data/federal-register-data.js`.
- Source: Federal Register API (`api.federalregister.gov`) for the DARS and FAR-system agencies. Both notices published May 4, 2026.
- Updated `Updated:` header to May 4, 2026.
- Entries:
  - **DoD: Annual List of Items Where Federal Prison Industries Has a Significant Market Share** — Notice — 91 FR 23979 — https://www.federalregister.gov/documents/2026/05/04/2026-08610/acquisition-of-items-for-which-federal-prison-industries-has-a-significant-market-share — Effective May 16, 2026. Five PSCs on the FY2025-data list: 7110 (Office Furniture), 7210 (Household Furnishings), 8105 (Bags and Sacks), 8125 (Bottles and Jars), 8420 (Men's Underwear and Nightwear).
  - **DFARS: Performance-Based Payments Representation — 30-Day Information Collection Notice** — Notice — 91 FR 23979 — https://www.federalregister.gov/documents/2026/05/04/2026-08611/information-collection-requirement-defense-federal-acquisition-regulation-supplement-dfars — Reinstatement of OMB clearance for DFARS provision 252.232-7015. Comments due June 3, 2026.
- No FAR-system or GSA publications this week. The FR API search for `defense-acquisition-regulations-system` + `federal-acquisition-regulation-system` (gte 2026-04-27) returned the two entries above; the GSA fallback returned 0.

## GAO Bid Protests
- **5 new decisions** added to a new `weekOf: "May 4, 2026"` block at index 0 of `data/gao.js`.
- Source: gao.gov directly via WebFetch (Chrome MCP was unavailable this run, but the sandbox's WebFetch returned full content for the recent-decisions index and each individual decision page; no 403 encountered today). Each `bottomLine` is verbatim from the decision's DIGEST section on gao.gov.
- Decisions:
  - B-423821.2; B-423821.3 — J&J Maintenance, Inc., dba J&J Worldwide Services — denied — https://www.gao.gov/products/b-423821.2,b-423821.3
  - B-423281.4 — Owl International Inc., d/b/a Global, a 1st Flagship Company — sustained in part / denied in part — https://www.gao.gov/products/b-423281.4
  - B-424221 — Threat Tec, LLC — dismissed — https://www.gao.gov/products/b-424221
  - B-423066.3 — Bailey's Premier Services, LLC — denied — https://www.gao.gov/products/b-423066.3
  - B-422717.4; B-422717.5 — KriaaNet, Inc. — denied — https://www.gao.gov/products/b-422717.4,b-422717.5
- I included the Threat Tec dismissal because the timeliness lesson (10-day clock, supplemental protests grounded in the D&F's first disclosure of the legal theory) has real CO value.

## ASBCA
- **0 new decisions.** `data/asbca.js` left untouched.
- Source: asbca.mil/Decisions/2026/ via WebFetch (Chrome MCP unavailable, but asbca.mil served the index normally). The latest published decision date is March 27, 2026 — outside the 30-day window from runMonday (April 4, 2026). Every March 2026 substantive decision listed on the index is already in the dedupe set from prior weekly runs.
- The Board's published page has not added any April or May 2026 decisions yet. No fallback to stanhinton.com was needed.

## Source notes
- **Chrome MCP unavailable this run.** The Chrome extension wasn't reachable when the task ran. Both gao.gov and asbca.mil happened to serve the sandbox's WebFetch normally today, so I used WebFetch directly and got Board/GAO source language without falling back to legal blogs. Every `bottomLine` in this run is from the primary source.
- **OneDrive sync hiccup during file writes.** The first FR_DIGESTS edit appeared to succeed via the Edit tool but the bash mount returned a truncated file (size unchanged, partial content). I rebuilt and copied the full file via bash; `node --check` then passed. GAO and FR final files both verified syntax-clean. Worth flagging for future runs in case it recurs.
- **No FAC published this week.** The FAR Council has not pushed a new circular since FAC 2026-01 in March.

## Review checklist
- [ ] Spot-check the 2 FR summaries against the Federal Register text (FPI list and PBP info-collection notice)
- [ ] Spot-check `bottomLine` values for the 5 GAO entries against the DIGEST sections on each gao.gov page
- [ ] Confirm the FPI effective date (May 16, 2026) and the 5 PSCs are correct in the FR entry
- [ ] Confirm `weekOf: "May 4, 2026"` is the right label across both files

## Git commit
```
git add data/federal-register-data.js data/gao.js data/_weekly-update-2026-05-04.md && git commit -m "Weekly update — May 4, 2026 (2 FR, 5 GAO, 0 ASBCA)" && git push
```
