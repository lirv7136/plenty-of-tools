# Measurement Notebook — M1 prototype

Hidden local tool at `/tools/measurement-notebook/`. Build with `python3 build.py`.
It is deliberately absent from the homepage and sitemap while the prototype is evaluated.

## Available

- One JPEG, PNG or WebP photo, or the bundled original window illustration.
- Tap two points for a dimension; enter metric decimals or imperial fractions.
- Editable text notes, colour/size controls and numeric endpoint positions.
- Drag endpoints, labels and annotations; keyboard nudge; undo/redo and deletion.
- Wheel/pinch zoom, explicit pan and fit-to-photo.
- Original-resolution annotated PNG and single-page A4/Letter PDF, portrait/landscape.
- All processing is local. Exports add no GPS metadata and have no watermark.

This is M1 from [the blueprint](../../docs/MEASUREMENT-NOTEBOOK-BLUEPRINT.md), not the native
app or the persistent-project beta. Work is held in memory and lost on closing/reloading.
The page says so and warns before replacing edited work. Export files are flattened results,
not editable project backups. There is no service worker or claim of offline reopening yet.
Once its resources are loaded, editing and export work with the network disconnected.

## Implementation

`static/core.js` contains pure validation, source-relative geometry, wrapping, draw plans and
annotation history. Coordinates are relative to the EXIF-oriented image, independent of
viewport size. `static/render.js` draws the same plan into the SVG editor and canvas exports.
`app.js` handles imports, editor state, gestures, history and downloads. Diagnostics expose
read-only copies via `window.__measurement`; tests use the actual UI to mutate documents.

Imports use file signatures, then browser decoding and EXIF orientation, before converting to
a metadata-free display PNG. A failed import retains the previous photo and annotations.
The original file is not modified. Current limits: 25 MiB compressed, 24 million decoded pixels
and a 16,000-pixel maximum edge. Devices may have lower memory limits. HEIC is not supported.

PDF output embeds a rasterised 144-dpi page, including browser-rendered labels and title.
This preserves the glyphs available in the device's fonts (including tested fractions, degree
marks and Japanese) without PDF standard-font encoding errors. Text is not selectable or
searchable. Vector PDF text and embedded fonts are a later quality improvement, not implemented
as described in the aspirational blueprint. PNG export retains decoded photo dimensions.

## Validation

```sh
node tests/measurement-notebook.test.cjs
node tests/measurement-notebook.browser.cjs
```

The browser test starts a temporary loopback server and headless Chrome. It needs permission
to bind a local port and launch Chrome. `CHROME_BIN` can override the executable; `TEST_PHOTO`
can supply a local real-photo fixture under the image limits. Otherwise the test uses the
installed Ubuntu Monument Valley background if present and explicitly skips that fixture
if unavailable. No test photo is redistributed in this repository.

Verified on 18 September 2026:

- Eight core tests: input validation, schema/coordinates, view transforms, anchored zoom,
  bounded movement, history, Unicode wrapping and source-coordinate draw plans.
- Chrome: ten labels; pointer drag/cancel/undo/redo; invalid fraction recovery; Unicode and
  literal HTML text; note/delete/restore; narrow layout and emulated two-finger pinch.
- Downloaded PNG decoded and checked at an annotation endpoint; PDF loaded and page size
  checked. Exports completed after network access was disabled without new HTTP requests.
- EXIF orientation 6 imported/exported with corrected portrait dimensions.
- A real 4736 × 2656 photo with ten labels survived zoom/resize and exported as PNG and PDF.
- A 4000 × 3000 fixture with ten labels exported at its full 12 MP resolution.
- Unsupported input preserved the existing document; no local/session storage writes.

Real iPhone/Android hardware and Safari/Firefox checks remain outstanding. Emulated Chrome
touch testing is not evidence of device compatibility. The five-person competitor/user trial,
saved projects, backup/restore, offline reopening and native work remain future milestones.

## Assets and next step

The example SVG is an original MIT-licensed illustration, labelled as such. It is not a
photograph or an automatically measured scene. PDF-LIB 1.17.1 is copied from this repository's
PDF-sign tool with its MIT licence; see `static/NOTICES.txt` and `vendor-manifest.json`.

Next milestone: M2's saved projects and portable backup/restore, retaining this document and
coordinate model. Review the local prototype with a real measurement task first.
