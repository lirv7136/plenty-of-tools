# Plain Invoice

A standalone site for the invoice maker: free, in the browser, no account. Working name
"Plain Invoice", planned domain plaininvoice.com.au (free at the .au registry on 11 Nov 2026;
not bought). See docs/research/invoice-teardown.md for why it exists and what it competes with.

The invoice maker itself is shared with Plenty of Tools: `build.py` reads the script, styles and
PDF code from `tools/invoice-generator/`, so a fix there reaches both sites. Everything else
(page shell, pages, icons, offline worker) lives here.

## Build, preview, test

From the repository root:

```sh
python3 sites/plain-invoice/build.py              # dist/ for the real domain
PI_STAGING=1 python3 sites/plain-invoice/build.py # a copy for review: noindex everywhere
python3 -m http.server 8767 --bind 127.0.0.1 --directory sites/plain-invoice/dist
node tests/plain-invoice.browser.cjs
A11Y_DIST=sites/plain-invoice/dist A11Y_PAGES=/,/pricing/,/privacy/,/terms/,/guides/ node tests/accessibility.browser.cjs
```

## Deploy (only when Lachlan says so)

Cloudflare Pages project `plain-invoice`, domain plaininvoice.com.au. Deploy from this
directory, so `wrangler.toml` and `functions/` are picked up:

```sh
cd sites/plain-invoice
python3 build.py && npx wrangler pages deploy --branch main            # production
PI_STAGING=1 python3 build.py && npx wrangler pages deploy --branch staging   # staging.plain-invoice.pages.dev
```

## The only server side part

`functions/api/count.js` adds one to a daily total for an action (pdf, print, email, Pro page
opens). `functions/api/waitlist.js` keeps an email address for people who ask to hear when Pro
opens, and removes it on request. Both use the D1 database `plain-invoice` (schema in
`migrations/`). No ids, cookies or IP addresses are stored; the privacy page says exactly this.
Every page is still a static file: only `/api/*` runs code.

```sh
npx wrangler pages dev --port 8788          # site and endpoints locally, with a local database
TEST_URL=http://127.0.0.1:8788/ node ../../tests/plain-invoice.browser.cjs
npx wrangler d1 execute plain-invoice --remote --command "SELECT day,event,n FROM counts ORDER BY day DESC, event; SELECT feature,count(*) FROM waitlist GROUP BY feature"
```

## Pages

- `/` the invoice maker; `?start=visits` (Date column), `?start=nogst`, `?start=tax`, `?start=ndis`
- `/pricing/` Free, and Pro (not available yet, A$5 a month or A$48 a year); `/pro/` the waitlist
- `/privacy/`, `/terms/`
- `/guides/` and five search pages: NDIS, no GST, tax invoice, cleaning, tutoring

## Other countries, and spreadsheets (13 Nov 2026)

"Where is your business?" sets the currency, the tax's name and a starting rate (regions in
`core.js` REGIONS; all editable). Australia is the default and keeps ABN checks, Tax Invoice,
BSB, PayID and NDIS; elsewhere those are put away. A first visit guesses from the time zone.

`tools/invoice-generator/static/bulk.js` reads a CSV (one job per row; rows for one customer
or NDIS participant become one invoice), and writes the PDFs into one ZIP with a CSV list. It
also exports "Your invoices" as CSV. All in the browser. Tests: `tests/invoice-bulk.test.cjs`.

## Pro: sign in and sync (built 13 Nov 2026, off until `"sync": true` in site.json)

The server is the private repo `plain-invoice-pro` (a Worker on `/account/api/*`). The browser
side is here: the sign in box on the home page, `core.mergeStores` and `core.mergeHistory`, and
the sync code in `app.js`. With sync off the box is hidden and nothing calls the server.

```sh
PI_SYNC=1 python3 sites/plain-invoice/build.py     # build with the sign in box
(cd ~/dev/plain-invoice-pro && npx wrangler dev --port 8799) &
node tests/plain-invoice-sync.browser.cjs          # two browser profiles as two devices
```

## NDIS

"Who is it for?" on the home page (and `?start=ndis`, `/ndis-invoice-template/`) makes an NDIS
invoice: participant name and NDIS number, a Date and a Support item column with both required
on every line, the provider's ABN required when plan managed, No GST lines by default, and a
warning when a support is more than 90 days old (extra NDIS checks) or 2 years (the limit).
Rules read on 12 Nov 2026 from ndis.gov.au "Guide to getting paid" (saved from a real browser,
because the site refuses automated reading) and the ATO's NDIS GST page. Price limits are not
checked: that needs the NDIS support catalogue as a data file, refreshed each year.
