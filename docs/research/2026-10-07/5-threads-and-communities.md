# 5. Threads, communities and creators (research, 7 October 2026)

Agent 5 of 5. Angle: people asking right now for what our tools do, and where to show up over
the next 10 weeks. Research only: nothing was posted, voted, signed up for or messaged.

Builds on, and does not repeat, `docs/PLAN-DISTRIBUTION-2026-Q4.md` section 6 and
`docs/distribution/posts.md` (Post 1, HEIC on techcommunity thread 4508209 plus the Apple
thread; Post 2, Subscription Finder on Reddit).

**Read this before using any draft.** Every draft below was written by an agent. Rewrite each
one in your own words before posting (Privacy Guides forbids AI written posts outright, and on
every other site a pasted template reads as spam). Fill or delete every [square bracket]. Check
each feature claim against the live tool the day you post. One link, last, with disclosure.

---

## 0. What could and could not be checked

| Source | Access from here | Effect on this report |
|---|---|---|
| Reddit (www, old, .json) | **Blocked.** WebSearch refuses `reddit.com` as a domain; `old.reddit.com/.../search.json` returned HTTP 403 | No Reddit thread could be opened or even listed. Section 2.4 gives the exact searches to run yourself |
| Redlib / Libreddit mirrors | Reachable, but they run Anubis, which exists to block AI scrapers | Deliberately not bypassed |
| Stack Exchange API | Works | View counts, dates, protected and closed status are exact as of today |
| Hacker News (Algolia API) | Works | Exact |
| Discourse forums (Privacy Guides, TrainerRoad, JustinGuitar) | JSON works | Exact dates and post counts |
| Microsoft Tech Community, Microsoft Q&A, OzBargain thread pages | WebFetch works (OzBargain search is behind a Cloudflare check) | Dates from the page |
| Quora | Not opened | Listed with "not opened"; dates unknown |
| WebSearch | Ran out at 200 calls (shared session budget) partway through | Sizes of Reddit and Facebook communities are marked unverified |

---

## 1. Findings that change what we post

1. **Name collision: "Settle Up" is also an established app** (settleup.io) that people
   already recommend as a Splitwise alternative, including in the OzBargain thread "Splitwise
   Gone Rouge!" (ozbargain.com.au/node/817343, 30 Nov 2023: "Settle Up, clean UI, though with
   some ads") and in most "Splitwise alternatives 2026" listicles. A reply saying "try Settle Up"
   sends readers to the competitor. Always write "the Settle Up page on Plenty of Tools" and put
   the full URL. Worth a rename discussion (search agent's call).
2. **iOS 26 made the Ringtone Maker much more useful, and our page does not say so.** iOS 26
   added "Use as Ringtone" to the share sheet for DRM free audio files of 30 seconds or less
   (AppleInsider, 12 June 2025: appleinsider.com/articles/25/06/12/custom-ringtones-are-now-slightly-easier-to-add-in-ios-26;
   Tom's Guide: tomsguide.com/phones/iphones/ios-26-makes-custom-iphone-ringtones-easier-than-ever-heres-how-to-do-it).
   `tools/ringtone-maker/index.html` still tells iPhone users to go through GarageBand. Trimming
   to under 30 seconds is exactly what our tool does, so this is the hook. **Test it on your own
   iPhone with an MP3 from the tool before changing the page or posting** (reports mention MP3
   and M4A; WAV is unconfirmed).
3. **GPX Route Builder draws straight lines with no road snapping** (its own page says so).
   Do not pitch it in route planning threads (for example TrainerRoad "Alternatives to Strava
   Routing", trainerroad.com/forum/t/alternatives-to-strava-routing/79875): RideWithGPS and
   Komoot free tiers snap to roads and an honest reply would lose. Pitch it only where people
   want a **personal heatmap from their own export without a Strava subscription**.
4. **Image Converter strips EXIF.** Skip every thread that asks to keep metadata
   (softwarerecs 80653 "Offline batch conversion of HEIC to JPG while preserving metadata",
   apple.stackexchange 486409 "convert HEIC to JPG while retaining EXIF"). Answering those
   with our tool would be wrong.
5. **OzBargain readers already told a competitor what they fear.** Sub Tracker
   (ozbargain.com.au/node/949306, 24 Feb 2026, 38 comments, posted by its maker) charges $9.99
   to upload bank statements to an AI model; the top concerns were "uploading banking details",
   where statements are processed, and "a thin wrapper" around ChatGPT. That is our Subscription
   Finder's whole pitch (CSV stays in the browser, no AI). **Do not reply inside that deal
   thread** (it is someone else's post); use it as the reason for the Subscription Finder angle
   in the OzBargain forum post.
6. **HN Show HN is gated for accounts like ours.** dang, 2 Oct 2026: "we had to put some
   barriers in place (news.ycombinator.com/showlim) because we got flooded, and still are, with
   Show HNs from new accounts". dang, 15 Mar 2026: showlim "is vague, I know, but that's because
   we want people to be genuine community members, which is not a checklist process." There is
   no published karma number. Details in section 5.
7. **Many Microsoft Q&A threads are locked** (the HEIC thread 5569451 and the disk thread
   5552576 both are). Tech Community discussions are mostly still open.

---

## 2. Thread inventory

### 2.1 How "expected traffic" is ranked

Tier A: question gets thousands of views a year and still ranks; Tier B: hundreds to low
thousands a year or very recent and open; Tier C: small or old, worth a reply only because the
fit is perfect. A new answer lands at the bottom of a page, so even Tier A threads probably send
single or low double digit visits a month; their value is that it lasts for years.
Views per year are computed from the Stack Exchange API (views divided by age).

"Links" column: **Yes** = links allowed with disclosure (rule checked at source);
**Yes?** = allowed by norm, rule page not retrievable; **10 rep** = Stack Exchange
"protected" question, you need 10 reputation earned on that site before you can answer;
**No** = do not link.

### 2.2 The table (sorted by expected traffic)

| # | Thread | Site | Asked / last activity | Question (short) | Tool | Links | Tier |
|---|---|---|---|---|---|---|---|
| 1 | [superuser.com/questions/1811863](https://superuser.com/questions/1811863/easiest-way-to-convert-heic-to-jpeg-or-png) | Super User | Oct 2023 / Oct 2024 · 149,057 views (~50k a year) · 7 answers | Easiest way to convert HEIC to JPEG or PNG | Image Converter | 10 rep | A |
| 2 | [superuser.com/questions/1252004](https://superuser.com/questions/1252004/how-can-i-view-heic-photos-on-linux) | Super User | Sep 2017 / Apr 2025 · 169,584 views (~19k a year) · 16 answers | View HEIC photos on Linux | Image Converter (browser works on Linux) | 10 rep | A |
| 3 | [apple.stackexchange.com/questions/431183](https://apple.stackexchange.com/questions/431183/how-do-i-set-an-m4r-file-ringtone-i-airdropped-to-my-iphone-13) | Ask Different | Nov 2021 / Feb 2026 · 36,394 views (~7k a year) · 3 answers, none accepted | Set an .m4r ringtone AirDropped to iPhone 13 | Ringtone Maker | Yes | A |
| 4 | [superuser.com/questions/1570247](https://superuser.com/questions/1570247/how-to-view-heic-format-pictures-in-explorer-and-the-photos-app-on-windows-10) | Super User | Jul 2020 / Jul 2026 · 36,702 views (~6k a year) | View HEIC in Explorer and Photos, Windows 10 | Image Converter (as the "just convert them" route) | 10 rep | A |
| 5 | [superuser.com/questions/137294](https://superuser.com/questions/137294/how-can-i-sign-a-pdf-document-quickly-and-cheaply) | Super User | May 2010 / Mar 2020 · 76,606 views (~5k a year) · 11 answers | Sign a PDF quickly and cheaply | Sign a PDF | 10 rep | A |
| 6 | [superuser.com/questions/1839145](https://superuser.com/questions/1839145/how-to-convert-heic-format-to-jpeg-format) | Super User | Apr 2024 / **17 Sep 2026** · 9,734 views (~4k a year) · 4 answers, none accepted | Convert HEIC to JPEG | Image Converter | Yes | A |
| 7 | [techcommunity …/4505070](https://techcommunity.microsoft.com/discussions/windows11/what-is-the-best-qr-code-generator-without-expiration/4505070) | MS Tech Community | 24 Mar 2026 / **21 Aug 2026** · 13+ replies, unsolved | Best QR code generator without expiration | QR Codes | Yes? | A |
| 8 | [techcommunity …/4554178](https://techcommunity.microsoft.com/discussions/Windows10space/how-to-screen-record-and-record-yourself-at-the-same-time-on-windows/4554178) | MS Tech Community | **7 Sep 2026** · 8 replies, unsolved | Record screen and yourself at once, picture in picture | Screen Recorder | Yes? | A |
| 9 | [techcommunity …/4518312](https://techcommunity.microsoft.com/discussions/windows11/how-do-i-convert-iphone-heic-photos-to-jpeg-on-windows-11/4518312) | MS Tech Community | 11 May 2026 · 9 replies, unsolved | iPhone HEIC to JPEG on Windows 11 | Image Converter | Yes? | A |
| 10 | [android.stackexchange.com/questions/224](https://android.stackexchange.com/questions/224/how-do-i-set-a-custom-mp3-as-a-ringtone-for-other-notifications) | Android SE | Sep 2010 / Jul 2013 · 24,994 views | Set a custom MP3 as ringtone or notification | Ringtone Maker | Yes | B |
| 11 | [techcommunity …/4541386](https://techcommunity.microsoft.com/discussions/windows11/how-to-sign-a-pdf-for-free-on-windows-11/4541386) | MS Tech Community | **28 Jul 2026** · 1 reply | Sign a PDF for free on Windows 11 | Sign a PDF | Yes? | B |
| 12 | [learn.microsoft.com …/5706874](https://learn.microsoft.com/en-us/answers/questions/5706874/looking-for-a-windows-11-utility-to-help-with-free) | Microsoft Q&A | 13 Jan 2026 · 2 answers, open | Windows 11 utility to find the biggest files and folders | What's Eating My Disk | Yes? | B |
| 13 | [techcommunity …/4484050](https://techcommunity.microsoft.com/discussions/windows11/how-to-quickly-find-and-delete-large-files-on-windows-11/4484050) | MS Tech Community | 8 Jan 2026 / 12 Jan 2026 · 8 replies | Quickly find and delete large files | What's Eating My Disk | Yes? | B |
| 14 | [apple.stackexchange.com/questions/487047](https://apple.stackexchange.com/questions/487047/get-custom-ringtone-on-iphone-13-ios-18-7) | Ask Different | **9 Sep 2026** · 68 views · 1 answer | Custom ringtone on iPhone 13, iOS 18.7 | Ringtone Maker (GarageBand route; iOS 26 route if they update) | Yes | B |
| 15 | [softwarerecs …/16535](https://softwarerecs.stackexchange.com/questions/16535/disk-space-usage-utilization-analysis-for-windows) | Software Recs | Jan 2015 / Jul 2022 · 3,346 views | Disk usage analysis for Windows | What's Eating My Disk | Yes | B |
| 16 | [money.stackexchange.com/questions/24603](https://money.stackexchange.com/questions/24603/automatically-splitting-payments-between-people) | Money SE | Oct 2013 · 3,626 views | Automatically splitting payments between people | Settle Up | Yes | B |
| 17 | [discuss.privacyguides.net/t/27665](https://discuss.privacyguides.net/t/27665) | Privacy Guides | May 2025 / **15 Jun 2026** · 579 views, 10 posts | Recommendations for private transcription tools | Browser Transcription | Yes? (own words only) | B |
| 18 | [discuss.privacyguides.net/t/19271](https://discuss.privacyguides.net/t/19271) | Privacy Guides | Jul 2024 / Feb 2026 · 661 views, 19 posts | Transcription tools that run locally | Browser Transcription | Yes? (own words only) | B |
| 19 | [discuss.privacyguides.net/t/37219](https://discuss.privacyguides.net/t/37219) | Privacy Guides | **17 Apr 2026** / 19 May 2026 · 478 views, 7 posts | FOSS background remover for Linux | Background Remover | Yes? (own words only) | B |
| 20 | [community.justinguitar.com/t/412558](https://community.justinguitar.com/t/412558) | JustinGuitar Community | 28 Apr 2026 / **10 Sep 2026** · 15 posts | App vs clip on tuner | Tuner and Metronome | Unverified (check rules) | B |
| 21 | [ozbargain.com.au/node/952971](https://www.ozbargain.com.au/node/952971) | OzBargain forum | 22 Mar 2026 / 29 Mar 2026 · 10 comments | Best ATO approved logbook app (delivery work) | Car Logbook (after launch) | Yes, declare Associated | B (seasonal, before 31 Oct) |
| 22 | Quora: "What is the safest way to convert HEIC to JPG on Windows without uploading photos to a server?" quora.com/What-is-the-safest-way-to-convert-HEIC-to-JPG-on-Windows-without-uploading-photos-to-a-server | Quora | not opened | Exactly our pitch | Image Converter | Yes (disclose) | B |
| 23 | Quora: "Is there a software that transcribes audio files offline, without uploading the file to a server?" quora.com/Is-there-a-software-that-transcribes-audio-files-offline-without-uploading-the-file-to-a-server | Quora | not opened | Offline transcription | Browser Transcription | Yes (disclose) | B |
| 24 | Quora: "I generated a QR Code for my business cards but … it is expired now" quora.com/I-generated-a-QR-Code-for-my-business-cards-but-unfortunately-it-is-expired-now-and-I-cant-change-the-QR-Code-on-my-business-Cards-as-they-are-printed-in-a-lot-of-quantity-What-should-I-do-now | Quora | not opened | Printed dynamic QR died | QR Codes | Yes (disclose) | B |
| 25 | Quora: "Is there an easy way to determine all automatically renewing subscriptions associated with your bank account or credit card?" quora.com/Is-there-an-easy-way-to-determine-all-automatically-renewing-subscriptions-associated-with-your-bank-account-or-credit-card | Quora | not opened | Find recurring charges | Subscription Finder | Yes (disclose) | B |
| 26 | Quora: "Is there any free alternative to Speechify?" quora.com/Is-there-any-free-alternative-to-Speechify | Quora | not opened | Free text to speech | Read Aloud | Yes (disclose) | B |
| 27 | Quora: "Where can I find a free online resume builder which allows you to download the file after completion?" quora.com/Where-can-I-find-a-free-online-resume-builder-which-allows-you-to-download-the-file-after-completion | Quora | not opened | Resume builder with a free download | CV Builder | Yes (disclose) | B |
| 28 | [news.ycombinator.com/item?id=49927188](https://news.ycombinator.com/item?id=49927188) | Hacker News | **1 Oct 2026** · 25 comments | Ask HN: What are you working on? (October 2026) | The site as a whole | Yes (the thread asks for it) | B (reputation more than traffic) |
| 29 | [softwarerecs …/25196](https://softwarerecs.stackexchange.com/questions/25196/open-source-web-based-disk-space-analyzer-to-adapt-it-to-my-remote-protocol) | Software Recs | Sep 2015 / Jan 2025 · 1,626 views | Open source, web based disk analyser with a diagram, to adapt | What's Eating My Disk (MIT code) | Yes | C |
| 30 | [superuser.com/questions/1857859](https://superuser.com/questions/1857859/how-to-merge-all-pdf-files-in-a-folder-into-one) | Super User | Oct 2024 / **22 Sep 2026** · 534 views | Merge all PDFs in a folder into one | PDF Tools | Yes | C |
| 31 | [softwarerecs …/18323](https://softwarerecs.stackexchange.com/questions/18323/recipe-database-with-shopping-list-generator) | Software Recs | Mar 2015 · 1,118 views | Recipe database with a shopping list generator | Recipe Keeper (partial: per device, not shared) | Yes | C |
| 32 | [softwarerecs …/28557](https://softwarerecs.stackexchange.com/questions/28557/habit-tracking-app-that-supports-weekly-time-based-goals) | Software Recs | Feb 2016 / Feb 2024 · 1,013 views | Habit tracker with weekly goals | Habit Tracker ("3 times a week" targets) | Yes | C |
| 33 | [money.stackexchange.com/questions/36752](https://money.stackexchange.com/questions/36752/shared-groceries-expenses-between-roommates-to-be-divided-as-per-specific-consum) | Money SE | Sep 2014 · 2,403 views | Shared groceries split by a consumption ratio | Settle Up (exact amounts only, no ratio: say so) | Yes | C |
| 34 | [discuss.privacyguides.net/t/12999](https://discuss.privacyguides.net/t/12999) | Privacy Guides | Jun 2023 · 260 views, **0 replies** | E2EE group bill splitting app | Settle Up (no server; check how the link stores data) | Yes? (own words only) | C |
| 35 | [forum.ukuleleunderground.com/threads/168741](https://forum.ukuleleunderground.com/threads/best-freeish-tuning-app-for-phones.168741/) | Ukulele Underground | Mar 2025 | Best freeish tuning app for phones | Tuner and Metronome | Unverified | C |
| 36 | [learn.microsoft.com …/5703930](https://learn.microsoft.com/en-us/answers/questions/5703930/want-to-be-able-to-read-aloud-without-subscription) | Microsoft Q&A | 12 Jan 2026 · 3 answers, open | Read aloud without a subscription | Read Aloud | Yes? | C |
| 37 | Quora: "Is there any actually free … for life online background eraser tool?" quora.com/Is-there-any-actually-free-and-I-mean-completely-free-for-life-online-background-eraser-tool | Quora | not opened | Free background remover | Background Remover | Yes (disclose) | C |
| 38 | Quora: "What is the best way to find recurring charges on your credit card statement?" quora.com/What-is-the-best-way-to-find-recurring-charges-on-your-credit-card-statement | Quora | not opened | Recurring charges | Subscription Finder | Yes (disclose) | C |
| 39 | Quora: "Is there an online guitar tuner that works like digital guitar tuners?" quora.com/Is-there-an-online-guitar-tuner-that-works-like-digital-guitar-tuners | Quora | not opened | Online tuner | Tuner and Metronome | Yes (disclose) | C |
| 40 | Quora: "What is the best free habit tracker app with unlimited habits?" quora.com/What-is-the-best-free-habit-tracker-app-with-unlimited-habits | Quora | not opened | Unlimited habits, free | Habit Tracker | Yes (disclose) | C |
| 41 | Quora: "I created a QR code months ago and now it says the link expired…" quora.com/I-created-a-QR-code-months-ago-and-now-it-says-the-link-expired-or-doesnt-work-anymore-why | Quora | not opened | Dynamic QR expired | QR Codes | Yes (disclose) | C |
| 42 | [techcommunity …/4383274](https://techcommunity.microsoft.com/discussions/windowsinsiderprogram/whats-the-best-heic-to-jpg-converter-for-pc-windows-11-in-2025/4383274) | MS Tech Community | about Feb 2025 (date not on page) | Best HEIC to JPG converter for Windows 11 | Image Converter | Yes? | C |
| 43 | [techcommunity …/4389756](https://techcommunity.microsoft.com/discussions/windowsinsiderprogram/is-there-an-easy-way-to-convert-heic-to-jpg-in-bulk/4389756) | MS Tech Community | about Mar 2025 (date not on page) | HEIC to JPG in bulk | Image Converter | Yes? | C |
| 44 | [applevis.com/comment/201066](https://mail.applevis.com/comment/201066) | AppleVis forum | 27 Dec 2025 / 29 Dec 2025 · 8 replies | Easiest way to make a ringtone under iOS 26 | Ringtone Maker (trim step; check screen reader use first) | Unverified | C |
| 45 | [softwarerecs …/4500](https://softwarerecs.stackexchange.com/questions/4500/looking-for-a-metronome-program) | Software Recs | May 2014 · 206 views | Metronome program | Tuner and Metronome | Yes | C |

**Do not reply in these** (checked, and a reply would hurt): softwarerecs 80653 and
apple.SE 486409 (want EXIF kept); TrainerRoad 79875 (route planning, no road snapping);
OzBargain 949306 (a competitor's own deal post); HN 49628052 "Show HN: A FOSS Expense Splitter"
(someone else's launch); Microsoft Q&A 5569451 and 5552576 (locked); techcommunity 4387238
(archived); Apple Community threads (no links allowed: text answers only, see plan 6.1);
MoneySavingExpert "Finding subscriptions" (forums.moneysavingexpert.com/discussion/6467430,
Aug 2023; MSE forbids promotion, rule page not checked here, treat as no links).

### 2.3 Drafts for every row

House style: answer first, then one link, then disclosure. Where a site forbids links, delete
the last sentence. "[DEV]" prefix only where a community asks for it.

1. **SU 1811863 (HEIC, protected).** "If you only need a few, Windows 11 Paint and the Photos app
   can open HEIC and Save As JPEG once the HEIF extension is installed; on macOS, Preview's
   Export does it; for scripts, `heif-convert` from libheif or ImageMagick 7 (`magick in.heic
   out.jpg`) work. If you can't install anything, a browser page can decode HEIC locally: I made
   one that batch converts a folder to JPG, can resize, and removes the location data (which
   means it does not keep EXIF, so skip it if you need that). [Your own result on a batch.]
   plentyoftools.io/tools/image-converter/ (disclosure: I built it; free, open source, no
   upload)."
2. **SU 1252004 (HEIC on Linux, protected).** "For viewing, install the libheif plugin for your
   viewer (`heif-gdk-pixbuf` for Eye of GNOME and gThumb on Debian and Ubuntu; recent GIMP opens
   HEIC directly). For converting, `heif-convert in.heic out.jpg` from `libheif-examples`. On a
   locked down machine where you can't install packages, a browser page that decodes HEIC with
   WebAssembly also works on Linux: [link] (my project, open source; it strips EXIF on the way
   out)." Check the package names on your own distro before posting.
3. **Ask Different 431183 (.m4r AirDropped).** "On iOS 26 you no longer need the .m4r at all:
   save the audio to Files, make sure it's 30 seconds or less and not DRM protected, then Share
   and choose Use as Ringtone; it appears under Settings, Sounds & Haptics. On iOS 18 and earlier
   the AirDropped .m4r does nothing on its own; the reliable route is GarageBand (import the
   file, then Share, Ringtone). If the clip is too long, any trimmer works; I built a browser one
   that trims and fades and exports MP3, [what happened when you tested it on your iPhone].
   [link] (disclosure: mine, free)." **Only after testing.**
4. **SU 1570247 (view HEIC on Windows 10, protected).** "Viewing needs the HEIF Image
   Extensions plus HEVC Video Extensions from the Store (the HEVC one is paid unless your PC
   shipped with it). If you only need the photos to open everywhere, converting them once is
   simpler: [IrfanView batch or Paint on Windows 11], or in a browser with nothing installed:
   [link] (my project; free, no upload; it removes location data)."
5. **SU 137294 (sign a PDF, protected).** "Free options today: Acrobat Reader's Fill & Sign,
   Microsoft Edge's draw tool for a quick squiggle, or Preview on a Mac. If you'd rather not
   upload the PDF to a signing site, there are pages that do it locally: I made one where you
   draw or type a signature, add text, dates and ticks, and download the signed PDF; nothing
   leaves the browser. It is an electronic signature, not a certificate based digital
   signature, so it won't satisfy anything that asks for an audit trail. [link] (disclosure: I
   built it, free, open source)."
6. **SU 1839145 (HEIC to JPEG, open).** Same core as row 1 but **different wording** (Stack
   Exchange flags near duplicate answers as spam). Lead with the Windows 11 Paint route, then
   "If you need many at once and can't install software: [link], which converts in the browser,
   can zip the results, and strips GPS. [Your batch result]. Disclosure: my project, free and
   open source."
7. **Tech Community 4505070 (QR without expiration).** "The ones that expire are dynamic codes:
   the pattern holds the generator's short link, and the redirect is switched off when the trial
   ends. A static code stores your real URL in the pattern, so nothing can turn it off. Before
   printing, scan your own file and check the decoded text shows your URL and not the
   generator's domain. Any static generator is fine (GoQR, QRCode Monkey); I made a free one that
   only does static codes, with PNG and SVG downloads and no account: [link] (disclosure: I built
   it)."
8. **Tech Community 4554178 (screen plus webcam).** "OBS does this with a Display Capture source
   plus a Video Capture Device source resized into a corner, but it takes some setup. If you want
   something with no install: I made a browser recorder that records the screen with your mic
   and a round camera bubble in a corner of your choice, with no time cap; in Chrome and Edge it
   writes the file to your disk as you record. [What you recorded and how the file came out.]
   [link] (disclosure: mine, free, no account)."
9. **Tech Community 4518312 (iPhone HEIC on Windows 11).** Do **not** reuse Post 1 wording
   (that one is for thread 4508209). "Two fixes that avoid converting every time: on the iPhone,
   Settings, Camera, Formats, Most Compatible makes new photos JPG; and Settings, Photos,
   Transfer to Mac or PC, Automatic converts on cable import. For the ones you already have:
   [Paint route]; or a browser converter that does a whole folder without uploading: [link]
   (disclosure: I built it)."
10. **Android SE 224 (MP3 as notification sound).** "Copy the MP3 into the Notifications folder
    (or Ringtones for a ringtone) on internal storage, then pick it under Settings, Sound; most
    Android versions list files from those folders. If the clip is too long or starts in the
    wrong place, trim it first: [any editor], or a browser page I built that trims, fades and
    exports MP3: [link] (disclosure: mine, free)."
11. **Tech Community 4541386 (sign PDF on Windows 11).** "For an ordinary form, an electronic
    signature (typed or drawn) is enough, which is what Edge's draw tool and Acrobat Reader's
    Fill & Sign give you. If you don't want to upload the PDF anywhere, [link] does it in the
    browser: draw or type, add text and dates, download. Not a certificate signature. Disclosure:
    I built it, free."
12. **Microsoft Q&A 5706874 (find big folders).** "Settings, System, Storage shows categories;
    WinDirStat and TreeSize Free give the folder map. If you can't install software on that PC,
    there is a browser version: pick a folder and you get a treemap, the biggest files,
    duplicates matched by content, and files untouched for years. [Whether it could read your
    whole user folder.] [link] (disclosure: I built it; it reads only, deletes nothing)."
13. **Tech Community 4484050 (find and delete large files).** Same facts, different words, plus
    "Delete through Explorer, never from inside C:\Windows or Program Files."
14. **Ask Different 487047 (ringtone, iOS 18.7).** "On iOS 18 the only route without a computer
    is GarageBand: import the audio from Files, drag it onto a track, then My Songs, long press,
    Share, Ringtone. If you update to iOS 26, any DRM free file of 30 seconds or less can be set
    from the share sheet with Use as Ringtone. To get the clip down to the right length: [link]
    (my browser trimmer, exports MP3; disclosure: I built it)."
15. **Software Recs 16535 (disk analysis, Windows).** Software Recs answers must say how the
    tool meets each requirement. "[Requirement by requirement.] Free, MIT licensed, runs in the
    browser so nothing to install; shows a treemap, largest files, duplicates. Limitation: it
    scans one folder you pick, read only. [link]. I'm the author."
16. **Money SE 24603 (splitting payments).** "Record who paid what, compute each person's net
    balance (paid minus share), then settle with the fewest transfers by matching the largest
    debtor to the largest creditor until everyone is at zero. A spreadsheet does it; apps like
    Splitwise and Tricount automate it. I built a free page that keeps the whole ledger inside a
    share link, so nobody needs an account; it splits equally or by exact amounts. It does not
    sync live. [link] (disclosure: mine; it's called Settle Up but is not the settleup.io app)."
17. **Privacy Guides 27665 (private transcription).** **Write this yourself, no template.**
    Facts you can check and use: English only; files up to 10 minutes and 50 MB; first run
    downloads about 55 MB of model files from Hugging Face (which sees that request); audio
    never leaves the device; exports text and SRT. Mention whisper.cpp and Buzz as fuller
    desktop options, then disclose.
18. **Privacy Guides 19271.** Same facts; only if 17 was received well. Never both on the same
    day.
19. **Privacy Guides 37219 (FOSS background remover, Linux).** Own words. Facts: runs in the
    browser on Linux, MIT, about 16 MB of model files load from our site on first use, then the
    photo stays in the tab; up to 20 MB and 16 megapixels. Mention rembg (CLI) as the native
    option.
20. **JustinGuitar 412558 (app vs clip on).** Read the forum rules first (not retrievable here).
    "[Your view: clip on for noisy rooms, app or browser at home.] If anyone wants one without
    ads or subscription: a chromatic tuner with presets that works offline after the first
    visit. [link] Disclosure: I built it."
21. **OzBargain 952971 (ATO logbook), after the logbook ships.** "The ATO accepts any format
    with the required details for a continuous 12 week period [ATO link]. Driversnote and
    CarSavvy do automatic GPS trips if that's what you want. If you're happy to enter trips
    yourself, I built a free one with no app or account that works out the business use
    percentage and prints a report for your agent. It doesn't track GPS. [link] I'm the
    developer (Associated). Not a tax agent."
22. **Quora HEIC safest way.** Lead with "the safe routes are the ones where decoding happens on
    your own machine: Paint or Photos with the HEIF extension, IrfanView, or a browser page that
    decodes locally"; explain how to tell (works with Wi-Fi off after loading). Then link plus
    disclosure.
23. **Quora offline transcription.** whisper.cpp, Buzz, MacWhisper; then ours with the English,
    10 minute and first run download caveats.
24. **Quora expired business card QR.** "Sadly a printed dynamic code can only be revived by
    paying that provider; if the destination is your own site, a sticker with a new static code
    over the old one is the cheap fix. For the reprint use a static code (scan test before
    printing). [link] (mine, static only)."
25. **Quora find renewing subscriptions.** Check PayPal automatic payments, App Store and Google
    Play subscriptions, then export 6 to 12 months of CSV and look for repeats; "I built a page
    that does the pattern matching in the browser [link]; it doesn't connect to your bank."
26. **Quora Speechify alternative.** Edge Read Aloud, macOS Spoken Content, Android Select to
    Speak are free; "for PDFs with sentence highlighting and resume where you stopped, using your
    device's own voices: [link] (mine). Voices are only as good as the ones your device has."
27. **Quora resume builder free download.** Google Docs templates or LibreOffice are genuinely
    free; "most builders put the paywall on the download button. Mine doesn't: [link]; download
    goes through the browser's print to PDF." Add [what your own CV looked like].
28. **HN October thread.** See section 6, reply 1.
29. **Software Recs 25196 (web disk analyser code).** "Not remote protocol aware, but the source
    may be adaptable: MIT licensed, the treemap and scan are plain JavaScript reading a directory
    handle, so you'd swap the file system reader for your API. [repo link] I'm the author."
30. **SU 1857859 (merge a folder of PDFs).** Lead with `qpdf --empty --pages *.pdf -- out.pdf`
    or `pdfunite`; "for a one off without the command line, [link] merges and reorders in the
    browser. Mine."
31. **Software Recs 18323 (recipes plus shopping list).** Honest partial: Mealie and Tandoor are
    the self hosted shared options that match the group need; "if one person plans for everyone,
    Recipe Keeper adds up the shopping list across the week, but it lives on one device. [link],
    mine."
32. **Software Recs 28557 (weekly goals).** Read the body first. If "weekly" means "N times a
    week", our streaks count weeks; if it means hours a week, we don't fit, skip.
33. **Money SE 36752.** Answer the ratio maths fully; mention Settle Up only as "exact amounts per
    item"; probably skip the link.
34. **Privacy Guides 12999.** Own words. Before answering, confirm how the ledger is stored in the
    share link (URL fragment or query) and what a link preview bot would see; that is what this
    audience will ask.
35 to 45. Short answers on the same patterns; low priority, do only when the tool's tab is open
    anyway.

### 2.4 Reddit: run these yourself (nothing could be opened from here)

Use Reddit search with **Sort: New, Time: Past month**, reply only under 7 days old with under
30 comments (plan 6.3). These are built to surface the asks our tools answer:

| Search (paste into reddit.com/search or the subreddit search) | Tool |
|---|---|
| `subreddit:AusFinance logbook` and `subreddit:AusFinance "work from home" hours` | Car Logbook, Hours Log (from 19 Oct) |
| `subreddit:auscorp "fixed rate" OR "wfh hours"` | Hours Log |
| `splitwise (limit OR "3 expenses" OR premium)` | Settle Up |
| `subreddit:travel OR subreddit:solotravel "split costs"` (read rules first; most travel subs ban promotion) | Settle Up |
| `heic jpg windows` and `subreddit:iphone heic` | Image Converter |
| `subreddit:iphone ringtone "ios 26"` | Ringtone Maker |
| `loom (alternative OR "5 minute")` | Screen Recorder |
| `"remove.bg" (alternative OR credits)` | Background Remover |
| `"qr code" (expired OR "stopped working")` | QR Codes |
| `subreddit:Strava "heatmap" subscription` | GPX heatmap (not route planning) |
| `subreddit:ukulele OR subreddit:Guitar tuner app ads` | Tuner |
| `subreddit:usyd OR subreddit:UNSW resume OR cv template` | CV Builder |
| `(rocket money OR "forgotten subscriptions") australia` | Subscription Finder (Post 2 already covers one) |

Record each thread URL in `PORTFOLIO.md` with "found by hand" so the 30 day review can count it.

---

## 3. Communities to cultivate (next 10 weeks)

Rules marked **checked** were read at the source today; **plan** means already recorded in
PLAN 6.1; **unverified** means Reddit or Facebook blocked or no budget left: read the sidebar or
group rules before your first post.

| Community | Size | Self promotion rule | Honest way in | Tools |
|---|---|---|---|---|
| Super User | large; protected Qs need 10 rep | **checked**: "if you mention your product … you must disclose your affiliation"; "Don't include links except to support what you've written" (superuser.com/help/promotion) | Two or three plain answers without links first, to pass 10 rep, then rows 1, 2, 4, 5 | Image Converter, Sign a PDF, PDF Tools, Disk |
| Software Recommendations SE | small, evergreen | same network rule, plus answers must address every requirement | Rows 15, 29, 31, 32 | Disk, Recipe, Habit, Tuner |
| Ask Different (apple.stackexchange) | large | same network rule; **the place for Apple answers with a link**, since Apple Community bans them | Rows 3, 14 after testing iOS 26 | Ringtone, Image Converter |
| Android Enthusiasts SE | medium | same | Row 10 | Ringtone |
| Money SE | medium | same | Rows 16, 33 | Settle Up, Subscription Finder |
| Hacker News | huge | **checked**: Show HN gated by showlim for new accounts; vote asking forbidden | Monthly "What are you working on?" now; real comments weekly; Show HN later (section 5) | Whole site |
| OzBargain Free Software forum | large AU | **plan** (docs/distribution/ozbargain.md): forum not deals, declare Associated | One forum post; then answer AU threads like row 21 | Invoice, Logbook, Hours Log, Settle Up, Subscription Finder |
| Microsoft Tech Community (discussions) | huge | rule page not retrievable; **plan**: no unsolicited advertising | Answer first, disclose, one link; rows 7 to 13 | Image Converter, Screen Recorder, QR, Disk, Sign a PDF |
| Microsoft Q&A (learn.microsoft.com) | huge | not retrievable; many old threads locked | Only open, recent questions (rows 12, 36) | Disk, Read Aloud |
| Privacy Guides forum (discuss.privacyguides.net) | active, privacy minded | **checked**: "Using AI to generate post content is forbidden" (discuss.privacyguides.net/faq). Spam forbidden. There is live scepticism about software "made fully by LLMs" (topic 41141) | Write in your own words; lead with the threat model (what leaves the device); be upfront that you built it and how | Transcription, Background Remover, Settle Up, Image Converter |
| TrainerRoad forum | cycling, active | **checked**: no affiliate links, no buying or selling | Heatmap questions only; never route planning | GPX heatmap |
| JustinGuitar Community | large learner base | rules not retrievable (faq.json empty); read before posting | Rows 20; also answer beginner tuning questions with no link | Tuner and Metronome |
| Ukulele Underground forum | established | unverified | Uke Tech Support subforum; answer, then link once | Tuner |
| AppleVis forum | blind and low vision Apple users | unverified | Only after checking Read Aloud and Ringtone Maker with VoiceOver yourself; this audience will test it properly | Read Aloud, Ringtone Maker |
| r/AusFinance | unverified (very large) | unverified; plan says replies only until checked | Comments without links for two weeks, then disclosed answers in logbook and WFH threads 19 to 31 Oct | Logbook, Hours Log, Invoice, Subscription Finder, Worth It |
| r/SideProject | unverified (large) | **plan**: self promotion welcome, must engage | One post when the account is about 30 days old | Whole site |
| r/webdev | unverified | **plan**: Showoff Saturday only, technical | A Saturday technical write up (static pages, per build service worker cache) | Whole site |
| r/degoogle | unverified | **plan**: Showcase megathread, prefix **[DEV]** | Megathread entry plus [DEV] replies | Settle Up, Habit, Recipe, Transcription |
| r/selfhosted | unverified | **plan**: New Project megathread for projects under 3 months, docs required | December | Whole repo |
| r/usyd, r/UNSW | unverified | unverified | Be a student first: answer course and campus questions; CV Builder only when someone asks | CV Builder, Settle Up |
| Facebook: "I'm a small business owner in Western Australia" (~15k, "no advertising allowed"), "Small Business Owners Australia" (~9k), "Brisbane Small Business" (~9k) | sizes from a SmartCompany article (smartcompany.com.au/entrepreneurs/small-business-facebook-groups-covid-19/), probably dated | No advertising in the first; many groups allow promotion only on set days | Join with your own profile, answer invoice and GST questions in text; only post the tool on a promotion day | Invoice, Logbook |
| Share house and backpacker Facebook groups | unverified | typically no promotion | Low priority; only reply when someone asks how to split bills | Settle Up |

Discord and Slack: none found that is both public and on topic, and their posts are not indexed
by Google, so they send no lasting traffic. Skip them this quarter.

---

## 4. Creators and newsletters

Plan 8.1 and 8.2 already cover press (Honi Soit, SmartCompany, Finder, Canstar) and the generic
creator template. These are named targets. Send only after the tool you mention has been
through your own hands, and never more than one tool per pitch.

| # | Creator or newsletter | Audience | Why they fit | How they take suggestions | Pitch tool |
|---|---|---|---|---|---|
| 1 | **Dense Discovery** (Kai Brach, Melbourne) densediscovery.com | about 36,000 subscribers, design, tech, sustainability | Features small apps and sites weekly; Australian editor | Email Kai via the site; "reads every email" (toolsandtoys.net/dense-discovery-newsletter/) | Whole site, framed as "no server, no tracking" |
| 2 | **Web Tools Weekly** (Louis Lazaris) webtoolsweekly.com | front end developers | Takes web apps of any kind | DM on X or Bluesky (@LouisLazaris), per webtoolsweekly.com/submit | PDF Tools or Disk analyser (technical angle) |
| 3 | **Tech Productivity** (Louis Lazaris) | productivity tools | Productivity tools were moved here from Web Tools Weekly | Same DMs (webtoolsweekly.com/submit) | Screen Recorder, Read Aloud |
| 4 | **Recomendo** (Kevin Kelly, Mark Frauenfelder, Claudia Dawson) kk.org/cooltools/recomendo/ | large general audience | Six short picks a week of things the editors personally used | No public form; picks come from the editors' own use. A short, plain reply to an issue is the only route; expect nothing | QR Codes (static, never expire) |
| 5 | **Cool Tools** (kk.org/cooltools) | long running tools site | About 90% of entries are reader submitted reviews by people who used the tool | Only a genuine user should submit; you can't review your own tool | none yourself; mention to a happy user |
| 6 | **Free Technology for Teachers / Practical Ed Tech** (Richard Byrne) freetech4teachers.com | K to 12 teachers and librarians | Writes about free web tools with classroom uses | Email through the site | Read Aloud, QR Codes, Tuner (music teachers) |
| 7 | **The New Oil** (Nate Bartram) thenewoil.org | beginner privacy audience | "Privacy does not require abandoning tech"; covers easy tools | Contact page thenewoil.org/en/links | Image Converter (strips GPS), Sign a PDF (no upload) |
| 8 | **Privacy Guides** (forum plus "This Week in Privacy") | privacy community | Tool discussions happen in the forum | Forum only, own words | Transcription, Background Remover |
| 9 | **Dave's Toolbox** daveswift.com/newsletter | general tools roundup, 5 to 6 picks per issue | Weekly tool picks | Reply to the newsletter (check the site for a form) | QR Codes or Screen Recorder |
| 10 | **Great Startups** greatstartups.substack.com | tools newsletter; a search result says it was formerly "No Signup Tools" (not confirmed on its about page) | If the history is right, no signup tools is exactly our niche | Substack reply or comment | Whole site |
| 11 | **Tash Invests / Get Rich Slow Club** (Natasha Etschmann, with Pearler) pearler.com | young Australian investors | Practical AU money content | Instagram or TikTok DM, or via Pearler | Subscription Finder, Is It Worth It |
| 12 | **Aussie Firebug** aussiefirebug.com | Australian FIRE readers | Frugal, spreadsheet minded | Contact form on the blog | Subscription Finder, Logbook (after launch) |
| 13 | **Strong Money Australia** (Dave Gow) strongmoneyaustralia.com | Australian FIRE readers; co hosts the Aussie FIRE podcast with Pearler | Same | Contact on the blog | Subscription Finder |
| 14 | **Note-Worthy Experiences resources page** note-worthyexperiences.com/resources.html | a music studio's student resource list | Lists free metronome and tuner apps for students | Polite email asking whether a browser tuner suits the list | Tuner and Metronome |
| 15 | **Seattle JazzEd "10 best free or cheap music apps for students"** seattlejazzed.org/10-best-free-or-cheap-music-apps-for-students | music education nonprofit | Curated free app list for students | Email the education team | Tuner and Metronome |
| 16 | **MusicRadar "Best guitar tuner apps"** musicradar.com/news/best-guitar-tuner-apps | large guitar audience | Roundup that already lists free tuners | Email the article's author; low odds | Tuner and Metronome |

Student productivity YouTube could not be verified within the search budget. Method (15
minutes): YouTube search "free websites for university students", filter to this year; keep
channels between 10k and 150k subscribers whose videos list web tools; the About tab shows a
business email. Pitch the CV Builder in January (graduate applications), not in exam season.

Australian tax TikTok: CPA Australia publicly warned against TikTok tax advice in 2025
(accountantsdaily.com.au/tax-compliance/21271-tiktok-tax-advice-misleading-taxpayers-cautions-cpa).
Pitch only to registered tax agents who post (check the Tax Practitioners Board register), so the
logbook is shown by someone accountable.

---

## 5. Account bootstrapping (4 weeks, under 20 minutes a day)

### What the rules actually are in 2026

**Hacker News.** Show HN is restricted for accounts "without much HN history" via
news.ycombinator.com/showlim (dang, 22 Apr 2026). The threshold is deliberately unpublished
("not a checklist process", dang, 15 Mar 2026). A fresh account on 24 Sep 2026 reported Show HN
blocked, a plain story killed in about 15 minutes, and an Ask HN flagged within 60 seconds
(ax7nova, via the HN Algolia API). Background: "Ask HN: Please restrict new accounts from
posting" (news.ycombinator.com/item?id=47300329, March 2026, 515 comments). Third party guides
claim 50 to 100 karma; that is folklore, not policy.

**Reddit.** There is no sitewide karma gate. Each subreddit sets its own minimum karma and
account age in AutoModerator and usually doesn't publish it, and since September 2023 moderators
can also filter on Reddit's hidden Contributor Quality Score (five tiers, from signals including
past actions, network and location patterns, and whether the email is verified; summary at
postpone.app/blog/understanding-reddits-contributor-quality-score). Common gates reported are
around 30 days and 50 to 500 karma (postiz.com/blog/reddit-karma-requirements), unverified per
sub. Karma farming subs lower trust and get accounts banned elsewhere: never use them.

### The calendar (you have about 3 weeks before the November blackout)

The account is 30 days old on about **7 November**, two days before you go dark (9 to 28
November). So: anything that needs 30 days happens either 5 to 8 November or from 29 November.
If you already have an older Reddit account, use it (disclosing as always): it skips most gates.

| Week | Reddit (10 min a day) | Hacker News (10 min, 3 days a week) | Stack Exchange and forums (fold into the same 20 minutes) |
|---|---|---|---|
| 1 (8 to 14 Oct) | Create the account, verify the email, turn on 2FA, same phone and network each time, no VPN. Join r/AusFinance, r/usyd, r/sydney, r/Guitar or r/ukulele. Two genuinely useful comments a day, **no links**: things you know (USYD engineering, share house bills, Expo app review, tuning) | Reply 1 in the October "What are you working on?" thread (it is the one place a project link is the point). Then two substantive comments a week on topics you know: building controls and HVAC fault data, ROS, shipping an Expo app, Cloudflare Pages | Super User: two linkless answers to fresh questions you can actually solve, aiming for the 10 rep that unlocks the protected HEIC and PDF questions |
| 2 (15 to 21 Oct) | Three comments a day. One question post in a hobby sub. Still no links | Keep commenting; no self links | First linked answers: SU 1839145 (open), Tech Community 4554178 and 4505070 |
| 3 (22 to 28 Oct) | **Tax deadline window.** First disclosed replies in logbook and WFH threads (at most 1 in 10 of your comments). Check every post while logged out (plan 6.5) | Same | OzBargain forum post for the Logbook and Hours Log, Associated; then row 21 |
| 4 (29 Oct to 4 Nov) | Keep the 1 in 10 ratio. Draft the r/SideProject post | If several comments drew replies and upvotes, try Show HN once on a US morning; if showlim blocks it, don't work around it | Protected SU answers if you reached 10 rep |
| 5 to 8 Nov | r/SideProject post (account about 30 days), then answer every comment that evening | | |
| 9 to 28 Nov | Nothing. Posts left unanswered for three weeks hurt more than not posting | Nothing | Nothing |
| from 29 Nov | r/degoogle megathread, r/webdev Showoff Saturday, r/selfhosted megathread (plan) | Show HN if not yet done | Weekly 20 minute thread hunt (plan 6.3) |

---

## 6. The 10 replies to make first

Ordered by value per minute. Each needs your own rewrite. Mark posted ones in `PORTFOLIO.md`.

**1. Hacker News, "Ask HN: What are you working on? (October 2026)"**
news.ycombinator.com/item?id=49927188 (1 Oct, 25 comments). Allowed with karma 1, and it builds
the history showlim looks for. Post by 12 October while it is still read.

> Plenty of Tools: small single purpose web pages for things that usually end in a paywall or an
> upload (a CV builder, sign a PDF, HEIC to JPG, a screen recorder with no time cap, an
> Australian invoice generator). Each one is a static page; the work happens in the tab, so
> there is no server to send files to. [One thing you learned building it, for example the per
> build service worker cache or what was hardest to do without a server.] MIT licensed:
> [repo link]. plentyoftools.io

**2. Microsoft Tech Community, "How to screen record and record yourself at the same time"**
(7 Sep 2026, 8 replies, unsolved). Draft: section 2.3, row 8. Record a 2 minute test with the
camera bubble first so the bracket is real.

**3. Microsoft Tech Community, "What is the best qr code generator without expiration?"**
(Mar 2026, last reply Aug 2026). Draft: row 7. Scan your own downloaded PNG and SVG first.

**4. Super User 1839145, "How to convert heic format to jpeg format"** (open, active 17 Sep
2026, 9,734 views). Draft: row 6. Use different sentences from Post 1.

**5. Microsoft Tech Community, "How to sign a PDF for free on Windows 11?"** (28 Jul 2026,
1 reply). Draft: row 11. Sign one real form first.

**6. Ask Different 487047, "Get custom ringtone on iPhone 13 iOS 18.7"** (9 Sep 2026).
Draft: row 14. Same session: test the iOS 26 share sheet route with an MP3 from our tool, then
answer row 3 (431183, 36k views) with what you saw, and tell the search agent so the Ringtone
Maker page can be updated.

**7. Microsoft Q&A 5706874, "Looking for a Windows 11 utility to help with freeing up SSD
space"** (13 Jan 2026, open). Draft: row 12. Point the analyser at your own Downloads or user
folder first and note what happens.

**8. Privacy Guides 27665, "Recommendations for private transcription tools?"** (last post
15 Jun 2026). Write it yourself (row 17 lists the facts). Lead with what leaves the device: the
first run fetches about 55 MB of model files from Hugging Face, after that nothing.

**9. Money SE 24603, "Automatically splitting payments between people"** (3,626 views).
Draft: row 16. Includes the settleup.io clarification.

**10. OzBargain 952971, "Best ATO Approved Logbook App"**, the day the Car Logbook ships
(19 to 25 Oct). Draft: row 21. Tick Associated if replying in a way that promotes it, or simply
say "I'm the developer" in the comment; check the current OzBargain rule for comments the same
day.

Reserve, if a slot frees up: JustinGuitar 412558 (tuner, after reading its rules); Privacy
Guides 37219 (background remover, own words).

---

## Sources

Stack Exchange API (api.stackexchange.com/2.3) for every Stack Exchange view count, date,
protected and closed flag, 7 Oct 2026. Hacker News Algolia API (hn.algolia.com/api/v1) for HN
threads and the dang and ax7nova comments. Discourse JSON for discuss.privacyguides.net,
trainerroad.com/forum and community.justinguitar.com. Page fetches: the Microsoft Tech Community
and Microsoft Q&A threads listed in the table; ozbargain.com.au/node/952971, 817343, 787575,
702794, 799623, 728739, 770023, 949306; mail.applevis.com/comment/201066;
superuser.com/help/promotion; discuss.privacyguides.net/faq; trainerroad.com/forum/faq;
webtoolsweekly.com/submit. Search results (not opened): the Quora questions listed;
appleinsider.com/articles/25/06/12/custom-ringtones-are-now-slightly-easier-to-add-in-ios-26;
tomsguide.com/phones/iphones/ios-26-makes-custom-iphone-ringtones-easier-than-ever-heres-how-to-do-it;
postpone.app/blog/understanding-reddits-contributor-quality-score;
postiz.com/blog/reddit-karma-requirements; toolsandtoys.net/dense-discovery-newsletter/;
kk.org/cooltools/recomendo/; thenewoil.org/en/links; pearler.com;
smartcompany.com.au/entrepreneurs/small-business-facebook-groups-covid-19/;
accountantsdaily.com.au/tax-compliance/21271-tiktok-tax-advice-misleading-taxpayers-cautions-cpa;
note-worthyexperiences.com/resources.html; seattlejazzed.org/10-best-free-or-cheap-music-apps-for-students;
musicradar.com/news/best-guitar-tuner-apps. Tool facts from this repo's `tools/*/index.html`.
