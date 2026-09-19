# Brief for Codex, week of 20 September 2026

Paste this whole file into a Codex session working in `~/dev/plenty-of-tools`. It is written to
be self contained. Claude is working in the same tree at the same time, so the first section
matters most.

## What Claude is touching right now. Do not edit these.

Re-read any shared file immediately before you patch it, and patch it, never rewrite it.

| File or folder | Why it is busy |
|---|---|
| `shell/sw.js`, `shell/page.html`, `build.py` | Claude is adding a per build offline cache: `build.py` writes `dist/offline-manifest.json` and stamps a build id into `sw.js`, and `page.html` gains a redirect off the pages.dev subdomain. |
| `tools.json` | Claude is adding an `"offline": true` flag to nine light tools and will add entries for `habit-tracker` and `ringtone-maker`. Patch other fields freely, just re-read first. |
| `tools/habit-tracker/`, `tools/ringtone-maker/` | Claude is building slate items #18 and #22. |
| `tools/settle-up/`, `tools/tuner-metronome/` | Claude's, shipped 19 September. |

Everything else is yours. Your own tools are `subscription-finder`, `background-remover`,
`qr-codes`, `invoice-generator`, `gpx-route-builder`, `worth-it-calculators`, `transcription`
and `measurement-notebook`.

Two things worth knowing about `build.py`:

- It builds `hidden` tools too, so your measurement notebook page has been deploying since
  19 September at `/tools/measurement-notebook/` with a noindex tag. It is not on the home page
  or in the sitemap. That is fine, just not what the blueprint assumed.
- Since 19 September a `vs/` page **follows its tool's status**. Your `vs/imagemeter.json`
  builds and its URL works, but it is noindex and out of the sitemap until
  `measurement-notebook` is flipped to `live`, and the same now applies to `vs/google-one.json`.
  Before that guard, a comparison page for a hidden tool was indexed and put an "open it, free,
  no account" button in front of search traffic for something nobody could use. Write the `vs/`
  page whenever you like; it goes public with the tool.

## Standing rules

- Personal accounts only. Never CIM Enviro accounts, infrastructure or connectors.
- Browser only. No server, no uploads, no run time third party scripts. Vendor libraries into
  `tools/<slug>/vendor/` or `static/`, with the licence file beside them and a line in
  `vendor-manifest.json`.
- Every tool ships `meta.json`, an `index.html` fragment, `tool.css`, `app.js`, pure logic in
  `static/core.js`, `tests/<slug>.test.cjs`, a `README.md`, and a fair `vs/<incumbent>.json`
  that says plainly when paying is the right call.
- **Commit nothing.** Lachlan commits when he asks for it. Claude pushed `928ce90` and
  `130561e` on 19 September, which included your transcription finishing work and the
  measurement notebook M1, so the tree started this week clean.
- Verify prices and free tier limits from the incumbent's own page before writing a number, and
  put the review month in the `vs/` JSON.
- No hyphens in compound modifiers in anything a person will read.

## What the 19 September review found, because the same traps apply to your work

Eight defects were found in code written that day. Four of the lessons are general:

1. **Test numeric code at both ends of its stated range.** The tuner claimed to read up to
   1800 Hz but its tests stopped at 880, and it turned out to read every note above about
   1.3 kHz an octave low.
2. **Validate anything decoded from a link, a file or local storage before the page sees it,**
   and escape every value that lands in an HTML attribute. A share link could otherwise inject
   markup. This one is directly relevant to the measurement notebook's backup and restore.
3. **Reconcile the `vs/` page against the built tool.** The GuitarTuna page listed time
   signatures the tool does not have.
4. **Never claim offline unless a cache holds the page and its assets.** The service worker only
   cached the offline page, so four pieces of copy were wrong. Your READMEs were already honest
   about this, which is why they are quoted as the good example.

## Task A · Travel fee calculators, slate item #19 · about half a day

Extend your existing `worth-it-calculators` rather than making a new tool. Four calculators,
same pattern as the five already there: user entered prices, a worked example, a break even
threshold, a sensitivity table, and the printable report.

1. **Seat selection.** Is paying to choose a seat worth it, given party size, the chance of
   being split up, and what the airline charges per leg. The honest answer often depends on
   whether you are travelling with a child, which is where the calculator earns its keep.
2. **Checked bag versus carry on only.** Fee per bag per leg, the cost of a cabin bag that fits,
   the risk and cost of gate checking, and the time saved or lost at the carousel.
3. **Cruise wifi.** Per day package price against days at sea, number of devices, and what you
   would actually use it for. Include the "one device shared by two people" case, because that
   is the main lever.
4. **Theme park parking.** Daily parking against the prepaid or annual option, number of visit
   days, and the shuttle or rideshare alternative.

Sources: the price pain mine already flagged all four query families in both Australia and the
United States. Check current figures for at least one named example per calculator and cite the
month.

**Done when:** the four appear beside the existing five, unit tests cover each break even, the
live page prints a correct report, and `/tools/worth-it-calculators/` has no console errors.

## Task B · Measurement notebook M2 · 1 to 2 days

Per your own blueprint: saved projects and backup or restore. The M1 prototype holds one photo
in memory and loses everything on reload, which is the main thing stopping a real trial.

- Projects in IndexedDB, since a photo plus annotations is far too large for local storage.
  List, rename, duplicate, delete with a confirm, and a storage used figure.
- Export a project as a single file and import it back. **Validate the import fully before it
  replaces anything**, and treat every string in it as untrusted. See lesson 2 above.
- Decide and document what happens when the quota is exceeded mid save, and make the failure
  visible rather than silent.
- Keep it `hidden` in `tools.json` until Lachlan has tried it on a phone.

**Done when:** a project survives a reload and a browser restart, export then import reproduces
it exactly, a corrupted import file is refused with a clear message, and the README states the
storage limits you found.

## Task C · Read aloud, slate item #15 · about a day, only if A and B are done

New tool, slug `read-aloud`. Anchor paywall: Speechify, around US$139 a year for the voices and
the speed control. Verify the current price before writing `vs/speechify.json`, and be fair that
its neural voices and its PDF and web import are genuinely better than what a browser gives away.

- Paste text, or open a TXT, or open a PDF and pull its text with the pdf.js already vendored
  for the PDF signer. EPUB only if it is cheap.
- Speak with the browser's own `speechSynthesis`: voice picker, rate, pitch, pause and resume,
  skip by sentence or paragraph, and the current sentence highlighted as it is read.
- Remember position per document so it resumes where it stopped.
- Be explicit on the page that the voices belong to the operating system, so they differ between
  Windows, macOS, Android and iOS, and that some platforms speak only while the tab is visible.
- Do **not** add the neural voice option. It is a 90 MB model fetch and it belongs with the
  December batch alongside the transcription tool.

**Done when:** tests cover the sentence splitter and the position store, a 5,000 word document
reads without stalling, and `/vs/speechify/` returns 200.

## Order

A first, because it is half a day and it strengthens a tool that is already live. Then B,
because a prototype nobody can save is a prototype nobody will trial. C only if there is room.

Tell Lachlan what you finished, and leave the commit to him.
