# Growth teardown: how comparable free tool sites grew, and what Plenty of Tools can copy now

Research agent 1 of 5, 7 October 2026. Research only: nothing was posted, submitted or signed
into. Builds on `docs/PLAN-DISTRIBUTION-2026-Q4.md` and `docs/PLAN-ENGAGEMENT-2026-Q4.md`, which
stay the baseline. This report covers what those plans missed, where the evidence contradicts
them, and which moves are worth Lachlan's scarce hours.

**About the numbers.** Traffic figures marked "Semrush" are third party estimates from Semrush's
public overview pages. They are often wrong by a wide margin, especially for small sites, so read
them as orders of magnitude. Anything I could not verify is marked **unverified**. Reddit and
Indie Hackers sometimes block fetching. Where that happened, the claim comes from a search
snippet or a secondary write up and is labelled.

---

## 1. Short answer

1. **No comparable site grew because of the umbrella.** Each breakout was a single tool you can
   name in one sentence: remove.bg, Squoosh, Excalidraw, Photopea, Smallpdf's compressor,
   iLovePDF's merger, Omni's percentage calculator. The big umbrellas began as one tool and
   widened **within one category**. When they moved into a second category they often used a
   second brand on its own domain: iLovePDF and iLoveIMG, remove.bg and unscreen, Photopea and
   Vectorpea. TinyWow is the only unrelated multi tool umbrella in this set at scale, and its
   early growth is undocumented (section 2.8).
2. **The fastest documented growth for this exact product shape (open source tools that run in
   the browser) came from the self hosting ecosystem,** not from Google. Examples: it-tools (40.8k
   GitHub stars), OmniTools (10.3k), BentoPDF (15.8k in its first year), VERT (15.7k) and
   Stirling PDF (93.7k). The existing plans touch this channel only lightly (a README note, a
   December megathread, awesome-privacy in January). This is the biggest gap.
3. **Mature tool sites live on direct traffic, not search.** Photopea is 64% direct, TinyWow
   79%, Squoosh 85%, invoice-generator.com 82% and it-tools 56%. Search and community spikes
   bring people in once; bookmarks and habit bring them back. The engagement plan's retention
   work (install prompts, recent work, share links) is the right bet and should stay.
4. **Search is slow for a new domain, even when done well.** Omni Calculator took about two years
   and a team to reach roughly 20k visits a month. An indie calculator site in 2026 saw "almost
   nothing" from search for 8 weeks. Do not expect search to carry October to December.
5. **Two things in the current plan need fixing.** "Settle Up" is already the name of an
   established app (2.5 million users, per a third party summary), and Spliit, an open source,
   no account Splitwise alternative, is already listed as the top alternative to it. Also, Show
   HN numbers suggest one hero tool beats a 19 tool umbrella on HN.

**Verdict on shape.** Keep plentyoftools.io as the home and the domain that collects links and
index trust. Starting new domains now would reset the indexing clock, and indexing is the current
bottleneck. **Stop marketing the umbrella.** Market 2 or 3 hero tools under their own names. Only
when a hero passes about 1,000 visits a month should it move to its own domain, as iLoveIMG and
unscreen did.

---

## 2. Site by site teardown

### 2.1 Photopea (solo; free "Photoshop alternative")

| | |
|---|---|
| Start | Coding began before 2013; the site footer says "© 2013" ([blog.photopea.com](https://blog.photopea.com/creating-photopea.html)) |
| Scale over time | "more than 2.5 millions of people" in total by December 2017 ([Photopea blog](https://blog.photopea.com/creating-photopea.html)); 1.5M monthly users at the November 2018 AMA ([HN 18397380](https://news.ycombinator.com/item?id=18397380)); about 3M a month seven to nine months later ([Indie Hackers summary](https://www.indiehackers.com/post/how-reddit-ama-earned-photopea-12m-monthly-users-7c66c1d9ad)); "opened 10 million times a month" ([Failory interview](https://failory.com/interview/photopea)) |
| Source mix now | Direct 64%, organic search 28%, referral 3% ([Ahrefs](https://ahrefs.com/websites/photopea.com), via search snippet); Semrush gives direct 65%, google.com 19% ([Semrush](https://it.semrush.com/website/photopea.com/overview)) |
| Time to roughly 1M a month | about 5 years |

**What worked.** Ivan says: "I wrote a comment about Photopea under each article about Photoshop
alternatives. I posted on Reddit, Hacker News, etc." Unprompted reviews and videos then "drew
more attention to Photopea over the last 8 years" ([Failory](https://failory.com/interview/photopea)).
Other people's YouTube tutorials are often credited too
([5to9 newsletter](https://5to9.beehiiv.com/p/photopea-free-photoshop-alternative-making-millions);
secondary source). The November 2018 Reddit AMA reached HN at 562 points
([HN](https://news.ycombinator.com/item?id=18397380)) and drew press such as
[PetaPixel](https://petapixel.com/2018/11/08/photopea-is-a-free-photoshop-clone-that-runs-in-your-browser)
and [Gigazine](https://gigazine.net/gsc_news/en/20181111-photopea-developer-ask-question).
A 2021 HN AMA reached 363 points ([HN 26768550](https://news.ycombinator.com/item?id=26768550)).

**What failed.** "90% of my posts and comments were marked as self-promotion and deleted."
Asking YouTubers for coverage: "90% of them ignored me, and 10% asked for money"
([Failory](https://failory.com/interview/photopea)).

**What transfers.** Be a free version of one named, expensive product. Answer existing
"alternative to X" threads. Expect cold creator outreach to fail. The AMA worked because
1.5M people already used Photopea, so it does **not** transfer at our size.

### 2.2 Omni Calculator (team; thousands of calculators; search engine)

| | |
|---|---|
| Start | A percentage calculator app in 2011; the site began after a Berlin accelerator in 2014 ([Omni founder page](https://www.omnicalculator.com/meet-the-founder)) |
| Scale | "about 20,000 visits a month by 2016" ([founder page](https://www.omnicalculator.com/meet-the-founder)); 260k sessions in January 2017, 1.87M in January 2018, 3.75M in January 2019, while the team grew "from 5 to 20 people" ([Omni 2018 recap](https://blog.omnicalculator.com/2018-recap/)) |
| Engine | Organic search; ads (AdSense) pay for it ([Google publisher story](https://www.google.co.in/ads/publisher/stories/omni_calculator/)) |
| Extra lever | Free **embeddable widgets**, on condition of a visible "Powered by Omni Calculator" and a keyword link back ([Omni widgets](https://www.omnicalculator.com/calculator-widgets), [embed guide](https://www.omnicalculator.com/how-to-embed-calculator)) |

**What transfers.** Embeds that earn links, for our calculators. Do **not** copy the volume.
Omni's model needs a content team, and Glenn Gabe lists "calculations" among the categories that
"dropped heavily" in the September 2023 helpful content update
([GSQI](https://www.gsqi.com/marketing-blog/september-2023-google-helpful-content-update-hcux/)).

### 2.3 Smallpdf (three friends; one tool first)

- Started in 2013 as a single PDF compressor, built because scanned letters from their parents
  were too big to email ([EU-Startups interview](https://www.eu-startups.com/2020/12/in-a-nutshell-investors-simply-werent-necessary-interview-with-smallpdfs-co-founders-ceo-manuel-stofer-and-dennis-just/), via search snippet; the page returns 403 to fetching).
- "From zero to 8.5 million users per month in three years", with 14 tools by then (same
  source). [deutsche-startups.de](https://www.deutsche-startups.de/2016/04/27/smallpdf-7-mitarbeiter-85-millionen-nutzer-im-monat/?amp=1)
  reported 7 staff and 8.5M monthly users in April 2016.
- HN played no part: its submissions scored 9, 7 and 3 points
  ([HN search](https://hn.algolia.com/?q=smallpdf)). Growth came from search on very large
  queries ("compress pdf") in the 2013 search landscape. **The channel mix is not stated by
  the founders in anything I could read (unverified).**

**What transfers.** Start with one tool and add tools within one category. The 2013 search
conditions do not transfer.

### 2.4 iLovePDF (solo designer, then a team; one tool first)

- Built in 2010 by Marco Grossi, a 25 year old freelance web designer in Barcelona, because he
  could not find a fast, free way to merge two PDFs ([iLovePDF about](https://ilovepdf.com/help/about), via snippet).
- "over 60 million monthly visits in 2021"; localisation grew "from 11 to 25 languages", with
  "a team of 25 translators, one per language" ([Crowdin interview](https://crowdin.com/blog/interview-ilovepdf-product-localization)).
  About 150M visits in October 2024, 47M of them from India ([YourStory](https://yourstory.com/2026/02/ilovepdf-beats-amazon-india-traffic), via snippet).
- Image tools live under a **separate brand and domain, iLoveIMG**, with its own Chrome
  extension ([iLovePDF blog](https://www.ilovepdf.com/blog/ilovepdf-iloveimg-chrome-extensions-update)).

**What transfers.** A category spinoff onto its own brand, once a category works. Translation
helped at their scale, but it needs translators someone can trust, which we do not have.

### 2.5 PDF24 (small German company; desktop first)

- geek software GmbH, founded 2006. A desktop PDF printer (PDF24 Creator) came first, then
  online tools; funded by advertising, no outside money ([pdf24.org about](https://pdf24.org/about), via snippet).
- No public figures on early channels (**unverified**). The pattern is the same as 2.3 and 2.4:
  one category, many tools, about 20 years of compounding.

### 2.6 remove.bg (two founders; one tool)

- Launched 17 December 2018 as a free web app ([TechCrunch](https://techcrunch.com/2019/01/08/remove-bg-photoshop-free-image-background-editor/amp/)).
  It spread on Twitter when Matt Haughey ran it on Gritty (same source), then
  [Boing Boing](https://boingboing.net/2018/12/22/remove-bg-the-background-remo.html) (22 Dec)
  and TechCrunch (8 Jan) covered it. Kaleido says it "became the most upvoted product on Product
  Hunt" ([Kaleido story](https://www.kaleido.ai/about/our-story.jar), via snippet).
- On HN it did modestly: 77 points on launch day, 221 points three months later
  ([HN 18699925](https://news.ycombinator.com/item?id=18699925), [HN 19418244](https://news.ycombinator.com/item?id=19418244)).
- The next product, unscreen, went on **its own domain** in 2020
  ([TechCrunch](https://techcrunch.com/2020/10/02/kaleidos-unscreen-is-dead-simple-drag-and-drop-background-removal-for-video)).
  About 30M monthly active users by 2022, after Canva bought it in 2021 (Kaleido story, via snippet).

**What transfers.** A tool you can demo in one image travels on social media. Our Background
Remover is not new in 2026 (remove.bg is free at low resolution), so it will not repeat this.

### 2.7 Excalidraw (one engineer, then contributors)

- First tweet 1 January 2020. By 15 January: "12K unique active users, 1.5K stars on GitHub, 26
  contributors". Everyone who landed a pull request got commit access
  ([web.dev case study](https://web.dev/articles/excalidraw-and-fugu)).
- The engine was the founder's existing Twitter audience plus open contribution. We have neither
  the audience nor, in October, the time to review outside pull requests.

### 2.8 TinyWow (200+ tools, unrelated categories)

- Founder and CEO Evan Gower ([Crunchbase](https://www.crunchbase.com/person/evan-gower)).
- 1.92M visits in June 2026 ([Semrush](https://www.semrush.com/website/tinywow.com/overview/), via snippet);
  August 2025: direct 79%, organic search 15% ([Semrush snippet](https://it.semrush.com/website/tinywow.com/overview)).
- It shows up in "websites you didn't know existed" lists and TikTok roundups
  ([Marketing Shots](https://marketingshots.beehiiv.com/p/shot-66-5-websites-every-marketer), [Genbeta](https://www.genbeta.com/web/esta-web-tiene-tantas-herramientas-utiles-gratis-para-convertir-archivos-que-casi-parece-que-deberia-ser-ilegal)).
  **How it got its first 100k is undocumented (unverified).** It is the one unrelated multi tool
  umbrella at scale in this set. Its HN submissions got 2 points each ([HN search](https://hn.algolia.com/?q=tinywow)).

### 2.9 10015.io (solo; 57 tools at launch, now more)

- Show HN in February 2022 with "57 plus tools": 38 points, 12 comments. The sharpest criticism
  was "Way too many ads on this site" ([HN 30250223](https://news.ycombinator.com/item?id=30250223)).
- 710.82K visits in June; google.com 47.75%, direct 41.53%; India ahead of the US and UK
  ([Semrush snippet](https://nl.semrush.com/website/10015.io/overview), dated July 2025).
- Search did the work over about 3 years. This is the best "umbrella that worked" example, and
  it is developer and designer tools, a single audience.

### 2.10 it-tools (solo, open source, self hostable)

- Repo created April 2020, 40,782 stars today ([GitHub API](https://api.github.com/repos/CorentinTh/it-tools)).
- 228.04K visits in August 2026: direct 56.44%, google.com 35.07%; 3.74 pages a visit
  ([Semrush](https://www.semrush.com/website/it-tools.tech/overview/)).
- No big HN moment shows up ([HN search](https://hn.algolia.com/?q=it-tools.tech)). It spread
  through self hosting write ups and comparisons, for example noted.lol comparing OmniTools with
  it ([noted.lol](https://noted.lol/omni-tools/)), and through forks: awesome-selfhosted lists a
  fork ([awesome-selfhosted](https://github.com/awesome-selfhosted/awesome-selfhosted)).

### 2.11 OmniTools, BentoPDF, VERT, Stirling PDF (the 2024 to 2026 wave)

| Project | Shape | Repo created | Stars (7 Oct 2026) | How it spread (evidence) |
|---|---|---|---|---|
| OmniTools | everyday tools in the browser, Docker image | June 2024 | 10,292 | Show HN twice, 42 and 40 points ([HN 43149930](https://news.ycombinator.com/item?id=43149930), [HN 43523251](https://news.ycombinator.com/item?id=43523251)); [noted.lol review](https://noted.lol/omni-tools/); TrueNAS app catalogue ([TrueNAS](https://apps.truenas.com/catalog/omni-tools/)); Dokploy and Railway templates ([Dokploy](https://docs.dokploy.com/docs/templates/omni-tools), [Railway](https://railway.com/deploy/omni-tools)); listed in awesome-selfhosted |
| BentoPDF | 100+ PDF tools that run in the browser | October 2025 | 15,849 | Creator posts in Lemmy and fediverse self hosting communities ([piefed](https://piefed.jeena.net/post/299342), [lemmy](https://lemmy.manganiello.tech/post/198902)); listed in awesome-selfhosted; one solo developer ([BentoPDF desktop about](https://desktop.bentopdf.com/about)). HN posts scored 1 to 4 points ([HN search](https://hn.algolia.com/?q=bentopdf)) |
| VERT | file converter in wasm | November 2024 | 15,685 | covered by [Gigazine](https://gigazine.net/news/20251014-vert-sh/) and [dev.to](https://dev.to/githubopensource/vertsh-the-file-converter-that-never-sees-your-files-thanks-webassembly-4864) |
| Stirling PDF | self hosted PDF tools | January 2023 | 93,702 | self hosting ecosystem (listed in awesome-selfhosted) |

Star counts are from the GitHub API, read 7 October 2026. Star timelines could not be pulled
(the stargazer API needs a login), so I cannot say how fast each one grew.

**This is the closest comparable set to Plenty of Tools.** The pitch is the same: runs in your
browser, nothing uploaded, open source, no account. These projects did not grow through Google
first. They grew through GitHub, self hosting newsletters and app catalogues, and Lemmy. HN was
not the channel: BentoPDF reached 15.8k stars with HN posts scoring 1 to 4 points.

### 2.12 Spliit (direct competitor to Settle Up)

- Open source Splitwise alternative: no account, a group is a link, no ads, MIT
  ([GitHub](https://github.com/spliit-app/spliit)). 2,979 stars. Three Show HNs over three years
  scored 3, 4 and 28 points ([HN 31947018](https://news.ycombinator.com/item?id=31947018), [38615121](https://news.ycombinator.com/item?id=38615121), [39219789](https://news.ycombinator.com/item?id=39219789)).
  A native iOS app launched September 2026 ([HN 49549306](https://news.ycombinator.com/item?id=49549306)).
- AlternativeTo already names Spliit as "the best Settle Up alternative"
  ([AlternativeTo](https://alternativeto.net/software/settle-up/?p=2), via snippet), and
  [OpenAlternative](https://openalternative.co/alternatives/splitwise) lists it against Splitwise.
- **Lesson:** a polished, free, open source expense splitter does not catch fire with
  developers. Its audience is travellers and share houses, reached at the moment of need.

### 2.13 Carrd (solo; one product)

- First 10 users came from Twitter, through the following AJ had built with HTML5 UP. The
  Product Hunt launch (4,000+ upvotes) then pushed it "into overdrive"
  ([OpenView](https://openviewpartners.com/blog/aj-carrd), [Hackernoon interview](https://hackernoon.com/founder-interviews-aj-of-carrd-175736bedaf6)).
- It was later adopted by fandom communities (K-pop, activists) for bio pages
  ([Fanlore](https://fanlore.org/wiki/Carrd)). One community adopting the tool did more than
  any channel.

### 2.14 Small indie tool sites (2024 to 2026)

| Site | Result | Source |
|---|---|---|
| Utilvance (55+ calculators) | first 1,000 visitors from Product Hunt, AlternativeTo and SaaSHub listings, and build in public posts; "the first 8 weeks produced almost nothing from organic search"; plain link drops "got ignored or removed" | [Indie Hackers, 14 Sep 2026](https://www.indiehackers.com/post/how-i-got-my-first-1-000-visitors-to-a-free-tool-site-without-paid-ads-1a688a4a43) |
| QuickTools.one (11 PDF and image tools in the browser, privacy pitch) | week 4: 675 unique visitors; of sourced visits ChatGPT 71%, Google 22%; "ChatGPT sent 3x more traffic than Google"; the author does not know why | [dev.to](https://dev.to/eduard_albu/building-boring-tools-that-rank-4-weeks-11-tools-and-a-plot-twist-with-chatgpt-304) |
| An unnamed tool site, month 18 | peaked at 33k sessions a month, fell to 18k; "the SEO side of things continues to be troubled" | [Indie Hackers](https://www.indiehackers.com/post/im-building-a-tool-site-month-18-98bf81c3d5) |
| Adsby (AI ads tool plus free tools) | 20,000 visitors in 4 months; one free tool ("keyword generator") did most of it | [Pen Paper Pizza](https://penpaperpizza.substack.com/p/0-to-20k-traffic-no-budget-pure-indie) |

### 2.15 Failures and the Google risk

- Glenn Gabe's analysis of the September 2023 helpful content update lists sites that "dropped
  heavily across a number of categories, including lyrics, **calculations**, travel,
  **translations**, **downloads**, gaming". The common thread was terrible UX and heavy ads
  ([GSQI](https://www.gsqi.com/marketing-blog/september-2023-google-helpful-content-update-hcux/)).
  Plenty of Tools runs no ads, so the biggest single risk factor does not apply.
- March 2024: 837 of about 49,000 monitored sites were deindexed entirely, and all of them showed
  signs of AI generated content ([Search Engine Journal](https://www.searchenginejournal.com/googles-march-2024-core-update-impact-hundreds-of-websites-deindexed/)).
  The engagement plan's 29 September cut on batches of variant pages is correct, and this report
  backs it.
- The May 2026 core update brought no new guidance ([Search Engine Roundtable](https://www.seroundtable.com/google-may-2026-core-update-41367.html)).

### 2.16 Cross site patterns

| Pattern | Evidence | So for us |
|---|---|---|
| Breakouts are single tools | remove.bg, Squoosh, Excalidraw, Photopea, Smallpdf, iLovePDF | market heroes, not the umbrella |
| Umbrellas stay within one category, and new categories get new brands | iLovePDF and iLoveIMG; remove.bg and unscreen; Photopea and Vectorpea ([GameFromScratch](https://gamefromscratch.com/vectorpea-beta-launched/)) | spin a hero out only after it works |
| Mature sites are mostly direct traffic | Photopea 64%, TinyWow 79%, Squoosh 85% ([Semrush](https://www.semrush.com/website/squoosh.app/overview/)), invoice-generator.com 82% ([Semrush](https://www.semrush.com/website/invoice-generator.com/overview/)), it-tools 56% | retention and memorability compound; keep the engagement plan's retention work |
| Open source browser toolkits grow through self hosting channels | it-tools, OmniTools, BentoPDF, VERT, Stirling | **new channel for us** |
| On HN, single tools and essays beat toolboxes | Squoosh 241, Excalidraw 241, Photopea AMA 562; 10015.io 38, OmniTools 42 and 40, BentoPDF 1 to 4 | Show HN one hero, not 19 tools |
| Press follows a community spike; cold pitches rarely land | Photopea AMA then PetaPixel and Gigazine; remove.bg on Twitter then Boing Boing and TechCrunch | keep a press kit ready; pitch after a spike |
| Search is slow for new domains | Omni about 2 years to 20k a month; Utilvance 8 weeks of nothing | do not judge search before February |
| ChatGPT now sends traffic to privacy focused tools | QuickTools 71% of sourced visits in week 4; Squoosh about 46k ChatGPT visits in 6 months (Semrush); ChatGPT is 0.32% of all site traffic across 101k sites ([SE Ranking](https://seranking.com/blog/chatgpt-referral-traffic-may-2026/)) | cheap to be eligible; small but real for a new site |

---

## 3. Where the existing plans are wrong or thin

1. **The self hosting and open source channel is close to absent.** The plans include a README
   self host note, the r/selfhosted megathread in December and awesome-privacy in January. They
   leave out a Docker image, one click templates, selfh.st, Lemmy, noted.lol style reviewers,
   and awesome-selfhosted, which lists browser only toolkits such as OmniTools and BentoPDF.
   Its rule is that "any software project you are adding was first released more than 4 months
   ago" ([CONTRIBUTING](https://github.com/awesome-selfhosted/awesome-selfhosted-data/blob/master/CONTRIBUTING.md)),
   so the earliest date is about 16 January 2027, since the repo was created 16 September 2026.
2. **Settle Up's name collides with an established app.** Settle Up (settleup.io) is a long
   running group expense app with "over 2.5 million users", free with ads
   ([Kimola summary](https://kimola.com/reports/unlock-user-feedback-insights-for-settle-up-app-google-play-151364), third party),
   with its own AlternativeTo page and a SaaSHub comparison against Splitwise
   ([SaaSHub](https://www.saashub.com/compare-splitwise-vs-settle-up)). Searches for "settle up"
   will go to them; Reddit commenters will assume it is their app; and Spliit already holds the
   "open source, no account" pitch. The r/InternetIsBeautiful shot planned for Settle Up should
   wait until the tool has a distinct name and leads with what Spliit cannot claim: **no
   server at all, the ledger lives in the link.**
3. **The Show HN is pitched at the umbrella.** The draft title is "Plenty of Tools – 19 free
   tools…". The HN evidence in 2.16 points to one tool plus a technical story. The account is
   rate limited anyway (/showlim), so the next attempt should be a single hero.
4. **Creator outreach odds are too optimistic.** Photopea's 90% ignored and 10% asked for money
   is the only first hand data point found. Keep the plan's creator DMs as a lottery ticket, not
   a pillar.
5. **AI answer engines are not mentioned at all.** ChatGPT search uses third party providers
   including Bing, as well as its own crawl ([Windows Latest](https://windowslatest.com/2024/11/01/chatgpt-search-engine-uses-bing-builds-extension-to-replace-google-in-chrome), [Notebookcheck](https://www.notebookcheck.net/ChatGPT-search-relies-on-Bing-to-generate-search-results.911969.0.html)).
   So connecting Bing Webmaster Tools, a 10 minute item in the plan, matters more than the plan
   implies. robots.txt allows everything. Requests sent from here with spoofed OAI-SearchBot,
   GPTBot, PerplexityBot and bingbot user agents all got 200. That does **not** prove Cloudflare
   lets the real crawlers through, because Cloudflare verifies bots by IP. The AI crawler setting
   in the Cloudflare dashboard needs a human check.
6. **The plans read as if search will carry the site by mid November** (35 pages indexed, search
   visits weekly). That is plausible for impressions, but the comparables say meaningful search
   traffic comes after about 3 to 6 months. The 15 November and 20 December weekly visit targets
   (250 and 600) are only reachable with at least one community spike.

---

## 4. The 10 most transferable moves, ranked

Owner hours are Lachlan's (logins, posting, judgement). Agent hours are Claude or Codex. Evidence
strength: **strong** means several comparables plus primary sources; **medium** means one or two
comparables or secondary sources; **weak** means one anecdote or inference.

| # | Move | Expected effect (estimate) | Owner h | Agent h | Time to effect | Evidence | First concrete step |
|---|---|---|---|---|---|---|---|
| 1 | **Self hosting channel package**: Dockerfile (nginx serving `dist/`) and an image on GHCR; a "Self host in one command" README section; one click templates (Railway, Dokploy, Zeabur); then, in order: Lemmy c/selfhosted and c/privacy post, a tip email to selfh.st, the r/selfhosted New Project megathread, and the awesome-selfhosted PR on or after 16 Jan 2027 | GitHub stars plus a steady trickle of direct and referral visits from a technical audience; the only channel where a near identical product (OmniTools, BentoPDF) is documented reaching 10k+ stars inside 12 to 18 months. Best fit for PDF Tools, Sign a PDF, Image Converter, Transcription, Screen Recorder; no help for the ATO tools | 1.5 in total (approve the branch, 2 posts, 1 email, 1 PR later) | 4 to 6 | 2 to 8 weeks for the first stars; months to compound | **strong** for the category, medium for our mixed bag of tools | Agent: on a branch, add `Dockerfile`, a GHCR publish workflow and the README section, and draft the Lemmy post and selfh.st email in `docs/distribution/selfhosted.md`. Lachlan reviews before any commit or push |
| 2 | **Choose 2 or 3 hero tools and market only them**: (a) **PDF** (Sign a PDF plus PDF Tools, pitched as "DocuSign and iLovePDF jobs, nothing uploaded"); (b) **ATO Car Logbook** for Australia before 31 Oct and again at EOFY; (c) Settle Up **after** move 3. The umbrella home page leads with them. Every post, listing and pitch names one hero, never "19 tools" | Concentrates links and attention on pages that can rank and be remembered; matches every breakout in section 2 | 0.5 (choose) | 3 (home page, cards, copy) | immediate for posts; 1 to 3 months for search | **strong** | Agent drafts a one page "hero brief" for each hero (one sentence pitch, incumbent, proof clip, target query, communities). Lachlan picks in 15 minutes |
| 3 | **Rename or sharpen Settle Up before any launch**: a distinct name that does not collide with settleup.io, positioned as "no server, the ledger lives in the link" against Spliit and Splitwise. Keep `/tools/settle-up/` with a redirect so nothing breaks | Avoids sending traffic and confusion to a 2.5M user competitor; keeps the r/InternetIsBeautiful shot alive | 0.25 (decide the name) | 2 (rename, redirects, vs page update that names Spliit honestly) | before the December posts | **medium** (collision verified; effect inferred) | Agent: shortlist 5 names with a domain and app store collision check (searches only), plus an updated `/vs/splitwise/` that also covers Spliit |
| 4 | **Show HN one hero, not the umbrella, with a technical story**: "Show HN: Sign PDFs in the browser, nothing uploaded (MIT)" plus the rotated page coordinate story; retry when /showlim lifts (December window) | HN front page for a tool typically brings thousands to about 18k visitors ([Lafferty](https://nicklafferty.com/blog/what-happens-when-you-re-on-the-front-page-of-hacker-news/), [Burke](https://kevin.burke.dev/kevin/hn-popular-post-stats/)); toolboxes like ours score about 40 | 3 (one evening) | 2 | same day | **medium** | Agent rewrites `docs/distribution/show-hn.md` as a single tool post, keeping the umbrella text as a fallback |
| 5 | **Be eligible for ChatGPT and Perplexity answers**: confirm the Cloudflare AI crawler settings allow OAI-SearchBot and PerplexityBot (search bots, not training bots); connect Bing Webmaster Tools **this week**; give each hero page a plain factual block ("what it does, what never leaves your device, limits, compared with X") | Small but early; QuickTools got most of its week 4 traffic this way | 0.25 | 1 | 2 to 6 weeks | **weak to medium** | Lachlan: Cloudflare dashboard, AI Crawl Control, check OAI-SearchBot and PerplexityBot are allowed (5 min); import Search Console into Bing (10 min) |
| 6 | **Embeddable calculators with attribution**: the Is It Worth It calculators and a WFH fixed rate and logbook business use calculator as `<iframe>` embeds with a visible "Free calculator by Plenty of Tools" link; offer to AU finance bloggers and accountants in the outreach the plan already schedules | Editorial links from AU sites, which is the crawl demand fix the plan names as its biggest lever | 0.5 (adds a line to existing emails) | 3 | 1 to 3 months | **medium** (Omni runs exactly this; no published effect size) | Agent builds `/embed/` for the Uber One calculator first, with copy for the existing accountant email template |
| 7 | **List each hero as an alternative to its incumbent** on AlternativeTo, OpenAlternative and SaaSHub (separate entries for PDF, Logbook and the renamed splitter, not just the umbrella) | Passive, durable referral visits; these pages rank for "X alternatives" (Utilvance; Spliit's AlternativeTo position) | 1 (spread over October and December) | 1 (copy) | 1 to 4 weeks after approval | **medium** | Agent updates `docs/distribution/alternativeto.md` with one entry per hero and the "alternative to" targets |
| 8 | **Concentrate crawl on pages that can win**: noindex the `/vs/` pages other than the six search bets now, rather than after 6 weeks; keep them linked and live for visitors | Faster indexing of tool pages on a domain with 12 of 43 indexed; lowers thin page risk across the site | 0 | 0.5 | 2 to 6 weeks | **weak to medium** (Google calls "Discovered, not indexed" a crawl demand issue; whole site quality signals) | Agent: on a branch, change `build.py` so only the six `/vs/` pages are indexable, then refresh the sitemap |
| 9 | **Press kit and a "spike playbook"**: a `/press/` page (one paragraph, screenshots, a 20 second clip per hero, contact) and drafted notes to ghacks, Gigazine, PetaPixel style niche outlets and AU outlets, sent **only after** a post gets traction | Turns a lucky spike into a second wave, as Photopea, remove.bg and VERT got | 0.5 at spike time | 2 | only after a spike | **medium** | Agent drafts `/press/` (noindex) and `docs/distribution/spike-playbook.md` |
| 10 | **Build for direct traffic**: keep the engagement plan's install prompts, recent work, Settle Up share view and invoice numbering, and add short memorable hero URLs (`plentyoftools.io/sign`, `/logbook`) to print on outputs and say out loud | Direct is 56% to 85% of traffic at every mature comparable; memorable URLs feed it | 0 | 1 | months | **strong** for the pattern, inference for our version | Agent adds the redirects in `_redirects` on a branch |

**Owner total for these ten:** about 7 to 8 hours across October and December, most of it inside
work the existing calendar already funds (Show HN evening, AlternativeTo, accountant emails).
The genuinely new owner time is about 2 hours: the self hosting posts and email, the Cloudflare
and Bing checks, and the naming and hero decisions.

### Suggested fit with the calendar

| Week | Owner (new items only) | Agent |
|---|---|---|
| 7 to 11 Oct | Cloudflare AI crawler check; Bing import (5 + 10 min); pick heroes (15 min) | hero briefs; Docker branch; Settle Up name shortlist |
| 12 to 18 Oct | approve the Docker branch; Lemmy post for the PDF hero (15 min) | embed for Uber One calculator; `/vs/` noindex branch |
| 19 to 25 Oct | Car Logbook live (already planned) | logbook embed and calculator |
| 26 Oct to 1 Nov | selfh.st email (10 min); accountant emails now include the embed line | press kit |
| 9 to 28 Nov | nothing | watch GitHub stars and referrers; draft the single tool Show HN |
| 7 to 20 Dec | r/selfhosted megathread; single hero Show HN if eligible; renamed splitter on r/InternetIsBeautiful | spike playbook on standby |
| 16 Jan 2027 on | awesome-selfhosted PR (20 min) | prepare the YAML entry |

---

## 5. Moves I looked at and do not recommend now

| Move | Why not now |
|---|---|
| **Separate domains for heroes** | Each new domain starts with zero links and an empty index, and indexing is our bottleneck. The iLoveIMG and unscreen spinoffs came **after** the parent worked. Revisit in January for any hero above about 1,000 visits a month (PDF or Logbook) |
| **Translations into many languages** | iLovePDF needed 25 translators; machine translated tool pages on a new domain look like the "translations" category that dropped in September 2023 ([GSQI](https://www.gsqi.com/marketing-blog/september-2023-google-helpful-content-update-hcux/)). Revisit only for a proven hero |
| **Programmatic pages** (per bank, per car, per format) | The March 2024 deindexing wave; the engagement plan's cut stands |
| **Reddit or HN AMA** | It worked for Photopea at 1.5M users; at zero users there is no hook |
| **Browser extension or Chrome Web Store listing** | iLovePDF has one, but no source quantifies it as a growth channel; QuickTools only speculates. Cheap later for the PDF hero if it takes off |
| **Opening up commit access to contributors (Excalidraw)** | It needs review time Lachlan does not have before December |
| **More tools** | Every comparable that broke out had fewer, better known tools at the point it broke out. Finishing the two ATO tools is right; the flashcards, payslip and workout log should wait until a hero shows traction |

---

## 6. Is a 19 tool umbrella the right shape?

**As a home, yes. As the product you market, no.**

- Arguments for the umbrella: one domain gathers every link and every indexed page; cross
  links between tools help retention; agents make extra tools cheap; and 10015.io and TinyWow
  show umbrellas can reach hundreds of thousands to millions of visits.
- Arguments against marketing it: "plenty of tools" matches no query and makes no claim anyone
  can repeat. Our 19 tools serve unrelated audiences (Australian taxpayers, guitarists, cyclists,
  people with PDFs), so no single community cares about more than one or two. The successful
  umbrellas each served one audience (10015: developers and designers; iLovePDF: PDF users) or
  had operators with search muscle (TinyWow, **unverified**). HN scores for toolboxes cluster
  around 40.
- **Would 1 to 3 hero tools on their own domains grow faster?** Probably yes in the long run,
  but not before December. A new domain would have to go through the same 3 weeks or more of
  "Discovered, currently not indexed" that plentyoftools.io is in now. The faster path is
  hero **brands** on the existing domain (own name, short URL, own share card, own launch and
  listing), with a domain spinoff as the reward for traction. The best candidate for a later
  spinoff is the **PDF** hero (largest demand, the self hosting audience, and the BentoPDF and
  Stirling precedent). The second is the **ATO logbook** for EOFY 2027, ideally on a domain
  Australians trust; a `.com.au` needs an ABN or company, which is **unverified for Lachlan**.

---

## 7. Things I could not verify

- How TinyWow, Smallpdf and PDF24 got their first 1k and 10k monthly visits (no founder account found).
- Star growth timelines for it-tools, OmniTools, BentoPDF and VERT (the GitHub stargazer API needs a login).
- Whether Cloudflare's AI crawler controls are blocking OAI-SearchBot or PerplexityBot on plentyoftools.io (needs the dashboard).
- Whether Lemmy self hosting communities allow a creator's own project posts; the BentoPDF author posted there, but the rules were not read.
- Traffic for spliit.app, bentopdf.com, omnitools.app and vert.sh (Semrush public pages returned 404).
- The "2.5 million users" figure for the Settle Up app comes from a third party summary, not the vendor.
