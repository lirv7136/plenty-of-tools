#!/usr/bin/env python3
"""Render the 1200x630 link preview cards into shell/og/. Run by hand when a tool is added or
renamed (needs Inkscape); build.py only copies the PNGs, so the build itself stays stdlib only.

One card per live or hidden tool, named after its slug, plus default.png for every other page.
A card is the logo, the tool's name and its tagline, which is what a group chat shows when
someone pastes a Settle Up link.
"""
import json, html, re, subprocess, sys, textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "shell" / "og"
SITE = json.loads((ROOT / "site.json").read_text())
TOOLS = json.loads((ROOT / "tools.json").read_text())
# the logo's inner markup, nested as its own <svg> so its ids and 512 unit frame stay intact
LOGO = re.sub(r"^<svg[^>]*>|</svg>\s*$", "", (ROOT / "shell" / "icons" / "logo.svg").read_text().strip())

def lines(text, width, most):
    out = textwrap.wrap(text, width)
    if len(out) > most:
        out = out[:most]
        out[-1] = out[-1].rstrip(" .,;") + "…"
    return out

def card(title, sub):
    t = lines(title, 22, 2)
    s = lines(sub, 44, 3)
    ty = 300 if len(t) == 1 else 262
    title_svg = "".join(f'<tspan x="80" dy="{0 if i == 0 else 84}">{html.escape(l)}</tspan>' for i, l in enumerate(t))
    sy = ty + 84 * (len(t) - 1) + 70
    sub_svg = "".join(f'<tspan x="80" dy="{0 if i == 0 else 46}">{html.escape(l)}</tspan>' for i, l in enumerate(s))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="#0f1318"/>
<rect x="0" y="0" width="1200" height="10" fill="#17B8A6"/>
<svg x="80" y="64" width="96" height="96" viewBox="0 0 512 512">{LOGO}</svg>
<text x="196" y="126" font-family="Noto Sans" font-weight="700" font-size="38" fill="#e6eaef">{html.escape(SITE["brand"])}</text>
<text y="{ty}" font-family="Noto Sans" font-weight="800" font-size="76" fill="#ffffff" letter-spacing="-1.5">{title_svg}</text>
<text y="{sy}" font-family="Noto Sans" font-size="34" fill="#98a2b0">{sub_svg}</text>
<text x="80" y="574" font-family="Noto Sans" font-weight="600" font-size="30" fill="#3ccf9a">Free · no account · runs in your browser</text>
<text x="1120" y="574" text-anchor="end" font-family="Noto Sans" font-size="30" fill="#98a2b0">plentyoftools.io</text>
</svg>'''

def render(name, svg):
    src = OUT / f"{name}.svg"
    src.write_text(svg)
    subprocess.run(["inkscape", str(src), "--export-type=png", f"--export-filename={OUT / (name + '.png')}",
                    "--export-width=1200"], check=True, capture_output=True)
    src.unlink()

def main():
    OUT.mkdir(exist_ok=True)
    only = set(sys.argv[1:])
    jobs = [("default", "Free versions of things people pay for", SITE["tagline"].split(". ", 1)[-1])]
    jobs += [(t["slug"], t["name"], t["tagline"]) for t in TOOLS if t["status"] in ("live", "hidden")]
    for name, title, sub in jobs:
        if only and name not in only:
            continue
        render(name, card(title, sub))
        print("wrote", OUT / f"{name}.png")

if __name__ == "__main__":
    main()
