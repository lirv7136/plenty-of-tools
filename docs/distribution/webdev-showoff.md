# r/webdev Showoff Saturday draft

**Rule** (live sidebar via a Redlib mirror, 9 Oct 2026): sharing a project is limited to
Showoff Saturday; any other day it is removed; no commercial promotion; follow the 9:1 rule.
It is a standalone text post with the **"Showoff Saturday" flair**, not a weekly thread, and it
must focus on technical details. The sub removes posts that read as written by an LLM, so
**rewrite this in your own words** before posting. No published karma or age minimum, but a
brand new account is likely filtered: the plan puts this on Sat 17 Oct or later.

**When:** a Saturday, 9 to 11 pm Sydney (10:00 to 12:00 UTC). Never before 11 am Sydney on the
Saturday (still Friday in UTC). Text post, Markdown editor, flair "Showoff Saturday".

**Check before posting:** the "within 0.6 pt" figure was verified by hand on 19 Sep 2026 but is
not in a committed test; keep it only if you are comfortable with that, or cut the sentence.

## Title

```
19 static browser tools, and the Cloudflare Pages quirk that shaped their offline cache
```

## Body

```
I've been building a set of small, single purpose browser tools (sign a PDF, convert HEIC photos, split expenses, a tuner, and so on). 19 are live. It's a static site: a Python build script that uses only the standard library assembles plain HTML, CSS and JS, Cloudflare Pages serves it, and there is no server, so nothing you open is uploaded. Three things from building it that were more interesting than the tools themselves:

**1. Cloudflare Pages ignores the query string, which breaks the obvious offline cache**

Assets carry a `?v=<content hash>` for cache busting. The obvious service worker caches each versioned URL as it's requested. The catch: Pages ignores the query string when it serves a file, so a page from an old build asking for `/assets/x.js?v=oldhash` gets the *current* file back. A cache keyed on those URLs can store new code under an old version, next to an old page that doesn't match it.

So the build writes an offline manifest listing each page together with its own versioned assets, and the service worker precaches all of it as one unit into a cache named for the build. The build id is a hash of every precached file's contents and is stamped into `sw.js`, so any change produces a new worker, a new cache, and the old cache is deleted on activate. `sw.js` and the manifest are served `no-cache` so an edge cache can't hold back an update.

The testing trap: setting the page target offline over the DevTools protocol isn't enough. A navigation is answered by the service worker, whose fetch runs in its own target and stays online, so the page looks like it works offline when it doesn't. The test serves `dist/` with `no-store` (so the HTTP cache can't help) and applies the offline emulation to every attached target, the worker included.

**2. Signing rotated PDF pages**

pdf.js renders the page and pdf-lib writes the signature. Rotation is where it goes wrong: a page with `/Rotate 90` is displayed turned, so screen coordinates don't map to PDF user space with a simple y flip. Rather than hand rolling four cases, each placement is mapped back through `viewport.convertToPdfPoint` on the same viewport used to render it, and the drawn item is rotated to match the page. Placement lands within 0.6 pt on pages rotated 0, 90, 180 and 270.

**3. Lighthouse 100 says less about accessibility than it looks**

Every tool page scores 100, but only 25 of Lighthouse's 76 accessibility audits apply to these pages, and it hands several back as manual checks: labels and roles on custom controls, tab order, managed focus. Those are exactly what a waveform with drag handles or a row of toggle buttons depends on. So a separate test drives Chrome over every built page and asserts that every visible focusable element has an accessible name, there is no positive tabindex, nothing focusable sits inside `aria-hidden`, every form control has a real label rather than a placeholder, there is one `main` and one `h1` with no skipped heading levels, images have alt text, and toggle buttons report their state.

Most of the code was written with AI coding agents (Claude Code and Codex) under my direction, with tests like the ones above as the check on it.

Site: https://plentyoftools.io
Source (MIT): https://github.com/lirv7136/plenty-of-tools

A question for anyone who ships service workers behind a CDN or static host: would you have kept query string versioning and precached per build like this, or put the hash in the filename and avoided the problem altogether? I'm not sure which is the less fragile choice long term.
```

A fourth point for the comments if someone asks about testing: the tuner claimed to read up to
1800 Hz, its tests stopped at 880, and it read every note above about 1.3 kHz an octave low;
test both ends of any range you claim.
