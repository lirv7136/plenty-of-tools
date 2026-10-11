# Scan to PDF (#16)

Photos of documents to a straightened, multi page PDF at `/tools/scan-to-pdf/`. Built 7
October 2026, **hidden** and **not committed**. No dependencies: no OpenCV, no PDF library.

- `static/core.js` (pure, `tests/scan-to-pdf.test.cjs`, 7 tests): a homography from the four
  corners (Gaussian elimination), a bilinear perspective warp, a document mode (adaptive
  threshold over an integral image, with a dark floor so solid areas stay solid), A4
  placement, and a small PDF writer that embeds the JPEG bytes unchanged (DCTDecode) with a
  correct xref table.
- `app.js`: photos decoded with camera orientation (`createImageBitmap`, capped at 4000 px),
  draggable corner handles (pointer events, touch friendly), colour or document mode,
  rotate, skip, page strip with reorder and remove, PDF download. Everything stays in memory
  for the tab; nothing is stored or sent.

Corners start 4% in from the photo's edges; there is no automatic edge detection. That is the
obvious next step, and the place a library like OpenCV.js (about 8 MB) would earn its weight.

## Validation

`node tests/scan-to-pdf.browser.cjs` (after `python3 build.py`) draws a tilted page on a dark
background, loads it through the real file input, drags a corner with real pointer input,
adds a document mode and a colour page, then opens the PDF with the site's vendored pdf.js and
checks two A4 pages, the mark centred and the page white to its edges. Passes. The browser
test caught the first document mode hollowing out large dark areas, which is now fixed.

Not yet tried with a phone camera on real paper; that is the gate before `live`. Known nit:
the shared `.btn` style doesn't dim a disabled button, so "Download PDF" looks active when
there are no pages (it does nothing). That's site wide CSS, left alone.
