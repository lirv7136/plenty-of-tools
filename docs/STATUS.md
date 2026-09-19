# Plenty of Tools — status and handoff

Last updated 2026-09-19 (night, after the review pass). Read this first when resuming in a new
session. The next plan is `docs/PLAN-2026-09-20.md`.
The operating plan, calendar and decision rules live in `~/dev/idea-engine/PORTFOLIO.md`
(status log at the bottom). This file is the "where are we" summary.

## Next app: Measurement Notebook

Lachlan requested the build blueprint on 18 September. See
[MEASUREMENT-NOTEBOOK-BLUEPRINT.md](MEASUREMENT-NOTEBOOK-BLUEPRINT.md) for the product scope,
screen flow, data/export contract, web/native approach and milestones. **M1 is built locally**
at `/tools/measurement-notebook/` (hidden/noindex, absent from homepage and sitemap). Import
JPG/PNG/WebP; add and edit dimensions/notes; drag, zoom/pan, undo/redo; download PNG or PDF.
Eight core tests and Chrome UI/export checks pass, including a real 12.6 MP photo with ten
labels, mobile emulation/pinch, EXIF orientation, invalid-file recovery and disconnected
exports. See the [tool README](../tools/measurement-notebook/README.md) for exact coverage.
Local preview verified at `http://127.0.0.1:8765/tools/measurement-notebook/` on 19 September.
One photo in memory only: no saved projects, backup/restore, offline reopening or native app
yet. PDF pages are rasterised; device-font glyphs survive but text is not selectable.
Actual iPhone/Android checks and user/competitor trials remain outstanding. Next is M2's
saved-project and backup/restore work after trying the prototype. Not committed by Codex; note
that `build.py` builds hidden tools too, so the noindex page has been included in Claude's
deploys since 19 September and is reachable at /tools/measurement-notebook/.

## What this is

A portfolio of free, browser only tools, each anchored to a paid incumbent's paywall on
the core action, with an "Is it worth paying for X?" comparison page per tool. Everything
runs client side: no server, no uploads, no LLM calls, no third party scripts (libraries
are vendored). Distribution is the "alternative to X" query, directories and community
posts, not ads. Kill rule at 30 days: under 100 uniques mothball, over 1000 double down.

## Live

- Site: **https://plentyoftools.io** (also `www`, and the original
  https://plenty-of-tools.pages.dev which still serves). Canonicals point at plentyoftools.io.
- Repo: https://github.com/lirv7136/plenty-of-tools (public, MIT, branch `main`).
- Cloudflare Pages project `plenty-of-tools`, personal account `5e0f03f73cfa3e8ae2053605f57409d6`
  (lachieirving@gmail.com). Zone `plentyoftools.io` id `cee8ae15efbb3c0546cf9488d74cfd35`.
- Domain plentyoftools.io registered 2026-09-16 via Cloudflare Registrar, auto renew on,
  WHOIS redaction on. CNAMEs `@` and `www` -> `plenty-of-tools.pages.dev`, proxied.

| # | Tool | Slug | Status | Built by | vs page |
|---|---|---|---|---|---|
| 1 | CV Builder | cv-builder | live | Claude | zety |
| 2 | Subscription Finder | subscription-finder | live | Codex | rocket-money |
| 3 | Google Storage Analyser | drive-storage-analyser | **hidden** (Google review submitted 2026-09-19; flip to live on approval) | Claude | google-one |
| 4 | Screen Recorder | screen-recorder | live (recording untested by a human) | Claude | loom |
| 5 | Background Remover | background-remover | live | Codex | remove-bg |
| 6 | Sign a PDF | pdf-sign | live | Claude | docusign |
| 7 | QR Codes | qr-codes | live | Codex | bitly |
| 8 | Invoice Generator | invoice-generator | live | Codex | xero |
| 9 | GPX Route Builder | gpx-route-builder | live | Codex | (see vs/) |
| 10 | Image Converter | image-converter | live | Claude | cloudconvert |
| 11 | Is It Worth It? Calculators | worth-it-calculators | live | Codex | uber-one |
| 12 | Browser Transcription | transcription | live | Codex | otter |
| 13 | Settle Up | settle-up | live (2026-09-19) | Claude | splitwise |
| 17 | Tuner and Metronome | tuner-metronome | live (2026-09-19) | Claude | guitartuna |
| 19 | Travel fee calculators | (folded into worth-it-calculators) | live (2026-09-19) | Codex | uber-one |

Nine of the thirteen live tools are precached for offline use: cv-builder, subscription-finder,
qr-codes, invoice-generator, worth-it-calculators, settle-up, tuner-metronome, screen-recorder
and gpx-route-builder, plus the home page. Opt a tool in with `"offline": true` in `tools.json`.
Left out on size: pdf-sign 2.3 MB, image-converter 2.0 MB, background-remover 16.6 MB,
transcription 21.9 MB, measurement-notebook 0.5 MB and hidden, and drive-storage-analyser,
which needs the network by definition.

## Transcription validation (Codex, 16 September 2026)

Browser Transcription has passed eight focused unit tests plus real Chrome inference
checks, including 11-second and 33-second speech, editable TXT/SRT exports, cached-model
reuse with the model host blocked, stopping during inference, invalid/silent audio,
50 MiB and 10-minute limits, cache removal and mobile layout. Model revision and runtime
versions are pinned in `tools/transcription/README.md`; the final Otter comparison,
licence notices and expanded tests are in the working tree. Deployed with Claude's 19 September
deploys (`/vs/otter/` is live); still uncommitted, waiting on Lachlan's "commit".

## How to build and deploy

```bash
export PATH=$HOME/.nvm/versions/node/v20.19.6/bin:$PATH
cd ~/dev/plenty-of-tools
python3 build.py                       # -> dist/
node --test tests/                     # Codex's unit tests
npx wrangler pages deploy dist --project-name plenty-of-tools --branch main --commit-dirty=true
```

`scripts/deploy.sh` does the build and deploy in one go. Wrangler is logged in with an OAuth
token on the personal account (`~/.config/.wrangler/config/default.toml`, scope includes
`pages:write`; it can add Pages custom domains through the API but has no DNS scope).

Commits so far: `47f8a82` first commit, `092dfab` domain switch plus #11 and #12,
`928ce90` the 19 September batch. Push over SSH as lirv7136.

Registry: `tools.json` (`status`: live | hidden | queued). `hidden` builds the page with
noindex and leaves it off the home page and sitemap. Per tool: `tools/<slug>/{meta.json,
index.html fragment, tool.css, app.js, vendor/*.js (auto tagged as page scripts), static/
(copied to /assets/<slug>/, not tagged)}`. Comparison pages: `vs/<slug>.json`.
`site.json` holds brand, domain, `google_client_id`, and the still empty
`cf_analytics_token` and `pro_url`.

## Two agents share this tree

Claude (Claude Code) and Codex both work in this repo, often at the same time. Rules that
have kept it safe so far:

- Before starting a slate item, `ls -la tools/` and check for a folder that just appeared.
  Codex creates the folder first and flips `tools.json` to live itself.
- Never rewrite `tools.json`, `build.py`, `shell/*` or `README.md` wholesale. Re-read, then
  apply a targeted patch.
- Codex conventions: per tool `README.md`, tests in `tests/*.test.cjs`, pure functions
  exported for testing. Claude's tools expose a small `window.__<slug>` hook for browser checks.
- Commits are only made when Lachlan asks. Git identity in this repo is
  `Lachlan Irving <lachieirving@gmail.com>` (the machine's global email belongs to a
  different GitHub username; do not use it here).

## Accounts and access

- Cloudflare: personal account above. The Cloudflare MCP connector authenticates but is read
  only in practice (registrar purchase, Pages domain add and DNS writes all return
  `10000 Authentication error`). Use it for lookups; do writes with wrangler or the dashboard.
- Google Cloud: project `plenty-of-tools` on lachieirving@gmail.com. OAuth web client id
  `390891382041-3biu6r6ko1vguh7c74e2urtaq4q9m52q.apps.googleusercontent.com` (public by
  design, token flow, no secret used). Consent screen External, publishing status
  **In production** since 2026-09-19; branding verified and published with the logo; scope
  `drive.metadata.readonly` (**restricted**) declared on Data Access with the justification
  and demo video from `docs/google-verification.md`; Verification Center shows the data access
  request **under review** (submitted 2026-09-19). Until approval the unverified app is capped
  at 100 users for life, which is why the analyser stays `hidden`. JS origins and authorised
  domains: both pages.dev and plentyoftools.io are added. Google's questions arrive by email
  at lachieirving@gmail.com.
- GitHub: lirv7136 (personal). `gh` (snap) is logged in for API calls; push works over SSH.
- Google sign in is refused inside the MCP controlled Chrome, so anything needing a
  Google login happens in Lachlan's own browser.
- Nothing here uses CIM Enviro infrastructure or accounts, and nothing should.

## Open items

**Committed and pushed 2026-09-19 night as `928ce90`** (65 files): both new tools, the
installable site, cache busting, the 404 page, IndexNow, terms, the logo, the distribution kit,
Codex's transcription finish and measurement notebook M1, and the review fixes. The working tree
is clean and GitHub matches the live site.

**Review pass deployed 2026-09-19 night.** Tuner octave error above 1.3 kHz, Settle Up share
link id validation, the privacy microphone bullet, the corrected offline wording and the
GuitarTuna feature list are all live and verified in Chrome. 92 tests pass.

Lachlan:
1. Rewrite and post the two drafts in `docs/distribution/posts.md` (HEIC thread on Microsoft
   Community; a subscription tracker thread on r/AusFinance or r/personalfinance). Log the URLs.
2. Sign one of his own real PDFs at https://plentyoftools.io/tools/pdf-sign/ and open the
   result in another viewer. The screen recorder was exercised on 2026-09-19 for the demo video.
3. Watch lachieirving@gmail.com for Google's review emails (brand review first, then the
   restricted scope review). Forward questions to Claude for a drafted reply.
4. Later: merchant of record account for the Pro unlock (not before a tool earns it);
   Show HN and Product Hunt in the mid semester break using `docs/distribution/`.

Done since the first version of this file: Web Analytics on; Search Console domain property
verified on the personal account and sitemap submitted (Success); OAuth origin and authorised
domain added; branding verified and published with the logo; scope declared; Google review
submitted 2026-09-19; `/terms/` page; footer Privacy and Terms links; 404 page; IndexNow;
installable site; cache busting; #13 Settle Up and #17 Tuner and Metronome live.

Claude / Codex:
1. Flip `drive-storage-analyser` to `live` the day Google approves; then its launch post.
2. AlternativeTo submissions (`docs/distribution/alternativeto.md`) once the posts are out.
3. Monthly `price_pain` diff mine in `~/dev/idea-engine` (next: 1 October).
4. Consider a redirect from the pages.dev subdomain to plentyoftools.io (needs zone write).
5. Slate 2 remaining web tools in calendar order: #18 habit tracker PWA, #22 ringtone maker,
   #14 disk analyser, #15 read aloud, #16 scan to PDF, #20 receipts, #21 UV index, #23, #24.

## Gotchas worth remembering

- Deployment hash URLs (`<hash>.plenty-of-tools.pages.dev`) fail SSL in Chrome; use the
  production URL.
- `[hidden]{display:none!important}` is in `shell.css` because per tool `display:flex`
  rules were defeating the `hidden` attribute.
- The global `Permissions-Policy` header was removed because it blocked camera and mic.
- libheif-js's bundle exports a factory; call it once inside the worker.
- pdf.js transfers its input buffer to the worker; pass a copy and keep the original for
  pdf-lib.
- Screen recorder MP4 from MediaRecorder is fragmented; some players show 0:00 length.
- Pages serves `index.html` with a 200 for every unknown path unless the build ships a `404.html`;
  it does now (build.py), after scanners probing `/.env` were being counted as page views.
- `site.json.indexnow_key` is served as `/<key>.txt`; POST the sitemap URLs to
  `https://api.indexnow.org/indexnow` after a deploy to nudge Bing (no account needed). Google
  needs Search Console, which needs Lachlan's login.
- Analytics without the Cloudflare connector: wrangler's OAuth token can query the GraphQL
  Analytics API (`httpRequests1dGroups`, `httpRequestsAdaptiveGroups` in 1 day windows,
  `rumPageloadEventsAdaptiveGroups`); `clientRefererHost` is not available on the free plan.
- The service worker (`shell/sw.js`) is a template: `build.py` stamps a build id into it and
  writes `dist/offline-manifest.json`, which lists each opted in page together with its own
  versioned assets. One cache per build, `pot-app-<build>`. Why a page and its assets must be
  cached as one unit: Pages ignores the query string when serving a file, so an old
  `/assets/x.js?v=<old>` URL returns the CURRENT file, and a cache keyed on versioned URLs alone
  would drift. The build id is a hash of every precached file's contents, so any change to any of
  them changes `sw.js` itself, which is what makes the browser reinstall. Only URLs under
  `/assets/` carrying `?v=` are served cache first; everything else, including tool workers, wasm,
  the Whisper model and map tiles, returns without `respondWith` and goes straight to the network.
  Pages redirects `/offline.html` to `/offline`, and a redirected response cannot serve a navigation.
- **Testing offline properly.** Emulating offline on the page target alone is not enough: a
  navigation is answered by the service worker, whose `fetch` runs in its own target and stays
  online, so the page looks like it works offline when it does not. `tests/offline.browser.cjs`
  attaches at browser level and emulates on every target, serves `dist/` itself with
  `Cache-Control: no-store` so the HTTP cache cannot help either, and asserts
  `performance.getEntriesByType('navigation')[0].transferSize === 0`. Run it after a build:
  `node tests/offline.browser.cjs`.
- The zone's Browser Cache TTL overrides `Cache-Control` from `_headers`, so `/sw.js` is served
  with `max-age=14400` despite the `no-cache` rule in the build. It does not matter: browsers
  bypass the HTTP cache when checking a service worker script for updates. Changing it needs a
  dashboard visit.
- Asset URLs carry `?v=<sha1[:8]>` from build.py (including hand written `/assets/<slug>/*.js`
  tags in fragments). The zone still caches `/assets/*` for 4 h, but the URL changes on edit.
- Analytics reads: wrangler's token + Cloudflare GraphQL (see 2026-09-18 note above).
- Reddit blocks the WebSearch/WebFetch crawler; find Reddit threads manually.
- A `vs/` page follows its tool's status (build.py, 19 September). Before that guard,
  `/vs/google-one/` was indexed and in the sitemap with an "open it, free, no account" button
  into the hidden analyser, which nobody can actually use while Google's review is pending. Now
  a comparison page for a tool that is not `live` still builds and its URL works, but it is
  noindex and out of the sitemap, and it joins the sitemap by itself when the tool flips.
- Tuner pitch detection computes the NSDF from lag 1, not from the lag for `maxFreq`: starting
  at `minLag` skipped the fundamental's own lobe for notes above about 1.3 kHz and read them an
  octave low (found and fixed in the 19 September review; test covers 1318, 1500, 1760 Hz).
- Settle Up validates ids in a decoded link (`/^[\w-]{1,40}$/`, unique) and escapes them in
  attributes, so a crafted share link cannot inject markup. Verified live: both crafted ids are
  rejected, and legitimate free text containing markup renders as literal text.
- **The service worker does not make any tool work offline.** It caches only `/offline` and
  handles navigations, so a reload without a connection shows the offline page. An open tab
  keeps working because its JavaScript is already in memory. Never write "works offline" in tool
  copy; write "once the page is open it needs no connection". A real offline mode needs a per
  deploy cache of a page plus its versioned assets as one unit (see PLAN-2026-09-20 Block 3).
- `$CLAUDE_JOB_DIR/tmp/linkcheck.py` style check: walking `dist/` for every `href`/`src` and
  resolving it against the built tree catches typos across all 35 pages in a second. Worth
  re-running after any shell or build change.
