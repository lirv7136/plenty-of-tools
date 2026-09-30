# Car Logbook

The 12 week car logbook the ATO asks for, in the browser. `/tools/car-logbook/`, compared with
Driversnote at `/vs/driversnote/`. Built by Claude, 30 September 2026. Status `hidden` until a
person has tried it; flip to `live` in `tools.json`.

## ATO rules it is built around

Read on ato.gov.au on 29 September 2026: the logbook method page for businesses
(`/businesses-and-organisations/income-deductions-and-concessions/income-and-deductions-for-business/deductions/deductions-for-motor-vehicle-expenses/logbook-method`)
and the individuals' car expense pages. ato.gov.au refuses scripted fetches; read it in a browser.

- At least 12 continuous weeks, representative of the year (`PERIOD_DAYS = 84`, day 84 counts).
- Odometer at the start and end of the period, and total kilometres for the period.
- Each work journey: purpose, destination, start and end odometer, kilometres. Consecutive
  journeys on the same day may be one entry (`mergeSameDay`, only where one ends exactly where
  the next starts, work trips only, never changing the work kilometres).
- Entries at the end of the journey or as soon as possible afterwards. Every trip stores
  `createdAt`; `isLate` marks entries made more than 7 days after the trip (7 is fine, 8 is not).
  Editing a trip keeps its original `createdAt`.
- Business use % = work km ÷ total km, one decimal place. Total km comes from the closing
  odometer when the period is closed, otherwise from the highest reading so far. Gaps between
  trips are private driving and are not flagged.
- Valid for five years: the income year the logbook starts in plus four (`validUntil`). Later
  years record the 1 July and 30 June readings per income year.

## Data

`localStorage` key `pot:car-logbook:v1`: `{ v, cars, trips, favourites, activeCar }`. Every
load, restore and save goes through `LogbookCore.validate`, which checks ids against
`[A-Za-z0-9_-]`, lengths, readings, dates and that every trip belongs to a car. Everything
reaches the page through `textContent`. Backup files carry `app: "plentyoftools car-logbook"`
and a version; a newer version is refused rather than misread. CSV prefixes cells that start
with `= + - @` with an apostrophe so a spreadsheet will not run them.

## Limits of v1

- No GPS or automatic trip detection: a web page stops when the phone locks. The page says so
  and points at myDeductions and paid apps.
- No fuel, servicing or receipts, and no cents per kilometre calculator.
- One device at a time; moving devices means a backup file.

## Tests

- `tests/car-logbook.test.cjs`: 14 tests covering income year and daylight saving boundaries,
  day 83/84/85, business use at 0%, 100%, mixed and no driving, overlaps versus gaps, trips outside
  the period, the late flag at 7 and 8 days, merging, validity, backup round trip and refusal
  (including markup in an id), and CSV escaping.
- `tests/car-logbook.browser.cjs`: start a logbook, refuse a work trip without a purpose, add
  work and private trips, favourites, markup shown as text, reload, the example, the print
  layout, a refused damaged backup, 390 px layout, and no requests leaving the site.

## Before it goes live

Keep a real week of trips on a phone (add it to the home screen), print the report and check it
reads well to a tax agent, then flip `status` to `live`.
