#!/usr/bin/env python3
"""Real visits to plentyoftools.io, from two Cloudflare sources side by side.

    python3 scripts/traffic.py            # last 7 days
    python3 scripts/traffic.py 28         # last 28 days
    python3 scripts/traffic.py 2026-10-01 2026-10-08

1. **Edge page loads** (the main number). Every HTML page the edge served with a 200 to a real
   browser, from the zone's own request log. Nothing in the browser can block it. Bots, crawlers,
   headless browsers, curl and unidentified agents (mostly scanners) are dropped by user agent.
2. **Web Analytics (RUM)**: the beacon script. It gives referrers, but Safari's and Edge's
   tracking protection block it, and at this volume Cloudflare samples it (counts come in tens).
   On 24 Oct 2026 the edge showed about 25 Safari, iPhone and Edge loads of the invoice generator
   in Australia that RUM never saw. Use RUM for referrers, the edge for how many.

Two corrections to the edge count. The service worker, when it installs (first visit, and again
after every deploy), fetches every page in the offline precache at once; each install also
fetches /offline. So on each day, every precached page loses one load per /offline fetch, and
/offline itself is dropped. And some scanners send a Chrome user agent, which no filter on the
agent can catch, so the edge figure is an upper bound and RUM a lower bound.

Uses wrangler's OAuth token (run `npx wrangler whoami` first if it has expired: a 401 means that).
Both datasets only answer windows of a day or less, so each day is a query (two per day); the
GraphQL API has a rate limit, so do not run 90 days twice in a row. Days are UTC. Filter RUM on
the siteTag below, not the beacon token in site.json. Stdlib only.
"""
import collections, datetime as dt, json, re, sys, time, urllib.error, urllib.request
from pathlib import Path

ACCOUNT = "5e0f03f73cfa3e8ae2053605f57409d6"
SITE_TAG = "e2e4102c2f1848a2984c56adf6d3449e"
ZONE = "cee8ae15efbb3c0546cf9488d74cfd35"   # plentyoftools.io
NOT_A_PERSON = re.compile(r"headless|curl|bot|spider|crawl|unknown|python|wget|go-http|java|okhttp|preview|facebook|slurp|lighthouse", re.I)

def token():
    cfg = Path.home() / ".config/.wrangler/config/default.toml"
    m = re.search(r'oauth_token\s*=\s*"([^"]+)"', cfg.read_text())
    if not m:
        sys.exit("No wrangler token. Run: npx wrangler login")
    return m.group(1)

def gql(tok, q):
    req = urllib.request.Request("https://api.cloudflare.com/client/v4/graphql", json.dumps({"query": q}).encode(),
                                 {"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    for attempt in range(3):
        try:
            data = json.load(urllib.request.urlopen(req, timeout=40))
            break
        except urllib.error.HTTPError as e:
            sys.exit(f"Cloudflare said {e.code}. A 401 means the token expired: run `npx wrangler whoami` and try again.")
        except (urllib.error.URLError, TimeoutError, OSError):
            if attempt == 2:
                sys.exit("Cloudflare's analytics API did not answer three times. Wait a few minutes and run it again.")
            time.sleep(10 * (attempt + 1))
    if data.get("errors"):
        msg = data["errors"][0].get("message", "")
        sys.exit("Cloudflare: " + msg + (" (wait five minutes)" if "rate limit" in msg.lower() or "budget" in msg.lower() else ""))
    return data["data"]

def window(d):
    return d.isoformat() + "T00:00:00Z", (d + dt.timedelta(days=1)).isoformat() + "T00:00:00Z"

def edge_day(tok, d):
    a, b = window(d)
    q = ('{ viewer { zones(filter:{zoneTag:"%s"}) { httpRequestsAdaptiveGroups(limit:1000, filter:{datetime_geq:"%s", datetime_lt:"%s", '
         'requestSource:"eyeball", edgeResponseStatus:200, edgeResponseContentTypeName:"html"}) { count '
         'dimensions { clientRequestPath userAgentBrowser clientCountryName } } } } }') % (ZONE, a, b)
    rows = gql(tok, q)["viewer"]["zones"][0]["httpRequestsAdaptiveGroups"]
    return [r for r in rows if not NOT_A_PERSON.search(r["dimensions"]["userAgentBrowser"] or "unknown")]

def precached_pages():
    """Pages the live service worker precaches, from the deployed offline manifest."""
    try:
        with urllib.request.urlopen("https://plentyoftools.io/offline-manifest.json", timeout=20) as r:
            return set(json.load(r)["pages"])
    except Exception:
        return set()

def without_precache(rows, precached):
    """Take one load off each precached page per service worker install that day."""
    installs = sum(r["count"] for r in rows if r["dimensions"]["clientRequestPath"] == "/offline")
    by_path = collections.defaultdict(list)
    for r in rows:
        by_path[r["dimensions"]["clientRequestPath"]].append(r)
    out = []
    for path, group in by_path.items():
        if path == "/offline":
            continue
        remove = installs if path in precached else 0
        for r in sorted(group, key=lambda r: -r["count"]):          # take from the biggest rows first
            keep = max(0, r["count"] - remove); remove -= r["count"] - keep
            if keep:
                out.append({**r, "count": keep})
    return out, installs

def rum_day(tok, d):
    a, b = window(d)
    q = ('{ viewer { accounts(filter:{accountTag:"%s"}) { rumPageloadEventsAdaptiveGroups(limit:500, '
         'filter:{datetime_geq:"%s", datetime_lt:"%s", siteTag:"%s"}) { count sum { visits } '
         'dimensions { requestPath refererHost countryName } } } } }') % (ACCOUNT, a, b, SITE_TAG)
    return gql(tok, q)["viewer"]["accounts"][0]["rumPageloadEventsAdaptiveGroups"]

def top(title, counter, n=15):
    print(title)
    for k, v in counter.most_common(n):
        print(f"  {v:5d}  {k}")
    print()

def main(argv):
    today = dt.datetime.now(dt.timezone.utc).date()
    if len(argv) == 2:
        start, end = dt.date.fromisoformat(argv[0]), dt.date.fromisoformat(argv[1])
    else:
        n = int(argv[0]) if argv else 7
        start, end = today - dt.timedelta(days=n - 1), today + dt.timedelta(days=1)
    tok = token()
    precached = precached_pages()
    installs_total = 0
    e_paths, e_browsers, e_countries = collections.Counter(), collections.Counter(), collections.Counter()
    r_paths, r_refs = collections.Counter(), collections.Counter()
    e_total = r_total = 0
    print(f"plentyoftools.io, {start} to {end - dt.timedelta(days=1)} (UTC days)\n")
    print("  day          edge page loads   RUM loads")
    d = start
    while d < end:
        edge, installs = without_precache(edge_day(tok, d), precached)
        installs_total += installs
        rum = rum_day(tok, d)
        el, rl = sum(r["count"] for r in edge), sum(r["count"] for r in rum)
        e_total += el; r_total += rl
        print(f"  {d}   {el:8d}         {rl:6d}")
        for r in edge:
            m = r["dimensions"]
            e_paths[m["clientRequestPath"]] += r["count"]
            e_browsers[m["userAgentBrowser"]] += r["count"]
            e_countries[m["clientCountryName"] or "?"] += r["count"]
        for r in rum:
            m = r["dimensions"]
            r_paths[m["requestPath"]] += r["count"]
            r_refs[m["refererHost"] or "(none)"] += r["count"]
        d += dt.timedelta(days=1)
    print(f"\n  total: {e_total} edge page loads from real browsers (after removing {installs_total} offline cache installs); {r_total} seen by RUM\n")
    top("Pages (edge)", e_paths)
    top("Browsers (edge)", e_browsers, 10)
    top("Countries (edge)", e_countries, 10)
    top("Referrers (RUM only; blocked browsers are missing)", r_refs, 10)

if __name__ == "__main__":
    main(sys.argv[1:])
