# PDF Tools

Merge, split, delete, rotate and reorder PDF pages in the browser. The file is read in the
tab and never uploaded.

## Why this one exists

Every free PDF site works by uploading your document. That is not a slur on their
security; it is simply how a web service works. But the PDFs people most often need to
merge or split are contracts, payslips, bank statements, medical letters and passport
scans. A browser can read and write a PDF on its own, so the upload is not necessary for
these operations, and this tool does not do it.

`tests/pdf-tools.browser.cjs` asserts that: it fails if the page makes any request to
another origin other than the site's declared Cloudflare Web Analytics beacon.

## What it does

- Open one PDF or several, by picker or drag and drop.
- A thumbnail grid of every page, in one list across all the files.
- Select by clicking, or by typing a range the way you would say it: `1-3, 5, 8-10`.
  Buttons for all, none, invert, odd and even. Odd and even are what a double sided scan
  needs when a feeder has given you fronts then backs.
- Rotate a quarter turn either way, delete, reverse the whole order, move any page.
- Save the selection as one PDF, or save each selected page as its own file.
- Output is named after where it came from: `Lease-pages-2-3.pdf`, or `merged.pdf` when
  pages came from more than one document.

## What it does not do, and why

- **No compression.** Honest PDF compression means re-encoding the images inside the file.
  The shortcut most sites take when you ask for a small file is to rasterise every page,
  which silently destroys selectable text. A button that quietly wrecks a document is
  worse than no button.
- **No conversion** to or from Word, Excel or PowerPoint, and **no OCR**. Both genuinely
  need an engine that does not fit in a browser tab. `/vs/ilovepdf/` says so plainly.
- **No passwords.** A password protected PDF is refused by name rather than half opened.
- **No digital signatures.** Drawing or typing a signature is the separate
  [Sign a PDF](/tools/pdf-sign/) tool.

## Limits

- 30 files and 2000 pages in one go. Both are arbitrary but keep the thumbnail grid usable.
- Memory is the real limit: every file is held in the tab. A very large scanned document
  on a phone may not fit.
- Saving each page separately triggers several downloads at once, which the browser may
  ask you to allow.
- Rotation is added to whatever the page already carried, so a page that was already saved
  sideways stays sideways relative to itself.

## Third party code

Vendored, with licences and checksums in `vendor/NOTICES.txt`. Both are the same files
already vendored for Sign a PDF.

- `vendor/pdf-lib.min.js` — pdf-lib 1.17.1, MIT. Every page operation.
- `vendor/pdf.min.js` + `static/pdf.worker.min.js` — pdf.js 3.11.174, Apache 2.0, Mozilla.
  Thumbnails only; it never writes a file.

## Tests

```bash
node --test tests/pdf-tools.test.cjs     # 11 unit tests: ranges, rotation, ordering, names
node tests/pdf-tools.browser.cjs         # the page, against real PDFs
```

The browser test does not trust the page's own report of what it did. It builds a sample
PDF with pdf-lib, manipulates it through the real buttons, then **reads the saved bytes
back with pdf.js** and checks the page count, the text on each page and the rotation flag
are what was asked for. It also covers merging two documents, refusing a corrupt file by
name, refusing to delete every page, and the phone layout.
