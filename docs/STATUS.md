# Plenty of Tools — status and handoff

Last updated 2026-09-16 (night). Read this first when resuming in a new session.
The operating plan, calendar and decision rules live in `~/dev/idea-engine/PORTFOLIO.md`
(status log at the bottom). This file is the "where are we" summary.

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
| 3 | Google Storage Analyser | drive-storage-analyser | **hidden** (Google OAuth in Testing) | Claude | google-one |
| 4 | Screen Recorder | screen-recorder | live (recording untested by a human) | Claude | loom |
| 5 | Background Remover | background-remover | live | Codex | remove-bg |
| 6 | Sign a PDF | pdf-sign | live | Claude | docusign |
| 7 | QR Codes | qr-codes | live | Codex | bitly |
| 8 | Invoice Generator | invoice-generator | live | Codex | xero |
| 9 | GPX Route Builder | gpx-route-builder | live | Codex | (see vs/) |
| 10 | Image Converter | image-converter | live | Claude | cloudconvert |
| 11 | Is It Worth It? Calculators | worth-it-calculators | live | Codex | uber-one |
| 12 | Browser Transcription | transcription | live | Codex | otter |

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
  **Testing**, test user = Lachlan. Scope `drive.metadata.readonly` is **restricted**:
  unverified production would cap the project at 100 users for life, so it stays in
  Testing until Google's review passes. JS origins: pages.dev added; plentyoftools.io
  still to add.
- GitHub: lirv7136 (personal). `gh` (snap) is logged in for API calls; push works over SSH.
- Google sign in is refused inside the MCP controlled Chrome, so anything needing a
  Google login happens in Lachlan's own browser.
- Nothing here uses CIM Enviro infrastructure or accounts, and nothing should.

## Open items

Lachlan:
1. Google OAuth client: add `https://plentyoftools.io` as an authorised JavaScript origin;
   add `plentyoftools.io` as an authorised domain on the Branding page (may need Search
   Console verification: a DNS TXT record on the zone).
2. Cloudflare Web Analytics: enable for plentyoftools.io in the dashboard (automatic
   setup works because the zone is proxied). Without it the 30 day kill rules have no data.
3. Manual tests nobody has done: record something with the Screen Recorder; sign a real
   PDF; sign in to the Storage Analyser at
   https://plentyoftools.io/tools/drive-storage-analyser/ once the origin is added.
4. Later: merchant of record account for the Pro unlock; first community posts in his own
   voice where the "is it worth paying for X" threads live.

Claude / Codex:
1. Google restricted scope verification submission for the analyser: scope justification,
   demo video script, privacy page check on plentyoftools.io. Only after item 1 above.
2. Directory submissions and draft posts per tool (AlternativeTo, Product Hunt, Show HN,
   r/InternetIsBeautiful, niche subreddits) once analytics is on.
3. Monthly `price_pain` diff mine in `~/dev/idea-engine` for new slate candidates.
4. Consider a redirect from the pages.dev subdomain to plentyoftools.io (needs zone
   write; dashboard Bulk Redirect or a Pages `_redirects` cannot see the host, so it is a
   Cloudflare rule).

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
