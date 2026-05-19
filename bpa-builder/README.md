# BPA Generator

A local, static training tool for building simulated Blanket Purchase Agreements and BPA calls.

Open `index.html` in a browser. The app includes:

- Master BPA package with an SF 1449-style face page and FAR 13.303-style mandatory BPA language.
- BPA call package with an OF 347-style order face page, line items, Form 9/requisition number, accounting data, WAWF instructions, and call terms.
- BPA calls can either print priced lines or reference an attached price list/catalog.
- Master BPA defaults with no ceiling or obligated amount; funding and obligations live on individual calls.
- Support for open market BPAs and Federal Supply Schedule BPAs, including Schedule-contract supplement language when FSS mode is selected.
- Air Force/deployed exercise defaults for FA4867 BPA/call PIIDs, requiring activity Form 9 numbers, military contacts, undisclosed overseas addresses, DFAS Columbus, and `20XX` training dates.
- Fake deployed supplier roster with UEI-style codes and simulated CAGE codes.
- O&M default funding with optional Other Procurement funding for calls.
- Clause/reference selector with core BPA, commercial, payment, and WAWF references.
- Draft save/load using browser local storage, plus JSON import/export.
- Print preview and Save to PDF using the browser print dialog.

This is a training simulator. It does not create an official government contract, BPA, purchase call, or procurement record, and it is not connected to CON-IT, GPC systems, PIEE/WAWF, EDA, SAM, FPDS, agency finance systems, or any system of record. Live FAR/DFARS language and agency procedures should be verified before real-world use.

Reference sources:

- FAR 13.303: https://www.acquisition.gov/far/13.303
- FAR 13.303-3: https://www.acquisition.gov/far/13.303-3
- FAR 13.303-5: https://www.acquisition.gov/far/13.303-5
- FAR 13.303-6: https://www.acquisition.gov/far/13.303-6
- FAR 13.307: https://www.acquisition.gov/far/13.307
- FAR 8.405-3: https://www.acquisition.gov/far/8.405-3
- GSA OF 347: https://www.gsa.gov/reference/forms/order-for-supplies-and-services-1
- DFARS 252.232-7006: https://www.acquisition.gov/dfars/252.232-7006-wide-area-workflow-payment-instructions.
