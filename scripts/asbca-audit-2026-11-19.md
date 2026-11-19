# ASBCA importer audit (2026-11-19)

Scope: the 18 latest indexed cards. Each source was retrieved from its official ASBCA URL through the existing reader transport; caption identities and operative sections were checked. Direct PDF download returned HTTP 403 for Sweet Star, so this is reader-text verification, not PDF-byte or visual verification. No source-unavailable cards remain in this audit. No legal inference is made from historical facts or citations.

Sweet Star 64505 grants the Army summary-judgment motion; the old excerpt was a historical 2020 dismissal of 62082. Parrish 64471 denies the government's dismissal motions. Ashridge 64446 dismisses specified claims and stays the remainder. Motion rulings are explicitly distinct from appeal outcomes. Xerox's parenthesized URL is repaired and now returns the dismissal order rather than a 404 page.

## Card audit

- ASBCA No. 64505 (Sweet Star): Motion / partial ruling. We grant the Army's motion for summary judgment.
- ASBCA No. 64129 (GSINA-Pacific JV II LLC): Dismissed. The appeal has been withdrawn. Accordingly, it is dismissed from the Board's docket with prejudice.
- ASBCA No. 64333 (Texas Global Distribution LLC): Dismissed. For the foregoing reasons, the Board grants the Air Force's motion. Texas Global's appeal is dismissed with prejudice.
- ASBCA No. 64384 (Stonewin International LLC): Sustained. The appeal is sustained. Stonewin is entitled to $673,077.75, plus Contract Disputes Act (CDA) interest accruing from March 13, 2024. See 41 U.S.C. § 7109(a).
- ASBCA No. 64299 (Relyant Global LLC): Dismissed. The dispute has been settled. The appeal is dismissed with prejudice.
- ASBCA Nos. 63880, 63881 (Granite Construction Company): Dismissed. By email dated October 21, 2026, appellant's counsel informed the Board that "Granite has elected not to proceed further with the above-referenced appeals" and further requested their dismissal with prejudice and for the Board to cancel the hearing. Appellant's request is granted. The hearing is cancelled and we hereby order these appeals be dismissed with prejudice.
- ASBCA Nos. 63936, 63937 (California Department of Rehabilitation): Dismissed. The dispute has been settled. The appeals are dismissed with prejudice.
- ASBCA No. 63915 (Sacyr Construccion, SA): Settled. It is the Board's decision, pursuant to 41 U.S.C. §§ 7105(e), 7108(b), and the parties' stipulation and agreement, that the appeal is sustained. In the nature of a consent judgment, the Board makes a monetary award to appellant in the amount of $2,300,000. This amount is inclusive of Contract Disputes Act interest. No further interest shall be paid.
- ASBCA No. 64681 (Paragon Micro Inc.): Dismissed. The dispute has been settled. The appeal is dismissed with prejudice.
- ASBCA Nos. 64025-ADR, 64026-ADR, 64027-ADR (General Dynamics Ordnance and Tactical Systems): Dismissed. The dispute has been settled. The appeals are dismissed with prejudice.
- ASBCA No. 64471 (Parrish Business Services, LLC): Motion / partial ruling. The government's motions to dismiss are denied.
- ASBCA No. 64546 (Ladgov Corporation): Dismissed. The dispute has been settled. The appeal is dismissed with prejudice.
- ASBCA Nos. 63378, 64226, 64439 (J.A.M. Construction Services, Inc.): Dismissed. The dispute has been settled. The appeals are dismissed with prejudice.
- ASBCA No. 64019 (Xerox Corporation): Dismissed. The dispute has been settled. The appeal is dismissed with prejudice.
- ASBCA No. 63920 (Walsh Construction Company): Settled. It is the Board's decision, pursuant to 41 U.S.C. §§ 7105(e), 7108(b), and the parties' stipulation and agreement, that the appeal is sustained. In the nature of a consent judgment, the Board makes a monetary award to appellant in the amount of $1,450,000. This amount is inclusive of Contract Disputes Act interest. No further interest shall be paid.
- ASBCA No. 64618 (Lemek, LLC): Dismissed. ... By Order dated September 25, 2026, the Board directed appellant to show that it was represented by a person meeting the criteria of Board Rule 15(a), and that if it did not comply with the September 25, 2026 Order, the Board might dismiss the appeal without further notice to the parties. Appellant did not respond to the September 25, 2026 Order. A representative meeting the requirements of Board Rule 15(a) did not enter a notice of appearance. Without a representative meeting the requirements of Board Rule 15(a), the Board is unable to proceed. Accordingly, the appeal is dismissed.
- ASBCA No. 64446 (Ashridge, Inc.): Motion / partial ruling. For the reasons discussed above, we grant the motion to dismiss for failure to state a claim, and dismiss Claim 1 (FAR § 49.402-3(f)), Claim 2 (Show Cause Notice), Claim 5 (FAR § 49.402-4), and Claim 6 (Termination Notice). We stay the remainder of this appeal for 30 days. Within 30 days of the date of this decision, the appellant shall file a status report on the status of Claim 3 (Excusable Delay).
- ASBCA No. 64564 (GSINA-Pacific JV II LLC): Dismissed. The appeal has been withdrawn. Accordingly, it is dismissed from the Board's docket with prejudice.

## Checks

Run `python -m unittest discover -s scripts -p test_asbca_decisions.py -v`, `python -m py_compile scripts/fetch_asbca_decisions.py`, `node --check data/asbca-live.js`, and `git diff --check`. Both generated bundles must contain identical payloads. Missing source identity, error pages, missing operative sections, and conflicting dispositions abstain rather than inferring an outcome from filename/history.

Remaining limitation: this deliberately conservative parser is not a legal summarizer. Unrecognized future opinion formats display Read Decision and a verification limitation. Review remains required before merge/deployment.
