# Subscription Finder — slate #2

Browser-only bank CSV analysis at `/tools/subscription-finder/`, integrated with
the existing Plenty of Tools shell. Registry status `live` means included in
the static build; it does not mean deployed. The comparison page is
`/vs/rocket-money/`.

## Run locally

From the repository root:

```sh
python3 build.py
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open http://127.0.0.1:8765/tools/subscription-finder/ and select **Try an example**
or open a bank export. No dependencies or build-time package downloads.

## Behaviour

- Reads comma, semicolon and tab-separated text, quoted fields, BOM and CRLF.
- Guesses common column headers; supports manual mapping and headerless exports.
- Supports negative or positive spending and separate debit columns. Empty debit
  cells count as non-spending rows. Income rows still inform the statement range.
- Parses explicit AU/UK or US date order, ISO dates, and `03 Sep 2026` dates.
  Amounts use decimal points, optional thousands commas and common currency symbols.
- Conservatively normalises merchant descriptions and common transaction references.
- Requires at least two similar payments with consistent weekly, fortnightly,
  monthly, quarterly or yearly gaps. Three or more consistent charges provide
  stronger evidence. Uses the latest payment to estimate annual/monthly cost.
- Shows original transactions and amount changes. Marks older patterns relative
  to the statement end and excludes them from totals by default.
- Exports only checked candidates, with currency and evidence in the CSV.
  Escapes CSV fields and guards against spreadsheet formula interpretation.
- Stores transaction data in tab memory only. Clear, reload or close to remove it.
  No fetch calls, remote dependencies, cookies or browser storage in the tool.
  The shared shell can separately enable site analytics via `site.json`.

## Limits

One account and currency per file; selecting currency only changes display.
Up to 10 MB / 100,000 transactions. Decimal-comma exports must be converted first.
Metadata/preamble rows should be removed before importing. Malformed-width rows,
unreadable dates and invalid amounts are reported as skipped. Exact duplicates
are counted once, which can also collapse genuine identical same-day payments.

These are recurring-payment candidates, not verified subscriptions. Regular bills
or shopping may match. Missing months, highly variable costs, multiple plans with
one merchant description, renamed merchants and one-off annual renewals may be
missed. No bank connection, live monitoring, automatic cancellation or currency
conversion. Next expected dates are estimates after the last observed charge,
not promises about future debits.

## Verification

```sh
node tests/subscription-finder.test.cjs
# With the local server above running and Chrome installed:
node tests/subscription-finder.browser.cjs
```

The browser test uses Chrome's debugging pipe without an npm dependency. Set
`CHROME_BIN` or `TEST_URL` to override defaults. It tests example totals, included
payments, actual report download, mobile overflow, clear, file upload, untrusted
HTML rendering, malformed input and absence of transaction network/storage writes.
Screenshots and the downloaded sample report are written to a temporary directory.

## Positioning

Rocket Money already includes subscription tracking in its free tier. The
comparison page links its official documentation; this tool's distinction is
local CSV processing without an account or linked bank. No paid-plan pricing is
assumed. The CV builder and shared build/shell remain owned by the parallel work.
