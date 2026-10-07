# DD 1155 Builder

Static, browser-local training builder for DD 1155-style purchase orders, delivery orders, and BPA calls. Shares the SF 1449 Generator's editor styling.

Features: order-preparation blocks 1–25, contractor acceptance and simulated signature toggles, editable CLINs with calculated totals, funding, free-text order terms, local draft save/load, validated JSON import/export, continuation pages, and browser print-to-PDF.

The output is a clearly marked training layout, not a replica of the official fillable form. Receiving and payment blocks 26–42 are reserved for later processing. Clause text is entered by the user; there is no automated clause applicability determination. Drafts remain in browser storage until cleared or overwritten. JSON exported by this builder uses `kthq-dd1155-v1`; drafts from other builders are rejected.

References:
- [Official DD 1155, DEC 2001](https://www.esd.whs.mil/Directives/forms/dd1000_1499/DD1155/)
- [DFARS PGI 253.213-70 completion instructions](https://www.acquisition.gov/dfarspgi/pgi-253.213-70-completion-dd-form-1155-order-supplies-or-services.)
