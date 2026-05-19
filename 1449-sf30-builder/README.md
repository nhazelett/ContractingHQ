# SF 1449 Generator

A local, static training tool for building simulated SF 1449 contract packages.

Open `index.html` in a browser. The app includes:

- SF 1449-style cover page based on the current GSA SF 1449 revision, 11/2021.
- UCF continuation package: Sections A through M.
- CLIN editor with calculated line amounts and total award amount. The SF 1449 face page points Blocks 19-24 to continuation, while the detailed schedule prints in Section B.
- Clause selector with core commercial clauses plus option, IDIQ, requirements, services, and payment clauses.
- Live print preview and a Save to PDF button that opens the browser print dialog.
- Draft save/load using browser local storage, plus JSON import/export.
- Air Force/deployed exercise defaults for FA4867 PIIDs, separate contract and solicitation serial randomizers, military contacts, undisclosed overseas addresses, and `20XX` training dates.
- Fake deployed contractor roster with UEI-style codes, auto-filled vendor details, Net 30 terms, and DFAS Columbus payment office defaults.
- Randomized Air Force-style accounting data with O&M default funding, optional Other Procurement funding, ACRN/LOA details, and auto-accepted CLINs.
- Form 9/requisition number defaults to the requiring activity DoDAAC format (`F2D3JC-F9-20XX-0001`) and drives the funding document value in the accounting data and SF 30 requisition block.
- DFARS WAWF payment instructions are included in Section G and Section I with realistic deployed routing values.
- Section J starts with no attachments; attachments can be added one by one when an exercise needs them.
- SF 30 modification builder with a separate preview, inheriting award data from the generated SF 1449 package.
- Signature toggles and an apply-signatures button for contractor and Government signature blocks.

This is a training simulator. It does not create an official government contract, it is not connected to FPDS, SAM, CON-IT, EDA, PIEE, agency financial systems, or any procurement system of record, and sample clause text/dates should be verified against the live FAR/eCFR before real-world use.

Reference sources:

- GSA SF 1449: https://www.gsa.gov/reference/forms/solicitationcontractorder-for-commercial-products-and-commercial-services
- FAR 12.204: https://www.ecfr.gov/current/title-48/chapter-1/subchapter-B/part-12/subpart-12.2/section-12.204
- FAR 53.212: https://www.ecfr.gov/current/title-48/chapter-1/subchapter-H/part-53/subpart-53.2/section-53.212
- DFARS 232.7004: https://www.acquisition.gov/dfars/232.7004-contract-clauses.
- DFARS 252.232-7006: https://www.acquisition.gov/dfars/252.232-7006-wide-area-workflow-payment-instructions.
