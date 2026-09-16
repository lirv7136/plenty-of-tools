# Plenty of Tools

Free versions of things people pay for. Every tool runs entirely in the browser,
so there is no server, no per user cost and nothing uploaded — which is what
lets them stay free.

Each tool replaces a product that puts its paywall on the core action (the
download button, the export, the minute cap). Each ships with a `/vs/<incumbent>/`
page answering "is it worth paying for X?".

```bash
python3 build.py          # assemble dist/ (stdlib only)
scripts/deploy.sh         # build + deploy to Cloudflare Pages
```

- `site.json` — brand, domain, analytics token, GitHub URL
- `tools.json` — registry; `status: live` tools are built and listed
- `tools/<slug>/` — `meta.json`, `index.html` (a `<main>` fragment), `tool.css`, `app.js`
- `vs/<name>.json` — comparison page content
- `shell/` — page chrome and templates

Operating plan and calendar: `~/dev/idea-engine/PORTFOLIO.md`.

MIT.

## Third party code

- `tools/screen-recorder/vendor/fix-webm-duration.js` — MIT, Yuri Sitnikov
  (github.com/yusitnikov/fix-webm-duration). Patches the missing duration header in
  WebM files produced by MediaRecorder. Vendored so the site loads no third party scripts.
- `tools/pdf-sign/vendor/pdf.min.js` + `static/pdf.worker.min.js` — pdf.js 3.11.174, Apache 2.0,
  Mozilla. Renders PDF pages. `vendor/pdf-lib.min.js` — pdf-lib 1.17.1, MIT. Writes the signed PDF.
  `static/Caveat.ttf` — Caveat, SIL Open Font License 1.1, used for typed signatures.
- `tools/image-converter/static/libheif-bundle.js` — libheif-js 1.23.2 wrapping libheif and
  libde265, **LGPL 3.0**. Decodes HEIC/HEIF in a Web Worker. Kept as a separate, unmodified file
  with `NOTICES.txt` and the licence text beside it; nothing else in the repo links against it.
