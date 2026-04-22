# Weekly Update — April 20, 2026

## Federal Register / FAR-DFARS
- 0 new entries added (quiet week — no new FAR or DFARS items in the Federal Register for the past 7 days)
- A new empty block was prepended to `data/federal-register-data.js` with `weekOf: "April 20, 2026"` and `entries: []` so the weekly cadence is preserved. The render module shows the "No FAR or DFARS activity to report this period" placeholder.
- Entries: none

## GAO Bid Protests
- 2 new decisions added to a new `weekOf: "April 20, 2026"` block at index 0 of `data/gao.js`
- Both decisions are from earlier in 2026 but were publicly released and discussed in commentary in the past ~10 days, which is the realistic "new-to-us" window for GAO given its standard 30-60 day protective-order redaction cycle.
- Decisions:
  - B-423993; B-423993.2 — Effective Communication Strategies, LLC — sustained — https://www.gao.gov/products/b-423993,b-423993.2
  - B-423898; B-423898.2; B-423898.3; B-423898.4 — Amentum Technology Inc.; SOS International LLC — sustained — https://www.gao.gov/products/b-423898,b-423898.2,b-423898.3,b-423898.4

## ASBCA
- 1 new decision added
- Per the task spec (same-month new decision → append to existing index-0 block), the Group III Mgt. decision was appended to the existing `weekOf: "March 2026"` block rather than a new April block. The `intro` was updated to reflect six decisions (was five) and describe the new USACE construction case. The header `Updated:` line was bumped to April 20, 2026.
- Decisions:
  - ASBCA No. 64176 — Group III Management, Inc. — procedural (motion to dismiss / summary judgment denied) — https://www.asbca.mil/Portals/143/Decisions/2026/64176%20Group%20III%20Mgt%203.2.26%20Decision.pdf

## Source issues
- GAO bid-protest search and "recent" pages were not accessible (403 from the edge) via WebFetch or curl. Candidate decisions were discovered through legal-blog coverage (NatLawReview, governmentcontractslaw.com, governmentcontractslegalforum.com, PilieroMazza) published in the past 7–11 days; the GAO decision links in the data file point to the standard `gao.gov/products/{b-number}` URL pattern and should be spot-checked.
- ASBCA site (asbca.mil) was also inaccessible via WebFetch/curl. The new decision (ASBCA No. 64176, Group III Mgt.) was confirmed via the stanhinton.com recent-decisions list and the underlying PDF was pulled and parsed from the ASBCA portal URL (the saved link in the data file points to that same portal PDF). Please spot-check the link resolves when you open it.
- Federal Register API returned zero FAR/DFARS documents in the April 14–21 window with the correct agency slugs (`federal-acquisition-regulation-system` and `defense-acquisition-regulations-system`). I also sanity-checked with a broader 2026-03-01 cutoff and only one DFARS information collection notice showed up (2026-03-27) — confirming there was nothing impactful the filter might have missed.
- `bottomLine` for the GAO decisions is paraphrased from article coverage of the holdings rather than directly extracted from the GAO PDFs (which were blocked). Please verify against the GAO decisions before push. The ASBCA `bottomLine` for Group III was drawn from the actual decision PDF text.

## Review checklist
- [ ] Spot-check each `bottomLine` against the source (verbatim accuracy) — especially the two GAO entries
- [ ] Confirm outcome classifications (sustained / denied / dismissed / procedural)
- [ ] Verify links resolve — the GAO `products/b-...` URLs and the ASBCA portal PDF URL
- [ ] Confirm the `weekOf: "April 20, 2026"` label is what you want for the FR empty block (or delete the empty block if you'd rather suppress it)
- [ ] Optional: move the Amentum decision to its own week if the Feb/Jan decision dates feel too stale for this week's "current" view
- [ ] `git add data/federal-register-data.js data/gao.js data/asbca.js data/_weekly-update-2026-04-20.md && git commit -m "Weekly update: 2026-04-20" && git push`
