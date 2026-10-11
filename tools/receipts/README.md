# Receipts to Expenses (#20)

Photos of receipts to an editable expense table and CSV, at `/tools/receipts/`. Built 7 October
2026, **hidden** (noindex, absent from the home page and sitemap) and **not committed**.

## How it works

- `static/core.js` (pure, `tests/receipts.test.cjs`): reads OCR text from Australian receipts.
  Day first dates in the common formats, the total line rather than subtotal or savings (else
  the largest amount), stated GST (else a greyed 1/11 estimate that never reaches the CSV),
  ABN with the ATO checksum, merchant from the top lines, a category guess (fuel, parking,
  tolls, car servicing, phone and internet, office, travel, meals). CSV quotes formula-like cells.
- `app.js`: file input or drag and drop, a self-hosted Tesseract worker, an editable table,
  totals by category, autosave in localStorage. Images are read and dropped; never stored.

## Runtime and network

Self-hosted, unmodified tesseract.js 7.0.0 and tesseract.js-core 7.0.0 (Apache-2.0), LSTM
builds only (plain, SIMD and relaxed SIMD; the worker picks one, about 3.9 MB), and the
English `4.0.0_best_int` model (2.9 MB, tessdata_best, Apache-2.0). Nothing loads until the
first photo. Sources and SHA-256 hashes: `static/vendor-manifest.json`; notices in
`static/NOTICES.txt`. The browser caches the model in IndexedDB after the first read.

## Validation

`node tests/receipts.browser.cjs` (after `python3 build.py`) draws a receipt on a canvas, feeds
it to the real file input, waits for real OCR, and checks merchant, date, total, GST, ABN and
category, totals, autosave across reload, and that no request leaves the site except the
site wide analytics beacon. Passes. Not yet tried with a phone camera on a real receipt,
which is the gate before `live`.

## Before going live

- Try real receipts on a phone (thermal paper, creases, long supermarket dockets).
- A `/vs/expensify/` page, if the Pro comparison holds up.
