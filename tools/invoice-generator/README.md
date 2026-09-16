# Invoice Generator — slate #8

Australian invoice and quote authoring at `/tools/invoice-generator/`, with an
Xero comparison at `/vs/xero/`. Included on the local homepage. Registry `live`
means included in the build, not deployed publicly.

## Preview and tests

From the repository root:

```sh
python3 build.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
node tests/invoice-generator.test.cjs
# With Chrome, pdftotext and pdfinfo installed and the server running:
node tests/invoice-generator.browser.cjs
```

Preview: http://127.0.0.1:8765/tools/invoice-generator/

No third-party runtime dependencies, install step or network requests. The
browser test accepts `CHROME_BIN` and `TEST_URL` overrides.

## User workflow

1. Choose invoice or quote; enter the number, issue date and due/expiry date.
2. Select the business's GST registration/pricing mode. Enter seller and customer
   details, and an ABN when using a GST-registered mode.
3. Add descriptions, quantities, unit prices and per-line GST treatment.
4. Optionally enter the amount already paid, payment instructions and notes.
5. Use **Print / save PDF**, then choose **Save as PDF** in the browser dialog.
   Disable browser headers and footers for the clean document.
6. Save a JSON draft to retain editable source. Open that file to continue later.

The tool does not automatically save, send invoices, request payment or keep a
ledger. Refreshing/closing the tab clears unsaved state. Example and New document
replace the current draft; save a file first if you need to retain it.

## Calculation and validation

- AUD only. No GST, registered GST-exclusive, or registered GST-inclusive mode.
- Optional no-GST lines support documents with mixed treatments.
- Quantities have at most 3 decimal places; unit prices and payments have 2.
- Decimal input is parsed into scaled BigInt integers. Quantity × price is rounded
  to cents, then line GST is rounded half up: 10% of the exclusive line amount or
  1/11 of the inclusive line amount. Totals sum the displayed rounded lines.
- Inclusive line totals retain the entered price. Net + GST = gross in all modes.
- Payments reduce the amount due; overpayments, negative lines, credit notes and
  adjustments are outside this version's scope. Quotes ignore the paid field.
- Up to 100 items, quantities up to 1,000,000, total up to $999,999,999.99.
- Seller, customer, document number, valid dates and line descriptions are required
  before printing. Customer identity is always included, including larger invoices.
- Registered mode uses “Tax Invoice”; unregistered mode uses “Invoice” and omits
  GST columns. Quotes use “Quote” and explicitly state they are not tax invoices.
- ABN validation is local format/checksum validation only. It does not look up
  entity identity or confirm ABN/GST registration.

Review the correct GST treatment for the business and supply. This tool handles
ordinary line-item invoices, not specialised tax arrangements or accounting.

## Rendering and draft handling

All user content is inserted with textContent. The preview and print document
share one renderer, including optional payment/notes sections. A4 print CSS hides
the editor and site chrome, repeats table headers and avoids splitting rows where
possible. Invalid documents print an instruction to complete fields instead of
an incomplete invoice. Very large individual blocks may still span pages.

Drafts use `{format: "plenty-of-tools-invoice", version: 1, data: ...}`. Import
accepts incomplete field values, validates structure/types/lengths and copies only
known keys. Max file size is 1 MB. A failed import leaves the current document
intact; a pending import cannot replace edits made after its read started.
No content goes into browser storage, URLs, cookies or network requests.

## Evidence and verification

12 core tests cover GST-inclusive/exclusive/mixed calculations, exact half-cent
rounding, decimal quantities, bounds, quote payment behaviour, ABN checksum,
date validation, required fields and safe draft round trips.

Chrome tests validate the UI and actual A4 PDFs through `Page.printToPDF` plus
`pdftotext`/`pdfinfo`: one-page invoices, quotes, and a five-page 65-line invoice
with all items and repeated headers. Also covers invalid print blocking, draft
downloads/reopen, malformed import preservation, add/remove, HTML escaping,
mobile overflow and operation with networking disabled and no browser storage.
Screenshots, PDFs and drafts are saved under a temporary `invoice-browser-*`
directory. Mobile layout is tested in a desktop Chrome viewport, not a physical
phone's native print dialog.

Primary references checked September 2026:

- Australian Government invoicing guidance:
  https://business.gov.au/finance/payments-and-invoicing/how-to-invoice
- ABN format and checksum:
  https://abr.business.gov.au/Help/AbnFormat
- ATO tax invoice guidance and rounding:
  https://www.ato.gov.au/businesses-and-organisations/gst-excise-and-indirect-taxes/gst/tax-invoices

The example is fictional and deliberately uses no GST and no ABN. Tests use the
ABR's published ABN example solely to verify checksum/validation behaviour.
