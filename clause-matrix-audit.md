# Clause Matrix Audit Log
**Session start:** 2026-04-21
**Working file:** `/sessions/practical-busy-noether/mnt/ContractingHQ Website/data/clause-matrix.js`
**Schema confirmed:** `var CLAUSE_DATA = [...]` array with 1,509 records. Each: `{id, title, date, prescribedAt, type, ibr, ucf, reg, classDevUrl, altFlag, devFlag, tags[], ct, cp, ci, method, flow, oconus, _uid, st}`. Detail records keyed by `_uid` (or `id` fallback) in `CLAUSE_DETAIL`.

---

## SESSION 2 (2026-04-22) — Dollar Tiers, Footnote Strip, 52.212-3/-5 Removal

### Changes this session

**Data (`data/clause-matrix.js`):**
- **Batch 7 — Footnote strip:** 27 records had type field holding footnote symbols (`P†`, `C‡`, `Pú`, `Cú`, `C▫`). All normalized to bare `P` or `C`. Per Nick: "No footnote symbols should be in the tool."
- **Batch 8 — Threshold tag cleanup:** Stripped all 185 malformed `threshold:$...` tags across 128 clauses. These were inconsistent (mixed units, trailing commas, format variants), never referenced by the filter logic, and blocked a clean schema.
- **Batch 9 — Canonical tier tags:** Added cascading dollar-tier tags to 33 well-known FAR clauses (see schema below). 5 clauses already had the right tag.
- **Batch 10 — `core` expansion + construction split:** Added `core` tag to 9 universally-required clauses (52.232-33 EFT, 52.232-39, 52.232-40, 52.233-1 Disputes + alt, 52.233-3 + alt, 52.233-4, 52.222-50 Trafficking + alt, 52.252-2, 52.252-6). Total `core` now = 13 (one pre-existing: DFARS 252.232-7006). 52.212-4 deliberately NOT tagged core — commercial-only, the Part 12 build filter handles it. Also split `tier-over-750k` on 52.219-9 (base + Alts I–IV) and 52.219-16 into `tier-over-750k-nonconstr` (six records) and `tier-over-1-5m-constr` (six records) for construction-aware filtering.

**HTML (`clause-matrix.html`):**
- Added new "Dollar Value" filter section (single-select cascading tiers: Any / ≤$10K MPT / $10K–$250K SAT / $250K–$750K / $750K–$2M / $2M–$7.5M / $7.5M–$15M / >$15M Major)
- Removed "Above SAT" and "Below SAT" trim pills (subsumed by Dollar Value)
- Added `DOLLAR_EXCLUDE` map and tier-exclusion logic in `applyFilters()`
- Added `filters.dollar` state, `handlePillClick` dollar branch, `clearAllFilters` reset, init() activation
- Replaced `tier-over-750k` in `DOLLAR_EXCLUDE` with both `tier-over-750k-nonconstr` and `tier-over-1-5m-constr`, preserving identical cascade semantics (both excluded at mpt/sat/sub750, included at tina+). Semantic split is retained in the data for future construction-specific logic.
- Added `updateDollarLabels()` method: when the DoD trim pill is active, the SAT and sub-750 pill labels switch from `$250K` to `$350K` (FAR 2.101 DoD SAT). Called from `togglePill`, `clearAllFilters`, and `init()`.

**Site-wide narrative (jeopardy, pick-the-path, first-light):**
- Replaced all 4 jeopardy-clues references to 52.212-3/-5 as current, plus mirror edits in jeopardy-clues.js
- Fixed pick-the-path.html two scenario narratives that treated 52.212-5 as current
- Rewrote first-light.html "Required Clauses" card + its `rfo:` blurb to reflect RFO deletion of 52.212-3/-5

### Dollar Tier Schema (for Nick's review)

Cascading floor tags — clause REQUIRED only at or above this value:
| Tag | Floor | Reason |
|---|---|---|
| `tier-over-mpt` | $10K | Over the Micro-Purchase Threshold |
| `above-sat` | $250K ($350K DoD) | Over SAT. Existing tag — 115 clauses. Label in UI switches with DoD trim pill. |
| `tier-over-750k-nonconstr` | $750K | Non-construction subcontracting plan threshold (FAR 19.702) |
| `tier-over-1-5m-constr` | $1.5M | Construction subcontracting plan threshold (FAR 19.702(a)(1)(ii)) |
| `tier-over-tina` | $2M | TINA certified cost or pricing data |
| `tier-over-com-sap` | $7.5M | Commercial SAP ceiling / CAS full coverage |
| `tier-over-15m` | $15M | Contingency commercial SAP ceiling (not currently used on any clause — reserved) |

Ceiling tags — clause DROPS OUT above this value:
| Tag | Ceiling | Reason |
|---|---|---|
| `tier-under-mpt` | $10K | Reserved; no clauses tagged yet |
| `below-sat` | $250K | Existing tag — 33 clauses |

### Filter behavior

User selects ONE dollar value. Clauses hide if their tags say the clause does not apply at that value. Example: user picks "$2M–$7.5M", we exclude clauses tagged `tier-over-com-sap`, `tier-over-15m`, `tier-under-mpt`, `below-sat`. Clauses tagged `core` are always shown regardless.

Tested counts at each tier against the loaded data (post-Batch 10):
- Any: 1509 shown
- ≤ $10K MPT: 1371 shown
- SAT: 1373 shown
- $250K–$750K: 1455 shown (subk-plan split tags now exclude here)
- $750K–$2M: 1461 shown (subk-plan clauses return)
- $2M–$7.5M: 1471 shown
- $7.5M–$15M and >$15M: 1476 shown

### Clauses tagged in Batch 9

Above SAT added: 52.203-7, 52.203-11, 52.203-12, 52.203-17, 52.215-2 Alt II/III, 52.215-14 Alt I, 52.222-4, 52.222-35, 52.222-37
Over MPT: 52.222-6 (Davis-Bacon), 52.222-36 (Workers with Disabilities)
Over $750K: 52.219-9 (base + Alts I–IV), 52.219-16
Over TINA ($2M): 52.215-10, -11, -12 (+Alt I), -13 (+Alt I), -18, -19, -20, -21
Over $7.5M (CAS full): 52.230-2, -3, -4, -5, -6

### Skipped during Batch 9

- **52.215-2 Alt IV** — not in matrix; the audit already flagged 52.215-2 Alt IV as a record to verify
- **52.222-26** (Equal Opportunity) — lookup returned null; may be under a non-standard `_uid`. Flagged for manual review.

### Questions flagged for Nick (answered 2026-04-22)

1. ~~**Which SAT value do we assume — $250K FAR or $350K DoD?**~~ Nick: yes, add a DoD-aware label. Done via `updateDollarLabels()`: SAT/sub-750 pill labels switch from `$250K` to `$350K` when the DoD trim pill is active.
2. **Tier coverage is still thin.** Only 33 clauses have tier tags; ~1400 remain. Open — recommend a future scripted pass with per-clause approval.
3. ~~**Expand `core` tag?**~~ Nick: yes, except 52.212-4 (commercial-only). Done in Batch 10. Core now covers disputes, trafficking, EFT, accelerated-pay-to-SB, and the two 52.252 incorporation clauses — 13 records total.
4. ~~**Ambiguous subcontracting-plan threshold (construction vs non-construction)?**~~ Nick: split it. Done — `tier-over-750k-nonconstr` + `tier-over-1-5m-constr` on all six subk-plan records (52.219-9 base + Alts I–IV, 52.219-16). Cascade currently excludes both identically; semantic distinction retained in data for future construction-specific logic.
5. **52.212-5 narrative in audit log still references deletion counts.** Historically accurate — left as-is for audit trail.

---

## WRAP-UP (read first)

**Session length:** 2026-04-21, single sitting (continued across one context compaction).
**File modified:** `data/clause-matrix.js` only. No HTML, CSS, or render-logic changes.
**Record count:** 1509 (unchanged before/after).
**Net byte delta:** ~+241 bytes (additive; mostly from "CD " prefix normalization).
**Validated after every batch:** parsed cleanly via Node `eval`, record count compared to baseline.

### What got fixed (114 records touched across 6 batches)
1. **Batch 1 — 52.212 family prescriptions:** 4 records (52.212-1, -2, -4 base + Alt I) had stale `prescribedAt` cites pointing to FAR 12.205. Updated to current 12.301(b)(1)/(c)/(b)(3) per the codified FAR (post-FAC update). Mid-batch correction: I had also added 52.212-3 and 52.212-5 as "missing" records based on acquisition.gov; Nick correctly flagged that the RFO deleted them. Reverted those 5 inserts. Saved RFO context to auto-memory (`project_rfo_clause_matrix.md`).
2. **Batch 1b — classDevUrl corruption:** 6 records had title fragments (e.g. "Country of Origin") jammed into the `classDevUrl` field. Cleared to null. (52.219-28 Alt I, 52.222-31, 52.222-46, 52.225-2, 52.225-12, 52.227-10.)
3. **Batch 2 — DFARS class-deviation prefix normalization:** 100 records had `prescribedAt` formatted as `"2026-O0041\n225.601(1)"` instead of the convention `"CD 2026-O0041\n225.601(1)"` used by ~200 sister DFARS CD records. Prepended "CD " to all 100. By prefix: 65 under DFARS Part 225 deviation (2026-O0041), 34 under Part 237 (2026-O0023), 1 under Part 211 (2026-O0013).
4. **Batch 3 — small data-quality fixes:** 52.222-3 date "June 2003" → "JUN 2003"; 852.252-70 ibr "N" → "No"; 5 VAAR 852.x records reg null → "VAAR".
5. **Batch 4 — altFlag/devFlag corruption:** 52.219-28 Alt I altFlag "Exceeds 55% domestic content (yes/no)" → "Yes"; 52.222-46 altFlag same fragment → null; 52.201-1 devFlag "No" → null.
6. **Batch 5 — title cleanup:** 252.225-7049 title double-space → single space.
7. **Batch 6 — high-traffic date spot-check (no edits):** verified 8 clauses (52.204-21, 52.204-25, 52.219-8, 52.225-13, 52.227-14 base + 5 alts, 52.232-25 base + Alt I, 52.247-34) against acquisition.gov. All dates matched.

### What needs Nick's eyes (in priority order)
1. **27 records with footnote-symbol type values (P†, C‡, Pú, Cú, C▫, P†):** the † / ‡ symbols look like real FAR Matrix legend markers; the "ú" almost certainly mojibake from a Latin-1/UTF-8 import error. Two questions: (a) should the renderer display these footnote markers, or normalize off? (b) want me to recover the original glyph for the "ú" cases by re-fetching the source FAR Matrix?
2. **17 records with type=null** (mostly VAAR 852.x): need source review to assign P or C; would not guess.
3. **5 type=null records also reg=VAAR (now fixed) but type still null** — same as above.
4. **52.222-26 (Equal Opportunity) absent from matrix:** likely intentional under EO 14148 revoking EO 11246, but worth confirming and possibly noting in the page narrative.
5. **rfo enum normalization:** field uses three string values + null ("RFO X" / "ADD" / "DFARS CD"). Worth normalizing to a real enum and updating the badge map. Non-urgent.
6. **RFO Part 12 deletion list (46 clauses):** could not extract the official RFO Part 12 deletion list from acquisition.gov practitioner album PDFs in this session. A defensible "matrix is RFO-aligned" claim wants this list compared against the matrix. Best path: download the Part 12 album manually and hand the deletion table to a future session.

### What did NOT get touched
- `clause-matrix.html` — no changes (per scope).
- `clause-detail.js` — no changes.
- Render logic, BUILD_RULES, TRIM_RULES, badge map — no changes.
- The 22 records with `devFlag:"Yes"` — not audited individually.
- DFARS 252.225 family date verification — beyond the prefix fix in Batch 2, no per-clause date sweep.
- DEAR / AFARS / DAFFARS / NMCARS / DLAD records — schema scan only, no per-record audit.
- Tags array contents — not inspected.
- ucf section assignments on the 19 nulls — flagged, not fixed.

### Push instructions for Nick
Single file changed: `data/clause-matrix.js`. Drag-and-drop to GitHub. No HTML or CSS changes.

---

## Checked
*Clauses verified against an authoritative FAR/DFARS source.*

### Batch 1 - 52.212 commercial family (2026-04-21)
- 52.212-1 — date SEP 2023 verified current; prescription cite was stale (12.205(a)(1) → 12.301(b)(1)) per acquisition.gov
- 52.212-2 — date NOV 2021 verified current; prescription cite stale (12.205(a)(2) → 12.301(c))
- 52.212-3 — MISSING from matrix entirely; verified via acquisition.gov (Oct 2025, prescribed 12.301(b)(2), Provision)
- 52.212-3 Alt I — MISSING; verified Feb 2024
- 52.212-4 — date NOV 2023 current; Alt I NOV 2021 current; prescription cite stale on both (12.205(b)(3) → 12.301(b)(3))
- 52.212-5 — MISSING from matrix entirely; verified via acquisition.gov (Mar 2026, prescribed 12.301(b)(4), Clause, IBR Yes)
- 52.212-5 Alt I — MISSING; FEB 2000, prescribed 12.301(b)(4)(i)
- 52.212-5 Alt II — MISSING; OCT 2025, prescribed 12.301(b)(4)(ii)

### Batch 1b - classDevUrl data corruption sweep (2026-04-21)
- 52.219-28--1 — classDevUrl field contained the string "Country of Origin"; cleared to null
- 52.222-31 — classDevUrl "Country of Origin" → null
- 52.222-46 — classDevUrl "Country of Origin" → null
- 52.225-2 — classDevUrl "Country of Origin" → null
- 52.225-12 — classDevUrl "Country of Origin" → null
- 52.227-10 — classDevUrl "Listed Countries of Origin" → null

## Changed
*Clauses with field-level edits.*

### Batch 1 (2026-04-21)
- **52.212-1**: prescribedAt `12.205(a)(1)` → `12.301(b)(1)` — source: https://www.acquisition.gov/far/52.212-1 + https://www.acquisition.gov/far/12.301
- **52.212-2**: prescribedAt `12.205(a)(2)` → `12.301(c)` — source: https://www.acquisition.gov/far/52.212-2 + https://www.acquisition.gov/far/12.301
- **52.212-4**: prescribedAt `12.205(b)(3)` → `12.301(b)(3)` — source: https://www.acquisition.gov/far/52.212-4 + https://www.acquisition.gov/far/12.301
- **52.212-4 Alt I**: prescribedAt `12.205(b)(3)` → `12.301(b)(3)` — same source
- **52.212-3** (NEW RECORD, then REVERTED): I added this as missing because acquisition.gov publishes it, then Nick correctly flagged that the RFO deleted it. Reverted.
- **52.212-3 Alt I** (REVERTED): same — RFO deletion.
- **52.212-5** (REVERTED): same — RFO Part 12 model deviation removed it; statutory references that survived are folded into the overhauled Part 12 itself, not into a flowdown clause.
- **52.212-5 Alt I, Alt II** (REVERTED): same.

The clause matrix is intentionally aligned to the RFO. acquisition.gov is not authoritative for this matrix — RFO model deviation text is. Saved as `project_rfo_clause_matrix.md` in auto-memory.

### Batch 1b - classDevUrl cleanup
- **52.219-28 Alt I, 52.222-31, 52.222-46, 52.225-2, 52.225-12, 52.227-10**: classDevUrl field contained title fragments ("Country of Origin", "Listed Countries of Origin") rather than URLs; cleared to null. This was data corruption, not a deliberate value.

### Batch 6 - high-traffic FAR 52 date spot-check (2026-04-21)
Verified 8 high-traffic clauses against acquisition.gov current text — all dates in matrix matched the published clause-level parenthetical date (not the FAC effective date). No edits needed.

| Clause | Matrix date | acquisition.gov | Status |
|---|---|---|---|
| 52.204-21 (Basic Safeguarding) | NOV 2021 | Nov 2021 | ✓ |
| 52.204-25 (Telecom prohibition) | NOV 2021 | Nov 2021 | ✓ |
| 52.219-8 (Utilization of Small Business) | JAN 2025 | Jan 2025 | ✓ |
| 52.225-13 (Restrictions on Foreign Purchases) | FEB 2021 | Feb 2021 | ✓ |
| 52.227-14 base (Rights in Data—General) | MAY 2014 | May 2014 | ✓ |
| 52.227-14 Alt I-V | DEC 2007 | Dec 2007 | ✓ |
| 52.232-25 (Prompt Payment) | JAN 2017 | Jan 2017 | ✓ |
| 52.232-25 Alt I | FEB 2002 | Feb 2002 | ✓ |
| 52.247-34 (F.o.b. Destination) | JAN 1991 | Jan 1991 | ✓ |

Implication: matrix's date currency on heavily-used FAR 52 clauses is good. The 229 records dated APR 1984 are not necessarily stale — many FAR clauses have never been revised since the 1984 baseline.

### Batch 5 - title cleanup (2026-04-21)
- **252.225-7049**: title had a double space between "Foreign" and "Commercial Satellite Services"; collapsed to single space.

### Batch 4 - altFlag/devFlag corruption (2026-04-21)
- **52.219-28 Alt I (_uid 52.219-28--1)**: altFlag `"Exceeds 55% domestic content (yes/no)"` → `"Yes"`. Title is "...Alternate I" so altFlag should be Yes; the existing value was a stray text fragment from a different field.
- **52.222-46 (Evaluation of Compensation for Professional Employees)**: altFlag `"Exceeds 55% domestic content (yes/no)"` → `null`. Title has no Alt suffix; field was holding the same stray fragment as 52.219-28 Alt I (likely a CSV import shift error).
- **52.201-1 (Acquisition 360: Voluntary Survey)**: devFlag `"No"` → `null`. Convention is null/Yes (1486 records null, 22 Yes); this was the lone "No" outlier.

### Batch 3 - small data-quality fixes (2026-04-21)
- **52.222-3 (Convict Labor)**: date `"June 2003"` → `"JUN 2003"`. Only record in matrix with non-MMM date format.
- **852.252-70 (VAAR Solicitation provisions or clauses incorporated by reference)**: ibr `"N"` → `"No"`. Only record using single-letter "N"; convention is "No"/"Yes"/"Yes*".
- **5 VAAR 852.x records** (852.215-72, 852.216-76, 852.217-70, 852.223-70, 852.223-71): reg `null` → `"VAAR"`. The 852-prefix is VAAR by definition; reg field was simply missing.

### Batch 2 - prescribedAt "CD " prefix normalization (2026-04-21)
100 records had `prescribedAt` values starting with a bare DFARS class deviation number ("2026-O0041\n225.601(1)") instead of the "CD " prefix the other ~200 sister records use ("CD 2026-O0041\n225.601(1)"). All other fields untouched. Distribution by deviation:
- 2026-O0041 (DFARS Part 225 RFO deviation, eff. 2026-02-17): 65 records
- 2026-O0023 (DFARS Part 237 RFO deviation, eff. 2026-02-01): 34 records
- 2026-O0013 (DFARS Part 211): 1 record (252.211-7008)

Fix: prepend "CD " so format matches sister convention. Source: cross-referenced existing 200+ records that already follow the "CD <devnum>\n<cite>" pattern (e.g. 252.203-7000 = "CD 2026-O0031\n203.171-4(a)"). Validated record count unchanged (1509), corrupt count 100 → 0, byte delta exactly +300 (= 3 chars × 100 records).

## Needs human review
*Items where the prescription is ambiguous, where altFlag/devFlag logic isn't clear, or where I would be guessing.*

- **52.212-1, 52.212-3, 52.212-5 rfo field**: existing 52.212-1/-2/-4 have rfo:null. These are commercial provisions with substantial fill-in addenda (esp. 52.212-1 fill-in addendum and 52.212-5 fill-in checkboxes). Should commercial fill-in clauses carry rfo:"RFO X"? Set to null on new records to match existing convention; flagging for Nick's call.
- **52.212-5 base ci values**: I set sup:"R", svc:"R" because 52.212-5 is required in every commercial buy. Existing 52.212-4 base also has R/R, so I followed precedent. Confirm.
- **52.212-3 Alt I trigger**: per FAR text, Alt I adds para (c)(12) for disadvantaged business classification. I matched the Alt I ci/method to existing alt patterns (A across the board). Confirm Alt I should not also be IBR "Yes" with same matrix as base.
- **52.212-5 Alt II prescribing cite**: FAR text says "as prescribed in 12.301(b)(4)(ii)"; recorded that cite. Some publishers cite Alt II differently; confirm.

### FAR Part 12 reorganization — POTENTIALLY SYSTEMIC (HIGH PRIORITY)
The 52.212 family had stale cites pointing at FAR 12.205(a)/(b). I updated those to 12.301(b)(x) to match the current official FAR.

**However:** under the RFO Part 12 model deviation (effective 2025-11-03 via DFARS class deviations, GSA RFO-2025-12, etc.), the new Subpart structure is 12.1 Presolicitation, 12.2 Solicitation/Evaluation/Award, 12.3 Postaward, 12.4 Micro-purchases. The actual prescriptions for retained 52.212-1/-2/-4 now live in new Subpart 12.2 sections (likely 12.202 / 12.203 / 12.204 territory) and are referenced via Tables 12-2, 12-3, 12-4. I was NOT able to extract the exact RFO cite from any class deviation memo I could read (model deviation text is hosted on acquisition.gov but not text-extractable from the PDFs I accessed).

**Deferred to Nick:** confirm whether matrix should carry the current-FAR cite (12.301(b)(x)) or the RFO cite (12.20x). My 12.301 entries are accurate for the codified FAR. If matrix is RFO-only, an additional pass is needed.

### RFO-deleted clause sweep — NOT YET DONE
The RFO Part 12 deviation also removes 46 other provisions/clauses from other FAR parts as no-longer-applicable to commercial buys. The matrix may or may not still carry all 46. A defensible audit needs the actual RFO-removed list (likely in the model deviation Table 12-X annexes). Flagging for separate batch.

### type field has 27 records with footnote-symbol suffixes (NEW, 2026-04-21)
The schema scan turned up the following non-canonical `type` values:
- `"Cú"` x5: 52.222-54, 52.223-9, 52.252-2 Alt, 252.204-7012 Alt, 252.204-7020 Alt
- `"Pú"` x3: 52.223-4, 252.204-7008 Alt, 252.204-7019 Alt
- `"P‡"` x9: mostly 252.225 Buy American Alt records + 252.204-7016 Alt + 252.226-7002 Alt
- `"C▫"` x1: 252.205-7000 Alt
- `"P†"` x9: mostly 252.225 Alt records + 252.209-7002 Alt + 252.216-7008 Alt

The †, ‡ symbols are real FAR Matrix legend markers (typically: † = applies to subcontracts; ‡ = basic clause + alternates have additional requirements). The "ú" appears to be mojibake — likely a Latin-1 character (possibly "°" or similar) that got UTF-8 encoded twice during an import.

Two open questions for Nick:
1. Should the renderer recognize and display these footnote symbols (e.g., as a small superscript next to the type badge), or should they be normalized off?
2. The "ú" characters are almost certainly encoding corruption of a different glyph. Want me to research the original source (FAR Matrix Excel?) to recover the right symbol?

### type=null on 17 VAAR/FAR records (NEW, 2026-04-21)
17 records have `type: null`:
- 52.208-90 (FAR, rfo:"ADD") — Government Supply Sources
- 16 VAAR 852.x records — most are clauses (one is provisions)

Defaulting these to "C" or "P" without checking the source FAR/VAAR text would be a guess. Flagging for human review or separate sourced batch.

### 52.222-26 (Equal Opportunity) absent from matrix (NEW, 2026-04-21)
Spot-check of high-traffic clauses turned up that 52.222-26 (Equal Opportunity) is not in the matrix at all. Probable explanation: EO 14148 (Jan 22, 2025) revoked EO 11246, which authorized the 41 CFR 60-1.4(a)/-300.5/-741.5 clauses including 52.222-26. If KTHQ matrix follows the post-EO state, the absence is intentional. Flagging for confirmation by Nick (and to potentially document in the audit narrative on the page).

### ucf=null on 19 records (NEW, 2026-04-21)
19 records have `ucf: null`. Two are 252.227-7005 Alt I/II (the License Term alternates), one is 52.208-90, and 16 are VAAR 852.x. UCF section assignments are mechanical from the FAR/DFARS source; a small Python pass against the FAR Matrix could fill these in, but doing it record-by-record without source would be guessing. Defer.

## Deferred enhancements
*Larger structural ideas for Nick's decision. Do not build without his sign-off.*

- The "rfo" field uses three string values plus null ("RFO X" / "ADD" / "DFARS CD"). Worth normalizing to a real enum (e.g. "fill-in" / "addendum" / "class-deviation" / null) and updating the badge map. Park.
- 52.212-5 is the master commercial flowdown clause and could justify a dedicated build filter or a "shown when commercial" gate, similar to how data-rights is gated. Park.
- classDevUrl had 6 records with title fragments instead of URLs. Probably an old import error. Worth a one-pass linter at build time to catch any non-URL non-null values. Park.
