# Spec: two ATO record keeping tools (29 September 2026)

Written first as a Codex brief; Lachlan chose to have Claude build both instead, and they were
built from this spec on 30 September (`tools/car-logbook/`, `tools/hours-log/`, each with a
README recording what was verified and what v1 leaves out). Kept as the record of the
requirements. Read `docs/PLAN-ENGAGEMENT-2026-Q4.md` for why these two come first: they are
Australian, required by law, searched for as "template" or "spreadsheet" (so a working tool
beats a static Excel file), and used daily, which is the repeat use the site lacks. The car
logbook also tests, cheaply, whether a native logbook app is worth building in January.

Build them in this order: **A. Car Logbook**, then **B. Hours Log**. Each is its own tool
folder, its own `tools.json` entry and its own `vs/` page.

## What else is moving in the tree

Nothing of Claude's is in flight in `build.py`, `shell/` or `tools.json` this week, but re-read
any shared file immediately before you patch it, and patch it, never rewrite it. Since
26 September:

- `build.py` has a `GROUPS` dict for the "More free tools" block under each tool. Add both new
  slugs to the `"money"` group (next to `invoice-generator`).
- Every tool page gets JSON-LD and a share card automatically. After adding the tools, run
  `python3 scripts/og_cards.py car-logbook hours-log` (needs Inkscape) to render their cards
  into `shell/og/`.
- Tool H1s that are not literally the searched phrase carry a keyword line:
  `<h1><span class="eyebrow">Free ATO car logbook</span>…</h1>`. Use the pattern.
- The browser tests expect the built site served on port 8765:
  `python3 -m http.server 8765 --directory dist`. Privacy tests must ignore the page view
  counter (`/^https:\/\/(static\.)?cloudflareinsights\.com\//`) and the shell's own URLs
  (`/sw.js`, `/offline-manifest.json`, `/manifest.webmanifest`, `/favicon.ico`, `/icons/`).

## Standing rules (unchanged)

- Personal accounts only. Never CIM Enviro accounts, infrastructure or connectors.
- Browser only. No server, no uploads, no run time third party scripts. Vendor any library into
  the tool folder with its licence and a line in `vendor-manifest.json`.
- Every tool ships `meta.json`, an `index.html` fragment, `tool.css`, `app.js`, pure logic in
  `static/core.js`, `tests/<slug>.test.cjs`, a browser test `tests/<slug>.browser.cjs`, a
  `README.md`, and a fair `vs/<incumbent>.json` that says plainly when paying is the right call.
- Add both to `tools.json` as `"status": "hidden"` first; Claude or Lachlan flips them live after
  a review. Opt both into `"offline": true`: they are small and people use them in the car or at
  home without thinking about a connection.
- **Commit nothing.** Lachlan commits when he asks.
- Verify every price and free tier limit on the incumbent's own page, and put the review month in
  the `vs/` JSON. Verify every ATO rule on ato.gov.au (it blocks scripted fetches; read it in a
  browser) and link the page you relied on from the tool.
- No hyphens in compound modifiers in anything a person will read.
- Validate anything read from local storage or an imported file in `core.js` before the page
  sees it, and escape every value that lands in HTML.
- Test numeric code at both ends of every stated range and across income year boundaries.

## The honest framing both pages must carry

The ATO's own **myDeductions** (inside the ATO app) is free and does car trips, hours and
receipts. Do not pretend otherwise. Our angle is: works on a laptop or desktop as well as a
phone, nothing to install, no myGov sign in, a print ready report for a tax agent, and CSV and
backup files the user owns. Each tool page and `vs/` page says this in one or two sentences with
a link to myDeductions. Neither tool gives tax advice; each says "this helps you keep the records
the ATO asks for; your tax agent or the ATO decides what you can claim", and links the ATO page.

---

## A. Car Logbook: `tools/car-logbook/`

**Search targets.** "ato logbook app free", "ato car logbook template", "ato logbook
requirements", "car logbook australia free". Title along the lines of *"Free ATO car logbook:
12 week logbook with business use percentage, no app or account"* (keep it under about 65
characters in `meta.json`; move the rest to the description).

**Incumbent and `vs/` page.** `vs/driversnote.json`. Our research on 29 September found the
Driversnote free plan limits reports to 15 trips a month; confirm that and the paid price on
driversnote.com.au before writing it. Mention TripLog (free basic tier) and myDeductions fairly.
When paying makes sense: automatic trip detection by GPS in the background, which a web page
cannot do.

**ATO rules the tool is built around** (logbook method, checked 29 Sep 2026; link
https://www.ato.gov.au/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/logbook-method
and the individuals' equivalent):

- The logbook covers **at least 12 continuous weeks**, representative of the year's travel.
- It records **odometer readings at the start and end of the logbook period** and the **total
  kilometres travelled in the period**.
- For **each work journey**: the reason or purpose and destination, the odometer reading at the
  start and end, and the kilometres travelled. Two or more journeys in a row on the same day may
  be recorded as one journey.
- Entries are made **at the end of the journey or as soon as possible afterwards**.
- **Business use percentage** = business kilometres ÷ total kilometres in the period.
- A logbook is **valid for five years**; in later years the person keeps odometer readings for
  the start and end of each income year. A new logbook can be started any time.

**v1 scope**

1. **Car and period setup.** Name or registration, make and model (optional), logbook start
   date, odometer at start. Several cars allowed, one active.
2. **Add a trip in seconds.** Date (today by default), start odometer (defaults to the last trip's
   end reading), end odometer, business or private, purpose and destination (required for
   business). Kilometres computed. **Saved favourite trips** ("Office ↔ Site A") fill purpose,
   destination and typical distance with one tap. Option to merge consecutive same day
   journeys.
3. **Record the time each entry was made.** Store `createdAt` on every trip and show it in the
   report ("entered 3 Oct 5:42 pm"). Flag, without blocking, any trip entered more than 7 days
   after its date ("added later"): the ATO expects entries at the time, and it is kinder to say
   so now than at tax time.
4. **Period panel.** Days elapsed out of 84, with a clear "12 continuous weeks reached" state;
   total km from the odometer (end minus start), business km, private km, **business use %** to
   one decimal place; a warning if trip odometer readings overlap or leave gaps, or if the period
   is under 12 weeks.
5. **Later years.** After the period ends, a small "odometer at 1 July / 30 June" record per income
   year and a note of when the logbook expires (5 years).
6. **Report.** Print or save as PDF (`window.print`, `@page` A4), laid out for a tax agent: car,
   period, start and end odometer, table of journeys with the entry times, totals and business
   use %. CSV export of trips. JSON backup and restore (validated; refuse corrupt files
   visibly).
7. Storage in `localStorage` or IndexedDB with visible autosave status and the storage error
   case handled. A "try an example" button that loads a realistic 12 week sample.

**Out of scope for v1:** GPS tracking (a web page stops when the phone locks, so we say so
plainly and point at myDeductions or a GPS app for automatic tracking), fuel and expense
receipts, cents per km method calculator (could be a later small addition).

**Tests.** Business use % including zero trips, all business and all private; 84 day boundary
(day 83, 84, 85) across a daylight saving change and across 30 June; odometer overlap and gap
detection; favourite trip fill; merge of same day journeys; "added later" flag at exactly 7 and
8 days; backup round trip and corrupt file refusal; browser test that adds trips, prints the
report layout and survives a reload offline.

---

## B. Hours Log: `tools/hours-log/`

**Search targets.** "work from home hours spreadsheet", "work from home hours calculator ato",
"timesheet calculator", "timesheet template australia". One tool, one page; do **not** make
separate near duplicate landing pages for WFH and timesheets (Google's 2023 to 2024 updates hit
thin duplicate calculator pages across whole sites). Title along the lines of *"Free work from
home hours log and timesheet for the ATO fixed rate method"*.

**Incumbent and `vs/` page.** `vs/timesheet-apps.json` comparing paid time trackers (confirm
current prices on each site: Toggl Track, Harvest, Clockify's paid tiers) and noting Clockify's
free tier and myDeductions honestly. When paying makes sense: team timesheets, approvals,
payroll integration.

**ATO rules the tool is built around** (fixed rate method, read on ato.gov.au 29 Sep 2026;
link https://www.ato.gov.au/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method):

- Rate per work hour: **52 cents** for 2020 to 21 and 2021 to 22; **67 cents** for 2022 to 23
  and 2023 to 24; **70 cents** for 2024 to 25 and 2025 to 26. **No rate is published yet for
  2026 to 27**: use 70 cents provisionally, label it "provisional until the ATO confirms the
  2026 to 27 rate" everywhere it appears (screen and report), and keep the table in one place
  in `core.js` so a later change is one line.
- The deduction is total hours × rate with **the cents disregarded, not rounded** (floor to
  whole dollars). The ATO's own worked example: 136 h × 70c = $95.20, claimed as $95.
- The record must cover the **total hours worked from home for the entire income year**, kept
  **at the time** (timesheet, roster, diary, a spreadsheet of start and finish times, a calendar
  log). **Estimates and a 4 week representative diary are not accepted** since 1 March 2023.
- The rate covers energy, internet, phone, stationery and computer consumables; other expenses
  (for example depreciation of a desk or laptop) are claimed separately with their own records.
  Keep records for 5 years.

**v1 scope**

1. **Start and stop timer** plus manual entries: date, start, finish, unpaid breaks, place
   (home, workplace, other), and an optional client or employer label and note.
2. **Store `createdAt` on each entry**, and flag entries created after the day they describe
   ("added later"), because only records kept at the time are acceptable. Never hide or block
   them; just be honest in the screen and the report.
3. **Income year view** (1 July to 30 June, Australian), week and month summaries, total hours
   from home, and the fixed rate deduction estimate with the rate for that year and the
   provisional label when relevant.
4. **Timesheet view.** Hours by week and by client, with an hourly rate per client, and a
   "copy as invoice lines" action producing CSV the Invoice Generator can take (or a simple
   documented format; do not couple the two tools' storage).
5. **Exports.** Print or PDF report for the year (for a tax agent) and for a week (a timesheet to
   send), CSV of entries, JSON backup and validated restore.
6. Autosave with visible status, storage failure handling, "try an example" sample data.

**Tests.** Rate table per year, including the 30 June to 1 July boundary and the provisional
year; cents disregarded (e.g. 136 h → $95, 135.99 h → $95, 0 h → $0); breaks longer than the
shift refused; entries crossing midnight; timer running across midnight and across a daylight
saving change; "added later" flag; per client totals; CSV and backup round trips; browser test
that runs the timer, adds manual entries, prints the year report and works offline after a
reload.

---

## Definition of done for each tool

- Unit and browser tests pass; `node tests/accessibility.browser.cjs` and
  `node tests/offline.browser.cjs` still pass with the tool built.
- README lists the ATO pages relied on and the date they were read, and every limit of v1.
- `vs/` page written with verified prices and the myDeductions paragraph.
- Left as `hidden`, uncommitted, with a short note at the end of `docs/STATUS.md` saying what was
  built and what a human should try before it goes live.
