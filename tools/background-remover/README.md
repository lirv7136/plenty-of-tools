# Background Remover — slate #5

Local background removal at `/tools/background-remover/` with a comparison at
`/vs/remove-bg/`. Registered in the static build; deployment is a separate step.

## Preview and tests

From the repository root:

```sh
python3 build.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
node tests/background-remover.test.cjs
# With the server running, and Chrome installed:
node tests/background-remover.browser.cjs
```

Open http://127.0.0.1:8765/tools/background-remover/. The browser test runs the
real bundled model (no inference mock), verifies foreground/background alpha,
downloads a PNG, checks original dimensions, exercises cancellation and input
validation, and records worker/page requests to check that processing uses only
same-origin GETs. It writes screenshots and the output PNG to a temporary folder.
`CHROME_BIN` and `TEST_URL` override its defaults.

## Implementation

- Vanilla JS and CSS, no npm build or remote runtime imports.
- U2NETP, the small U²-Net model, from rembg's v0.0.0 ONNX release; ~4.6 MB.
- ONNX Runtime Web 1.20.1, WASM execution provider, one thread, dedicated worker.
  No GPU, SharedArrayBuffer or cross-origin-isolation requirement.
- Runtime/model assets load only after **Remove background**. First use fetches
  about 16 MB uncompressed. HTTP caching may reuse assets; offline availability
  is not guaranteed. Asset downloads can be cancelled by terminating the worker.
- 320 × 320 input with browser resampling, image-max normalisation and ImageNet
  channel means/deviations. The first output is min/max-normalised into alpha.
- The mask is smoothly scaled to the original canvas dimensions and multiplied
  by original alpha. Source orientation is handled by browser image decoding.
- Export is a fresh PNG, with transparency or a solid colour. Original image
  dimensions are retained; metadata is not copied into the new PNG.
- Photos are held in memory, never put in localStorage, IndexedDB or a request.
  Clear and tab close release image state. Workers terminate on clear, cancel,
  page exit, failure or a three-minute processing timeout.
- Same-origin `static/` files are copied to `/assets/background-remover/` by the
  shared build. No effect on existing tool paths or scripts.

## Scope and limitations

JPEG, PNG and WebP only, checked by file signature then browser decoding. One
still image at a time; animated inputs are decoded as a still frame. Maximum
20 MB, 16 million pixels, 8,192 pixels per side. Larger images are rejected with
a resize instruction, rather than silently downscaled. No manual brush editor,
batch mode, HEIC decoder or premium model is included.

U2NETP is a compact salient-object model, not a high-resolution matting model.
Fine hair, transparent objects, holes and complex backgrounds can be imperfect.
Exporting the original dimensions does not recover detail absent from the
320 × 320 mask. The interface and comparison page make that distinction explicit.
Mobile performance depends on the browser/device; browser checks use desktop
Chrome with a mobile viewport, not a physical phone.

## Reproducibility and licences

All required binaries are checked into `static/`; `build.py` needs no network.
`static/vendor-manifest.json` records upstream URLs, byte sizes and SHA-256.
The unit tests verify all hashes and the model's upstream MD5. Restore a missing
asset from its manifest URL and verify the hash before using it.

The application is MIT. ONNX Runtime is MIT, U²-Net is Apache-2.0, and the NASA
example photograph is public domain. Full licences and attribution are shipped
with the site; see `static/NOTICES.txt` for primary sources and details.
