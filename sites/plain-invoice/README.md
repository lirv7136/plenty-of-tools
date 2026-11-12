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

Its own Cloudflare Pages project, `plain-invoice`, not yet created:

```sh
npx wrangler pages project create plain-invoice --production-branch main
PI_STAGING=1 python3 sites/plain-invoice/build.py
npx wrangler pages deploy sites/plain-invoice/dist --project-name plain-invoice --branch staging
```

Before the real launch: buy the domain, attach it to the project, set `redirect_pages_dev: true`
and a Cloudflare Web Analytics token in `site.json` (the privacy page text follows the token),
then build without PI_STAGING and deploy to `main`.

## Pages

- `/` the invoice maker; `?start=visits` (Date column), `?start=nogst`, `?start=tax`, `?start=ndis`
- `/pricing/` Free, and Pro (not available yet, A$5 a month or A$48 a year)
- `/privacy/`, `/terms/`
- `/guides/` and five search pages: NDIS, no GST, tax invoice, cleaning, tutoring

## NDIS

"Who is it for?" on the home page (and `?start=ndis`, `/ndis-invoice-template/`) makes an NDIS
invoice: participant name and NDIS number, a Date and a Support item column with both required
on every line, the provider's ABN required when plan managed, No GST lines by default, and a
warning when a support is more than 90 days old (extra NDIS checks) or 2 years (the limit).
Rules read on 12 Nov 2026 from ndis.gov.au "Guide to getting paid" (saved from a real browser,
because the site refuses automated reading) and the ATO's NDIS GST page. Price limits are not
checked: that needs the NDIS support catalogue as a data file, refreshed each year.
