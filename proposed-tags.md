# Proposed new tags — HOLD FOR REVIEW

Surfaced during the clause-detail audit. Not applied. Nick reviews and approves at end of audit before any bulk application.

Format: `clause-id | proposed-tag | why`

---

## Batch 1 (records 1-50)

- **252.204-7021** | `do-not-use` | Class-deviation instructing COs to NOT include this DFARS clause in new solicitations/contracts. UI should visually demote. Open to better name (`deviation-suppressed`? `do-not-include`?).
- **1452.228-71, 1452.228-72, 1452.228-73** | `aircraft` | Three DOI aircraft-operation clauses with distinct prescriptions. May be worth grouping if other aircraft-relevant clauses (e.g., DFARS 252.228 series) justify a Build pill.

## Batch 2 (records 51-100)

- **252.204-7998, 252.215-7990, 252.215-7991, 252.215-7992, 252.215-7993, 252.215-7994, 252.215-7995, 252.215-7996, 252.215-7997, 252.215-7998** | `class-deviation` | 10 DoD Pricing & Contracting class-deviation clauses rather than codified DFARS. Users deserve a filter to show/hide them. Existing `rfo` field already carries some metadata but a visible tag in Build row pays off.
- **252.216-7000, 252.216-7001, 252.216-7003, 252.216-7007, 252.216-7008** | `econ-price-adjustment` | Five economic price adjustment clauses with overlapping prescriptions. Candidate for a dedicated EPA filter pill. Lower priority than `class-deviation`.

## Batch 3 (records 101-150)

- **252.219-7996, 252.219-7997, 252.223-7997, 252.223-7998** | `class-deviation` | Four more class-deviation clauses (extending the batch 2 set). 252.219-79xx are SBSP/CSP Test Program; 252.223-79xx are PFOS/PFOA per CD 2022-O0010 R1. Same filter rationale as batch 2.
- **252.219-7009, 252.219-7010, 252.219-7011** | `partnership-agreement` | Three DFARS clauses tied specifically to SBA/DoD 8(a) Partnership Agreement contracts. Distinct from generic 8(a) work; a filter would help COs working a PA buy. Existing tags are `small-biz, set-aside` which are too broad.
- **252.223-7997, 252.223-7998** | `pfas` | Two PFOS/PFOA-specific clauses. Useful filter for environmental compliance. Low priority but cheap.
- **252.225-7000 through 252.225-7005** | (no new tag) | Already correctly tagged `buy-american`. No change.

## Batch 5 (records 201-250)

- **252.225-7963, -7964, -7966, -7967, -7972, -7973, -7975, -7976, -7977, -7980, -7986, -7987, -7993, -7995, -7997** | `class-deviation` | 15 more DFARS 252.225 class-deviation clauses. Extends the class-deviation proposal from batches 2 and 3 to cover the foreign-policy / overseas-operations block.
- **252.225-7053, -7054, -7966, -7967, -7980** | `russia-restrictions` | Five records specific to Russian energy / Russian fossil fuel prohibitions. Worth a dedicated filter given current salience. Skip if `class-deviation` alone is enough.
- **252.225-7057, -7058, -7059, -7060** | `china-restrictions` | Four records specific to PRC / Xinjiang restrictions. Same rationale as russia-restrictions.
- **252.227-7000 through -7005** | `patent-license` | Six DFARS patent/license clauses that all trigger only in patent releases, license agreements, or settlement agreements. Existing `ip-data` tag is broader (covers data rights too); a narrower `patent-license` would let COs filter specifically for patent licensing work. Lower priority.

## Batch 6 (records 251-300)

- **252.227-7989, -7991, -7992, -7994, -7995, -7996, -7997, -7998, -7999** | `class-deviation` | Nine more class-deviation clauses extending the running set — DFARS 252.227-79xx tech data rights for DoD commercial products/services + STTR pre/postaward additions (CD 2026-O0036). Same filter rationale as prior batches.
- **252.227-7006 through -7010** | `patent-license` | Five additional DFARS patent release/settlement/license records (running royalty terms, computation, reporting) — extends the batch 5 `patent-license` proposal to the running-royalty subgroup.
- **252.227-7018, 252.227-7030, 252.227-7998, 252.227-7999** | `sbir-sttr` | Four DFARS records that trigger specifically on SBIR or STTR contracts (technical data generated under SBIR/STTR; the two new STTR class deviations from CD 2026-O0036). Existing `ip-data` covers the topical overlap but not the program trigger. Useful for COs running an SBIR/STTR buy.

