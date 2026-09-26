# Plenty of Tools: engagement plan, 28 September to 20 December 2026

Written 26 September 2026 from three research passes (live traffic, repo audit, distribution and
comparable sites) plus an app options review. Supersedes the distribution parts of
`PLAN-2026-09-20.md`. The calendar and decision rules in `~/dev/idea-engine/PORTFOLIO.md` still
apply, except where this file corrects them.

## Where we start

| | 26 September |
|---|---|
| Live tools | 19 (plus Storage Analyser waiting on Google, Measurement Notebook waiting on a phone test) |
| Real pageloads, 20 to 26 Sep | about 37, mostly the home page, much of it Lachlan |
| Search | first Google referral 26 Sep; Bing and DuckDuckGo list about 5 pages |
| Posts made | none, so no tool's 30 day clock has started |
| Health | 180 unit tests pass, live site is byte identical to the repo |

The product is ahead of plan. Distribution and measurement have not started. Every week without a
post is a week the 30 day rule cannot judge.

**Calendar correction.** The mid semester break is **one week, 28 Sep to 4 Oct** (confirmed in the
semester calendar on 20 Sep), not 28 Sep to 9 Oct as PORTFOLIO.md says. MTRX3760 P1 is due Fri
9 Oct. STUVAC 9 to 15 Nov, exams 16 to 28 Nov, thesis report and MTRX P2 Fri 20 Nov, poster and oral
early December. **The coming week is the only real block of Lachlan's time before December.**

## What engagement means here (targets are estimates from a baseline of about 5 loads a day)

| Metric | Measured by | Wk 4 | Wk 8 | Wk 12 |
|---|---|---|---|---|
| Search visits a week | Web Analytics referrer + Search Console clicks | 30 | 120 | 300 |
| Tasks completed a week (PDF saved, invoice exported, share link made) | first party event counter | 20 | 80 | 200 |
| Returning share of visits | a yes/no flag in the browser, no identifier | 5% | 10% | 15% |
| Installs a week | `appinstalled` + launches in standalone mode | 2 | 5 | 10 |
| Settle Up shared links opened a week | event counter on the landing view | 5 | 15 | 40 |

Visitors say whether a page is found; completed tasks say whether a tool is worth finding.

## Workstreams

### 1. Measurement (agent, week 1)
- **Done 26 Sep:** the analytics query in STATUS.md used the beacon token instead of the siteTag;
  corrected, so traffic can be read.
- A Pages Function at `/api/e` that writes to Workers Analytics Engine (free tier: 100k writes and
  10k read queries a day). Each event carries: tool, event name, returning flag, referrer category.
  No cookies, no IP, no identifier. `/privacy/` updated to say exactly that.
- A Sunday scoreboard: an agent reads the week and appends one line per tool to
  `docs/SCOREBOARD.md`.

### 2. SEO foundations (agent, **done on branch `seo-pass`, 26 Sep**)
- Share cards (1200×630) for every tool plus a site default, so a pasted Settle Up link previews
  properly. Regenerate with `python3 scripts/og_cards.py` (needs Inkscape).
- Structured data: WebApplication + BreadcrumbList on tools, BreadcrumbList on comparisons,
  WebSite + ItemList on home. FAQPage was left out on purpose: since 2023 Google shows FAQ rich
  results only for government and health sites.
- New `/vs/` hub of every comparison, a "Compare" header link, and a "More free tools" block
  under every tool (grouped by kind, hidden in print).
- Comparison titles now lead with "Free X alternative"; meta descriptions end on a sentence.
- A keyword line above each slogan H1 ("Free invoice generator with GST and ABN" above "Good work.
  Clear invoices.") so the design stays and the page says what it is.
- Sitemap `lastmod` from git; the empty "Coming next" section is hidden when nothing is queued.

### 3. Getting people back (agent, weeks 1 to 4)
- **A "did the job" panel** after a completed task: two related tools, a bookmark hint, and an
  install prompt only after the second completed task, never on landing.
- **Recent work on this device** per tool and on the home page (recent invoices, saved clients,
  groups), labelled "stored only in this browser", with export.
- **Settle Up landing view.** A shared link opens a group view that says "made with Plenty of
  Tools, free, no account" and offers the tool. It is the only viral loop the site already has,
  so it gets polished first.
- **Invoice generator remembers the next number and past clients**: a monthly reason to return.
- **Update channel without email:** `/changelog/` with an RSS feed, and a "new since your last
  visit" dot from a date kept in the browser.
- **Install prompts:** `beforeinstallprompt` on Android and Chromium; an "Add to Home Screen" hint
  on iOS Safari after a second visit.

### 4. Content (agent, 2 pages a week, with a quality gate)
- **Weeks 1 to 3, deepen the four best bets:** how to, worked example, questions people actually
  search, and what the paid version adds.
  1. Australian invoice generator (GST, ABN; generic US sites are the competition)
  2. Ringtone maker for iPhone (iOS 26 reportedly lets any short audio file be set as a
     ringtone from Files; **verify on a real iPhone before the page claims it**)
  3. Splitwise alternative (the free tier's daily cap is the pain)
  4. Sign or edit a PDF without uploading
- **Weeks 4 to 8, pages that generate from real inputs, only where the output actually changes:**
  invoice variants for NZ GST, UK VAT, sole trader not registered for GST, and a quote template
  (about 6 pages); "is X worth it" calculators people already argue about (Uber One, Amazon Prime
  AU, Canva Pro, Strava, Adobe; up to 8).
- **Rule:** no page ships without a working tool on it. Pages with zero impressions after 6 weeks
  are noindexed.

## Week by week (Lachlan's hours in brackets)

| Wk | Dates | Lachlan | Agents |
|---|---|---|---|
| 1 | 28 Sep–4 Oct, **break** | (3 h) Review and merge `seo-pass`. Check Search Console coverage and request indexing for home. Create the AlternativeTo account (it must be 7 days old to submit). Post the two drafted forum replies. Show HN on Thu 1 Oct. One OzBargain forum post (marked Associated) led by the invoice generator | Event counter, "did the job" panel, update Show HN and AlternativeTo drafts to 19 tools |
| 2 | 5–11 Oct, P1 due | (0.5 h) Sunday review | Recent work lists, Settle Up landing view, 2 content pages |
| 3 | 12–18 Oct | (1.5 h) AlternativeTo listings for 4 tools; open the awesome-privacy PR | Changelog + RSS, install prompts |
| 4 | 19–25 Oct, A2 due | 0 | Invoice variants |
| 5 | 26 Oct–1 Nov | (1 h) Two replies in existing "is X worth it" threads | Calculators 1 to 4 |
| 6 | 2–8 Nov | (1 h) Uneed, SaaSHub, pwa.directory, pwastore (agent fills the forms, he submits) | Calculators 5 to 8 |
| 7–10 | 9 Nov–6 Dec, STUVAC, exams, thesis | 0 (5 min Sunday review) | Refresh pages with impressions but few clicks; write the December launch queue |
| 11 | 7–13 Dec | (3 h) r/InternetIsBeautiful, second OzBargain post, Peerlist | Launch support |
| 12 | 14–20 Dec | (4 h) Product Hunt for the brand; Show HN for the best single tool | Scoreboard, verdicts, app decision (below) |

Total owner time about 15 hours, most of it in week 1 and weeks 11 to 12. Every post, account and
submit click is his, in his own voice; agents draft, with square bracket placeholders for anything
he has not personally observed.

**Channel rules worth remembering**
- **Show HN:** no asking friends to upvote or comment.
- **OzBargain:** always free things go in the forums, not deals, and he must tick Associated.
- **Whirlpool:** does not allow self promotion, so skip it.
- **Product Hunt:** only about 10% of launches get featured, and an unfeatured launch brings under
  100 visits, so it waits for December.

## Decision rules

- **Per tool, 30 days after its posts:**
  - Under 100 unique visitors and under 10 completed tasks: mothball.
  - 100 to 1,000 visitors: keep, with one improvement from real feedback.
  - Over 1,000 visitors, or over 50 tasks a week: the tool gets week 12 and the January focus.
- **Per channel:** a post that brings under 20 visits is not repeated.
- **Site:** under 50 search visits a week by week 8 means stop making generated pages and move the
  effort to directories and community posts.
- **Pages:** if tasks per visit are under 5%, fix the first screen of the tool pages before adding
  anything.

## Should we make an app? Not yet.

The problem is that nobody has been sent to the site, and a store listing does not fix that.

| Option | Verdict |
|---|---|
| Keep the PWA, improve install prompts | **Now.** No cost, keeps every web visit |
| Android wrapper on Google Play (TWA via Bubblewrap) | **Maybe, from 14 Dec**, only if the site reaches the keep band (100+ uniques a month) and install prompts are being accepted. A personal Play account needs a 14 day closed test with 12 testers, per app; reuse Talkeven's tester pool |
| iOS wrapper (Capacitor) | **No.** App Store guideline 4.2 rejects repackaged websites |
| One native umbrella app | **No.** "Plenty of tools" matches no search, and it means two codebases for 19 tools |
| Separate native apps | **Only where native wins.** ATO car logbook (background GPS) in Jan to Feb, aiming for the store before EOFY. A habit tracker with home screen widgets second, if the web version shows retention. Tuner, splitter, ringtone and text to speech gain nothing from native |

Store accounts are already paid for (Apple team for Talkeven; personal Play account from 20 Sep),
so the cost of any app is owner time and review risk, not fees. App Store search for ringtone
maker and guitar tuner is dominated by apps with 10k to 20k ratings; habit tracker is the only one
of the three where small apps still rank.

## What worked for comparable sites

- **Photopea:** one Reddit AMA (Nov 2018) roughly doubled its monthly users in 7 months. Plain
  promotional posts were flagged. A founder story in an Ask or Show format beats an ad.
- **it-tools:** open source and self hostable, spread through self hosting write ups and GitHub
  stars. Our repo is already public and MIT licensed; a clear README with a static self host note
  is cheap.
- **10015.io and TinyWow:** one page per tool, with search as the engine (about half of 10015's
  desktop traffic, per a third party estimate), plus a way to reach users again. Ours, without
  email, is RSS plus installs.
