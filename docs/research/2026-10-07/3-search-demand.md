# Search demand: what Plenty of Tools can realistically win in 3 to 6 months

Research agent 3 of 5, 7 October 2026. Research only; nothing was posted or changed except this file.

## 0. Method, and how far to trust it

| Signal | How it was gathered | Trust |
|---|---|---|
| **Autocomplete suggestions** | Google's suggest endpoint with the `chrome` client and explicit `hl=en-AU&gl=au` or `hl=en-US&gl=us` (the `firefox` client ignores `gl` and geolocates to Sydney, so it was dropped). About 260 seed queries, 15 suggestions each. Raw output: scratchpad `ac/r1.json` to `r5.json`. | Good for "does anyone search this, and with which words". Says nothing about volume on its own. |
| **Prefix depth** | For 49 target queries: how many characters must be typed before Google offers the whole query (e.g. `wfh fixed rate method` appears after typing `wfh ` in AU: depth 4 of 21). Lower depth means the query beats everything else that starts with those letters. | The best free proxy for *relative* demand available here. Not a volume. |
| **Volume figures** | Only where a third party quoted one (e.g. "heic to jpg" about 246,000 a month globally; "secret santa" about 301,000). | Third party estimates; treat as order of magnitude. |
| **SERPs** | WebSearch (US based, and **not Google's index**: it surfaces Product Hunt, hunted.space and hacked university subdomains such as `live.museum.manchester.ac.uk` that Google mostly filters). Google, Google Trends (HTTP 429), Startpage (captcha) and Brave all blocked scripted access. Bing AU scraping worked for two queries and then returned poisoned, off topic results, so it was discarded except for "invoice template australia no gst". | Indicates what kind of page competes and whether giants are present. Positions will differ on Google. Every SERP judgement below should be read as "likely", and a 10 minute manual Google AU check is worth doing before building anything. |

Demand tiers used below (estimates): **A** = depth at or under 9 or a quoted volume over 10k a month; **B** = depth 10 to 14 or a full page of suggestions; **C** = depth 15 or more, or only a handful of suggestions; **D** = no autocomplete at all.

## 1. What the evidence says, in six lines

1. **The best search openings are seasonal and social, not privacy.** Secret Santa / Kris Kringle and splitting a holiday house by nights both have real demand, weak or spammy SERPs, and fit the Settle Up share link architecture we already have. They peak late November to January, so they must be live and requested for indexing by about 1 November.
2. **Privacy modifiers have almost no search demand.** "sign pdf without uploading" and "remove background without uploading" return *zero* US autocomplete suggestions; "heic to jpg without upload" exists but is a sliver of a 246k query. Those SERPs are already full of indie browser tools from Product Hunt and dev.to. Use privacy as conversion copy, not as a keyword strategy. The modifiers that *do* carry demand are "no sign up", "no email", "no watermark", "no expiration", "no subscription" and "free no limit".
3. **Australian specifics are the moat.** Queries where AU depth is far lower than US depth (Kris Kringle 6 vs 14, rent receipt 8 vs 23, quote template 7 vs 16, Rocket Money Australia 8 vs 15, invoice template australia 8 vs 18) are ones global giants serve badly.
4. **The ATO tools target real demand but are out of season for this window.** "wfh fixed rate method" (AU depth 4) and "ato logbook" (AU depth 5) are strong, but they peak July to October. Shipping 19 to 25 October will not rank before the 31 October deadline. They are bets on July 2027, and their best keywords are "template" and "calculator", not "app" or "records".
5. **iOS 26 undercut the ringtone bet.** Files and Voice Memos now offer "Use as Ringtone" directly for clips of 30 seconds or less (Tom's Guide, AppleInsider, Apple support), and the how to SERP belongs to Tom's Guide, iPhoneLife and iGeeksBlog. Our tool allows 40 seconds; it should cap ringtones at 30.
6. **About half the catalogue faces hopeless head terms** (screen recorder, background remover, HEIC to JPG, metronome/tuner, transcription, read aloud, disk analyser, habit tracker). For those, only narrow how to long tail ("heic to jpg windows 11", "officeworks print heic", "combine gpx files") is plausible.

## 2. Candidate queries per tool (with demand signal)

Depth figures are AU then US, "chars typed / query length". Suggestion lists quoted are Google AU autocomplete unless noted.

### CV Builder
| Query | Market | Signal |
|---|---|---|
| cv builder free | global | A: AU 4/15, US 5/15; suffixes "no sign up", "no payment", "ats friendly", "download pdf" |
| resume builder free no sign up | global | B: AU 16/30, US 8/30; variants "no sign up or payment", "no sign in" |
| free resume builder no watermark | global | B: 10 variants ("free cv maker without watermark and payment") |
| resume template australia student / no experience | AU | B: 6 suggestions each; "resume template australia 2026", "seek", "reddit" |
| graduate resume template australia | AU | C: 5 suggestions; seasonal Nov to Mar (grad programs) |
| cover letter template australia | AU | A: 15 suggestions incl. "seek", "nursing", "government job" (we have no cover letter mode) |

### Invoice Generator
| Query | Market | Signal |
|---|---|---|
| invoice template australia | AU | A: AU 8/26 vs US 18/26; first suffix is "no gst" |
| invoice template australia no gst | AU | A: AU 9/33; variants "free online", "word", "sole trader", "excel" |
| invoice generator australia (free) | AU | A: AU 9/27; "gst", "abn", "no gst" |
| how to invoice without abn / can you invoice without an abn | AU | B: 7 question variants incl. "do all invoices need an abn" |
| sole trader invoice template (australia no gst) | AU, UK | B: 13/28 |
| quote template australia | AU | A: AU 7/24 vs US 16/24; trade variants (builders, painting, carpentry) |
| rent receipt template australia | AU | A: AU 8/31 vs US 23/31 |
| receipt template australia / cash receipt template | AU | A: 15 suggestions |

### Settle Up
| Query | Market | Signal |
|---|---|---|
| splitwise alternative | global | B: 10/21; suffixes "free", "reddit", "open source", "website" |
| splitwise daily limit | global | B: 11/21; 11 variants ("reset time", "per day", "reached daily expense limit") |
| split airbnb cost calculator | global | B: 10/28 both markets; "how can i split airbnb costs fairly with friends" |
| split accommodation calculator / costs | global | C: appears under "holiday cost split calculator" |
| trip expense splitter | global | A: 7/21; "excel", "google sheets", "online", "app" |
| splitwise for couples / split expenses with partner | global | B: 13 to 14 suggestions |
| splitwise australia / splitwise pro cost australia | AU | C: 8 to 9 suggestions |

### Secret Santa (does not exist yet; natural sibling of Settle Up)
| Query | Market | Signal |
|---|---|---|
| secret santa generator | global | A: 7/22; parent "secret santa" about 301k a month globally (rankhero, quoted) |
| secret santa generator no email | global | A: 10/31; it is the **first** modifier suggested for "secret santa generator" |
| secret santa with exclusions (no email) | global | B: 13 variants |
| kris kringle generator | AU | A: **AU 6/22 vs US 14/22**; suffixes "text message", "wheel", "with wish list", "australia" |
| secret santa generator text message / whatsapp | global, AU | B: "secret santa generator text message australia" is itself a suggestion |

### Sign a PDF
| Query | Market | Signal |
|---|---|---|
| sign pdf free | global | A: 6/13; "no sign up", "no account", "iphone" |
| how to sign a pdf on iphone / mac | global | A: 15 suggestions each (Apple's native Markup answers it) |
| sign pdf without uploading | global | **D in US** (no suggestions); AU only 5 loosely related |
| sign pdf online free no sign up | global | B |

### PDF Tools
| Query | Market | Signal |
|---|---|---|
| merge pdf offline | global | B: 11/17; "windows", "free", "github", "windows 11" |
| merge pdf without uploading | global | C: 9 suggestions, mostly drift to other queries |
| merge pdf free no limit | global | B: 14 variants ("no size limit") |
| delete pages from pdf without adobe | global | B: 14 suggestions |
| how to merge pdf on windows (11) | global | B: 10 suggestions incl. "offline", "locally" |
| reorder pdf pages (free/iphone/mac) | global | A: 13 suggestions |

### Habit Tracker
| Query | Market | Signal |
|---|---|---|
| habit tracker free (printable/online) | global | A: dominated by printable intent |
| free habit tracker app no subscription | global | C: 22/38 |
| habit tracker website free | global | B |

### Recipe Keeper
| Query | Market | Signal |
|---|---|---|
| recipe keeper app free | global | A: "free vs pro", "limit", "one time purchase", "not syncing" |
| recipe keeper free (alternative/limit) | global | B: AU 10/18 vs US 15/18 |
| recipe organiser app free | global | B: 15 suggestions |

### What's Eating My Disk
| Query | Market | Signal |
|---|---|---|
| what is eating my disk space (windows 11) | global | B: 13 suggestions |
| disk space analyzer (free/windows/mac) | global | A: 6/19 (desktop software intent) |
| what is taking up space on my mac / pc | global | A: 15 suggestions |
| c drive full windows 11 | global | A: 15 suggestions |

### Read Aloud
| Query | Market | Signal |
|---|---|---|
| read pdf aloud (online free) | global | A: 6/14 |
| text to speech free no limit | global | A: 15 variants ("no word limit", "no sign up") |
| read aloud pdf free no sign up | global | B |

### Subscription Finder
| Query | Market | Signal |
|---|---|---|
| rocket money australia | AU | A: **AU 8/22 vs US 15/22**; "alternative", "equivalent australia", "work in australia", "apps like rocket money australia" |
| subscription finder (australia/app) | AU, global | B: 14/19; "australia" is the first suffix in AU |
| how to find all my subscriptions (for free) | global | A: 15 suggestions |
| find subscriptions australia / check subscriptions australia | AU | C |

### Screen Recorder
| Query | Market | Signal |
|---|---|---|
| screen recorder online free (no watermark / no download) | global | A: very high |
| screen recorder free no watermark | global | B: 17/28 |
| how to screen record on windows / mac with audio | global | A |

### Background Remover
| Query | Market | Signal |
|---|---|---|
| remove background from image free | global | A: 8/33 |
| background remover free no watermark | global | B |
| remove background offline | global | B: 11 suggestions, partly non English |
| remove background without uploading | global | **D** in both markets |

### Image Converter
| Query | Market | Signal |
|---|---|---|
| heic to jpg | global | A: about 246k a month (quoted); 5/11 |
| heic to jpg windows 11 (free/batch/bulk) | global | B: 13/22 |
| heic to jpg without upload | global | C: suggestion exists, tiny share |
| heic to jpg bulk / converter free | global | A |
| officeworks print heic / kmart photos heic | AU | C: real but tiny; seasonal (Christmas photo printing) |
| webp to jpg / avif to jpg | global | A (ezgif, iLoveIMG, Canva) |

### QR Codes
| Query | Market | Signal |
|---|---|---|
| qr code generator free no expiration | global | A: **US 3/36** (the scammy dynamic QR expiry pain) |
| qr code that doesn't expire | global | B: 13 variants |
| wifi qr code generator | global | A: 6/22; "free no sign up", "with logo" |
| free qr code generator australia no expiration | AU | C: present as a suggestion |

### GPX Route Builder
| Query | Market | Signal |
|---|---|---|
| gpx route planner (free/online/running) | global | A: 5/17 |
| gpx file creator (online/free) | global | A: 5/16 |
| create gpx file from google maps | global | B: 10 AU suggestions |
| combine gpx files / gpx merger | global | B: 13 to 15 suggestions |
| strava route builder free | global | B: AU 9/25 vs US 14/25; "strava routes sydney/perth" |
| gpx to kml / kml to gpx | global | A (converter intent) |

### Browser Transcription
| Query | Market | Signal |
|---|---|---|
| transcribe audio to text free (no limit / unlimited) | global | B: 11/29 |
| transcribe audio offline (free) | global | B |
| whisper web | global | B: 9/11 but noisy (Whisper the fashion site) |
| voice memo to text / mp3 to text | global | A |
| otter ai alternative free | global | C |

### Tuner and Metronome
| Query | Market | Signal |
|---|---|---|
| guitar tuner online | global | A: 7/19 |
| online metronome (with subdivisions) | global | A: 8/16 |
| chromatic tuner online | global | B |
| violin tuner online free no download | global | B |

### Ringtone Maker
| Query | Market | Signal |
|---|---|---|
| make ringtone iphone | global | B: 15/20 |
| make ringtone iphone without garageband | global | B: 15/39 |
| custom ringtone iphone ios 26 / set ringtone iphone ios 26 | global | B: 11 variants |
| how to make a ringtone from a voice memo (on iphone) | global | A: 15 variants |
| trim audio to 30 seconds | global | B: 13 suggestions |
| mp3 cutter / cut mp3 online | global | A (mp3cut, Clideo) |

### Is It Worth It?
| Query | Market | Signal |
|---|---|---|
| is uber one worth it | global | A: **AU 4/20** |
| is uber one worth it australia | AU | A: AU 9/30 vs US 14/30 |
| uber one australia price / student price | AU | C: 7 variants |
| is club jetstar worth it | AU | A: AU 6/24 (we have no Jetstar calculator) |
| is it worth paying for seat selection | global | B: 15 airline variants |
| is cruise wifi worth it | global | C: 9 variants |
| is coles plus / woolworths everyday extra worth it | AU | C: 6 to 8 variants |

### ATO Car Logbook (coming)
| Query | Market | Signal |
|---|---|---|
| ato logbook | AU | A: 5/11; "requirements", "app", "method", "template", "app free", "template excel" |
| ato logbook template (excel/pdf) | AU | A: 8/20 |
| car log book template | AU | A: 7/21 |
| ato logbook app (free) | AU | A: 7/15 |
| free car log book app australia | AU | C: 6 suggestions |
| ato logbook requirements / rules | AU | A (informational; ATO answers it) |
| 12 week logbook method | AU | C |

### ATO Hours Log (coming)
| Query | Market | Signal |
|---|---|---|
| wfh fixed rate method | AU | A: **AU 4/21**; "2026", "calculator", "ato", "25 26" |
| work from home hours calculator / work from home calculator ato | AU | A: 15 suggestions, "ato" first |
| ato working from home diary template excel | AU | A: 9/42 (very strong for a 42 character query) |
| work from home log book (template) | AU | C: 16/23 |
| how many hours did i work from home / "how many hours in total did you work from home during the year" | AU | C: the second is myTax's own question text, appearing as a suggestion |
| wfh fixed rate method records | AU | **D** (no AU suggestions). Drop as a target |

## 3. Ranked table: the 30 most promising

Score is demand times SERP weakness, then adjusted for fit and timing. "Top 5" is WebSearch (US, not Google) unless marked; giants likely present on Google are noted in brackets.

| # | Query | Mkt | Demand | SERP weakness (top 5) | Page that wins it | What the page needs | Conf. |
|---|---|---|---|---|---|---|---|
| 1 | secret santa generator no email | global | A (first modifier of a ~300k/mo topic) | **Weak**: worldcoffeeresearch.org (hacked), api.natori.com (hacked), peerpush.com, codeitbro.com, educatorstechnology.com. [Google: drawnames.com, elfster.com, secretsantaorganizer.com likely top] | **New**: Secret Santa / Kris Kringle draw | Names, exclusions, budget, date; one private link per person (pairing encoded in the link fragment, no server, no email); share via WhatsApp/SMS; live by 1 Nov | Med |
| 2 | kris kringle generator | AU | A (AU 6/22 vs US 14) | **Weak**: drawnames.com/kris-kringle, elfster.com blog, insiderguides.com.au, cufonfonts.com (a font!), font.download | Same new page | H1 and title say "Kris Kringle" as well as Secret Santa; "text message" and "work Kris Kringle" sections | Med |
| 3 | split airbnb cost calculator / split accommodation by nights | global | B (10/28) | **Very weak**: heartbeatapi.appbase.io, dashboard.ekuep.com, hsd.firstinternet.co.uk (all hacked spam), pop.freespeechforpeople.org, ultimatefinancecalculator.com; also hacecuentas.com, a coda.io doc | Settle Up, new "split by nights" mode | Per person nights in, weighted shares out, cleaning fee split evenly; result drops into the share link | Med/High |
| 4 | invoice template australia no gst | AU | A (9/33; the top modifier) | **Medium**: Bing AU: ausinvoice.com, onlineinvoices.com, invoicesonic.com, enerpize.com, abninvoice.com.au; WebSearch adds sprintlaw.com.au, rounded.com.au, westpac.com.au. Small exact match sites, no giants | Invoice Generator (title already targets it) | Worked no GST example; "Invoice" vs "Tax Invoice" explained; Word style PDF; FAQ on the $75k threshold | Med (6 months) |
| 5 | is uber one worth it australia | AU | A (parent AU 4/20) | **Weak**: pointhacks.com.au (tag page), loyaltyrewardco.com, newlifeinaus.com.au, australianfrequentflyer.com.au (forum posts), querysprout.com | Worth It, `#uber-one` | Current AU price (search summary says $9.99 a month, $99.99 a year; verify), student price, a worked AU example, DiDi comparison line | Med |
| 6 | rocket money australia / alternative australia | AU | A (AU 8/22 vs US 15) | **Weak**: subtracker.io, recurdash.com, help.truebill.com, alternativeto.net, resubs.app; none Australian, none explains AU bank CSV export | Subscription Finder | "Rocket Money doesn't work in Australia" intro; how to export CSV from CommBank, NAB, ANZ, Westpac, ING, Up; AU merchant names (Stan, Binge, Kayo) in the detector | Med |
| 7 | ato working from home diary template excel | AU | A (9/42) | **Weak**: template.net (x3), community.ato.gov.au, spam PDFs; etax.com.au for close variants | Hours Log | CSV/Excel export that looks like a diary; "what the ATO accepts" | Med (rank) / Low (timing: off season until July) |
| 8 | work from home calculator ato / hours calculator | AU | A | **Medium**: austax.tools (x2), ato.gov.au, austaxai.com.au, fairworkmate.com.au, tool.teamzlab.com: small AI built AU calculators plus the ATO | Hours Log | Hours times rate view with the 2026–27 rate checked on ato.gov.au | Low/Med |
| 9 | ato logbook app free / free car log book app australia | AU | A (7/15) | **Medium**: App Store pages (Driversnote, ATO Vehicle Logbook, Travel Logs), driversnote.com.au (5 posts) | Car Logbook | Say plainly it is a web app that installs to the home screen; compare with myDeductions and Driversnote honestly | Med (by July) |
| 10 | splitwise daily limit | global | B (11/21) | **Very weak**: trustpilot.com (x5 locales), itvoice.in, sharecost.nolt.io, au.trustpilot.com, getfinny.app | Settle Up + `/vs/splitwise/` | Dated statement of the limit (3 to 5 a day, unpublished, per getfinny Aug 2026) and "no limit here" | High (rank) / low volume |
| 11 | quote template australia | AU | A (AU 7/24 vs US 16) | Not inspected on Google; expect Canva, Xero, MYOB, Rounded, Billdu | Invoice Generator (already does quotes) | An H2 and anchor "Free quote template Australia", a worked trade quote, quote to invoice in one click | Low/Med |
| 12 | secret santa generator with exclusions no email | global | B | **Weak**: lootjestrekken.nl / drawnames.com app pages, jobs.doral.edu (hacked), drawnames.co.uk, codeitbro.com | New Secret Santa page | Exclusions for couples as a first class control | Med |
| 13 | create gpx file from google maps | global | B | **Weak**: exploroz.com forum, routegen.sourceforge.net, gt-rider.com forum, starpath.com, topofusion.com forum | GPX Route Builder | How to section: Google Maps cannot export GPX, so draw it here; import KML from My Maps | Med |
| 14 | how to invoice without an abn / can you invoice without an abn | AU | B | Not fully inspected; likely ATO, Rounded, Sprintlaw, Square | Invoice Generator | "No ABN" section: the 47% no ABN withholding rule and the ATO "Statement by a supplier" for hobbyists | Low/Med |
| 15 | car log book template / ato logbook template | AU | A (7/21, 8/20) | **Medium**: driversnote.com.au (x2), rosterelf.com, etax.com.au (x2), rounded.com.au, then spam | Car Logbook | Printable blank PDF and CSV export alongside the live tool | Low/Med (by July) |
| 16 | combine gpx files / gpx merge online | global | B | **Medium**: komoot.com tool, nailthetrail.com, dawarich.app (in browser), joewein.net, pypi.org | GPX Route Builder, new merge mode | Drop several GPX files, order, merge, download | Med |
| 17 | heic to jpg without upload | global | C | **Weak but crowded**: dev.to, Chrome Web Store, Microsoft Store, producthunt.com, jasperbernaers.com, aimetadatacleaner.com | Image Converter | Already says "nothing is uploaded"; add a how it works line and offline install | Med (rank) / low volume |
| 18 | heic to jpg windows 11 (free, batch) | global | B (big parent) | **Medium**: backup-utility.com, digitalcitizen.life, community.adobe.com, learn.microsoft.com, reaconverter.com; [Google likely adds iMazing, heictojpg.com] | Image Converter | "On Windows 11 without installing anything" how to with batch and ZIP download | Low/Med |
| 19 | rent receipt template australia | AU | A (AU 8/31 vs US 23) | Not inspected | Invoice Generator, receipt document type | A real receipt layout (paid, method, period); rent and bond fields | Low/Med |
| 20 | is club jetstar worth it | AU | A (AU 6/24) | **Medium/strong**: canstar.com.au, australianfrequentflyer.com.au, finder.com.au, pointhacks.com.au, executivetraveller.com; none is an independent calculator | Worth It, new `#club-jetstar` | Inputs: trips a year, bags, seats; fee $65 then $55 (per AFF/Canstar; verify) | Low/Med |
| 21 | resume template australia student / graduate resume australia | AU | B | **Weak**: kbs.edu.au, spam, studyaustralia.gov.au (x3), lawpath.com.au | CV Builder | An Australian preset (referees, no photo, AU spelling) and a student/no experience example; seasonal Nov to Mar | Low/Med |
| 22 | merge pdf offline / without uploading | global | B | **Medium**: drawboard.com tool, techcommunity.microsoft.com, dev.to, index.dodopayments.com, extension sites; [Google: iLovePDF, Smallpdf, PDF24 for "merge pdf"] | PDF Tools | Install as app and works offline, stated and shown | Low |
| 23 | trim audio to 30 seconds / iOS 26 ringtone | global | B | **Medium/strong**: techradar.com, support.apple.com, App Store, mergeek.com, spam | Ringtone Maker | Cap ringtones at 30 s; "save to Files, Share, Use as Ringtone" steps | Low |
| 24 | wifi qr code generator free no sign up | global | A | **Medium**: boldsign.com (x2), solobizkit.it.com, poper.ai, aguidetocloud.com; [Google: qifi.org, qr-code-generator.com] | QR Codes | A Wi-Fi mode anchor and a printable guest Wi-Fi card | Low |
| 25 | officeworks print heic / kmart photos heic | AU | C (tiny) | **Very weak**: Microsoft Store apps, pdf.net, ilovepdf.com blog; nothing answers the question | Image Converter | Short AU section: convert before uploading to Officeworks/Kmart photo kiosks; Christmas timing | Med (rank) / tiny volume |
| 26 | splitwise alternative free / open source | global | B | **Medium**: alternativeto.net (dominant), tricount.com blog, producthunt.com, hunted.space | `/vs/splitwise/` | Get listed on AlternativeTo (Spliit is #1 there) rather than outrank it | Low |
| 27 | sign pdf without uploading | global | D/C | **Weak**: producthunt.com, indiehackers.com, mwm.ai, usesignhouse.com, Chrome Web Store | Sign a PDF | Nothing new; keep the "which signers upload" article as link bait only | Low (no demand) |
| 28 | gpx route planner free / gpx file creator online | global | A | **Medium**: bunchies.brainiumlabs.com.au, Suunto planner coverage, fediverse posts, App Store, mapscaping.com; [Google: gpx.studio, plotaroute.com, onthegomap.com] | GPX Route Builder | Clear "draw a route, download GPX, no account" above the fold | Low |
| 29 | recipe keeper free limit / alternative | global | B | **Medium**: recipesage.com (x4 comparison pages), innerbuddies.com, recime.app | `/vs/` Recipe Keeper page | State Recipe Keeper's 20 recipe free cap and our no cap | Low |
| 30 | make ringtone iphone without garageband | global | B | **Strong**: softorino.com, digitalcitizen.life, macmost.com, beebom.com, mobigyaan.com; Tom's Guide/AppleInsider own the iOS 26 angle | Ringtone Maker | Not worth content investment now | Low |

**Considered and rejected as hopeless** (giants or desktop intent fill the top 5): heic to jpg (head), remove background (remove.bg, Canva, Adobe, Picsart), screen recorder online (TechSmith, CapCut, ScreenRec), merge/split pdf (iLovePDF, Smallpdf, Adobe, PDF24, Sejda), qr code generator (QR Code Monkey, Scanova, QRStuff), transcribe audio (TurboScribe style SaaS, Otter), read pdf aloud (NaturalReader, Narakeet, PDFgear), guitar tuner / metronome (Fender, Google's built in tuner), disk analyser (WinDirStat, TreeSize; also a browser cannot scan a whole C: drive), habit tracker (App Store apps).

## 4. The specific angles you asked about

**Privacy and no upload intent.** Low demand and crowded (see finding 2). Evidence: "sign pdf without uploading" returns no US suggestions; "remove background without uploading" none in either market; the SERPs that exist are Product Hunt launches, Chrome extensions and dev.to posts for local first tools (Firmalo, SignifyPDF, SignetPDF, Drawboard, Localdobe, MiOffice, BGNix). The phrases with demand are **"no email"** (Secret Santa), **"no expiration"** (QR, US depth 3), **"no sign up"** (resume, invoice, QR), **"no watermark"** (resume, screen recorder) and **"no limit"** (Splitwise, transcription, text to speech).

**Australia specific.** Strongest: invoice no GST, quote template australia, rent receipt template australia, Kris Kringle, Rocket Money Australia, Uber One Australia, Club Jetstar, the ATO pair, payslip generator australia (AU 9/27; SERP: rosterelf.com which already runs in the browser, clockon.com.au, payroller.com.au, so medium), and small ones like "officeworks print heic".

**Seasonal before 20 December.**
- *31 October tax deadline:* demand is real but the ATO tools ship 19 to 25 October and will not be indexed and ranked in a week. Use the deadline in community replies, not search.
- *Secret Santa / Kris Kringle:* the largest seasonal opportunity; peaks late November to mid December. Must be live by about 1 November.
- *Christmas group trips:* split by nights mode; "split airbnb cost", "holiday cost split calculator". Peaks December to January.
- *End of uni year CVs:* "resume template australia student", "graduate resume australia"; grad program applications reopen February to March, so this runs past December.
- *Summer road trips GPX:* weak demand signal; "strava routes sydney/perth" exists but is Strava's. Low priority.
- *Holiday photo HEIC:* "heic to jpg windows 11", "officeworks print heic". Small sections, not pages.

**How to long tail where a tool plus a how to section can rank.** "create gpx file from google maps" (forums and old pages), "heic to jpg windows 11" (how to sites, no in browser tool), "how to invoice without an abn", "how to split airbnb costs fairly with friends", "how to find all my subscriptions for free" plus AU bank CSV export steps, "how many hours did I work from home" for myTax.

## 5. New pages or tool modes worth building (8)

Each is a genuinely different output, not a keyword variant, so none should trip the thin content rule in PLAN-ENGAGEMENT.

| # | Build | Targets | Why it is distinct | Effort | When |
|---|---|---|---|---|---|
| 1 | **Secret Santa / Kris Kringle draw** (new tool, reuses Settle Up's link encoding) | secret santa generator no email; kris kringle generator; with exclusions; text message | Per person private links with no server and no email is a real feature competitors gate behind accounts | Small | Ship by 25 Oct, request indexing 1 Nov |
| 2 | **Settle Up: split by nights** | split airbnb cost calculator; split accommodation costs; holiday house split | Weighted shares are a different calculation from equal splits | Small | Before 15 Nov |
| 3 | **Subscription Finder: Australian bank CSV guide and presets** | rocket money australia; find subscriptions australia | No competitor explains CommBank/NAB/ANZ/Westpac/ING/Up exports | Small | Any time |
| 4 | **Invoice Generator: receipt document type + "No ABN" section** | rent receipt template australia; cash receipt template; how to invoice without an abn | A receipt is a different document (paid, method, period) | Small | Any time |
| 5 | **GPX: merge files mode + "Google Maps to GPX" how to** | combine gpx files; create gpx file from google maps | Merging is a new operation; the how to answers a forum level SERP | Small | Before December |
| 6 | **Worth It: Club Jetstar calculator** | is club jetstar worth it | Different inputs and fee structure from Uber One; AU only | Small | Any time |
| 7 | **Hours Log: "total hours for myTax" view** (tally from a calendar .ics or roster CSV, plus hours times rate) | work from home calculator ato; how many hours did I work from home; diary template excel | Turns existing records into the one number myTax asks for | Medium | By June 2027 (season) |
| 8 | **Ringtone Maker: 30 second cap and iOS 26 steps** | trim audio to 30 seconds; custom ringtone iphone ios 26 | Fixes a correctness gap rather than chasing a keyword | Tiny | Now |

Not recommended: a standalone "HEIC to JPG without uploading" landing page (the existing page already says it; a second page would be a near duplicate), "split PDF without uploading" (no demand), "sign PDF without uploading" pages.

## 6. Top 10 shortlist

1. **Secret Santa / Kris Kringle (new).** Highest seasonal demand we can plausibly touch, SERP below drawnames/Elfster is spam and thin tools, and AU's "Kris Kringle" wording is underserved (AU depth 6 vs US 14). Also a share link loop like Settle Up. Deadline driven.
2. **Split by nights (Settle Up mode).** The weakest SERP found (hacked spam pages hold the top 5), cheap to build, December peak, and it feeds Settle Up's existing loop.
3. **Invoice template Australia no GST.** The strongest evergreen AU query among the plan's bets; no giants, but crowded by small exact match invoice sites, so expect 6 months and backlinks to matter.
4. **Is Uber One worth it (Australia).** Strong parent demand, AU skew, weak SERP of tag pages and forum threads. The page already exists; it needs a dated AU worked example.
5. **Rocket Money Australia / Subscription Finder.** Clear AU demand with no Australian answer in the SERP; bank CSV steps make the page uniquely useful.
6. **Splitwise daily limit.** Small volume but the easiest rank of all; the cap is still live in August 2026.
7. **Quote template / rent receipt (Invoice Generator).** AU specific template queries where AU depth is far below US; one H2 for quotes (already built) and a cheap receipt type.
8. **Create GPX from Google Maps + merge GPX.** Forum level SERPs; one how to section and one small mode.
9. **ATO working from home diary template / WFH calculator (Hours Log).** Strong AU demand and a weak SERP, but the payoff is July to October 2027. Build now, expect nothing until then.
10. **ATO logbook template / app (Car Logbook).** Same seasonality; Driversnote owns much of it, so aim at "template" with printable output rather than "app".

## 7. Verdict on the plan's six existing bets (PLAN-DISTRIBUTION section 4.1)

| Bet | Verdict | Reason |
|---|---|---|
| **Car Logbook: "ato logbook app free"** | **Keep, retarget and reset expectations.** | Demand is real (ato logbook AU 5/11, app 7/15, template 8/20, car log book template 7/21). But "app free" SERPs are App Store pages plus five Driversnote posts; "template" is the bigger and weaker target. Search is seasonal (July to October), so the 3 to 6 month window is off peak. Treat it as a July 2027 bet. |
| **Hours Log: "wfh fixed rate method records"** | **Keep the tool, drop that keyword.** | "wfh fixed rate method records" has *no* AU autocomplete. Use "ato working from home diary template excel" (9/42, SERP of template.net and an ATO community thread) and "work from home calculator ato" instead. Same seasonality caveat. |
| **Invoice: "invoice template australia no gst"** | **Keep; rank it first of the six.** | Top modifier of a strong AU query; no Canva/Xero at the top for the no GST variant; competition is small exact match sites. Add quote and receipt angles for adjacent AU demand. |
| **Ringtone: "make ringtone iphone without garageband"** | **Downgrade; stop content work.** | iOS 26 added "Use as Ringtone" from Files and Voice Memos for clips of 30 s or less, which removes the GarageBand pain; the SERP is Tom's Guide, AppleInsider, iPhoneLife, iGeeksBlog and Apple. Fix the tool's 40 s limit to 30 s for ringtones (the plan's blocker is now answered by multiple sources, though a real iPhone test is still wise) and leave it. |
| **Settle Up: "splitwise daily limit"** | **Keep, but it is a small win; add bigger Settle Up surfaces.** | Very weak SERP (Trustpilot, itvoice.in, a Nolt board, getfinny); modest volume. The split by nights mode and Secret Santa page carry far more seasonal demand on the same codebase. |
| **Worth It: "is uber one worth it australia"** | **Keep.** | Parent query AU 4/20; AU variant skews Australian; SERP is a Point Hacks tag page, loyaltyrewardco, forum threads and querysprout. Add a dated AU example and consider a Club Jetstar sibling calculator. |

Two additions the plan does not have and should: **Secret Santa / Kris Kringle** and **Settle Up split by nights**, both needing to be live by about 1 November.

## Sources

Autocomplete: `https://suggestqueries.google.com/complete/search?client=chrome&hl=en-AU&gl=au&q=…` and the `en-US/us` equivalent, queried 7 Oct 2026 (raw JSON in the session scratchpad, `ac/r1.json` to `r5.json`, prefix depths in `ac/depth.txt`).

- Splitwise limit: https://getfinny.app/blog/splitwise-pricing-2026 ; https://www.itvoice.in/splitwise-has-introduced-restrictions-on-the-number-of-free-expenses-users-can-add ; https://au.trustpilot.com/review/splitwise.com ; https://sharecost.nolt.io/32
- Splitwise alternatives: https://alternativeto.net/software/splitwise/ ; https://tricount.com/blog/top-splitwise-alternatives-in-india-2025-which-app-should-you-switch-to
- iOS 26 ringtones: https://www.tomsguide.com/phones/iphones/ios-26-makes-custom-iphone-ringtones-easier-than-ever-heres-how-to-do-it ; https://appleinsider.com/articles/25/06/12/custom-ringtones-are-now-slightly-easier-to-add-in-ios-26 ; https://iphonelife.com/content/make-voice-memo-ringtone ; https://support.apple.com/en-mt/120692 ; https://www.techradar.com/how-to/phone-and-communications/mobile-phones/how-to-make-a-ringtone-for-iphone-1299344
- Invoice no GST: https://sprintlaw.com.au/articles/gst-free-invoice-template-for-australian-businesses/ ; https://www.enerpize.com/templates/australian-invoice-no-gst ; https://free-invoice-template.rounded.com.au/ ; https://www.westpac.com.au/business-banking/business-help/cash-flow/invoice-template-australia/ ; https://ausinvoice.com/invoice-template-no-gst (Bing AU) ; https://abninvoice.com.au (Bing AU)
- ATO logbook: https://www.driversnote.com.au/news/ato-compliant-log-book-template ; https://www.rosterelf.com/free-bookkeeping-templates/motor-vehicle-logbook-template ; https://www.etax.com.au/claim-car-expenses-download-car-logbook/ ; https://apps.apple.com/app/id730712765 ; https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/logbook-method
- WFH: https://austax.tools/work-from-home-deductions-calculator ; https://austaxai.com.au/calculators/wfh ; https://fairworkmate.com.au/blog/working-from-home-deduction-2026-tax-return ; https://www.template.net/editable/270796/work-from-home-log-book ; https://www.etax.com.au/download-etax-resources/ ; https://community.ato.gov.au/s/question/a0JRF000001rpVF/p00314679
- Uber One / Club Jetstar: https://www.pointhacks.com.au/tag/rideshare/ ; https://loyaltyrewardco.com/riding-the-wave-of-rewards-with-uber-one/ ; https://querysprout.com/what-is-uber-one/ ; https://onemileatatime.com/guides/uber-one-membership/ ; https://www.canstar.com.au/finance-news/jetstar-launches-new-loyalty-membership/ ; https://www.australianfrequentflyer.com.au/club-jetstar ; https://executivetraveller.com/is-club-jetstar-worth-it-for-business-travellers
- Secret Santa / Kris Kringle: https://www.rankhero.com/keywords/secret-santa (301k figure) ; https://drawnames.com/kris-kringle ; https://www.elfster.com/blog/kris-kringle/ ; https://www.codeitbro.com/tool/secret-santa-generator ; https://peerpush.com/p/secret-santa-generator-noemail-nosignup ; https://grasshoppersignup.com/tools/gift-exchange-generator ; https://www.educatorstechnology.com/2022/12/the-7-best-secret-santa-generators.html
- Split by nights: https://www.ultimatefinancecalculator.com/calculators/airbnb-cost-split-calculator ; https://hacecuentas.com/en/hotel-split-cost-calculator ; https://coda.io/@evanatcoda/splitting-rentals-with-friends ; https://heartbeatapi.appbase.io/splitting-airbnb-cost-calculator (spam example)
- HEIC: https://plugintracker.io/keywords/heic and https://explodingtopics.com/topic/heic (volume figures as quoted) ; https://jasperbernaers.com/free-heic-to-jpg-converter/ ; https://aimetadatacleaner.com/image-converter/heic-to-jpg ; https://www.digitalcitizen.life/how-to-convert-heic-to-jpg-on-windows-11/ ; https://howto.reaconverter.com/?p=1910
- PDF privacy: https://www.producthunt.com/p/firmalo/firmalo ; https://www.indiehackers.com/product/signifypdf ; https://www.drawboard.com/tool/merge-pdfs ; https://thedrive.ai/blog/how-to-merge-pdf-files-without-uploading
- GPX: https://www.exploroz.com/forum/47371/convert-google-map-data-to-gpx ; https://www.starpath.com/gpx ; https://komoot.com/gpx-merge-tool-online ; https://dawarich.app/tools/gpx-merger/ ; https://bunchies.brainiumlabs.com.au/cycling-route-planner
- Subscriptions: https://subtracker.io/alternatives/rocket-money-alternative ; https://resubs.app/resources/best-rocket-money-alternatives ; https://statementdecoder-web.onrender.com/subscriptions
- Others: https://www.rosterelf.com/free-tools/payslip-generator ; https://recipesage.com/alternatives/recipe-keeper/ ; https://scanova.io/blog/qr-code-generator-free-no-expiration-guide/ ; https://boldsign.com/wifi-qr-code-generator/ ; https://studyaustralia.gov.au/en/tools-and-resources/tips-and-advice-for-students/the-international-student-s-guide-to-writing-a-great-resume-- ; https://capcut.com/resource/screen-recorder-without-watermark ; https://pureinfotech.com/whats-taking-up-space-drive-windows-11/
