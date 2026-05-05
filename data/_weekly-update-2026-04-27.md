# Weekly Update — April 27, 2026

**Status:** Run completed. 6 new GAO entries, 4 new ASBCA entries, FR cleanup. Significant regression fixes.

## Federal Register / FAR-DFARS
- **Cleanup:** Removed the empty `weekOf: "April 20, 2026"` block that the prior run had incorrectly prepended. The "current week" view now correctly shows the substantive `March 24, 2026` block (6 entries: FAC 2026-01 Trade Agreements, CAS 407, CAS thresholds, CMMC, Confucius Institute, DFARS Inflation).
- 0 new entries from the past 7 days — confirmed via both the Federal Register API and a direct browser check of `https://www.federalregister.gov/agencies/defense-acquisition-regulations-system`. DARS hasn't published anything new since the September 10, 2025 CMMC final rule.
- One historical gap noted but **not** auto-added: a FAR Council semiconductor restrictions rule from February 17, 2026 (`Federal Acquisition Regulation: Prohibition on Certain Semiconductor Products and Services`, doc 2026-03065). It predates the start of your digest. Add manually if you want it covered.
- Updated `Updated:` header to April 27, 2026.

## GAO Bid Protests
- **6 new decisions** added to a new `weekOf: "April 27, 2026"` block at index 0 of `data/gao.js`.
- Source: gao.gov directly via Chrome MCP (bypasses the WebFetch 403 by using your browser session). Each `bottomLine` is verbatim from the decision's DIGEST section on gao.gov.
- Decisions:
  - B-424243; B-424243.2 — SupplyCore, Inc. — denied — https://www.gao.gov/products/b-424243,b-424243.2
  - B-424392 — Metro East Joint Venture, LLC — dismissed — https://www.gao.gov/products/b-424392
  - B-419947.4 — Harper Construction Company, Inc.—Reconsideration — denied — https://www.gao.gov/products/b-419947.4
  - B-423066.2 — LOGMET LLC — denied — https://www.gao.gov/products/b-423066.2
  - B-424040.2; B-424040.3 — Identity One, LLC — denied — https://www.gao.gov/products/b-424040.2,b-424040.3
  - B-422249.5 — CSlope Solutions, LLC — denied — https://www.gao.gov/products/b-422249.5

## ASBCA
- **4 new substantive decisions** appended to the existing `March 2026` block in `data/asbca.js` (same-month rule). Updated the block's `intro` to reflect the new content and bumped the file's `Updated:` header to April 27, 2026.
- Source: asbca.mil PDFs directly via Chrome MCP + PDF.js for text extraction. Each `bottomLine` is verbatim from the Board's opinion. **No secondary sources used.**
- Decisions:
  - ASBCA Nos. 63871, 63894 — Sayar Development, Inc. — procedural (recon granted, claim still dismissed on different jurisdictional ground) — March 17, 2026 — Judge D'Alessandris
  - ASBCA No. 64382 — Pacific West Builders — sustained (consent judgment, $95K) — March 17, 2026 — Judge Eyester
  - ASBCA No. 63449-EAJA — CB Portable Toilet Rental and Services — denied (EAJA application untimely + wrong applicant) — March 10, 2026 — Judge Melnick
  - ASBCA Nos. 63621 et al. — Lockheed Martin Aeronautics Company — procedural (cross-MSJ both denied; $98M case) — March 10, 2026 — Judge Melnick
- ASBCA also has several routine dismissals from late March (MLSUSA Corp x2, JACMEALS LLC, Dunlap Towing, North Island Research, SupplyCore-ADR) that I did not include — they're procedural dismissals without substantive CO lessons. Add manually if you want full coverage.

## Source notes
- **GAO 403 issue resolved via Chrome MCP** — gao.gov serves your real browser session normally, only the sandbox's outbound IPs are CDN-blocked. The updated task prompt now uses Chrome MCP as the primary path.
- **ASBCA 403 issue resolved similarly** — Chrome MCP accessed asbca.mil/Decisions/2026/ and individual PDFs. PDF.js (loaded from CDN inside the browser) extracted the text.
- The `gao.js` file still has the prior run's `weekOf: "April 20, 2026"` block with two stale February 18 decisions sourced from legal blogs. **Recommend deleting that block** before commit — it's superseded by the new April 27 block. Just remove the entire `{ weekOf: "April 20, 2026", ... }` object.

## Review checklist
- [ ] Spot-check `bottomLine` values for the 6 GAO entries against gao.gov DIGEST sections
- [ ] Spot-check `bottomLine` values for the 4 ASBCA entries against the PDFs
- [ ] Decide whether to delete the stale `weekOf: "April 20, 2026"` block from `gao.js`
- [ ] Optional: manually add the Feb 17, 2026 FAR Semiconductor rule to `federal-register-data.js`
- [ ] `git add data/gao.js data/asbca.js data/federal-register-data.js data/_weekly-update-2026-04-27.md && git commit -m "Weekly update: 2026-04-27" && git push`

## Next run
Monday, May 4, 2026 at ~5:04 AM local. The updated task prompt uses Chrome MCP for both GAO and ASBCA, with PDF.js for ASBCA decision text extraction. Click "Run now" once with Chrome open (any time before May 4) to pre-approve the Chrome MCP tool calls so the 5 AM run doesn't pause for permission.
