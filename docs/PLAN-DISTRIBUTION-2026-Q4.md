# Getting eyes on Plenty of Tools: distribution plan, 1 October to 20 December 2026

Written 30 September 2026 from three research passes run in parallel (communities and forums;
search and backlinks; launches, press and partners) plus the measurement script. It is the
detailed distribution layer under `docs/PLAN-ENGAGEMENT-2026-Q4.md`, which still owns the
targets, the product work and the decision rules. Drafts it relies on live in
`docs/distribution/`. Where a rule or number could not be verified it says so.

---

## 1. Where we start

| | 30 September |
|---|---|
| Real visits | 23 pageloads in 4 days, 16 of them the home page, no outside referrer (`python3 scripts/traffic.py 4`) |
| Google | 12 of 43 pages indexed; 29 "Discovered, currently not indexed" (not yet crawled; normal for a 2 week old domain with no links in) |
| Bing / DuckDuckGo | about 5 pages, via IndexNow |
| Accounts | Hacker News `lachieirving` (karma 1); AlternativeTo `lirv7136` (email to verify; listings from 3 Oct); OzBargain `lirv7136`; Reddit: unknown, assume new |
| Posts made | none |
| Live tools | 19, plus Car Logbook and Hours Log hidden until a phone test (target live 19 to 23 Oct) |

**Owner time:** about 3 hours in the break week (to 4 Oct), 1 to 3 hours in normal weeks,
nothing from 9 to 28 November (STUVAC, exams, thesis due 20 Nov), a little in early December
(poster), and about 3 to 4 hours a week from 14 December.

## 2. Targets for this plan

Measured with `scripts/traffic.py` (Cloudflare Web Analytics, real browsers only).

| By | Weekly real visits | From outside the site | Indexed on Google |
|---|---|---|---|
| 18 Oct | 100 | at least 3 referring sites | 25 pages |
| 15 Nov | 250 | search visits appearing weekly | 35 pages |
| 20 Dec | 600 (launch week spike excluded: 300 baseline) | 10 referring sites | all tool pages |

These are estimates from a baseline of about 5 a day. A single Show HN or r/InternetIsBeautiful
hit can beat all of them in a day; a flop changes nothing. The plan is built to keep working
either way.

## 3. Rules we follow everywhere

1. **Disclose, every time:** "Disclosure: I built this, it's free and open source, no ads or
   sign up."
2. **Answer the question first, fully.** The link is the last line, once, and only where the
   community allows links.
3. **Never ask anyone to vote, comment or share,** on any site. Never use a second account.
4. **Never post a claim you have not seen yourself.** Drafts carry `[placeholders]`.
5. **Say how it was built** where people ask or where it matters (HN, Product Hunt): with AI
   coding agents, checked by hand and by tests. Hiding it goes worse than saying it.
6. **90/10 on Reddit:** at most one in ten of your comments mentions your own project.
7. **Log every post** (URL, date, channel) in `~/dev/idea-engine/PORTFOLIO.md`, and read its
   effect with `scripts/traffic.py` a day and a week later.

---

## 4. Channel A: search (slow, compounding; most of the agent work)

### 4.1 Where we can realistically rank within 3 months

Autocomplete pulled 30 Sep with Australian settings; "who ranks" is indicative.

| Tool | Primary query | Long tail worth owning | Competition |
|---|---|---|---|
| **Car Logbook** | ato logbook app free | free car log book app australia; ato logbook requirements; ato logbook template; ato logbook rules | Driversnote AU, ATO, GOFAR, small AU sites |
| **Hours Log** | wfh fixed rate method records | work from home log book; wfh fixed rate 2026; wfh fixed rate 25/26 | ATO, a few small AU tools and accountant blogs |
| **Invoice Generator** | invoice template australia | invoice template australia no gst; free invoice with abn; invoice pdf | Rounded, Wise, Billdu, generic templates |
| **Ringtone Maker** | make ringtone iphone without garageband | make ringtone iphone free; from video; from mp3 | how to blogs, desktop app vendors, YouTube |
| **Settle Up** | splitwise daily limit | splitwise alternative free online; open source; limit per day | a handful of indie split app blogs |
| **Is It Worth It** | is uber one worth it australia | for students; for uber eats; reddit | thin: a few blogs and TikTok |

Every other tool faces Canva, iLovePDF, remove.bg and friends; they get listings and community
replies, not search effort.

### 4.2 Page fixes for those six (agent; exact copy to review)

| Tool | Title (under 60 characters) | Add to the page |
|---|---|---|
| Car Logbook | Free ATO Car Logbook: 12 Week Logbook, No App | FAQ as H2/H3: how long must a logbook run; how long is it valid; do I record private trips; can I use a template or spreadsheet. Link Hours Log and Invoice |
| Hours Log | Free WFH Hours Log and Timesheet for the ATO | "What the ATO accepts" (no estimate, no 4 week diary); FAQ: what counts as a record, what the rate covers, the 2026–27 rate. Check ato.gov.au for a published 2026–27 rate first |
| Invoice | Free Invoice Template Australia, GST or No GST | A worked example of an invoice without GST; FAQ: what goes on an invoice if not registered for GST, do I need an ABN, when is it a tax invoice |
| Ringtone | Free iPhone Ringtone Maker, No GarageBand | "iOS 26: set it from Files" section and FAQ. **Blocked on a real iPhone test:** reports say the Files route needs 30 seconds or less, and the tool allows 40 |
| Settle Up | Splitwise Alternative With No Daily Limit, Free | Intro line "No daily expense limit"; FAQ: what is Splitwise's daily limit, does it reset, can friends add expenses without the app; link the comparison |
| Is It Worth It | Is Uber One Worth It in Australia? Calculator | An H2 and an anchor per calculator (`#uber-one`), a worked Australian example, FAQ on price, students and break even orders |

Internal links: Car Logbook, Hours Log and Invoice link to each other; Settle Up and Is It Worth
It link to each other; Ringtone links to Screen Recorder. On the home page the six come first.

FAQ sections are plain headings and text. FAQ rich results are limited to government and health
sites, so no FAQPage markup.

### 4.3 Getting the other 29 pages indexed

Google's own words: "found by Google, but not crawled yet… no need to resubmit". The fix is
crawl demand, not technical:
1. **Links from other sites** (section 5). The biggest lever by far.
2. **Request indexing** in URL Inspection, about 10 a day (unpublished quota). Spend it on
   tool pages first, then the ATO pages when they go live, never on `/vs/` pages.
3. Keep `lastmod` honest (it comes from git; never bulk edit it).
4. Connect **Bing Webmaster Tools** by importing from Search Console (10 minutes).
5. After 6 weeks, `noindex` any `/vs/` page with zero impressions rather than adding more pages.

### 4.4 Articles that can earn links (agent drafts; owner checks anything tested)

| Article | Target query | Needs a human |
|---|---|---|
| The ATO car logbook rules in plain English | ato logbook requirements | no |
| WFH fixed rate 2026–27: what you must record | wfh fixed rate 2026 | check the rate |
| What Splitwise's daily limit actually is | splitwise daily limit | test it on a Splitwise account and date it |
| Set a custom iPhone ringtone on iOS 26 without GarageBand | make ringtone iphone without garageband | test on an iPhone |
| We checked 15 "free" PDF signers: which ones upload your file | sign pdf without uploading | agent can gather network evidence |

---

## 5. Channel B: listings and links (cheap, permanent)

Ranked by value for effort. "?" means the link type was not verified.

| # | Where | Cost | Owner time | Notes | When |
|---|---|---|---|---|---|
| 1 | **AlternativeTo**, umbrella entry, then 4 search bets, then a few a day | free | 10 min each | Moderated; account must be about 7 days old. Draft: `docs/distribution/alternativeto.md` | from 3 Oct |
| 2 | **AU bookkeeper and accountant logbook guides** (e.g. bksp.com.au, afsbendigo.com.au, nanakaccountants.com.au) | free | email, 20 min | Editorial links; pitch only once the Car Logbook is live | 26 Oct to 1 Nov |
| 3 | **pwa.directory** | free queue (or €49 fast track, not worth it) | 15 min | Needs manifest, service worker, HTTPS: all in place | 2 to 8 Nov |
| 4 | **pwastore.io** | free | 10 min | | 2 to 8 Nov |
| 5 | **SaaSHub** | free | 15 min | Followed links only on paid plans | 2 to 8 Nov |
| 6 | **awesome-no-login-web-apps** (GitHub) | free | PR, 20 min | Separate PRs for Settle Up, PDF Tools, Screen Recorder | 12 to 18 Oct |
| 7 | **OpenAlternative** | free queue | 15 min | Needs an open source repo: MIT qualifies | 2 to 8 Nov |
| 8 | **Peerlist Launchpad** | free | 20 min | Weekly, from Monday | Mon 12 Oct or Dec |
| 9 | **Fazier**, **MicroLaunch** | free | 20 min each | | 7 to 13 Dec |
| 10 | **Uneed** | free queue closed Aug 2026; US$14.99 fast track | 20 min | Optional | 7 to 13 Dec |
| 11 | **Indie Hackers** products and a story post | free | 30 min | "19 tools, zero traffic, what I learned" | 2 to 8 Nov |
| 12 | **Tiny Helpers** (GitHub PR) | free | 15 min | Web developer tools only: QR Codes, Image Converter at most | 9 to 13 Nov (agent prepares the PR) |
| 13 | **newlifeinaus.com.au** (covers Uber One in AU) and travel blogs with bill splitting roundups | free | email | Pitch the calculator and Settle Up | Nov or Dec |
| 14 | Uni library and student union "free software" pages (USYD SRC, UNSW Arc) | free | email | edu.au links, low odds | 9 to 13 Nov |
| 15 | GitHub repo: topics, README with a live link and self host note | free | agent | | this week |
| — | **Skip:** BetaList (paid only), Console.dev (developer tools only), business.gov.au, Whirlpool (no self promotion), Lobsters (invite only; show tag blocked for 70 days) | | | | |
| — | **awesome-privacy**: repo must be 4 months old, so not before mid January 2027 | | | | Jan 2027 |

---

## 6. Channel C: communities (warm, targeted; mostly replies)

### 6.1 Rules that matter

Reddit fetching is blocked, so subreddit rules come from third party mirrors of the sidebars.
**Read the live sidebar before your first post in any subreddit.**

| Community | Rule | Mode |
|---|---|---|
| Reddit generally | about 90/10 own content | replies first |
| r/InternetIsBeautiful | no sign up, no paid, **nothing where AI drives the functionality** | one post; **Settle Up** is the candidate (not Background Remover or Transcription) |
| r/SideProject | self promotion welcome, must engage | post once the account is about 30 days old |
| r/webdev | project showoffs only on **Showoff Saturday**, focused on technical detail | a technical write up on a Saturday |
| r/selfhosted | projects under 3 months old only in the New Project megathread, must have docs | megathread, December |
| r/opensource | Promotional flair; MIT is fine | December |
| r/degoogle | Showcase megathread; affiliated commenters prefix **[DEV]** | megathread plus [DEV] replies |
| r/smallbusiness | weekly promotion thread only; relevant replies allowed | weekly thread (invoice) |
| **Do not use** | r/privacy (instant ban for promotion), r/sidehustle, r/resumes (bans resume builders), r/jobs, Whirlpool | |
| Hacker News | not primarily for promotion; no vote asking | Show HN once, then real comments |
| OzBargain | always free things go in the **forums**; declare and choose "Associated" | one forum post; draft `docs/distribution/ozbargain.md` |
| **Apple Community** | no links to personal websites | **text answers only.** This changes Post 1's Apple thread in `posts.md` |
| Microsoft Q&A / Community | no unsolicited advertising | reply that answers first, with disclosure |
| Stack Exchange (Super User, Bicycles, Music, Money) | disclose affiliation in every answer | answer first |

**Checked 9 Oct (archived sidebars):** r/AusFinance bans promoting anything you own, and enforces
it, so it is **answers without links only**; r/personalfinance bans it too but allows open
source tools with modmail pre approval, and bans AI written content; r/FinancialPlanning and
r/Frugal ban own links; r/povertyfinance allows disclosed links. Everywhere below that lists
r/AusFinance, read it as "helpful answers, no link". Details: `docs/distribution/subscription-finder-replies.md`.

Unverified and so replies only until checked: r/usyd, r/UNSW,
r/unimelb, r/auscorp, r/Guitar, r/cycling, r/Strava, r/MealPrepSunday, r/iphone, r/Windows, r/mac,
r/tax, r/Accounting, r/tradies, r/dyslexia.

### 6.2 Where each tool gets mentioned

| Tool | Communities |
|---|---|
| Car Logbook, Hours Log | r/AusFinance, r/auscorp, OzBargain forum, r/tradies (check), accountant outreach |
| Invoice Generator | r/AusFinance, r/smallbusiness weekly thread, OzBargain forum |
| Settle Up | r/AusFinance, r/travel, r/degoogle, r/InternetIsBeautiful |
| Is It Worth It | r/AusFinance, r/Flights, OzBargain forum, r/EtsySellers |
| Subscription Finder | r/AusFinance, r/personalfinance |
| Image Converter | Microsoft Q&A, r/iphone, r/Windows, Super User |
| Ringtone Maker | r/iphone, Apple Community (text only) |
| Screen Recorder, PDF Tools, Sign a PDF | r/software, r/Windows, Super User |
| CV Builder | r/usyd, r/UNSW, r/unimelb in graduate application season (never r/resumes or r/jobs) |
| GPX Route Builder | r/Strava, r/cycling, r/running, Bicycles SE |
| Tuner and Metronome | r/Guitar, r/ukulele, Music SE |
| Habit Tracker, Recipe Keeper | r/getdisciplined, r/MealPrepSunday, r/EatCheapAndHealthy, r/degoogle |
| Transcription, Read Aloud | r/degoogle megathread, r/software, r/opensource |

### 6.3 Thread hunting (Sunday, 20 minutes, agent can run the Google half)

Replace the date with a week ago each time. Reply only to threads under 7 days old with fewer
than 30 comments.

```
site:reddit.com "splitwise" (limit OR alternative OR premium) after:2026-09-23
site:reddit.com/r/AusFinance ("logbook" OR "work from home" hours) after:2026-09-23
site:reddit.com "heic" (jpg OR windows) after:2026-09-23
site:answers.microsoft.com heic jpg after:2026-09-23
site:reddit.com ("remove.bg" OR "docusign" OR "loom") (free OR alternative) after:2026-09-23
site:reddit.com ("rocket money" OR "forgotten subscriptions") after:2026-09-23
site:reddit.com (strava "route builder" OR "export gpx") after:2026-09-23
site:reddit.com ("gst" invoice template) ("sole trader" OR abn) after:2026-09-23
```

Reddit search, sorted New, past week: `subreddit:AusFinance title:logbook`,
`subreddit:Guitar title:tuner`, `subreddit:iphone heic`, `subreddit:Strava gpx`,
`title:splitwise self:yes`.

### 6.4 Reply templates (fill the brackets from your own use)

- **Upload or privacy worry:** "[Direct answer]. If you'd rather not upload [photos/the PDF],
  [tool] runs in the browser; I tried it on [my own file and result]. It doesn't [limitation].
  [link] Disclosure: I built this, it's free and open source, no ads or sign up."
- **Paid app limit:** "[App]'s free tier caps [X]. The manual workaround is [method]. I made
  [tool] because [my situation]; it doesn't [sync/feature]. [link] + disclosure"
- **Calculator:** "With your numbers: [working]. So it pays off only if [condition]. The
  calculator I made does this: [link] + disclosure"
- **ATO:** "The ATO wants [requirement, with the ato.gov.au link]. Any record with [fields] works,
  even paper. I built a free one: [link] + disclosure. I'm not a tax agent."
- **No links allowed:** the full answer, and "happy to share what I use if DMs are OK", only where
  DMs are allowed.

### 6.5 Building a reputation honestly

| Weeks | Reddit | Hacker News |
|---|---|---|
| 1 to 2 | 3 to 5 genuinely helpful comments a week with no links (r/AusFinance, r/usyd, hobby subs), about 45 minutes | 2 or 3 substantive comments a week on engineering, HVAC or tooling threads |
| 3 to 5 | first disclosed replies with links, at most 1 in 10 | Show HN retry if Thursday was blocked (section 7.1) |
| 6 on | r/SideProject and r/InternetIsBeautiful posts, once about 30 days old with about 100 karma (estimate) | keep commenting; never repost the same thing |

A new account's posts can be silently removed by automoderators: check each post while logged
out.

---

## 7. Channel D: launches (spikes)

### 7.1 Show HN, Thursday 1 October, 10 pm to midnight Sydney (8 to 10 am US Eastern)

**The gate.** Since March 2026 HN restricts Show HN from accounts without much history; they are
sent to a notice page (news.ycombinator.com/showlim), and moderators give no karma threshold.
`lachieirving` has karma 1. Submit anyway. **If you land on /showlim, do not work around it** (no
new account, no plain title without "Show HN"). Spend October on section 6.5 and retry around
**3 to 5 November** or **15 to 17 December**.

**Before submitting**
- [ ] Screen Recorder: record a real clip and play the file back.
- [ ] Sign a PDF: sign a real file, open it in another viewer.
- [ ] Site checked on your phone, no console errors.
- [ ] Your own sentence on how it was built, in `docs/distribution/show-hn.md`.
- [ ] 2.5 hours free after posting.

**Title** (no caps, no exclamation marks, no hype):
1. `Show HN: Browser only replacements for tools that paywall the last step`, the strongest.
2. `Show HN: 19 small tools that run entirely in the browser (MIT)`
3. Avoid anything like "I replaced 19 paid apps", which reads as linkbait.

**First comment, as a short essay:** why (the CV builder that charged at the download button,
in your words) → the rule (no server, so free costs nothing) → two or three technical stories
(rotated PDF coordinates, HEIC in wasm, the ledger in the URL hash) → built with AI agents and
how you checked the work → what is rough → one question for readers → source link.

**The first three hours:** answer every comment within about 15 minutes; fix small bugs live
and say "fixed, thanks"; thank critics, concede what is true, answer with data; don't argue about
AI; don't watch the rank.

**If it sinks:** HN allows a small number of reposts only for stories that got no attention;
you may email hn@ycombinator.com once, politely, about the second chance pool. Better: a Show HN of
a single tool (Car Logbook or PDF Tools) at least 4 weeks later, with its own URL. A technical
write up (rotated PDF coordinates) can go in as an ordinary submission.

### 7.2 Product Hunt, Tuesday 15 December, 12:01 am Pacific = **7:01 pm Sydney (AEDT)**

- Editors feature about 1 in 10 launches: useful, novel, crafted, not "minimal,
  undifferentiated". A bundle of 19 risks looking undifferentiated, so lead with "nothing
  uploaded, open source" and show three standout tools (Car Logbook, Settle Up, Sign a PDF).
- **Assets (agent drafts, week of 1 Dec):** tagline under 60 characters; 5 gallery images at
  1270×760; a 30 to 60 second silent demo; thumbnail; maker comment including "built with AI
  agents, checked by hand".
- Followers page and a teaser a week before; tell friends "have a look", never "upvote".
- **Likely result (estimate):** unfeatured, under 100 visits; featured, a few thousand; plan for
  50 to 800.
- `docs/distribution/product-hunt.md` gives 5:01 pm; in December it is **7:01 pm** because Sydney
  is on daylight time.

### 7.3 Other launch venues

| Venue | Rule | Expected (estimate) | When |
|---|---|---|---|
| r/InternetIsBeautiful | one tool, no AI, no sign up: **Settle Up** | 0 to 20,000, high variance | 2 to 8 Nov or 7 to 13 Dec, account about 30 days old |
| r/SideProject | honest "I built" post, stay for comments | 100 to 1,000 | 2 to 8 Nov |
| r/webdev Showoff Saturday | technical detail | 50 to 500 | Sat 17 Oct |
| Indie Hackers | the story post | 50 to 500 | 2 to 8 Nov |
| Peerlist Launchpad | weekly | 50 to 300 | Mon 12 Oct |
| Hacker Newsletter / TLDR | curated from HN only | bonus only | follows an HN hit |

---

## 8. Channel E: press, newsletters, creators, partners

### 8.1 Press

Lifehacker AU and Gizmodo AU closed in July 2024; don't pitch them.

| Outlet | Angle | When |
|---|---|---|
| **Honi Soit** (editors@honisoit.com) | USYD student builds free tools with no paywall; CV Builder for graduate season | 5 to 9 Oct |
| USYD news, Engineering faculty | student story | October |
| **SmartCompany** | free ATO logbook and invoice tools for sole traders; they want a story, not product placement | 20 to 27 Oct |
| **Finder, Canstar, Money** | free ATO logbook and WFH hours record before the **31 Oct** self lodgement deadline | 20 to 24 Oct |
| Startup Daily | USYD student ships 19 open source tools built with AI agents | early Nov or December |

Pitch template:

> Subject: [Free ATO car logbook, no sign up] ahead of 31 Oct
> Hi [name], I'm a final year USYD engineering student. I built [tool], a free replacement for
> [paid app, $X a year] that runs entirely in the browser, so nothing leaves your phone.
> [One fact or story from your own use]. Happy to give [a quote / screenshots / a demo].
> [link]
> Lachlan Irving, [phone]

### 8.2 Creators

Ten small to mid accounts (5k to 100k): Australian tax and money TikTok ("tax time australia",
"work from home deduction"), study and productivity YouTube, "free tools you didn't know"
accounts. Offer first look at one tool, never payment.

> Hi [name], loved your [specific video]. I built a free, no sign up [car logbook / CV builder]
> that keeps everything on your device. No ask, no affiliate: if it's useful for a [topic]
> video it's yours to show. [link]

### 8.3 Partners

| Partner | Tool | Message |
|---|---|---|
| USYD SRC, UNSW Arc, careers centres | CV Builder, Settle Up | "Hi [team], I'm a USYD student who built a free CV builder with no paywall on the download and no data collected. Would you consider it for [resources page / newsletter]? Open source, no ads. [link]" |
| Clubs and societies, share house groups | Settle Up, QR Codes | "Hi [exec], a free tool for splitting club costs, no app or account needed. Happy to show it at [event]. [link]" |
| Accountants and tax agents | Car Logbook, Hours Log | "Hi [firm], clients often arrive without a 12 week logbook or a record of WFH hours. I built free, private tools that print a report and export CSV. Free to recommend, nothing in it for me. [link]" |
| Music teachers | Tuner and Metronome | "Hi [teacher], a free tuner and metronome that works in any browser, no ads, handy for students without an app. [link]" |
| Running and cycling clubs | GPX Route Builder | "Hi [club], a free GPX route builder for planning group runs, no subscription. Useful for your route setters? [link]" |

---

## 9. The master calendar

Owner time in brackets. Agent work runs alongside and needs no owner time unless it says so.

| Week | Owner | Agent |
|---|---|---|
| **Thu 1 Oct** | (3 h) Recorder and PDF checks; your sentence in the Show HN draft; **Show HN 10 pm**, then 2.5 h answering. If blocked by /showlim, note it and move on | Watch comments; `traffic.py` next morning |
| **1 to 4 Oct** (break) | (1 h) Verify AlternativeTo email; umbrella listing from 3 Oct; 10 indexing requests; connect Bing Webmaster; start no link comments (Reddit, HN) | Page fixes for Invoice, Settle Up, Is It Worth It (4.2); GitHub README; fix `posts.md` Apple note |
| **5 to 11 Oct** (P1 due 9 Oct) | (0.5 h) Honi Soit pitch (5 to 9 Oct); Sunday thread hunt | Splitwise limit article draft (you test the limit); 10 more indexing requests list |
| **12 to 18 Oct** | (2.5 h) Peerlist Mon 12 Oct; AlternativeTo: 4 search bet tools; awesome-no-login PR; **iPhone ringtone test**; Subscription Finder reply (Post 2); r/webdev Showoff Sat 17 Oct | Ringtone section and article after your test; PR text; Showoff write up |
| **19 to 25 Oct** (A2 due 25 Oct) | (1 h) Phone test of Car Logbook and Hours Log, then **flip them live**; indexing requests for both; pitch SmartCompany, Finder, Canstar | ATO page copy and FAQs; logbook rules article; pitch drafts; DM list of 5 tax creators |
| **26 Oct to 1 Nov** | (2.5 h) ATO replies in r/AusFinance around the **31 Oct** deadline; **OzBargain forum post**; 3 accountant emails | WFH rate article; outreach drafts |
| **2 to 8 Nov** | (2.5 h) **Show HN retry** if Thursday was blocked; r/SideProject; Indie Hackers story; pwa.directory, pwastore, SaaSHub, OpenAlternative (agent fills the forms, you submit) | PDF signer audit article; form copy |
| **9 to 28 Nov** (STUVAC, exams, thesis) | (5 min a week) Glance at Search Console; answer replies only | Refresh pages with impressions but few clicks; Tiny Helpers PR prepared; list `/vs/` pages for noindex; careers centre emails drafted |
| **29 Nov to 6 Dec** (poster) | (1 h) Settle Up and Is It Worth It replies (holiday trips, bag fees); Product Hunt follower page | Product Hunt gallery, demo video script, maker comment |
| **7 to 13 Dec** | (2 h) r/InternetIsBeautiful (Settle Up); Fazier, MicroLaunch, Uneed; CV Builder replies in uni subs; r/smallbusiness weekly thread; Startup Daily pitch | Launch copy |
| **Tue 15 Dec** | (3 h) **Product Hunt, 7:01 pm Sydney**, then answer comments | Watch and reply drafts |
| **16 to 20 Dec** | (2 h) Single tool Show HN if eligible; r/opensource and r/degoogle megathreads; Recipe Keeper replies before Christmas; Tuner in r/Guitar gift threads | **Scoreboard and verdicts** (section 10); January plan with awesome-privacy PR |

Total owner time: about 25 hours over 12 weeks, heaviest this week and in mid December.

---

## 10. Measuring it

- **Every Sunday:** `python3 scripts/traffic.py 7`. Paste the totals, the top pages and the
  referrers into the PORTFOLIO status log. (If it says 401, run `npx wrangler whoami`.)
- **The day after every post:** `python3 scripts/traffic.py 2` and note the referrer count next to
  the post in PORTFOLIO.
- **Search Console, fortnightly:** indexed count, impressions and clicks for the six search bets.
- **Channel verdicts:** a post that brings fewer than 20 visits is not repeated in that channel;
  a channel that brings over 100 gets a second, different post within a month.
- **Tool verdicts** follow `PLAN-ENGAGEMENT-2026-Q4.md`: 30 days after a tool's posts, under 100
  visitors and under 10 completed tasks means mothball; over 1,000 means double down.

## 11. Risks and open items

| Risk or open item | What we do |
|---|---|
| Show HN blocked for a new account | build history honestly; retry in November or December |
| New Reddit account filtered | comment for two weeks first; check posts while logged out |
| iOS 26 ringtone length (30 s versus our 40 s) | test on an iPhone before changing the page or posting |
| 2026–27 WFH rate unpublished | provisional label stays; check ato.gov.au before the ATO pages go live |
| Splitwise's current daily limit | test and date it before the article claims a number |
| Google CASA review blocks the storage analyser | not part of this plan; exemption asked 29 Sep, deadline 19 Dec |
| Burnout in exam weeks | the calendar has nothing but glances from 9 to 28 Nov; skipping a week is fine |

## Sources

Hacker News: guidelines, Show HN rules, FAQ, /showlim, second chance pool. Product Hunt featuring
guidelines. OzBargain deal posting guidelines. Apple Community terms. Microsoft Q&A code of
conduct. Subreddit rules via rankhog and redditgrowthdb mirrors (live sidebars unverifiable from
here). Google Search Central: page indexing report, sitemaps, URL Inspection. ATO logbook and
fixed rate pages. pwa.directory, SaaSHub, Uneed, Peerlist, Tiny Helpers, awesome-privacy
CONTRIBUTING, Lobsters about. Full links are in the three research reports summarised here
(30 September 2026).
