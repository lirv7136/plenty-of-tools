# Hours Log

A work from home hours log for the ATO fixed rate method, plus a timesheet by client, in the
browser. `/tools/hours-log/`, compared with paid time trackers at `/vs/timesheet-apps/`. Built by
Claude, 30 September 2026. Status `hidden` until a person has tried it.

## ATO rules it is built around

Read on ato.gov.au on 29 September 2026: the fixed rate method page
(`/individuals-and-families/income-deductions-offsets-and-records/deductions-you-can-claim/work-related-deductions/working-from-home-expenses/fixed-rate-method`).
ato.gov.au refuses scripted fetches; read it in a browser.

- Rates in `RATES` (one place): 52c for 2020–21 and 2021–22, 67c for 2022–23 and 2023–24, 70c
  for 2024–25 and 2025–26. **No rate was published for 2026–27**, so `rateFor` returns the latest
  rate with `provisional: true`, and the page and the printed report say "provisional". When the
  ATO publishes the 2026–27 rate, add it to `RATES` and the label disappears by itself.
- Deduction = hours at home × rate, cents disregarded, not rounded. Worked in integer minutes ×
  cents (`Math.floor(minutes × cents / 6000)`) so no float error can move a dollar boundary.
  The ATO's example, 136 h × 70c = $95.20 → $95, is a unit test.
- The record covers the whole income year (1 July to 30 June) and must be kept at the time. Every
  entry stores `createdAt`; `isLate` marks entries made after the day they describe (an overnight
  shift gets one day). Editing keeps the original `createdAt`.
- Only hours at home count towards the fixed rate; workplace and other hours appear in the totals
  and the timesheet.

## Data

`localStorage` key `pot:hours-log:v1`: `{ v, entries, rates, timer }`. An entry is a date, a
start and a finish on the local clock and unpaid break minutes; a finish at or before the start
runs past midnight, and minutes are measured between real moments, so a shift over a daylight
saving change is an hour shorter or longer. The timer stores only its start moment, so it keeps
running across reloads and closed tabs, and refuses to save under a minute or over 24 hours.
Everything goes through `HoursCore.validate`; everything reaches the page through
`textContent`. Backups carry `app: "plentyoftools hours-log"` and a version.

"Copy invoice lines" writes one line per client (description, hours, hourly rate) to the
clipboard, or saves a CSV if the clipboard is refused. It does not touch the Invoice Generator's
storage.

## Limits of v1

- No reminders when the page is closed, and no sync between devices (use a backup file).
- No record of the running expenses themselves (one bill of each type), which the ATO also asks
  for, and no actual cost method.

## Tests

- `tests/hours-log.test.cjs`: 11 tests covering every published rate and the provisional year,
  cents disregarded at and around dollar boundaries, the 30 June to 1 July boundary, home versus
  other hours, breaks, overnight shifts, daylight saving (checked when the test runs in an
  Australian eastern zone), validation, the late flag with overnight grace, the timer, weekly and
  per client totals, invoice lines, backup round trip and refusal, and CSV escaping.
- `tests/hours-log.browser.cjs`: entries, refusals, overnight workplace hours, the provisional
  label, client rates, the timer across a reload, markup shown as text, both print layouts, a
  refused damaged backup, 390 px layout, and no requests leaving the site.

## Before it goes live

Log a real week, including the timer, print the year report and a timesheet, and check the
2026–27 rate on ato.gov.au in case it has been published.
