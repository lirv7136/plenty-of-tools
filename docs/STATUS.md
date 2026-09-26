# Plenty of Tools — status and handoff

Last updated 2026-09-19 (night, after the review pass and the habit tracker). Read this first when resuming in a new
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
September brief work now adds saved projects in IndexedDB, rename/duplicate/confirmed delete,
storage usage, autosave with visible failure recovery, and validated `.mnote` backup/restore.
One photo per project remains the current scope; multiple photos, multipage reports, offline
reopening and native work remain later milestones. Real Chrome restart, reload, restored
document/image equality, corrupt import refusal, transaction failure and tab conflict checks
pass. The README documents limits and the observed browser quota. Keep this tool hidden until
Lachlan tries it on a phone. PDF pages remain rasterised.

**Committed and deployed 19 September** (`d9fbc4b`). Claude verified the built page beyond
Codex's own tests: saving writes an IndexedDB record, it survives a reload, and reopening
restores the image with its annotations, console clean. Because `build.py` builds hidden tools,
the noindex page is live at **https://plentyoftools.io/tools/measurement-notebook/**, absent from
the home page, the sitemap and search. `/vs/imagemeter/` is built and reachable but noindex, and
joins the sitemap by itself the day the tool flips to `live`.

**The remaining gate is Lachlan's:** open that URL on his phone, import a photo, add a couple of
dimensions, save, close the tab, reopen and confirm the project is still there. Flip to `live`
only after that.

## 20 September: What's Eating My Disk (slate item #14)

Live at **https://plentyoftools.io/tools/disk-analyser/**, with `/vs/cleanmymac/`. Claude's
build, deployed 20 September. Pick a folder and it reports a treemap you can click into, the
fifty biggest files, a breakdown by kind, duplicates matched on content, and large files not
touched in six months to five years, plus a CSV. Two ways in: the File System Access API on
Chromium desktop, which can also remove files, and a plain folder input everywhere else,
which reads only. The page says which one you are getting.

**The removal guard is the part worth knowing about.** Before deleting anything it re-reads
the file and refuses unless the size and modified time still match what was scanned, so a
stale scan cannot delete the wrong thing. `tests/disk-analyser.browser.cjs` proves this
against the origin private file system, which hands out the same `FileSystemDirectoryHandle`
API a chosen folder does: it writes real files, removes one, and checks the three refusal
cases leave their file in place. **No human has yet deleted a real file with it**, which is
the one manual check outstanding.

Sixteen unit tests cover the arithmetic, and they assert the treemap's geometry rather than
sample output: rectangles fill their box exactly, sit in proportion, never overlap, stay
close to square, and survive empty, single item, zero size and wildly lopsided input.

The comparison page is deliberately generous. DaisyDisk is US$9.99 once, not a subscription,
and its own site says so; WinDirStat, WizTree, GrandPerspective and ncdu are free. The page
says all of that and pitches the wedge honestly: nothing to install, any operating system,
no admin rights. The anchor is CleanMyMac's subscription, from about US$3.33 a month billed
annually on its own site in September 2026.

Two things found while building it, both fixed: the sample folder could not demonstrate
duplicate finding because there were no real bytes to hash, so the sample now carries small
backing blobs; and the treemap coloured tiles by a hash of the folder name, which let two
large neighbours land on the same colour and read as one block, so tiles are now coloured by
position, which guarantees neighbours differ.

## 20 September: Recipe Keeper (slate item #23)

Live at **https://plentyoftools.io/tools/recipe-keeper/**, with `/vs/recime/`. Claude's
build. Unlimited recipes in `localStorage`, searched by name, tag or ingredient; paste a
recipe and it separates ingredients from method; scale to the servings you are cooking for;
a seven day, three meal plan; and a shopping list added up across the week that says which
recipes wanted each item. Ticking, copying, printing, export and import. Opted into the
offline precache, which is now eleven pages.

Two design decisions are load bearing and are stated on the page and in the README:

- **Unlike units are never converted.** Two cups of flour plus one cup is three cups; two
  cups plus 200 g stays two lines. Converting volume to weight depends on what is being
  measured, and a guess would put a wrong number on a shopping list.
- **Nothing is silently dropped.** A line the parser cannot read keeps its text and reaches
  the list with no quantity. `a pinch of salt` reads as one pinch, because an article
  followed by a real unit is a quantity; `a few tomatoes` is left alone, because `few` is
  not one. Ranges take the low end, so `1-2 onions` under shops rather than over.

Twenty unit tests cover the quantity grammar at both ends, unit aliases, the ingredient
line split, the paste parser with and without headings, scaling, aggregation across
recipes, and rebuilding an imported file field by field.

Two failures worth recording, both found by the tests before anything shipped. The first
was mine to fix: `a pinch of salt` parsed as an item with no quantity, because the parser
only looked for digits, so a pinch never reached the shopping list as a pinch. The second
was a wrong expectation rather than a bug: searching `garlic` returns two recipes, not one,
because the soup has garlic in its ingredients and not in its name, which is the search
working as intended.

The comparison page is honest about where ReciMe earns its money: pulling a recipe out of
an Instagram or TikTok video costs them real money per import and a browser tab cannot do
it at all. ReciMe's own help centre gives one figure, US$39.99 a year in the United States,
and says the price varies by region; it does not state the free tier's limit, so the page
does not quote one. Paprika is named as the fair pay once option.

## 20 September: PDF Tools (new, not on either slate)

Live at **https://plentyoftools.io/tools/pdf-tools/**, with `/vs/ilovepdf/`. Claude's build,
found by a fresh research pass rather than from slate 2, and cheap because pdf-lib and
pdf.js were already vendored for Sign a PDF.

Merge, split, delete, rotate, reverse and reorder pages, then save the selection as one
file or each page as its own. Selection by clicking thumbnails or by typing a range the way
a person says one (`1-3, 5, 8-10`), with odd and even buttons for a double sided scan.

**The wedge is not the price, it is the upload.** iLovePDF, Smallpdf and Adobe all work by
sending your document to their servers, and the PDFs people most need to merge or split are
contracts, payslips, bank statements and medical letters. A browser can read and write a PDF
on its own, so the upload is unnecessary for these operations.
`tests/pdf-tools.browser.cjs` asserts it: the test fails if the page makes any request to
another origin except the site's declared analytics beacon.

The browser test does not trust the page's own report of what it did. It builds a sample PDF
with pdf-lib, drives the real buttons, then **reads the saved bytes back with pdf.js** and
checks the page count, the text on each page and the rotation flag. It also covers merging
two documents, refusing a corrupt file by name, and refusing to delete every page.

Deliberately not included, and said so on the page: no compression, because honest
compression means re-encoding the images and the shortcut of rasterising every page
silently destroys selectable text; no Word conversion; no OCR; no passwords. Those are the
things worth paying iLovePDF for, and the comparison page says so.

Verified from iLovePDF's own pricing page in September 2026: the free tier caps compress at
2 files, merge at 25, image to PDF at 20, with file size limits from 15 MB to 400 MB, and
Premium is AUD$7 a month billed yearly, AUD$84 a year, or AUD$11 month to month. The page
also names Stirling PDF, macOS Preview and Windows print to PDF as genuinely free
alternatives, because they are.

Two fixes the tests forced. `baseName` left a trailing dash on a name whose last character
was a path separator, so a saved file could be called `a-b-c-.pdf`. And the delete button
was disabled whenever every page was selected, which is a dead control that explains
nothing; it is now live and the click says why it will not empty the document.

## September brief: Codex completion

- A: four travel calculators extend the original five. All nine text and print reports pass
  Chrome checks, alongside range and break even unit tests. Official example source notes
  were reviewed in September 2026. Claude included the main extension in commit `093e005`
  during parallel work; Codex did not commit or push. Follow up edge case and documentation
  changes remain in the working tree.
- B: saved projects and backup/restore are implemented as described above. The tool and
  ImageMeter comparison remain hidden from the homepage and sitemap until the phone trial.
- C: Read aloud is implemented and listed on the local homepage, with TXT/PDF input, local
  system voices, controls, highlighting and saved positions. Unit and Chrome checks pass;
  5,000 words completed through the actual local speech engine. `/vs/speechify/` returns 200
  in the local build. Neural voices and EPUB are omitted. See its README for platform limits.

No Codex commit, push or deployment was made. Browser tests used temporary local servers
only; the tools themselves have no backend. Actual phone listening and notebook checks remain
manual follow up work. The current notebook scope is one photo per project, not the full
multiple photo reporting scope in the longer blueprint.

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
| 15 | Read Aloud | read-aloud | live (2026-09-19) | Codex | speechify |
| 18 | Habit Tracker | habit-tracker | live (2026-09-19) | Claude | habitify |
| 22 | Ringtone Maker | ringtone-maker | live (2026-09-19) | Claude | ringtone-apps |
| 14 | What's Eating My Disk | disk-analyser | live (2026-09-20) | Claude | cleanmymac |
| 23 | Recipe Keeper | recipe-keeper | live (2026-09-20) | Claude | recime |
| 25 | PDF Tools | pdf-tools | live (2026-09-20) | Claude | ilovepdf |

**Nineteen tools live.** Eleven of them plus the home page are precached for offline use:
cv-builder, subscription-finder, qr-codes, invoice-generator, worth-it-calculators, settle-up,
tuner-metronome, screen-recorder, gpx-route-builder, habit-tracker and recipe-keeper. Opt a tool in with
`"offline": true` in `tools.json`. Left out on size: pdf-sign 2.3 MB, image-converter 2.0 MB,
background-remover 16.6 MB, transcription 21.9 MB, measurement-notebook 0.5 MB and hidden, plus
drive-storage-analyser, which needs the network by definition. read-aloud has not been opted in
yet, which is Codex's call, and ringtone-maker is out because its vendored MP3 encoder is 156 KB
on its own.

## Transcription validation (Codex, 16 September 2026)

Browser Transcription has passed eight focused unit tests plus real Chrome inference
checks, including 11-second and 33-second speech, editable TXT/SRT exports, cached-model
reuse with the model host blocked, stopping during inference, invalid/silent audio,
50 MiB and 10-minute limits, cache removal and mobile layout. Model revision and runtime
versions are pinned in `tools/transcription/README.md`; the final Otter comparison,
licence notices and expanded tests are in the working tree. Deployed with Claude's 19 September
deploys (`/vs/otter/` is live); still uncommitted, waiting on Lachlan's "commit".

## Analytics, live since 19 September 2026

Until that evening **the site had no analytics at all**. The beacon was never in the page and
`site.json.cf_analytics_token` was empty, so every number anyone had quoted came from zone level
request counts, which are dominated by scanners and crawlers. The thirty day decision rule in
PORTFOLIO.md had nothing real to measure.

Cloudflare Web Analytics is now on every page, including `404.html`. Beacon token
**`264e4341231044e4919c83c7da7d5ce9`**, which is a public identifier and not a secret; it is
visible in the page source of every visitor. **The token is not the siteTag the data is filed
under.** Queries filter on siteTag **`e2e4102c2f1848a2984c56adf6d3449e`** (found 26 September by
querying with no site filter); filtering on the token returns zero for every day, which is why no
numbers were read in the first week. `build.py` emits Cloudflare's own module script from
`analytics_tag()`. Verified in Chrome: the beacon loads and posts to
`https://cloudflareinsights.com/cdn-cgi/rum`, which answers `204`.

Read it back with wrangler's token. Note the shape: `dimensions` is a selection, not an argument,
and the window must be one day or less.

```bash
TOKEN=$(grep oauth_token ~/.config/.wrangler/config/default.toml | cut -d'"' -f2)
SITE=e2e4102c2f1848a2984c56adf6d3449e   # the siteTag, not the beacon token
curl -s https://api.cloudflare.com/client/v4/graphql -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d @- <<Q
{"query":"{ viewer { accounts(filter:{accountTag:\"5e0f03f73cfa3e8ae2053605f57409d6\"}) { rumPageloadEventsAdaptiveGroups(limit:30, filter:{datetime_geq:\"2026-09-20T00:00:00Z\", datetime_lt:\"2026-09-21T00:00:00Z\", siteTag:\"$SITE\"}) { count sum { visits } dimensions { requestPath refererHost countryName } } } } }"}
Q
```

**This is the one third party script on the site**, so `/privacy/` now says so plainly and names
it, and the old claim that no third party script loads has been corrected in the privacy page and
the README. The counter is cookieless, does not fingerprint, and only runs in real browsers, which
is exactly why its numbers will look far smaller than the edge request counts. That is the point.

## Lighthouse and accessibility, 19 September 2026

Seven live pages audited with Lighthouse 13.4.1, mobile profile, against the live domain. Every
one scored **100 for Accessibility, Best Practices, SEO and Agentic Browsing, with zero failed
audits**: the home page, Settle Up, Sign a PDF, the Splitwise comparison, Habit Tracker, Ringtone
Maker and Read Aloud. Lighthouse 13 has no PWA category, so installability is not scored there;
it is covered by `tests/offline.browser.cjs` instead.

**Treat that 100 with care.** On a tool page only 25 of Lighthouse's 76 accessibility audits
apply, 48 are not applicable and 11 are handed back as manual: custom control labels and roles,
focusable controls, logical tab order, managed focus, interactive element affordance, offscreen
content hidden, visual order following the DOM, focus traps, landmarks and structured data. Those
are precisely what a waveform with drag handles or a week of tick buttons rests on.

So `tests/accessibility.browser.cjs` now checks them across **all 40 built pages and 638 visible
controls**: every focusable element has an accessible name, no positive tabindex, nothing
focusable inside `aria-hidden`, no control labelled only by a placeholder, one main landmark and
one effective h1 per page, no skipped heading level, alt text on every image, and a toggle button
that looks pressed must say so. It honours `aria-level`, because that is what a screen reader
announces. Run it after a build: `node tests/accessibility.browser.cjs`.

It found two real defects, both now fixed:

- **CV Builder** put its editor's collapsible section headings at level three under the page's
  h1, skipping level two. They are page structure, so they are now `h2`.
- **Invoice Generator** injects a facsimile of the printed invoice into the page, which put a
  second h1 in the outline and jumped from h1 to h3. Both stylesheets, screen and print, target
  those tags by name and the PDF depends on them, so the tags stay and `relevelPreview()` sets
  `aria-level` instead: the document title and the seller name sit at three, everything else at
  four, under the "Live preview" heading. Nothing visual changed, verified live.

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
5. Slate 2 remaining web tools in calendar order: #16 scan to PDF, #20 receipts,
   #21 UV index, #24 vocal remover. (#14, #15, #18, #22 and #23 are live.)
   #21 is the only one that would need a server, even a tiny one; that is Lachlan's call.

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
- **The `*.browser.cjs` tests are not run by `node --test tests/`** and had drifted. Two of them
  asserted an exact network request count after load, which the service worker and web manifest
  broke on 19 September; both now filter the shell's own requests (`/sw.js`,
  `/offline-manifest.json`, `/manifest.webmanifest`, the icons) and assert on what is left, which
  is what they were really testing. Run them after any shell change.
- **This machine has no speech synthesis voices at all** (`speechSynthesis.getVoices()` is empty),
  so Read Aloud cannot speak here and `tests/read-aloud.browser.cjs` hangs rather than fails. The
  tool itself handles it correctly: the voice picker says "No local voices available", play is
  disabled and the status explains why. Codex needs to give that test a skip when no voice exists.
- **AAC encoding is not available in this Chrome**, so no tool here can write an iPhone `.m4r`:
  `AudioEncoder.isConfigSupported({codec:'mp4a.40.2'})` reports false while Opus reports true.
  The ringtone maker therefore ships WAV and MP3 only, and its page explains the free GarageBand
  route instead of offering a button that would silently fail. Re-check before adding `.m4r`.
- The MP3 encoder is `lamejs` 1.2.1 (LGPL, vendored with its licence and a SHA-256 in
  `tools/ringtone-maker/vendor/NOTICES.txt`). Its global is used as a namespace, not called:
  `new lamejs.Mp3Encoder(...)`, never `lamejs()`. Calling it throws. MPEG only allows certain
  sample rates, so a clip at anything else is rendered through an `OfflineAudioContext` at
  44.1 kHz before encoding.
- **Checking a phone layout: do not trust `documentElement.scrollWidth`, and do not trust the
  Chrome MCP.** Setting a viewport through the MCP left the layout at desktop width while media
  queries reported the phone width, which makes an overflow check pass when it should fail. And
  `scrollWidth` counts content that a clipping ancestor already contains, which makes it fail
  when it should pass; it reported 662 px of overflow on a page that does not move. The honest
  check is `window.scrollTo(9999, 0)` and then reading `window.scrollX`, with device metrics set
  over CDP in a `tests/*.browser.cjs` harness. `tests/habit-tracker.browser.cjs` does it that way.
- A grid or flex item defaults to `min-width:auto`, which is its min-content width. A wide child
  in a scroll container therefore sets the card's minimum and pushes the whole page sideways on a
  phone, however much `overflow-x:auto` the inner container declares. The cure is `min-width:0`
  on the item, not more overflow rules.
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
