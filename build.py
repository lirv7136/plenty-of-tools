#!/usr/bin/env python3
"""Assemble dist/ from shell/ + tools/ + vs/. Stdlib only.

Each tools/<slug>/ holds meta.json (title, description), index.html (a <main>
fragment) and optional tool.css / app.js which are copied alongside. Each
vs/<name>.json renders to /vs/<name>/. The home page lists tools.json.
"""
import json, shutil, html
from pathlib import Path

ROOT = Path(__file__).parent
DIST = ROOT / "dist"
SITE = json.loads((ROOT / "site.json").read_text())
TOOLS = json.loads((ROOT / "tools.json").read_text())

def tpl(name):
    return (ROOT / "shell" / name).read_text()

def fill(template, **kw):
    out = template
    for k, v in kw.items():
        out = out.replace("{{" + k + "}}", str(v))
    return out

def page(path, title, description, main, robots="index,follow", head_extra="", body_class=""):
    analytics = ""
    if SITE.get("cf_analytics_token"):
        analytics = ('<script defer src="https://static.cloudflareinsights.com/beacon.min.js" '
                     f'data-cf-beacon=\'{{"token": "{SITE["cf_analytics_token"]}"}}\'></script>')
    canonical = SITE["domain"].rstrip("/") + path
    out = fill(tpl("page.html"), title=html.escape(title), description=html.escape(description),
               canonical=canonical, robots=robots, head_extra=head_extra, body_class=body_class,
               brand=SITE["brand"], github=SITE["github"], main=main, analytics=analytics)
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
    urls = []

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
            head += f'<link rel="stylesheet" href="/assets/{t["slug"]}.css">'
        main_html = (src / "index.html").read_text()
        if (src / "vendor").is_dir():
            vdir = DIST / "assets" / f'{t["slug"]}-vendor'
            shutil.copytree(src / "vendor", vdir)
            for vf in sorted(vdir.glob("*.js")):
                main_html += f'\n<script src="/assets/{t["slug"]}-vendor/{vf.name}" defer></script>'
        if (src / "app.js").exists():
            shutil.copy(src / "app.js", DIST / "assets" / f'{t["slug"]}.js')
            main_html += f'\n<script src="/assets/{t["slug"]}.js" defer></script>'
        url = page(f'/tools/{t["slug"]}/', meta["title"], meta["description"], main_html,
                   head_extra=head, body_class=f'tool tool-{t["slug"]}',
                   robots="index,follow" if t["status"] == "live" else "noindex,nofollow")
        if t["status"] == "live":
            urls.append(url)

    # vs pages
    for f in sorted((ROOT / "vs").glob("*.json")):
        v = json.loads(f.read_text())
        main_html = fill(tpl("vs.html"), github=SITE["github"], **v)
        urls.append(page(f'/vs/{v["slug"]}/', f'Is it worth paying for {v["incumbent"]}?',
                         v["short_answer"][:155], main_html))

    # privacy (required by Google's OAuth consent screen) + about + home
    urls.append(page("/privacy/", f'Privacy · {SITE["brand"]}',
                     "Nothing you type or load into these tools is uploaded. What the site does and does not collect.",
                     fill(tpl("privacy.html"), github=SITE["github"], brand=SITE["brand"])))
    urls.append(page("/about/", f'Why these are free · {SITE["brand"]}',
                     "Every tool here replaces a product that charges at the moment you need the result.",
                     fill(tpl("about.html"), github=SITE["github"])))
    live = "".join(card(t) for t in TOOLS if t["status"] == "live")
    queued = "".join(card(t) for t in TOOLS if t["status"] == "queued")
    urls.append(page("/", f'{SITE["brand"]} — free versions of things people pay for', SITE["tagline"],
                     fill(tpl("home.html"), brand=SITE["brand"], tagline=SITE["tagline"],
                          live_cards=live, queued_cards=queued)))

    (DIST / "robots.txt").write_text(f'User-agent: *\nAllow: /\nSitemap: {SITE["domain"]}/sitemap.xml\n')
    (DIST / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    # No Permissions-Policy: the screen recorder needs camera + microphone; the browser still prompts.
    (DIST / "_headers").write_text("/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n")
    print(f"built {len(urls)} pages -> {DIST}")

if __name__ == "__main__":
    main()
