#!/usr/bin/env python3
"""Build Plain Invoice into sites/plain-invoice/dist/. Stdlib only.

The invoice maker itself is shared with the Plenty of Tools page: its script, styles and PDF code
are read from tools/invoice-generator/, so a fix there reaches both sites. Everything else (shell,
pages, icons, offline worker) lives here.
"""
import json, os, shutil, html, hashlib, re
from pathlib import Path

HERE = Path(__file__).parent
REPO = HERE.parent.parent
TOOL = REPO / "tools" / "invoice-generator"
DIST = HERE / "dist"
SITE = json.loads((HERE / "site.json").read_text())
BASE = SITE["domain"].rstrip("/")
# PI_STAGING=1 builds a copy for review on pages.dev: nothing indexed, nothing crawled.
STAGING = os.environ.get("PI_STAGING") == "1"

def ver(p):
    return hashlib.sha1(Path(p).read_bytes()).hexdigest()[:8]

def fill(text, **kw):
    for k, v in kw.items():
        text = text.replace("{{" + k + "}}", str(v))
    return text

def ld(*objs):
    return "".join('<script type="application/ld+json">'
                   + json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
                   + "</script>" for o in objs)

def analytics():
    t = SITE.get("cf_analytics_token")
    return ('<script type="module" src="https://static.cloudflareinsights.com/beacon.min.js" '
            f'data-cf-beacon=\'{{"token": "{t}"}}\'></script>') if t else ""

ANALYTICS_NOTE = (
    "Cloudflare Web Analytics counts page views without cookies: which page, the referring site, "
    "the country and the kind of browser. It does not see anything you type."
    if SITE.get("cf_analytics_token") else
    "Nothing. This site does not run any analytics script.")

SYNC_ON = bool(SITE.get("sync")) or os.environ.get("PI_SYNC") == "1"
SYNC_NOTE = ("""<h2>If you sign in (Pro beta)</h2>
<p>Signing in is optional. If you do, we keep your email address, and a copy of your saved customers, templates, invoice numbers and invoice list, so they stay in step on your devices. That copy is stored encrypted in a database on Cloudflare. We do not use it for anything else, and it is never shared or sold.</p>
<p>We email you a sign in link; there is no password. A cookie keeps you signed in on that device for up to 60 days. We do not store your IP address.</p>
<p><strong>Delete my account</strong>, beside the sign in box, removes your email address and everything stored for it on the server straight away. What is saved in your browser stays until you delete it there.</p>""" if SYNC_ON else "")

# Each page: path, title, description, source file under pages/.
PAGES = [
    ("/pricing/", f'Pricing · {SITE["brand"]}',
     "Free forever: invoices, quotes, PDF, email, saved customers and a date on each line. Pro, not open yet, adds sync, sending and reminders.",
     "pricing.html"),
    ("/pro/", f'Pro, not open yet · {SITE["brand"]}',
     "Plain Invoice Pro would send invoices on a schedule, chase overdue ones and sync your phone and laptop. Not open yet: leave your email to hear when it is.",
     "pro.html"),
    ("/privacy/", f'Privacy · {SITE["brand"]}',
     "Nothing you type into the invoice maker is uploaded. What is kept in your browser, and what the site collects.",
     "privacy.html"),
    ("/terms/", f'Terms of use · {SITE["brand"]}',
     "Free to use, provided as is, open source. Your invoices stay on your device.", "terms.html"),
    ("/guides/", f'Free invoice templates for Australia · {SITE["brand"]}',
     "Free invoice templates for Australian businesses: no GST, tax invoice, NDIS, cleaning and tutoring, each with ABN and a PDF.",
     "guides/index.html"),
    ("/invoice-template-no-gst/", "Invoice template for sole traders not registered for GST (Australia)",
     "A free Australian invoice for sole traders who are not registered for GST: ABN, no GST line, how to pay. Make it in your browser and download a PDF.",
     "guides/invoice-template-no-gst.html"),
    ("/tax-invoice-template/", "Tax invoice template Australia, for businesses registered for GST",
     "A free tax invoice for Australian businesses registered for GST: GST on each line, prices with or without GST, and what a tax invoice must show.",
     "guides/tax-invoice-template.html"),
    ("/ndis-invoice-template/", "NDIS invoice template for support workers, free (Australia)",
     "A free NDIS invoice: participant name and NDIS number, date and support item number on every line, your ABN, plan or self managed. Make it in your browser.",
     "guides/ndis-invoice-template.html"),
    ("/cleaning-invoice-template/", "Cleaning invoice template Australia, with the date of each clean",
     "A free invoice for Australian cleaners: one line per clean with its date, your ABN, GST only if registered, and the next invoice one tap away.",
     "guides/cleaning-invoice-template.html"),
    ("/tutoring-invoice-template/", "Tutoring invoice template Australia, one line per lesson",
     "A free invoice for Australian tutors and coaches: one line per lesson with its date, paid or unpaid at a glance, no account.",
     "guides/tutoring-invoice-template.html"),
]

def page(path, title, description, main, head_extra="", body_class="", jsonld="", robots="index,follow"):
    redirect = ('<script>if(/\\.pages\\.dev$/.test(location.hostname)){location.replace("' + BASE +
                '"+location.pathname+location.search+location.hash)}</script>') if SITE.get("redirect_pages_dev") and not STAGING else ""
    out = fill((HERE / "shell" / "page.html").read_text(), redirect=redirect, title=html.escape(title),
               description=html.escape(description), canonical=BASE + path, robots="noindex,nofollow" if STAGING else robots, brand=SITE["brand"],
               sitev=ver(HERE / "shell" / "site.css"), jsonld=jsonld, head_extra=head_extra,
               body_class=body_class, main=main,
               signin='<a href="/#inv-sync">Sign in</a>' if SYNC_ON else '<a href="/privacy/">Privacy</a>', github=SITE["github"], analytics=analytics())
    dest = DIST / "index.html" if path == "/" else DIST / path.strip("/") / "index.html"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(out)
    return BASE + path

def main():
    if DIST.exists():
        shutil.rmtree(DIST)
    (DIST / "assets").mkdir(parents=True)
    shutil.copy(HERE / "shell" / "site.css", DIST / "assets" / "site.css")
    shutil.copytree(HERE / "shell" / "icons", DIST / "icons")
    shutil.copy(HERE / "shell" / "icons" / "favicon.ico", DIST / "favicon.ico")
    for f in ("manifest.webmanifest", "offline.html"):
        shutil.copy(HERE / "shell" / f, DIST / f)

    # the shared invoice maker
    shutil.copytree(TOOL / "static", DIST / "assets" / "invoice-generator")
    shutil.copy(TOOL / "tool.css", DIST / "assets" / "invoice.css")
    shutil.copy(TOOL / "app.js", DIST / "assets" / "invoice.js")
    sv = lambda name: f'/assets/invoice-generator/{name}?v={ver(TOOL / "static" / name)}'
    pdflib = sv("pdf-lib.min.js")
    tool_assets = [f'/assets/invoice.css?v={ver(TOOL / "tool.css")}', sv("core.js"), sv("pdf.js"), sv("bulk.js"),
                   f'/assets/invoice.js?v={ver(TOOL / "app.js")}', pdflib]
    head = (f'<link rel="stylesheet" href="{tool_assets[0]}">'
            f'<script>window.INV_PDFLIB={json.dumps(pdflib)};window.INV_COUNT_URL="/api/count";'
            # Pro sign in and sync: on only when site.json says so (or PI_SYNC=1 for local tests).
            + ('window.INV_SYNC_URL="/account/api";' if SYNC_ON else "") + '</script>')
    scripts = "".join(f'\n<script src="{u}" defer></script>' for u in tool_assets[1:5])
    app_ld = {"@context": "https://schema.org", "@type": "WebApplication", "name": SITE["brand"], "url": BASE + "/",
              "description": SITE["tagline"], "applicationCategory": "BusinessApplication",
              "operatingSystem": "Any (runs in a web browser)", "browserRequirements": "Requires JavaScript",
              "isAccessibleForFree": True, "offers": {"@type": "Offer", "price": "0", "priceCurrency": "AUD"}}
    urls = [page("/", f'Free invoice maker, no account · {SITE["brand"]}',
                 "Make an invoice or quote in your browser and download a PDF. Built for Australia (ABN, GST, PayID, NDIS), set up for NZ, UK, Europe, US and Canada. No account, no limits.",
                 (HERE / "pages" / "home.html").read_text().replace("{{jump_signin}}", '<a href="#inv-sync">Sign in to sync</a> · ' if SYNC_ON else "") + scripts, head_extra=head, body_class="tool",
                 jsonld=ld(app_ld))]

    for path, title, desc, src in PAGES:
        main_html = fill((HERE / "pages" / src).read_text(), brand=SITE["brand"], github=SITE["github"],
                         analytics_note=ANALYTICS_NOTE, sync_note=SYNC_NOTE, pro_month=SITE["pro_price_month"], pro_year=SITE["pro_price_year"])
        urls.append(page(path, title, desc, main_html))

    nf = ('<main class="wrap prose pi-page"><h1>Page not found</h1><p>That address does not exist here. '
          '<a href="/">Make an invoice</a> or see the <a href="/guides/">invoice templates</a>.</p></main>')
    page("/404/", f'Page not found · {SITE["brand"]}', "This page does not exist.", nf, robots="noindex,nofollow")
    (DIST / "404" / "index.html").rename(DIST / "404.html"); (DIST / "404").rmdir()

    # IndexNow key file, so Bing and others accept URL submissions without an account.
    if SITE.get("indexnow_key") and not STAGING:
        (DIST / f'{SITE["indexnow_key"]}.txt').write_text(SITE["indexnow_key"])
    (DIST / "robots.txt").write_text(f"User-agent: *\nAllow: /\n" + ("" if STAGING else f"Sitemap: {BASE}/sitemap.xml\n"))
    (DIST / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                                      + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    (DIST / "_headers").write_text(
        "/*\n" + ("  X-Robots-Tag: noindex, nofollow\n" if STAGING else "") + "  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n"
        "\n/sw.js\n  Cache-Control: no-cache\n\n/offline-manifest.json\n  Cache-Control: no-cache\n"
        "\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n")

    # Offline: the invoice maker (the home page), everything it loads including the PDF library,
    # and the offline page. The worker is the Plenty of Tools one, renamed (see shell/sw.js).
    site_css = f'/assets/site.css?v={ver(HERE / "shell" / "site.css")}'
    offline_pages = {"/": ["/", site_css, *tool_assets]}
    def dist_file(u):
        p = u.split("?")[0]
        if p == "/offline":
            return DIST / "offline.html"
        p = p.lstrip("/")
        return DIST / (p + "index.html" if p == "" or p.endswith("/") else p)
    precached = sorted({u for g in offline_pages.values() for u in g} | {"/offline"})
    digest, total = hashlib.sha1(), 0
    for u in precached:
        f = dist_file(u)
        if not f.exists():
            raise SystemExit(f"offline precache names a file that was not built: {u}")
        digest.update(u.encode()); digest.update(f.read_bytes()); total += f.stat().st_size
    build_id = digest.hexdigest()[:12]
    (DIST / "offline-manifest.json").write_text(json.dumps({"build": build_id, "pages": offline_pages}, indent=1) + "\n")
    (DIST / "sw.js").write_text(fill((HERE / "shell" / "sw.js").read_text(), build=build_id))
    print(f"built {len(urls)} pages -> {DIST}" + (" (STAGING: noindex on every page and in the headers)" if STAGING else ""))
    print(f"offline precache: {len(precached)} files, {total / 1024:.0f} KB, build {build_id}")

if __name__ == "__main__":
    main()
