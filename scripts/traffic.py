#!/usr/bin/env python3
"""Real visits from Cloudflare Web Analytics, by day, page, referrer and country.

    python3 scripts/traffic.py            # last 7 days
    python3 scripts/traffic.py 28         # last 28 days
    python3 scripts/traffic.py 2026-10-01 2026-10-08

Uses wrangler's OAuth token (run `npx wrangler whoami` first if it has expired: a 401 means that).
Notes that cost a week to learn: filter on the siteTag below, not the beacon token in site.json;
the RUM dataset only answers windows of a day or less, so it is queried day by day; days are UTC.
Only real browsers run the beacon, so these numbers are far below the zone's request counts,
which are mostly scanners. Stdlib only.
"""
import collections, datetime as dt, json, re, sys, urllib.error, urllib.request
from pathlib import Path

ACCOUNT = "5e0f03f73cfa3e8ae2053605f57409d6"
SITE_TAG = "e2e4102c2f1848a2984c56adf6d3449e"

def token():
    cfg = Path.home() / ".config/.wrangler/config/default.toml"
    m = re.search(r'oauth_token\s*=\s*"([^"]+)"', cfg.read_text())
    if not m:
        sys.exit("No wrangler token. Run: npx wrangler login")
    return m.group(1)

def day(tok, d):
    a, b = d.isoformat() + "T00:00:00Z", (d + dt.timedelta(days=1)).isoformat() + "T00:00:00Z"
    q = ('{ viewer { accounts(filter:{accountTag:"%s"}) { rumPageloadEventsAdaptiveGroups(limit:500, '
         'filter:{datetime_geq:"%s", datetime_lt:"%s", siteTag:"%s"}) { count sum { visits } '
         'dimensions { requestPath refererHost countryName } } } } }') % (ACCOUNT, a, b, SITE_TAG)
    req = urllib.request.Request("https://api.cloudflare.com/client/v4/graphql", json.dumps({"query": q}).encode(),
                                 {"Authorization": "Bearer " + tok, "Content-Type": "application/json"})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=30))
    except urllib.error.HTTPError as e:
        sys.exit(f"Cloudflare said {e.code}. A 401 means the token expired: run `npx wrangler whoami` and try again.")
    if data.get("errors"):
        sys.exit(data["errors"])
    return data["data"]["viewer"]["accounts"][0]["rumPageloadEventsAdaptiveGroups"]

def main(argv):
    today = dt.datetime.now(dt.timezone.utc).date()
    if len(argv) == 2:
        start, end = dt.date.fromisoformat(argv[0]), dt.date.fromisoformat(argv[1])
    else:
        n = int(argv[0]) if argv else 7
        start, end = today - dt.timedelta(days=n - 1), today + dt.timedelta(days=1)
    tok = token()
    paths, refs, countries = collections.Counter(), collections.Counter(), collections.Counter()
    loads = visits = 0
    print(f"Real pageloads, {start} to {end - dt.timedelta(days=1)} (UTC days)\n")
    d = start
    while d < end:
        rows = day(tok, d)
        l, v = sum(r["count"] for r in rows), sum(r["sum"]["visits"] for r in rows)
        loads += l; visits += v
        print(f"  {d}  {l:5d} loads  {v:5d} visits")
        for r in rows:
            m = r["dimensions"]
            paths[m["requestPath"]] += r["count"]
            refs[m["refererHost"] or "(none)"] += r["count"]
            countries[m["countryName"] or "?"] += r["count"]
        d += dt.timedelta(days=1)
    print(f"\n  total {loads} loads, {visits} visits\n")
    for title, c in (("Pages", paths), ("Referrers", refs), ("Countries", countries)):
        print(title)
        for k, n in c.most_common(15):
            print(f"  {n:5d}  {k}")
        print()

if __name__ == "__main__":
    main(sys.argv[1:])
