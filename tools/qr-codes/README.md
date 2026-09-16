# QR Codes — slate #7

Local static QR generator at `/tools/qr-codes/`, with `/vs/bitly/` comparison.
Registered as `live` in the local build; public deployment is separate.

## Run and verify

From the repository root:

```sh
python3 build.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
node tests/qr-codes.test.cjs
# With Chrome installed and the server running:
node tests/qr-codes.browser.cjs
```

Preview: http://127.0.0.1:8765/tools/qr-codes/

No install step, remote scripts or runtime service. `vendor/` is included by
the existing build; `static/` contains licences, attribution and checksums.

## Features

- HTTP/HTTPS links, plain text, Wi-Fi configuration, email drafts.
- Website mode adds HTTPS when omitted, validates the address and encodes the
  browser-normalised URL. No URL shortening, redirect service or link fetching.
- UTF-8 text preserves line breaks, whitespace and emoji. Wi-Fi escapes syntax
  characters and supports WPA/WPA2 Personal, WEP, hidden and open networks.
- Wi-Fi credentials are visibly identified as readable by anyone scanning the
  code. Enterprise and WPA3-only networks are outside this version's scope.
- PNG at 512, 1024 or 2048 pixels; SVG exports scale without pixelation.
- Integer module sizes and a minimum four-module white border in PNG; exact
  four-module border in SVG. Colour input requires contrast of at least 4.5:1
  against white; this is a conservative guard, not a guarantee of scan success.
- Four error correction levels. Payload limit: 2,000 UTF-8 bytes; dense content
  may exceed capacity at higher correction levels and produces a useful error.
- Editing any encoded content or setting invalidates the old preview/export.
- No localStorage, IndexedDB, cookies or payload requests. Clear removes field
  values, generated matrix references, preview pixels and encoded-content text.

Static codes have no service expiry, but cannot change content after printing.
Linked websites must remain available. Always test the final printed size with
the intended scanner; device handling of Wi-Fi, email and Unicode can differ.
Offline generation works once page assets have loaded; offline reload is not
guaranteed and no service worker is installed.

## Verification details

Unit tests use the independent jsQR decoder to read matrices for every content
type at every error correction level. They cover UTF-8, syntax escaping, payload
validation, capacity errors, safe SVG construction, borders and vendor hashes.

The Chrome test independently decodes the preview and actual downloaded PNG
and SVG, checks file dimensions, Unicode, Wi-Fi, invalid contrast, stale export
prevention, clearing, mobile overflow and absence of browser storage writes.
Network access is disabled after page load during generation and download checks.
Screenshots and exported files are saved under a temporary `qr-browser-*` folder.
Mobile checks use a desktop browser viewport, not a physical phone camera.

## Dependencies

qrcode-generator 1.4.4 (MIT), including its UTF-8 extension, is vendored unchanged.
jsQR 1.4.0 (Apache-2.0) is a test-only independent decoder under `tests/vendor/`;
it is not shipped in `dist/`. Versions, source URLs and SHA-256 hashes are recorded
in `static/vendor-manifest.json`. See `static/NOTICES.txt` and licence files.
