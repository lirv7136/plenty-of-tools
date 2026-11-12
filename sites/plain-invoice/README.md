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

- `/` the invoice maker; `?start=visits` (Date column), `?start=nogst`, `?start=tax`
- `/pricing/` Free, and Pro (not available yet, A$5 a month or A$48 a year)
- `/privacy/`, `/terms/`
- `/guides/` and four search pages: no GST, tax invoice, cleaning, tutoring

The NDIS layout is not built yet: the NDIS rules must be read on ndis.gov.au by hand first
(the site refuses automated reading).
