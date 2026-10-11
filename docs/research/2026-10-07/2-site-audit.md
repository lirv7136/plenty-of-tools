# Site audit: what stops Plenty of Tools ranking, spreading and bringing people back

Research agent 2 of 5, 7 October 2026. Read only: nothing in the repo was changed except this file,
nothing was committed, deployed or posted. Evidence comes from the worktree at
`.claude/worktrees/seo-pass` (branch `ato-tools-brief`, with today's uncommitted title and FAQ edits),
a fresh `python3 build.py` into `dist/`, curl against the live site, a headless Chrome pass at phone
width (390 × 844, temp profile, scratch script outside the repo), and Google and Cloudflare
documentation. Line numbers refer to the worktree as of today.

## The short version

1. **The site is technically clean and shallow; indexing is a demand problem, not a structure
   problem.** Every live tool is one click from home and every comparison two clicks; no page is
   orphaned; HTML is 6 to 13 KB; every page has one H1, a canonical and a sitemap entry. On site work
   cannot replace links from other sites. What on site work *can* do is (a) remove three small
   signals that make the site look less trustworthy to a crawler, (b) thicken the handful of tool
   pages that are almost empty to a reader, and (c) turn the tools' own outputs into the source of
   those missing links and visits.
2. **Only one tool has a built in growth loop, and it leaks.** Settle Up's share link is the only
   output that lands a new person on the site. The recipient lands in an editor, three phone
   screens above the answer they came for, with a chat preview that talks about Splitwise. Fixing
   that is the single highest value change on the site.
3. **Nothing brings anyone back.** No install prompt, no "done" moment, no cross tool link at the
   moment of success, and the invoice generator (the strongest search bet) forgets everything on
   refresh.
4. **We are blind.** The only counter is a Cloudflare beacon that EasyPrivacy blocks, which means
   the privacy minded audience this site is built for is invisible, and no tool reports whether
   anyone finished a task.

## Ranked changes (at most 20; the first five are marked ★)

| # | Change | Area | Agent effort | Owner time |
|---|---|---|---|---|
| ★1 | Settle Up: recipient view, share sheet with a summary line, links a third the length, a chat preview written for the recipient | loop | 4 to 6 h | none |
| ★2 | First party event counter (and Search Console data an agent can read) | measurement | 4 to 5 h | 10 min |
| ★3 | Host and sitemap hygiene: www redirect, pages.dev noindex, honest lastmod, descriptions cut to length | indexing | 1 to 2 h | 5 min dashboard |
| ★4 | A shared "done" panel: next tool, send to a friend, install after the second success | retention, spread | 5 to 7 h | none |
| ★5 | Invoice Generator remembers your business, customers and next number | retention | 3 to 4 h | none |
| 6 | Shareable result links for Is It Worth It | loop | 2 to 3 h | none |
| 7 | Real prose on the thin tool pages (CV Builder first) | indexing | 1 h per page | 10 min review each |
| 8 | Home page as a hub: groups, "on this device", a plainer first screen | retention, indexing | 3 to 4 h | none |
| 9 | Recipe share link | loop | 4 to 5 h | none |
| 10 | Credits policy: visible credit only where it helps the recipient; metadata credit elsewhere | loop | 2 to 3 h | 5 min decision |
| 11 | PWA: shortcuts, screenshots, per tool install for daily tools, iOS hint, `storage.persist()` | retention | 3 to 4 h | none |
| 12 | Title and H1 consistency | indexing | 1 h | 10 min review |
| 13 | GPX route share link | loop | 3 to 4 h | none |
| 14 | Contextual links in body copy between paired tools | indexing | 1 to 2 h | none |
| 15 | "What's new" page with RSS, fed by the build | retention | 2 h | none |

Effort is agent time; owner time is Lachlan's. Expected effects are estimates, labelled as such.

---

## ★1. Settle Up: make the shared link land a convert, not a confused guest

**Problem (evidence)**
- The share button copies the bare URL and nothing else: `tools/settle-up/app.js:205-210`
  (`navigator.clipboard.writeText(url)`, `prompt()` fallback). No `navigator.share`, no message text.
  A friend in a group chat receives a 1,780 character blob.
- Link length: the built in sample (5 people, 8 expenses) encodes to **1,738 characters of hash, a
  1,780 character URL** (`static/core.js:132-145`, JSON to base64url, no compression). Raw deflate of
  the same JSON is **503 characters**. A real fortnight trip with 30 expenses will pass 6,000.
  Long opaque links look like spam and some SMS clients split them.
- The chat preview is the SEO title. `og:title` is filled from `<title>` (`shell/page.html` lines
  10 to 11, `build.py:97`), so the recipient sees *"Splitwise Alternative With No Daily Limit,
  Free"* above a description that ends *"A free alternative to Splitwise and Tricount."*
  (`tools/settle-up/meta.json`). That copy is right for Google and wrong for a friend who has never
  used Splitwise and only wants to know what they owe. The card image itself
  (`shell/og/settle-up.png`) is good.
- What the recipient sees on a phone (headless Chrome, 390 px, live site, sample link): the H1
  "Settle Up", a paragraph about Splitwise, then *Copy share link / Expenses CSV / Plan CSV /
  Print / Try a sample / Clear*, then a toast that disappears after 3.5 seconds
  (`app.js:26`, `app.js:235`). The "Settle up" plan, the thing they came for, starts **2,544 px down
  (about three screens)**. Nothing tells them who sent it, that it is free, or that the site has
  18 other tools. The People card is also clipped on the right at 390 px (chips and the "Add a
  name" field run under the card edge).
- Arrivals are uncountable: a chat app sends no referrer and the hash never reaches the server, so
  an opened share link looks exactly like any other `/tools/settle-up/` pageview.

**Change**
- `tools/settle-up/static/core.js:132-145`: versioned encode. New links are `#z` + base64url of
  `CompressionStream('deflate-raw')`; `decode` accepts both the old and the new form, so every link
  already sent keeps working. Async encode means `persist()` (`app.js:40-43`) awaits it; debounce
  the `replaceState` by 300 ms. Unit tests in `tests/settle-up.test.cjs` for round trip and old link
  compatibility (Node 18+ has `CompressionStream`).
- `app.js:205-210`: "Share" uses `navigator.share({ title, text, url })` where available, else
  copies a two line message: *"Jervis Bay weekend: 5 people, A$1,240. Who owes whom:"* + URL. The
  summary line is the conversion copy and is written by the sender's own data, so it is honest.
- `app.js:232-235`: when `source === 'link'`, render a recipient panel above everything:
  the group name, the settle plan (*"4 payments settle this: Priya pays Mia A$212.40 …"*), a
  "Jump to the expenses" link, one line *"Add yours below and send the new link back"*, and a quiet
  footer line *"Settle Up is one of 19 free tools that run in your browser, no account. [See
  them]"*. Collapse the editor buttons behind "Edit this ledger" for link arrivals. Fire the
  `link_opened` event from ★2.
- Share preview: let `meta.json` carry an optional `share_title` and `share_description`; in
  `build.py` `page()` (line 92) fill `og:title` and `og:description` from them when present.
  Settle Up: *"Settle Up: see who owes whom"* / *"Someone split a trip or a house with you. Open
  the link to see the fewest payments that square everyone up. Free, no app, no account."*
  `<title>` stays the Splitwise title for search.
- Fix the People card clip in `tools/settle-up/tool.css` (`min-width:0` on the grid item, per the
  STATUS gotcha).

**Expected effect (estimate).** Each shared ledger reaches every member of a group, typically 3 to
6 people, all of whom are exactly the people who will need a splitter for their next trip. Today
they meet an editor and a Splitwise pitch; after this they meet their answer and a one line
introduction to the site. This is also the r/InternetIsBeautiful candidate in the distribution
plan, so it should be in its best form before that post.

## ★2. A first party event counter, and Search Console data an agent can read

**Problem (evidence)**
- The only measurement is Cloudflare Web Analytics (`build.py:31-38`). Its script host is on
  EasyPrivacy: `||cloudflareinsights.com^$third-party` (line 6598 of
  https://easylist.to/easylist/easyprivacy.txt, checked today). uBlock Origin and Brave ship that
  list, so readers from r/degoogle, Hacker News or r/selfhosted mostly do not count. The last 8 days
  show **11 loads, all on `/`, no referrer, 8 from the US** (`python3 scripts/traffic.py 8`): not one
  tool page load registered, which suggests even Lachlan's own testing is blocked or absent.
- No tool reports a completed task, so the engagement plan's main metric ("tasks completed a
  week") and the 30 day mothball rule cannot be computed. `functions/` does not exist; the
  `/api/e` counter in `PLAN-ENGAGEMENT-2026-Q4.md` workstream 1 was never built.
- Search Console impressions are only visible in Lachlan's browser; agents cannot read them, so the
  fortnightly check depends on his scarce time.

**Change**
- `functions/api/e.js` (Pages Function) writing to Workers Analytics Engine: one data point with
  blobs `[tool, event, referrer_category, returning]` and nothing else. No cookie, no IP, no user
  agent stored. Add `_routes.json` with `"include": ["/api/*"]` so every other request stays
  static and free of Function invocations.
- `shell/pot.js` (new, loaded by `shell/page.html` with `defer`): `POT.done(tool, event)` sends
  `navigator.sendBeacon('/api/e', …)`, once per event per page view. "Returning" is a yes or no
  from a date kept in `localStorage` (`pot:seen`), never an identifier. Events to wire first:
  `settle-up link_copied`, `settle-up link_opened`, `invoice printed`, `cv printed`, `pdf-sign saved`,
  `pdf-tools saved`, `image-converter converted`, `ringtone downloaded`, `qr downloaded`,
  `worth-it calculated`, `install accepted`, `standalone launch`.
- `shell/privacy.html`: one paragraph saying exactly what an event contains.
- `scripts/scoreboard.py` querying the Analytics Engine SQL API per tool per week, appending to
  `docs/SCOREBOARD.md`.
- Search Console: a Google Cloud service account (the `plenty-of-tools` project already exists)
  added as a *restricted* user on the domain property (Lachlan, 10 minutes, once), then
  `scripts/gsc.py` pulling clicks, impressions and position per page and query for the last 28
  days. Agents can then run the November "refresh pages with impressions but few clicks" task
  without him.

**Expected effect.** Not traffic, but the ability to tell which of 19 tools deserves the next
hour. Without it every verdict in both plans is a guess. A first party path is also not on
blocklists, so the counts will be much closer to reality than the beacon's.

## ★3. Host and sitemap hygiene

**Problem (evidence)**
- Three hosts serve the same 200 pages: `https://plentyoftools.io/`, `https://www.plentyoftools.io/`
  and `https://plenty-of-tools.pages.dev/` (curl as Googlebot, all `HTTP/2 200`, no redirect). Only a
  JavaScript redirect for pages.dev exists (`shell/page.html` line 6). The canonical tags are right,
  but Google ranks a redirect above `rel=canonical` as a signal and treats the sitemap as weak
  (https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls). On a
  site Google is still deciding how much to crawl, every duplicate URL it discovers is spent budget
  ("If many of these URLs are duplicates … this wastes a lot of Google crawling time",
  https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget).
- `lastmod` is not honest. Every tool page carries `2026-09-30` because `build.py:190` passes
  `ROOT / "tools.json"` to `lastmod()`, so adding two *hidden* tools on 30 September re-dated all 19
  live tool pages. Meanwhile today's title and FAQ changes are live but uncommitted, so their
  pages still say 30 September. The home page, `/vs/`, `/about/`, `/privacy/` and `/terms/` have no
  `lastmod` at all (`dist/sitemap.xml`). Google uses lastmod only "if it's consistently and
  verifiably … accurate" (https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).
- Tool meta descriptions are passed raw (`build.py:184`, `meta["description"]`), unlike `/vs/`
  pages which go through `snippet()`. 17 of 23 are over 160 characters, up to 384
  (`recipe-keeper`), so both the search snippet and the chat preview end mid thought.

**Change**
- `build.py:272-275`: add to `_headers`
  `https://:project.pages.dev/*` → `X-Robots-Tag: noindex` (Cloudflare's documented pattern,
  https://developers.cloudflare.com/pages/configuration/headers/).
- Cloudflare dashboard, zone `plentyoftools.io`: one Redirect Rule, `www.plentyoftools.io/*` →
  `https://plentyoftools.io/${1}`, 301, keep query (5 minutes; `_redirects` cannot do host
  redirects, https://developers.cloudflare.com/pages/configuration/redirects/). Lachlan or an
  agent with a token that has zone write; the current wrangler token does not.
- `build.py:190`: `lastmod(src, ROOT / "vs" / f'{t["vs"]}.json')` without `tools.json`; give
  the home page and `/vs/` the newest date of what they list; add a pre deploy check in
  `scripts/deploy.sh` that refuses to deploy with uncommitted changes under `tools/`, `vs/` or
  `shell/` (or use a content hash cache so lastmod follows content, not commits).
- `build.py:184`: `snippet(meta["description"])`, and rewrite the longest seven descriptions by
  hand so the first 155 characters carry the point.

**Expected effect.** Small, but free: one host, dates Google can trust, readable snippets. It does
not by itself move "Discovered, not indexed"; links and visits do.

## ★4. A shared "done" panel at the moment of success

**Problem (evidence)**
- No tool has a success moment beyond its own download. `grep beforeinstallprompt|appinstalled|
  display-mode` over `shell/` and `tools/` finds nothing; the engagement plan's "did the job" panel
  and install prompts (workstream 3) were not built.
- Cross tool links exist only in the "More free tools" aside at the very bottom of each page
  (`build.py:180-183`), below the fold of a tool that is several screens tall (Settle Up 5,066 px,
  Invoice 6,684 px at 390 px wide). Someone who just signed a PDF is not scrolling there.
- There is no way to pass a tool on except copying the address bar.

**Change**
- `shell/pot.js` (same file as ★2) exposes `POT.done(tool, event, {next})`, which shows a small,
  dismissible panel under the tool's output: *"Done. Saved to your device."* · one or two next steps
  chosen per tool (a `NEXT` map beside `GROUPS` in `build.py`, emitted as JSON) · *"Send this tool
  to someone"* (`navigator.share` with the tool URL, else copy) · and, only from the second completed
  task on this device, *"Install Plenty of Tools"* (stashed `beforeinstallprompt` on Chromium; a one
  line Add to Home Screen hint on iOS Safari). Never on landing, never twice in a session,
  remembered when dismissed.
- Suggested next steps (each a real workflow, not filler): Sign a PDF → PDF Tools (merge or
  reorder); PDF Tools → Sign a PDF; Image Converter → Background Remover; Background Remover →
  QR Codes or Image Converter; Invoice → Hours Log (when live) and Car Logbook; Ringtone Maker →
  Screen Recorder or Transcription; Transcription → Read Aloud; Subscription Finder → Is It Worth
  It; Is It Worth It → Subscription Finder and Settle Up; Settle Up → Is It Worth It (bag fees,
  travel calculators); CV Builder → Sign a PDF and PDF Tools (cover letter plus transcript into one
  file); Recipe Keeper → Habit Tracker; GPX Route Builder → Habit Tracker.
- Wire the call into each tool's existing success line (examples: `pdf-sign/app.js:554`,
  `image-converter/app.js:156` and `:364`, `ringtone-maker/app.js:283`, `qr-codes/app.js:89-91`,
  `invoice-generator/app.js:112`, `cv-builder/app.js:292-295`, `settle-up/app.js:205`).

**Expected effect (estimate).** Moves the cross tool link from the bottom of the page to the one
moment a person is satisfied and looking for the next thing; the site's pitch ("plenty of tools")
only works if a visitor discovers the second tool. Gives an honest, quiet install path.

## ★5. Invoice Generator remembers the business, the customers and the next number

**Problem (evidence)**
- The page tells users *"refreshing this tab clears unsaved edits"* (`tools/invoice-generator/index.html:4`).
  `grep localStorage tools/invoice-generator/app.js` finds nothing; the only persistence is a
  manual JSON draft file (`app.js:105`). A sole trader who comes back next month retypes their ABN,
  bank details and customer.
- This is the strongest Australian search bet in `PLAN-DISTRIBUTION-2026-Q4.md` §4.1, and invoicing
  is the most naturally recurring task on the site. The engagement plan listed this fix
  (workstream 3) and it was not built.

**Change**
- `tools/invoice-generator/app.js`: autosave the current document to `localStorage`
  (`pot:invoice:draft`), keep "Your business" as a saved profile, keep a list of past customers
  (pick from a list on the Customer card), and propose the next invoice number from the last one
  printed. A visible *"Stored only in this browser · Forget"* line, and the existing draft export
  as the backup.
- `index.html:4`: replace the warning with *"Your details stay in this browser for next time."*
- Optional: on the second visit, *"Welcome back: INV-0007 is next"* in the hint line.

**Expected effect.** Turns a one off into a monthly return visit for every user who keeps
invoicing; returning visits are also a positive signal for the page that Google is evaluating.

---

## 6. Shareable result links for Is It Worth It

**Problem.** The calculators only download a text file (`worth-it-calculators/app.js:66-70`); the
hash selects a calculator and nothing else (`app.js:71-73`). "Is Uber One worth it" is argued in
r/AusFinance and OzBargain threads, which is exactly where the distribution plan's reply template
("With your numbers: [working]") sends Lachlan. A link that opens with the numbers filled in is a
better reply than a paragraph and a link to an empty form.

**Change.** `app.js`: encode `active` plus field values in the hash (`#uber/orders=6&fee=4.99…`),
update it with `replaceState` on calculate, read it in `activate()`; a "Copy link to this result"
button beside Print; `share_title` for the page as in ★1. A short line on arrival: *"Someone shared
these numbers. Change any of them."*

**Effect.** Each shared result is a link into the site posted inside a relevant thread (a real
backlink and a real visit), and it makes Lachlan's own replies faster. 2 to 3 hours.

## 7. Real prose on the thin tool pages

**Problem (evidence).** Visible words inside `<main>` (excluding the related aside), from `dist/`:

| Page | Words in main | Has a "how it works / questions" section |
|---|---|---|
| CV Builder | **75** | no (editor is rendered by script into an empty `<section id="editor">`) |
| Read Aloud | 147 | no |
| PDF Tools | 161 | no |
| Background Remover | 262 | short |
| GPX Route Builder | 264 | short |
| Disk Analyser | 275 | partial |
| Screen Recorder | 288 | one H2 |
| Tuner and Metronome | 295 | "Notes" only |
| Sign a PDF | 299 | one H2 |
| Settle Up, Invoice, Is It Worth It, Ringtone | 450 to 650 | yes (today's pass) |

For comparison, the "free CV builder no paywall" results today are dedicated landing pages for
MojCV, FreeCV, Make My CV Free and MyPDFCV (an open source rival), all of which state the "no
watermark, no paywall at download" promise in body text; "merge pdf without uploading" returns
pages that explain *how* the in browser merge works (pdf-lib, nothing leaves the device). Our pages
say the same thing in one sentence. Google judges site quality partly from what it has already
crawled, so the three near empty pages weigh on the rest.

**Change.** In each `tools/<slug>/index.html`, a `<section class="prose">` below the tool in the
Settle Up pattern: how it works (what really happens to the file), 3 to 5 questions people actually
search, an honest "when the paid one is better" line and the `/vs/` link. Order: CV Builder (the
origin story of the site; questions on ATS, A4 versus Letter, "CV or resume in Australia", why no
watermark), PDF Tools (merge, split, rotate as H3s with `#merge` style anchors, which also gives
community replies a precise link), Sign a PDF (is a drawn signature legally binding in Australia,
with a link to the source, not advice), Read Aloud, Screen Recorder. No new URLs; the plan's rule
against batch pages stands. Each page reviewed by Lachlan for claims he has not seen.

**Effect (estimate).** Gives the queries in the distribution plan something to match and lifts the
weakest pages Google has seen. 1 hour each, about 6 hours for the set.

## 8. Home page as a hub people keep

**Problem (evidence).** At 390 px the home page is a 4,102 px single column of 19 cards in
`tools.json` order, CV Builder first (headless Chrome screenshot). No groups, no way to see "my
tools", and the first screen is the brand name twice plus two sentences of positioning. The
`GROUPS` map already exists in `build.py:43-49` but only feeds the related aside.

**Change.** `build.py:237-250` and `shell/home.html`: render the five groups as H2 sections
(Documents, Money, Audio and video, Images, Everyday) with one line each; a row *"On this device"*
filled by `shell/pot.js` from the `pot:*` localStorage keys that tools already write (Settle Up,
CV Builder, Habit Tracker, Recipe Keeper, and Invoice after ★5), linking straight back to work in
progress; the six search bets first within their groups; a one line hero that says what happens
(*"19 tools that run in your browser. Nothing uploaded, no account, no paywall at the last
step."*). Keep the `ItemList` JSON-LD.

**Effect.** A start page worth bookmarking or installing, H2s that describe the categories to a
crawler, and a reason for an installed app's start URL (`/`) to be useful. 3 to 4 hours.

## 9. Recipe share link

**Problem.** Recipe Keeper exports all recipes as `recipes.json` (`recipe-keeper/app.js:396`) and
copies a shopping list as plain text (`app.js:378-382`). Recipes are among the most shared things
in families and share houses, and the tool has no way to send one.

**Change.** A "Share this recipe" button that encodes one recipe (title, ingredients, method,
notes, no photos) in the hash with the ★1 compressed codec; the recipient sees the recipe card
read only, with *"Save to my recipes"* (adds to their own localStorage) and the same one line site
introduction. Validate and escape like Settle Up's ids. `share_title`: *"A recipe for you"*.

**Effect (estimate).** A second true loop: the recipient lands on a page that does something for
them and asks for nothing. 4 to 5 hours.

## 10. Credits: where a "made free with plentyoftools.io" line is honest, and where it is not

**What each tool emits today.**

| Tool | Output leaving the site | Credit today |
|---|---|---|
| Settle Up | share link, two CSVs, print | the link itself; nothing on print or CSV |
| Invoice | browser print to PDF | none in the document; Chrome's own header and footer (URL, date) if the user leaves them on, which the page tells them to turn off |
| CV Builder | browser print to PDF (`@page{margin:0}`), JSON | none |
| Sign a PDF, PDF Tools | PDF via pdf-lib | pdf-lib's default Producer string; only the built in sample says Plenty of Tools (`pdf-sign/app.js:641`) |
| QR Codes | PNG, SVG | none |
| GPX Route Builder | `.gpx` | `creator="Plenty of Tools"` (`static/core.js:56`), no link |
| Ringtone Maker | WAV, MP3 | none |
| Image Converter, Background Remover | images, ZIP | none |
| Transcription | TXT, SRT | none |
| Habit Tracker, Recipe Keeper, Subscription Finder, Disk Analyser | CSV, JSON, print | none |
| Is It Worth It | TXT, print | none |
| Screen Recorder | WebM or MP4 | none |

**Policy (judged against annoyance and the "no paywall at the last step" promise).** A watermark
is exactly what these tools exist to avoid (Loom, Zety, remove.bg), so:

- **Visible credit, on by default, one click to remove and remembered:** only where the reader of
  the output is a peer who plausibly needs the same tool and the document is informal. Settle Up
  print and plan CSV last line (*"Split with Settle Up, free at plentyoftools.io"*); Is It Worth It
  print and TXT; Recipe Keeper printed card and shared recipe.
- **Offered, off by default:** Invoice and CV. A checkbox *"Add a small 'Made free with
  plentyoftools.io' line to the footer"*. Invoices go to clients and CVs to recruiters; the user
  is judged on them, and a default credit there is a tax on the result.
- **Metadata only, invisible in normal use:** signed and edited PDFs set Producer to
  *"Plenty of Tools (plentyoftools.io)"* instead of pdf-lib's string (both tools already overwrite
  it); GPX gets the standard `<metadata><link href="https://plentyoftools.io/tools/gpx-route-builder/">`.
- **Nothing at all:** QR images (printed on someone else's poster), screen recordings, ringtones,
  converted images, cutouts, transcripts, and anything copied to the clipboard (appending text to a
  copy is the classic dark pattern).

**Files.** `settle-up/static/core.js` (`csvPlan`), `settle-up/tool.css` print footer,
`worth-it-calculators/app.js:66-70` and its print CSS, `recipe-keeper` print CSS,
`invoice-generator/app.js` (footer node near line 82) and a checkbox in `index.html`,
`cv-builder/app.js` render, `pdf-sign/app.js` and `pdf-tools/app.js` before each `save()`,
`gpx-route-builder/static/core.js:56`.

**Effect (estimate).** Small and slow, but permanent; mostly it makes ★1 and ★9 complete. 2 to
3 hours.

## 11. PWA: install the tools people use daily

**Problem (evidence).** `shell/manifest.webmanifest` has one app, start URL `/`, no `shortcuts`,
no `screenshots` (Chromium shows the richer install sheet only with screenshots). Someone who
installs from Habit Tracker gets an icon that opens the home page. No tool calls
`navigator.storage.persist()`, so on iOS Safari, where script written storage can be cleared after
seven days without a visit unless the site is on the Home Screen, a habit streak or recipe
collection can vanish, which is the worst possible retention event for a "nothing leaves your
device" brand.

**Change.** Manifest `shortcuts` for the four most repeated tools (Habit Tracker, Recipe Keeper,
Settle Up, Invoice; later Car Logbook and Hours Log) and two `screenshots`. For Habit Tracker,
Recipe Keeper, Car Logbook and Hours Log, a per tool manifest (`id` and `scope` set to the tool
path, linked from that tool page via `head_extra` in `build.py:150`) so the installed icon *is*
the tool. `navigator.storage.persist()` on first save in those tools, and an iOS Add to Home Screen
hint after a week of use (from ★4's logic). Track `install accepted` and `standalone launch` (★2).

**Effect.** Daily tools become home screen apps, which is where habits and logbooks live. 3 to 4
hours.

## 12. Title and H1 consistency

**Problem (evidence).** Seven tool titles exceed 60 characters (Sign a PDF 82, Tuner 81, Image
Converter 76, Transcription 73, Screen Recorder 70, Background Remover 70, PDF Tools 67), and six
spend characters on " · Plenty of Tools" while the rest omit it. Eight tools have a bare product name
as H1 with no keyword line (CV Builder, PDF Tools, Sign a PDF, Screen Recorder, Image Converter,
Habit Tracker, Ringtone Maker, Tuner and Metronome); the others use the eyebrow pattern from the
26 September pass. Is It Worth It ships an empty `<h2 id="wc-title">` in the HTML that script fills
(`worth-it-calculators/index.html:4`).

**Change.** `tools/*/meta.json` titles to 50 to 60 characters with the query first and no brand
suffix (the brand is in `og:site_name`); add the eyebrow keyword line to the eight H1s; give the
empty H2 the default calculator's text in the HTML.

**Effect.** Cleaner snippets; consistent signals on what each page is for. 1 hour.

## 13. GPX route share link

**Problem.** Routes leave only as `.gpx` downloads (`gpx-route-builder/app.js:104`). Run and ride
clubs share routes with members, which is the partner pitch in the distribution plan §8.3.

**Change.** Encode the route's points (rounded to 5 decimals, delta encoded, compressed with the
★1 codec) in the hash; the recipient sees the route on the map with "Download GPX" and "Edit a copy".
Long routes may exceed comfortable URL length: cap at about 2,000 points and say so.

**Effect.** A loop into club chats, smaller audience than ★1 or ★9. 3 to 4 hours.

## 14. Contextual links in body copy

**Problem (evidence).** The link graph is flat and complete: the crawl from `/` reaches all 19
live tools at depth 1 and all 19 `/vs/` pages at depth 2, with 6 to 13 internal links into each tool
page (scratch audit over `dist/`). There are no orphans among indexable pages (`/vs/imagemeter/`
has zero inbound links but is noindex). So the link graph is **not** why pages are unindexed. What
is missing is descriptive anchor text in body copy: most inbound anchors are the tool's name inside
a card.

**Change.** When writing ★7 prose, link the natural pairs in sentences (Sign a PDF ↔ PDF Tools;
Image Converter ↔ Background Remover; Settle Up ↔ Is It Worth It; Invoice ↔ Car Logbook ↔ Hours
Log, as the distribution plan §4.2 already asks). No link blocks, no footers of links.

**Effect.** Minor. 1 to 2 hours, mostly folded into ★7.

## 15. "What's new" page with RSS

**Problem.** No reason to come back that does not depend on email, which the site will not collect.

**Change.** `build.py` renders `/new/` and `/new/feed.xml` from a small `changes.json`; a dot on the
header link when something is newer than the date in `localStorage`. One entry per real change.

**Effect.** Low: a few RSS readers among the open source audience, and one more honestly fresh page.
2 hours. Do it only after ★1 to ★5.

---

## Answers to the five audit questions

### 1. Why 31 pages are "Discovered, currently not indexed"

Google's definition: *"found by Google, but not crawled yet … Google rescheduled the crawl"*
(https://support.google.com/webmasters/answer/7440203). For a three week old domain with no inbound
links that is crawl demand, which Google says depends on *"size, update frequency, page quality,
and relevance"* and popularity (*"URLs that are more popular on the Internet tend to be crawled more
often"*). The on site checklist, measured:

| Factor | Finding | Verdict |
|---|---|---|
| Depth from home | every tool 1 click, every comparison 2 | fine |
| Links per page | 15 to 17 internal on tool pages, 8 on `/vs/`, 45 on the hub | fine |
| Orphans | none among indexable pages | fine |
| Sitemap | 43 URLs, all live, submitted; lastmod inaccurate | fix (★3) |
| Canonical | correct on all three hosts; www and pages.dev still serve 200 | fix (★3) |
| Page weight | HTML 6 to 13 KB, 0.1 to 0.5 s from this machine | fine |
| `/vs/` near duplicates | template boilerplate about 60 words; unique copy 290 to 740 words each | not duplicates; keep, and keep the plan's 6 week noindex rule |
| Text to boilerplate | 0.34 (CV Builder) to 0.95; tool pages mostly 0.5 to 0.8 | thin on CV, Read Aloud, PDF Tools (★7) |
| H1s | exactly one per page; eight are bare product names | tidy (★12) |
| Robots | `Allow: /`, hidden tools `noindex,nofollow` | fine |

The honest conclusion: these fixes make the site cheaper and more convincing to crawl, but the
lever is links and visits from elsewhere. That is why ★1, 6, 9 and 13 matter for SEO too: each turns
a user's output into a link that lands on the site from a forum, a chat or a club page.

### 2. Built in growth loops
See ★1, 6, 9, 10, 13. Only Settle Up has a loop today. Ranked by expected reach: Settle Up link,
Is It Worth It result link, recipe link, a generic "send this tool" in the done panel, GPX route
link, then credits on informal printouts. The policy in item 10 is the line between a credit and a
watermark.

### 3. Retention and return visits
See ★4, ★5, 8, 11, 15. The two concrete defects are the invoice generator forgetting everything and
the absence of any install path; the structural gap is that the home page knows nothing about what
this browser has already used.

### 4. Shareability
Share cards exist for all 23 tools and look good (`shell/og/*.png`). The problems are the text
around them: `og:title` equals the search title, which for Settle Up and Is It Worth It is aimed at
Google rather than at a friend in a chat (★1 adds `share_title`), and tool `og:description`s run to
384 characters (★3). A first time visitor on a shared Settle Up link does not see who sent it, what
they owe, or what the site is until three screens down (★1).

### 5. Measurement gaps
Cannot measure today: any task completion; any shared link opening; installs; returning visits;
anyone using a blocker (EasyPrivacy covers the beacon); Search Console without Lachlan's login. The
lightest privacy respecting fix is ★2: one Pages Function, one Analytics Engine dataset, events
that carry a tool name and an event name and nothing about the person, scoped by `_routes.json`
so the rest of the site stays static.

## Things checked and found fine

- 404s are real 404s (`/nope/` → 404, `no-store`); trailing slash and `index.html` redirect with 308.
- Hidden tools and their comparison pages are noindex and out of the sitemap (`build.py:196-217`).
- Structured data is restrained and correct in kind (WebApplication, BreadcrumbList, ItemList; no
  FAQPage, no invented ratings).
- No horizontal page scroll at 390 px on home, Settle Up, CV Builder, Invoice and PDF Tools
  (`scrollTo(9999,0)` then `scrollX === 0`), apart from the clipped People card inside Settle Up.
- Today's title and FAQ edits for Settle Up, Invoice and Is It Worth It are live (curl).

## Sources

- Google, Page indexing report: https://support.google.com/webmasters/answer/7440203
- Google, Crawl budget and crawl demand: https://developers.google.com/search/docs/crawling-indexing/large-site-managing-crawl-budget
- Google, Build a sitemap (lastmod): https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap
- Google, Consolidate duplicate URLs: https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls
- Cloudflare Pages headers (pages.dev noindex): https://developers.cloudflare.com/pages/configuration/headers/
- Cloudflare Pages redirects (no host redirects): https://developers.cloudflare.com/pages/configuration/redirects/
- EasyPrivacy list, line 6598: https://easylist.to/easylist/easyprivacy.txt
- Competing "free CV builder no paywall" pages (MojCV, FreeCV, Make My CV Free, MyPDFCV) and
  "merge pdf without uploading" results, web search 7 October 2026.
