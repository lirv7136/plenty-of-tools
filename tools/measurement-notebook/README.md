# Measurement Notebook — saved project preview

Hidden tool at `/tools/measurement-notebook/`. Build with `python3 build.py`.
It is deliberately absent from the homepage and sitemap while the prototype is evaluated.

## Available

- One JPEG, PNG or WebP photo, or the bundled original window illustration.
- Tap two points for a dimension; enter metric decimals or imperial fractions.
- Editable text notes, colour/size controls and numeric endpoint positions.
- Drag endpoints, labels and annotations; keyboard nudge; undo/redo and deletion.
- Wheel/pinch zoom, explicit pan and fit to photo.
- Original resolution annotated PNG and single page A4/Letter PDF, portrait/landscape.
- All processing is local. Exports add no GPS metadata and have no watermark.

M1 was included in Claude's deploys from 19 September 2026 despite its hidden status.
This extends it with the saved projects and backup portion of M2 requested in the September
brief. Each project still has one photo; multiple photos and multipage reports remain later
blueprint work. List, rename, duplicate and delete projects locally. Applied edits autosave
to IndexedDB after a short delay; the page says Saved only after the transaction completes.
Unapplied form edits are not saved. Open a saved project from the list after restarting.
There is no claim of offline reopening: this hidden page is not opted into the site cache.
Once its resources are loaded, editing, storage and export work without the network.

## Implementation

`static/core.js` contains pure validation, source relative geometry, wrapping, draw plans and
annotation history. Coordinates are relative to the EXIF oriented image, independent of
viewport size. `static/render.js` draws the same plan into the SVG editor and canvas exports.
`app.js` handles imports, editor state, gestures, history and downloads. Diagnostics expose
read only copies via `window.__measurement`; tests use the actual UI to mutate documents.

`static/projects.js` validates portable projects and binary backups. `static/storage.js`
uses one IndexedDB record per project, containing metadata and image Blobs in the same
transaction. Revision checks prevent another tab's newer save or deletion being overwritten.
No photo data or project metadata goes into local storage. Names and imported annotation text
are rendered with DOM text or input values, never HTML interpolation.

## Storage, backups and failure policy

- Incoming photos: 25 MiB, 24 million pixels, 16,000 pixels per edge. Normalised PNG: 100 MiB.
- Each project: one photo and up to 1,000 annotations, with 100 characters for its name/title
  and 240 per note. These bounds also apply to restored data.
- Backups: 128 MiB maximum, metadata at most 2 MiB. `.mnote` is an uncompressed binary
  container: eight UTF 8 bytes `MNOTE002`, a four byte big endian JSON length, JSON metadata,
  normalised PNG bytes, then optional original photo bytes. The JSON contains format,
  project metadata/document, its own SHA 256 checksum and asset size/type/SHA 256 descriptors. Exact field sets,
  types, dimensions, coordinates, counts, signatures, lengths and checksums are validated;
  both the displayed image and any original must decode with matching oriented dimensions
  before any database write. No archive paths exist.
  This deliberately replaces the blueprint's proposed ZIP with a dependency free format.
- Import always gets a fresh project ID. Annotation IDs, labels, positions, photo bytes,
  names and sheet content remain identical. Saved revision/update time are local bookkeeping.
  The complete record commits before it becomes the open project. Invalid or failed imports
  keep existing records and the current editor. Backups include original photo metadata,
  potentially GPS; flattened PNG/PDF exports do not retain it.
- A failed write aborts the whole transaction. The last successful record stays intact;
  current edits stay in memory with a persistent visible error and a Save now / retry button.
  Switching projects is blocked until edits save. Backup export works despite a save failure,
  so the user can keep a copy, delete another saved project to free space and retry. Close
  current project also offers confirmed discard, useful for reopening after a tab conflict.
  Closing without resolving the error loses only the changes since the last successful save.
  A before unload prompt is a best effort,
  not protection against an operating system killing the tab.
- There is no fixed IndexedDB allowance. The page shows project payload bytes separately
  from `navigator.storage.estimate()` for the whole origin, including other tools and caches.
  The quota varies with browser, profile, free disk space and privacy mode. Clearing site
  data removes projects; storage pressure may evict data, and private sessions are temporary.
  Keep downloaded backups. No automatic quota increase or persistent storage grant is claimed.

Storage behaviour checked against [MDN's quota documentation](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria)
in September 2026. Browser restart and transaction failure tests are reproducible below;
simulated quota rejection is not a claim about a universal device capacity.

The September 2026 Chrome test profile reported a quota of 10,744,159,391 bytes (about
10 GiB) and 6,741,151 bytes in use across the test origin after saving and restoring projects.
This is an observed estimate on this Linux machine, not an app allowance or a phone result.
The dedicated storage regression passed an actual Chrome process restart, reload, rename,
duplicate, cancelled and confirmed deletion, identical image hashes and document restore
into empty storage, checksum rejection, markup as literal text, injected quota failure inside
a real IndexedDB transaction, retry, revision conflict protection and a 390 pixel layout.

Imports use file signatures, then browser decoding and EXIF orientation, before converting to
a metadata free display PNG. A failed import retains the previous photo and annotations.
The original file is not modified. Current limits: 25 MiB compressed, 24 million decoded pixels
and a 16,000-pixel maximum edge. Devices may have lower memory limits. HEIC is not supported.

PDF output embeds a rasterised 144 dpi page, including browser rendered labels and title.
This preserves the glyphs available in the device's fonts (including tested fractions, degree
marks and Japanese) without PDF standard font encoding errors. Text is not selectable or
searchable. Vector PDF text and embedded fonts are a later quality improvement, not implemented
as described in the aspirational blueprint. PNG export retains decoded photo dimensions.

## Validation

```sh
node tests/measurement-notebook.test.cjs
node tests/measurement-projects.test.cjs
node tests/measurement-notebook.browser.cjs
node tests/measurement-storage.browser.cjs
```

The browser test starts a temporary loopback server and headless Chrome. It needs permission
to bind a local port and launch Chrome. `CHROME_BIN` can override the executable; `TEST_PHOTO`
can supply a local real photo fixture under the image limits. Otherwise the test uses the
installed Ubuntu Monument Valley background if present and explicitly skips that fixture
if unavailable. No test photo is redistributed in this repository.

Verified on 18 September 2026:

- Eight core tests: input validation, schema/coordinates, view transforms, anchored zoom,
  bounded movement, history, Unicode wrapping and source coordinate draw plans.
- Chrome: ten labels; pointer drag/cancel/undo/redo; invalid fraction recovery; Unicode and
  literal HTML text; note/delete/restore; narrow layout and emulated two finger pinch.
- Downloaded PNG decoded and checked at an annotation endpoint; PDF loaded and page size
  checked. Exports completed after network access was disabled without new HTTP requests.
- EXIF orientation 6 imported/exported with corrected portrait dimensions.
- A real 4736 × 2656 photo with ten labels survived zoom/resize and exported as PNG and PDF.
- A 4000 × 3000 fixture with ten labels exported at its full 12 MP resolution.
- Unsupported input preserved the existing document; no local/session storage writes.

Real iPhone/Android hardware and Safari/Firefox checks remain outstanding. Emulated Chrome
touch testing is not evidence of device compatibility. User trials, multiple photos per
project, offline reopening and native work remain future milestones. Keep the tool hidden
until Lachlan has tried it on a phone.

## Assets and next step

The example SVG is an original MIT licensed illustration, labelled as such. It is not a
photograph or an automatically measured scene. PDF-LIB 1.17.1 is copied from this repository's
PDF signer with its MIT licence; see `static/NOTICES.txt` and `vendor-manifest.json`.

Next: review saved projects on a phone with a real measurement task, then expand project
photo organisation and reports if the trial supports it.
