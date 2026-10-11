# UV Index Now (#21)

Live UV readings for Australian cities at `/tools/uv-index/`. Built 7 October 2026, **hidden**
and **not committed**.

- `static/core.js` (pure, `tests/uv-index.test.cjs`): parses ARPANSA's XML feed, skips
  malformed or impossible readings, WHO categories, advice (sun protection from UV 3, per
  Cancer Council Australia), staleness after 30 minutes.
- `app.js`: fetches the feed directly from the browser, picks a default city from the time
  zone, remembers the choice in localStorage, refreshes every 5 minutes while visible, keeps
  the last reading if a refresh fails.

## No server needed (correcting SLATE2)

SLATE2 assumed the feed needed a CORS proxy. It doesn't: on 7 Oct 2026
`https://uvdata.arpansa.gov.au/xml/uvvalues.xml` answered with
`Access-Control-Allow-Origin: *`. The browser fetches it directly; nothing of ours sits in
between. If ARPANSA ever drops that header the tool says it can't reach the feed.

## Licence and attribution

ARPANSA publishes the UV data under Creative Commons Attribution 2.5 Australia (data.gov.au
listing), with a disclaimer that it isn't a substitute for health advice. The page credits
ARPANSA, links the licence and paraphrases the disclaimer. **Before going live, check the exact
attribution wording on ARPANSA's developer page** (it timed out from here):
https://www.arpansa.gov.au/services/monitoring/ultraviolet-radiation-monitoring/ultraviolet-radation-data-information
— it may also ask developers to limit polling; the tool polls once per 5 minutes per open tab.

## Validation

`node tests/uv-index.browser.cjs` intercepts the feed over CDP and serves
`tests/fixtures/arpansa-uvvalues.xml` (a real capture) edited to daytime values: default city
from the time zone, reading, colour, advice, every station, stale marking, switching and
remembering a city, and a failed refresh. Passes. Also checked against the live feed at
phone width.

Not built: forecasts or "sun protection times" for the day. The live feed has no forecast;
that would need ARPANSA's or BOM's forecast data and its own terms.
