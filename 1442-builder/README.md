# SF 1442 Generator

A local, static training tool for building simulated SF 1442 construction, alteration, or repair contract packages.

Open `index.html` in a browser. The app includes:

- SF 1442-style solicitation, offer, and award pages based on the current GSA SF 1442 revision, 12/2022.
- UCF continuation package: Sections A through M.
- Construction CLIN editor with calculated line amounts and total award amount.
- Construction-focused clause selector with bonding, inspection, IDIQ, requirements, payment clauses, and all active FAR 52.236-series construction and architect-engineer clauses incorporated by reference.
- Air Force/deployed exercise defaults for FA4867 PIIDs, separate contract and solicitation serial randomizers, military contacts, undisclosed overseas addresses, and `20XX` training dates.
- Fake deployed contractor roster with UEI-style codes, auto-filled vendor details, Net 30 terms, and DFAS Columbus payment office defaults.
- Randomized Air Force-style accounting data with O&M default funding, optional Other Procurement funding, ACRN/LOA details, and auto-accepted CLINs.
- Form 9/requisition number defaults to the requiring activity DoDAAC format (`F2D3JC-F9-20XX-0001`) and drives the funding document value in the accounting data and SF 30 requisition block.
- DFARS WAWF payment instructions are included in Section G and Section I with realistic deployed routing values.
- Section J starts with no attachments; attachments can be added one by one when an exercise needs them.
- SF 30 modification builder with a separate preview, inheriting award data from the generated SF 1442 package.
- Signature toggles and an apply-signatures button for contractor and Government signature blocks.
- Draft save/load using browser local storage, plus JSON import/export.

This is a training simulator. It does not create an official government contract, it is not connected to FPDS, SAM, CON-IT, EDA, PIEE, agency financial systems, or any procurement system of record, and sample clause text/dates should be verified against the live FAR/eCFR before real-world use.

Reference sources:

- GSA SF 1442: https://www.gsa.gov/reference/forms/solicitation-offer-and-award-construction-alteration-or-repair
- FAR 36.701: https://www.ecfr.gov/current/title-48/chapter-1/subchapter-F/part-36/subpart-36.7/section-36.701
- FAR 53.236-1: https://www.ecfr.gov/current/title-48/chapter-1/subchapter-H/part-53/subpart-53.2/section-53.236-1
- DFARS 232.7004: https://www.acquisition.gov/dfars/232.7004-contract-clauses.
- DFARS 252.232-7006: https://www.acquisition.gov/dfars/252.232-7006-wide-area-workflow-payment-instructions.
