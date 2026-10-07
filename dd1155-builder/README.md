# DD 1155 Builder

Static, browser-local training builder for DD 1155 purchase orders, delivery orders, and BPA calls. Shares the SF 1449 Generator's editor styling.

Features: all 42 blocks, optional receiving/payment entries, contractor acceptance and simulated signature toggles, editable CLINs with calculated totals, funding, free-text order terms, local draft save/load, validated JSON import/export, continuation pages, and browser print-to-PDF.

The face page uses vector artwork extracted from the user-supplied blank DD 1155, DEC 2001 (updated 20241203), at its original 612 x 792 point dimensions. Original typography and rules remain unchanged. PDF viewer signature controls are excluded; checkbox outlines and entered values are positioned at the original widget coordinates. Up to three CLINs appear in the actual schedule area; larger schedules and field overflow go to continuation sheets. All line-item details are also included in the continuation schedule. No text is silently truncated to fit a block.

Use fictional exercise data. Signatures entered by the builder are simulated, not digital signatures. Clause text is entered by the user; there is no automated clause applicability determination. Drafts remain in browser storage until cleared or overwritten. JSON exported by this builder uses `kthq-dd1155-v1`; older drafts load with empty receiving/payment fields, and drafts from other builders are rejected.

`assets/dd1155-template.svg` holds the original form artwork; `template-fields.js` holds its field rectangles; `exact-form.js` maps the editor state into those rectangles. Both live preview and browser printing use the same artwork and values. The SVG text is outlined to preserve the source lettering without external fonts.

References:
- [Official DD 1155, DEC 2001](https://www.esd.whs.mil/Directives/forms/dd1000_1499/DD1155/)
- [DFARS PGI 253.213-70 completion instructions](https://www.acquisition.gov/dfarspgi/pgi-253.213-70-completion-dd-form-1155-order-supplies-or-services.)
