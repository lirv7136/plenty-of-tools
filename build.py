#!/usr/bin/env python3
"""Assemble dist/ from shell/ + tools/ + vs/. Stdlib only.

Each tools/<slug>/ holds meta.json (title, description), index.html (a <main>
fragment) and optional tool.css / app.js which are copied alongside. Each
vs/<name>.json renders to /vs/<name>/. The home page lists tools.json.
"""
import json, shutil, html, hashlib, re, subprocess
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
SITE = json.loads((ROOT / "site.json").read_text())
TOOLS = json.loads((ROOT / "tools.json").read_text())

def ver(p):
    """Short content hash for cache busting asset URLs (the zone caches /assets/* for 4 h)."""
    return hashlib.sha1(Path(p).read_bytes()).hexdigest()[:8]

SHELL_V = None

def tpl(name):
    return (ROOT / "shell" / name).read_text()

def fill(template, **kw):
    out = template
    for k, v in kw.items():
        out = out.replace("{{" + k + "}}", str(v))
    return out

def analytics_tag():
    """Cloudflare's own snippet, verbatim apart from the token: a module script, which is deferred
    by definition. Cookieless, page views only, and it runs in real browsers rather than in the
    scanners that dominate the edge request counts. Declared on /privacy/."""
    if not SITE.get("cf_analytics_token"):
        return ""
    return ('<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" '
            f'data-cf-beacon=\'{{"token": "{SITE["cf_analytics_token"]}"}}\'></script>')

# Related tools shown under each tool page, nearest first. A tool missing from here still gets
# related links, just from the whole list. Kept here rather than in tools.json so that file stays
# as Codex writes it.
GROUPS = {
    "documents": ["pdf-tools", "pdf-sign", "invoice-generator", "cv-builder", "image-converter"],
    "money": ["settle-up", "subscription-finder", "worth-it-calculators", "invoice-generator"],
    "audio and video": ["ringtone-maker", "transcription", "read-aloud", "screen-recorder", "tuner-metronome"],
    "images": ["background-remover", "image-converter", "qr-codes", "pdf-tools"],
    "everyday": ["habit-tracker", "recipe-keeper", "gpx-route-builder", "disk-analyser", "qr-codes"],
}

def related(slug, live, n=4):
    """Up to n other live tools: same group first, in group order, then the rest of the list."""
    picked = []
    for members in GROUPS.values():
        if slug in members:
            picked += [s for s in members if s != slug and s not in picked]
    picked += [t["slug"] for t in live if t["slug"] != slug and t["slug"] not in picked]
    by_slug = {t["slug"]: t for t in live}
    return [by_slug[s] for s in picked if s in by_slug][:n]

def ld(*objs):
    """JSON-LD script tags. '</' is escaped so a string can never close the script element."""
    return "".join('<script type="application/ld+json">'
                   + json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
                   + "</script>" for o in objs)

def crumbs(*pairs):
    base = SITE["domain"].rstrip("/")
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": name, "item": base + path}
        for i, (name, path) in enumerate(pairs)]}

def snippet(text, most=158):
    """A meta description that ends on a sentence, or failing that a whole word, never mid word."""
    if len(text) <= most:
        return text
    cut = text[:most]
    end = max(cut.rfind(". "), cut.rfind("? "), cut.rfind("! "))
    if end >= 80:
        return cut[:end + 1]
    return cut[:cut.rfind(" ")].rstrip(",;:") + "…"

def lastmod(*paths):
    """Date of the last commit touching any of these paths, for the sitemap. Empty outside git."""
    try:
        out = subprocess.run(["git", "log", "-1", "--format=%cs", "--", *map(str, paths)], cwd=ROOT,
                             capture_output=True, text=True, timeout=10).stdout.strip()
    except (OSError, subprocess.SubprocessError):
        return ""
    return out

def page(path, title, description, main, robots="index,follow", head_extra="", body_class="",
         og="default", jsonld=""):
    analytics = analytics_tag()
    canonical = SITE["domain"].rstrip("/") + path
    og_name = og if (ROOT / "shell" / "og" / f"{og}.png").exists() else "default"
    out = fill(tpl("page.html"), title=html.escape(title), description=html.escape(description),
               canonical=canonical, robots=robots, head_extra=head_extra, body_class=body_class,
               og_image=f'{SITE["domain"].rstrip("/")}/og/{og_name}.png', og_alt=html.escape(title),
               jsonld=jsonld,
               brand=SITE["brand"], github=SITE["github"], main=main, analytics=analytics,
               shellv=SHELL_V, domain=SITE["domain"].rstrip("/"))
    dest = DIST / path.strip("/") / "index.html" if path != "/" else DIST / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    return canonical

def card(t):
    rep = ", ".join(t.get("replaces", []))
    if t["status"] == "live":
        return (f'<a class="card" href="/tools/{t["slug"]}/" style="text-decoration:none;color:inherit">'
                f'<h3>{html.escape(t["name"])}</h3><p>{html.escape(t["tagline"])}</p>'
                f'<span class="replaces">Instead of: {html.escape(rep)}</span></a>')
    return (f'<div class="card queued"><h3>{html.escape(t["name"])} <span class="badge">soon</span></h3>'
            f'<p>{html.escape(t["tagline"])}</p><span class="replaces">Instead of: {html.escape(rep)}</span></div>')

def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "assets").mkdir(parents=True)
    shutil.copy(ROOT / "shell" / "shell.css", DIST / "assets" / "shell.css")
    global SHELL_V
    SHELL_V = ver(ROOT / "shell" / "shell.css")
    # installable app: manifest, offline page, icons and favicon at the root. sw.js is written
    # at the end of the build, because it carries the build id of what it precaches.
    for f in ("manifest.webmanifest", "offline.html"):
        shutil.copy(ROOT / "shell" / f, DIST / f)
    shutil.copytree(ROOT / "shell" / "icons", DIST / "icons")
    shutil.copy(ROOT / "shell" / "icons" / "favicon.ico", DIST / "favicon.ico")
    if (ROOT / "shell" / "og").is_dir():
        shutil.copytree(ROOT / "shell" / "og", DIST / "og")   # link preview cards, scripts/og_cards.py
    urls, mods = [], {}
    live_tools = [t for t in TOOLS if t["status"] == "live"]
    # Pages the service worker precaches, each listed with its own versioned assets so that a
    # page and the code it loads are always cached as one consistent unit. Opt in per tool with
    # "offline": true in tools.json, and keep the total small: the build prints its size.
    offline_pages = {}
    shell_css = f"/assets/shell.css?v={SHELL_V}"

    # tools
    pot_cfg = json.dumps({"googleClientId": SITE.get("google_client_id", "")})
    for t in TOOLS:
        if t["status"] not in ("live", "hidden"):
            continue
        src = ROOT / "tools" / t["slug"]
        meta = json.loads((src / "meta.json").read_text())
        # Optional self-hosted resources (workers, models, runtimes, licences).
        if (src / "static").is_dir():
            shutil.copytree(src / "static", DIST / "assets" / t["slug"])
        head = f"<script>window.POT={pot_cfg};</script>"
        if (src / "tool.css").exists():
            shutil.copy(src / "tool.css", DIST / "assets" / f'{t["slug"]}.css')
            head += f'<link rel="stylesheet" href="/assets/{t["slug"]}.css?v={ver(src / "tool.css")}">'
        main_html = (src / "index.html").read_text()
        def _bust(m, _src=src, _slug=t["slug"]):
            f = _src / "static" / m.group(2)
            return f'{m.group(1)}?v={ver(f)}"' if f.exists() else m.group(0)
        main_html = re.sub(r'(src="/assets/' + re.escape(t["slug"]) + r'/([^"?]+\.js))"', _bust, main_html)
        if (src / "vendor").is_dir():
            vdir = DIST / "assets" / f'{t["slug"]}-vendor'
            shutil.copytree(src / "vendor", vdir)
            for vf in sorted(vdir.glob("*.js")):
                main_html += f'\n<script src="/assets/{t["slug"]}-vendor/{vf.name}?v={ver(vf)}" defer></script>'
        if (src / "app.js").exists():
            shutil.copy(src / "app.js", DIST / "assets" / f'{t["slug"]}.js')
            main_html += f'\n<script src="/assets/{t["slug"]}.js?v={ver(src / "app.js")}" defer></script>'
        tool_url = f'{SITE["domain"].rstrip("/")}/tools/{t["slug"]}/'
        app_ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": t["name"],
                  "url": tool_url, "description": meta["description"],
                  "applicationCategory": "UtilitiesApplication", "operatingSystem": "Any (runs in a web browser)",
                  "browserRequirements": "Requires JavaScript", "isAccessibleForFree": True,
                  "offers": {"@type": "Offer", "price": "0", "priceCurrency": "AUD"},
                  "image": f'{SITE["domain"].rstrip("/")}/og/{t["slug"]}.png',
                  "publisher": {"@type": "Organization", "name": SITE["brand"], "url": SITE["domain"]}}
        rel = related(t["slug"], live_tools)
        vs_note = ""
        if t.get("vs") and (ROOT / "vs" / f'{t["vs"]}.json').exists():
            inc = json.loads((ROOT / "vs" / f'{t["vs"]}.json').read_text())["incumbent"]
            vs_note = f'<a href="/vs/{t["vs"]}/">Is it worth paying for {html.escape(inc)}?</a> · '
        aside = ('\n<aside class="wrap related" aria-labelledby="related-title">'
                 '<h2 id="related-title">More free tools</h2>'
                 f'<div class="grid">{"".join(card(r) for r in rel)}</div>'
                 f'<p class="more">{vs_note}<a href="/vs/">Every comparison</a> · <a href="/#tools">All tools</a></p></aside>')
        url = page(f'/tools/{t["slug"]}/', meta["title"], meta["description"], main_html + aside,
                   head_extra=head, body_class=f'tool tool-{t["slug"]}', og=t["slug"],
                   jsonld=ld(app_ld, crumbs(("Tools", "/#tools"), (t["name"], f'/tools/{t["slug"]}/'))),
                   robots="index,follow" if t["status"] == "live" else "noindex,nofollow")
        if t["status"] == "live":
            urls.append(url)
            mods[url] = lastmod(src, ROOT / "tools.json")
            if t.get("offline"):
                page_url = f'/tools/{t["slug"]}/'
                assets = sorted(set(re.findall(r'/assets/[^"]+', head + main_html)))
                offline_pages[page_url] = [page_url, shell_css] + assets

    # vs pages. A comparison page follows its tool's status: publishing one for a tool that is
    # hidden puts an "open it, free, no account" button in front of search traffic for something
    # nobody can use yet. It still builds, so the URL works for anyone we send it to, but it is
    # noindex and stays out of the sitemap until the tool goes live.
    live_slugs = {t["slug"] for t in TOOLS if t["status"] == "live"}
    hub = []
    for f in sorted((ROOT / "vs").glob("*.json")):
        v = json.loads(f.read_text())
        main_html = fill(tpl("vs.html"), github=SITE["github"], **v)
        listed = v.get("tool_slug") in live_slugs
        # A search title leads with what people type ("free X alternative"); the h1 keeps the question.
        title = v.get("title") or f'Free {v["incumbent"]} alternative: is {v["incumbent"]} worth paying for?'
        vs_url = page(f'/vs/{v["slug"]}/', title, snippet(v["short_answer"]), main_html,
                      og=v.get("tool_slug", "default"),
                      jsonld=ld(crumbs(("Comparisons", "/vs/"), (v["incumbent"], f'/vs/{v["slug"]}/'))),
                      robots="index,follow" if listed else "noindex,nofollow")
        if listed:
            urls.append(vs_url)
            mods[vs_url] = lastmod(f)
            hub.append(f'<li><a href="/vs/{v["slug"]}/">Is it worth paying for {html.escape(v["incumbent"])}?</a>'
                       f'<p>{html.escape(snippet(v["short_answer"], 200))} Free instead: '
                       f'<a href="/tools/{v["tool_slug"]}/">{html.escape(v["tool_name"])}</a>.</p></li>')
    hub_main = ('<main class="wrap prose" style="padding-top:32px"><h1>Is the paid version worth it?</h1>'
                '<p class="muted">Each comparison looks at where a paid app puts its paywall, what a free '
                'tool here does instead, and when paying still makes sense.</p>'
                f'<ul class="vs-list">{"".join(hub)}</ul></main>')
    urls.append(page("/vs/", f'Free alternatives to paid apps, compared · {SITE["brand"]}',
                     "Where Splitwise, DocuSign, Loom, remove.bg and others put their paywalls, what a free "
                     "browser tool does instead, and when paying still makes sense.", hub_main,
                     jsonld=ld(crumbs(("Comparisons", "/vs/")))))

    # privacy (required by Google's OAuth consent screen) + about + home
    urls.append(page("/privacy/", f'Privacy · {SITE["brand"]}',
                     "Nothing you type or load into these tools is uploaded. What the site does and does not collect.",
                     fill(tpl("privacy.html"), github=SITE["github"], brand=SITE["brand"])))
    urls.append(page("/terms/", f'Terms of use · {SITE["brand"]}',
                     "Plain terms for using the free tools: provided as is, MIT licensed, your data stays on your device.",
                     fill(tpl("terms.html"), github=SITE["github"], brand=SITE["brand"])))
    urls.append(page("/about/", f'Why these are free · {SITE["brand"]}',
                     "Every tool here replaces a product that charges at the moment you need the result.",
                     fill(tpl("about.html"), github=SITE["github"])))
    live = "".join(card(t) for t in TOOLS if t["status"] == "live")
    queued = "".join(card(t) for t in TOOLS if t["status"] == "queued")
    queued_section = ('<section style="margin-top:40px"><h2>Coming next</h2>'
                      '<p class="muted">Built in the order people ask for them.</p>'
                      f'<div class="grid">{queued}</div></section>') if queued else ""
    base = SITE["domain"].rstrip("/")
    home_ld = [{"@context": "https://schema.org", "@type": "WebSite", "name": SITE["brand"], "url": base + "/",
                "description": SITE["tagline"]},
               {"@context": "https://schema.org", "@type": "ItemList", "name": "Free tools",
                "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": t["name"],
                                     "url": f'{base}/tools/{t["slug"]}/'} for i, t in enumerate(live_tools)]}]
    urls.append(page("/", f'{SITE["brand"]} — free versions of things people pay for', SITE["tagline"],
                     fill(tpl("home.html"), brand=SITE["brand"], tagline=SITE["tagline"],
                          live_cards=live, queued_section=queued_section), jsonld=ld(*home_ld)))
    offline_pages["/"] = ["/", shell_css]  # start_url of the installed app

    # 404 page: without one, Pages serves index.html with a 200 for every unknown path (soft 404s).
    nf_main = ('<main class="wrap prose"><h1>Page not found</h1><p>That address does not exist on this site. '
               'The tools are all listed on the <a href="/">home page</a>.</p><div class="grid">' + live + '</div></main>')
    nf = fill(tpl("page.html"), title=f'Page not found · {SITE["brand"]}', description="This page does not exist.",
              canonical=SITE["domain"].rstrip("/") + "/404.html", robots="noindex,nofollow", head_extra="",
              body_class="notfound", brand=SITE["brand"], github=SITE["github"], main=nf_main,
              analytics=analytics_tag(), jsonld="",
              og_image=f'{SITE["domain"].rstrip("/")}/og/default.png', og_alt=SITE["brand"],
              shellv=SHELL_V, domain=SITE["domain"].rstrip("/"))
    (DIST / "404.html").write_text(nf)
    # IndexNow key file so Bing and friends accept URL submissions without an account.
    if SITE.get("indexnow_key"):
        (DIST / f'{SITE["indexnow_key"]}.txt').write_text(SITE["indexnow_key"])
    (DIST / "robots.txt").write_text(f'User-agent: *\nAllow: /\nSitemap: {SITE["domain"]}/sitemap.xml\n')
    (DIST / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc>" + (f"<lastmod>{mods[u]}</lastmod>" if mods.get(u) else "")
                  + "</url>\n" for u in urls) + "</urlset>\n")
    # No Permissions-Policy: the screen recorder needs camera + microphone; the browser still prompts.
    # /sw.js and the offline manifest must revalidate, or an edge cache delays every update.
    (DIST / "_headers").write_text(
        "/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n"
        "\n/sw.js\n  Cache-Control: no-cache\n"
        "\n/offline-manifest.json\n  Cache-Control: no-cache\n")

    # Service worker. The build id is a hash of every precached file's contents, and it is
    # stamped into sw.js, so changing any precached file changes the worker itself. That is what
    # makes the browser install the new cache and drop the old one; a worker whose bytes never
    # change is never reinstalled.
    def dist_file(u):
        p = u.split("?")[0]
        if p == "/offline":
            return DIST / "offline.html"          # Pages serves offline.html at /offline
        p = p.lstrip("/")
        return DIST / (p + "index.html" if u.split("?")[0].endswith("/") else p)
    precached = sorted({u for group in offline_pages.values() for u in group} | {"/offline"})
    digest, total, missing = hashlib.sha1(), 0, []
    for u in precached:
        f = dist_file(u)
        digest.update(u.encode())
        if f.exists():
            digest.update(f.read_bytes())
            total += f.stat().st_size
        else:
            digest.update(b"missing")
            missing.append(u)
    build_id = digest.hexdigest()[:12]
    (DIST / "offline-manifest.json").write_text(
        json.dumps({"build": build_id, "pages": offline_pages}, indent=1) + "\n")
    (DIST / "sw.js").write_text(fill(tpl("sw.js"), build=build_id))
    if missing:
        raise SystemExit(f"offline manifest references files that were not built: {missing}")
    print(f"built {len(urls)} pages -> {DIST}")
    print(f"offline precache: {len(offline_pages)} pages, {len(precached)} files, "
          f"{total / 1024:.0f} KB, build {build_id}")

if __name__ == "__main__":
    main()
