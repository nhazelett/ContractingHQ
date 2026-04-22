# Clause data cleanup flags — HOLD FOR LATER

Surfaced during the clause-detail audit. Issues that need follow-up but don't fit the sp-rewrite/delete workflow. Address in a dedicated cleanup pass after the alphabetical sp audit completes.

---

## p (prescription) cleanup needed

- **252.209-7012** (batch 2) — prescription text matches 252.209-7011 verbatim. Likely a duplicate copy/paste. Verify against DFARS; either rewrite p or delete record under no-source rule.
- **252.215-7015** (batch 2) — prescription says "Insert the clause at 252.215-7995..." Likely mis-numbered or deviation-era duplicate of -7995. Verify against DFARS; if no distinct prescription exists, delete.
- **252.211-7003** (batch 2) — prescription ends with mojibake "(a).ply." (likely truncation of "Supply.").
- **52.215-12, 52.215-13** (batch 2 cross-find) — both literally start with "(DoD-specific guidance: Contracting officers shall NOT use Alternate I of FAR **52.214-28**..." which is the prescription for a different clause. Cross-contaminated paste.
- **252.219-7010** (batch 3) — p reads "In lieu of DFARS 252.219-7010, use the deviated version of this clause." Recursive/wrong — should be the codified prescription for the 8(a) PA notification clause.
- **252.225-7001--1, --2, --3** (batch 3) — all three Alt records share the same p text, which only describes Alt III (Afghanistan + alt domestic content). Per current DFARS each alt has a distinct trigger; rewrite Alt I (Trade Agreements) and Alt II (alt domestic content threshold) prescriptions.
- **252.225-7003** (batch 3) — p text starts "Use the provision at 252.215-7003, Requirement for Submission of Data..." — wrong clause referenced (252.215-7003 is Canadian Commercial Corp, unrelated to overseas-performance reporting).
- **252.225-7006** (batch 4) — p reads "use the deviated version of clause 252.225-7006" — same recursive pattern as 252.219-7010. Should describe the codified prescription.
- **252.225-7036 family** (batch 4, 12 records: base + Alt I–XI) — every record shares an identical `p` text describing only Alt XI conditions. Per current DFARS 225.1101(10) each alt has a distinct trigger; batch 4 sps were written generically (variant identification only) so COs can rely on the full clause text. Rewrite all 12 prescriptions in a future cleanup pass.
- **252.225-7045 alt family** (batch 5, 6 records: Alt II–VII) — same pattern as -7036: all share an Alt-VII-only `p` text. Sps written generically in batch 5. Rewrite all prescriptions in a future pass.
- **252.225-7980** (batch 5) — title is "Prohibition Regarding Russian Fossil Fuel Business Operations - Representation (DEVIATION 2024-O0008)" but the `p` text describes Djibouti products/services. Cross-contaminated paste from 252.225-7986. Rewrite `p` to the actual CD 2024-O0008 prescription.
- **252.225-7966/-7967 vs 252.225-7980** (batch 5) — overlapping Russian fossil fuel deviations: 7966/7967 cite CD 2024-O0006 R1 (representation + clause), 7980 cites CD 2024-O0008 (representation only). Verify whether CD 2024-O0008 supersedes 2024-O0006 R1; if so, delete -7966/-7967 under the CD do-not-use rule.
- **252.232-7016** (batch 7) — `p` text says "use this provision in lieu of FAR 52.232-3, Notice of Progress Payments" — but the cite that follows correctly references 52.232-13. The opening cite is wrong (52.232-3 is Discounts for Prompt Payment, unrelated). Fix `p` cite to 52.232-13.
- **252.235-7001** (batch 7) — `p` text reads "Use this clause in fixed-price solicitations" but the title is "Indemnification Under 10 U.S.C. 2354 — Cost Reimbursement". p is duplicated from -7000. Rewrite to describe the cost-reimbursement variant.
- **252.247-7023** (batch 9) — `p` text truncated mid-word, starts with lowercase "l products and commercial services that are commissary or exchange cargoes transported outside of the Defense Transportation System (10 U.S.C. 2643), when the contract is not a construction contract." The leading "Use this clause in solicitations and contracts, including solicitations and contracts using FAR Part 12 procedures for the acquisition of commercial" was lost. Rewrite p.
- **252.251-7000** (batch 9) — `p` text says "the clause at FAR 52.251: , Government Supply Sources" — mojibake: should be "FAR 52.251-1, Government Supply Sources".
- **52.213-4** (batch 11) — `p` reads "use the paragraphs in the deviated version of this solicitation or clause in lieu of the non-deviated version." Recursive — should describe the codified prescription for noncommercial simplified-acquisition T&Cs (FAR 13.302-5(d)).
- **52.214-27** (batch 11) — `p` reads "Contracting officers shall use the deviation version of this clause in lieu of the basic clause." Recursive — should describe the codified prescription (sealed-bid contracts, CCPD modifications anticipated; cross-ref CD if applicable).
- **52.222-9** (batch 14) — `p` reads "use the paragraphs in the deviated version of this solicitation or clause in lieu of the non-deviated version." Recursive — should describe the codified prescription (apprentices and trainees in $2,000+ construction within the U.S.).
- **52.223-10** (batch 14) — same recursive "use deviated version" `p`. Should describe codified prescription (waste reduction in services on Federal facilities).
- **52.223-23** (batch 14) — same recursive "use deviated version" `p`. Should describe codified prescription (sustainable products and services).
- **52.219-14** (batch 13) — `p` reads "use the clause at Attachment 1, 52.219-14, Limitations on Subcontracting (DEVIATION 2021-O0008), in lieu of the clause at FAR 52.219-14." Reference is fine, but rewrite p to describe the underlying codified prescription so COs see the actual trigger (set-aside or sole-source acquisitions that include 52.219-14 — see FAR 19.507(e)) without having to chase the deviation memo.
- **52.232-15** (batch 16) — `p` reads "The contracting officer shall insert this provision in invitations for bids if the solicitation will not contain 52.232-3 or -14." 52.232-3 is Discounts for Prompt Payment — unrelated. Should read "52.232-13 or -14" (Notice of Progress Payments; or Notice of Availability of Progress Payments Exclusively for SB).
- **52.232-40** (batch 17) — `p` reads "Insert the clause at 52.232-90, Fast Payment Procedure, in solicitations and contracts when the conditions in 32.1202 are applicable…" — cross-loaded from 52.232-90 (Fast Payment). 52.232-40 is "Providing Accelerated Payments to Small Business Subcontractors"; actual prescription is 32.009-2 (flowdown of 15-day accelerated payment to SB subcontractors). Rewrite `p`.
- **52.244-6** (batch 19) — `p` reads "For new solicitations and contracts, use the paragraphs in the deviated version of this solicitation or clause in lieu of the non-deviated version." Same recursive "use deviated version" pattern flagged on 52.213-4 / 52.214-27 / 52.222-9 / 52.223-10 / 52.223-23. Should describe the codified prescription (commercial-subcontract flowdown, FAR 44.402(b)/44.403).

## ft (full clause text) missing or empty

These records have ft length 0 or near-zero. Modal won't show usable clause text. Backfill from current DFARS / class-deviation memos:

- **252.219-7996** (batch 3) — ftLen 0
- **252.219-7997** (batch 3) — ftLen 0
- **252.223-7997** (batch 3) — ftLen 0
- **252.223-7998** (batch 3) — ftLen 0
- **252.225-7000** (batch 3) — ftLen 3
- **252.225-7002** (batch 3) — ftLen 0
- **252.225-7004** (batch 3) — ftLen 0
- **252.225-7005** (batch 3) — ftLen 25
- **252.225-7006** (batch 4) — ftLen 3
- **252.225-7007, -7008, -7009, -7012, -7015, -7016, -7018, -7019, -7040** (batch 4) — ftLen 0–134 (all near-empty)
- **252.225-7963, -7975, -7976, -7977, -7980, -7986, -7987, -7993, -7995, -7997** (batch 5) — ftLen 0 across the entire 252.225-79xx class-deviation block. Backfill from current class-deviation memos.
- **252.227-7000, -7005** (batch 5) — ftLen 0 on two DFARS patent/license clauses.
- **252.227-7012, -7017, -7019, -7023, -7024, -7027, -7030, -7037** (batch 6) — ftLen 0 across DFARS 252.227 patents/data-rights records that lack canonical clause text.
- **252.227-7989, -7991, -7992, -7994, -7995, -7996, -7997, -7998, -7999** (batch 6) — ftLen 0 across the entire 252.227-79xx class-deviation block (tech data rights for DoD commercial + STTR additions per CD 2026-O0036). Backfill from current class-deviation memos.
- **252.229-7001** (batch 6) — ftLen 0 on the German tax-relief clause.
- **252.232-7002, -7006, -7013, -7016, -7018** (batch 7) — ftLen 0 across five DFARS payment clauses.
- **252.233-7001** (batch 7) — ftLen 0 (Choice of Law - Overseas).
- **252.234-7004, -7998, -7999** (batch 7) — ftLen 0 across CSDR clause + the two new CD 2026-O0011 EVMS deviation records.
- **252.235-7003** (batch 7) — ftLen 0 (Frequency Authorization base + Alt I).
- **252.236-7005** (batch 7) — ftLen 0 (Airfield Safety Precautions).
- **52.214-16** (batch 11) — ftLen 0 (Minimum Bid Acceptance Period).
- **52.214-28** (batch 11) — ftLen 0 (Subcontractor CCPD — Modifications — Sealed Bidding; base + Alt I record).
- **52.215-13** (batch 12) — ftLen 0 (Subcontractor CCPD — Modifications; base + Alt I record).
- **52.216-11** (batch 12) — ftLen 0 (Cost Contract—No Fee; base + Alt I record).
- **52.216-12** (batch 12) — ftLen 0 (Cost-Sharing Contract—No Fee; base + Alt I record).
- **52.216-23** (batch 12) — ftLen 0 (Execution and Commencement of Work; letter-contract clause).
- **52.224-2** (batch 15) — ftLen 0 (Privacy Act).

## Tag misclassification (out of audit scope, log for later sweep)

- **252.217-7026, -7027, -7028** (batch 3) — tagged `vessels` because they share the 252.217 subpart with the master vessel-repair set, but their actual subjects (Sources of Supply, Contract Definitization, Over and Above Work) are general DoD acquisition concepts, not vessel-specific. Remove `vessels` tag in a future cleanup.
- **252.247-7028** (batch 9) — tagged `fms` but subject is Bills of Lading / Domestic Route Order shipping, not Foreign Military Sales. Remove `fms` tag in a future cleanup.

## Agency-supplement ft gap (systemic)

- **VAAR 852.xxx** (batch 22, ~38 records in this slice alone + more to come) — the entire VAAR 852 block has `ft` length 0. Detail modal has no clause text. Not a per-record flag; this is a dataset-wide VAAR ingestion gap. Backfill in bulk from 48 CFR Part 852 in a future pass.
- **AFFARS 5352.242-9001** (batch 22) — ft length 0 for Common Access Cards for Contractor Personnel (p is present; ft missing).
- **AFFARS 5452.233-9001** (batch 22) — ft length 0 for the AF-specific agency protest program provision.
- **852.217-70** (batch 22) — `p` is literally "This clause has not yet been added to acquisition.gov." Matrix has title "Contract Action Definitization" and prescription at VAAR 817.7005(a). sp written from matrix metadata; rewrite `p` and backfill `ft` from actual VAAR text in a future pass.
- **852.219-72** (batch 22) — p text contains "NOTE: THE VA NO LONGER HAS A MENTOR-PROTEGE PROGRAM." Verify current VAAR 819.7105 — if the Mentor-Protégé program is fully discontinued, delete this clause under the no-source rule. Retained for now since the clause is still codified.
- **852.271-72, -73, -74, -75** (batch 23) — all four vocational rehabilitation/employment services clauses share the same identical p text in the data. Per current VAAR 871.204, these are distinct clauses with distinct triggers (use of Gov facilities, subcontracting approval, Gov-furnished trainees, T4C adjustments). Sps written with variant descriptors; rewrite each `p` from current VAAR in a future pass.
- **852.273-72** (batch 23) — p text reads "lieu of the provision at 52.212-2, Evaluation--commercial items" — note that 52.212-2 was deleted by the RFO, so this VAAR clause references a deleted FAR provision. Additionally p contains mojibake "commercial products and commercial servicess". Either rewrite `p` to point at the RFO-era equivalent or flag VAAR clause for deletion if superseded.
- **952.226-74** (batch 24) — p contains mojibake "commercial products and commercial servicess" (double-s). Rewrite `p` in cleanup pass.
- **952.245-5** (batch 24) — p cite reads "FAR 52.245:" (mojibake) — should be "FAR 52.245-1" per body text. Fix `p` cite.
- **970.5215-1** (batch 24) — p contains mojibake "self: ssessment" — should be "self-assessment". Rewrite `p` in cleanup pass.
- **970.5222-1** (batch 24) — p cite reads "FAR 52.222: ." (mojibake) — should be "FAR 52.222-1". Fix `p` cite.
- **970.5227-12** (batch 25) — p uses "Alternate 1" (numeric 1) while the companion clause 970.5227-10 uses "Alternate I" (Roman numeral I) for the same prescription. Normalize to "Alternate I" in cleanup pass.

## DEAR ft gap (systemic)

- **DEAR 952.xxx and DEAR 970.5xxx-x** (batch 23-24, ~80+ records total) — the entire DEAR 952 and 970 blocks have `ft` length 0 across the board. Same systemic ingestion gap as VAAR. Backfill in bulk from 48 CFR Chapter 9 in a future pass. Not a per-record flag.
