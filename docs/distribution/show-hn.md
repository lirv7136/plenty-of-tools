# Show HN draft

**When.** Thursday 1 October 2026, between 8 and 10 am US Eastern, which is 10 pm to midnight
Sydney (Sydney is still on AEST that night; daylight saving starts 4 October). Posted from the
account **lachieirving**.

**Before posting, all three:**
- [ ] Record a real screen clip with the Screen Recorder and play the file back.
- [ ] Sign a real PDF with Sign a PDF and open the result in another viewer.
- [ ] Open the site on your phone once, so you have seen what a phone visitor sees.

**Rules that matter** (news.ycombinator.com/showhn.html): it must be something people can try
now, with no signup; do not ask anyone to upvote or comment, and do not post the link in group
chats asking for votes, since HN detects and penalises that. Show HN posts get one shot. Stay
around for the first two or three hours and answer every comment, critical ones first.

## Title (under 80 characters)

```
Show HN: Plenty of Tools – 19 free tools that run entirely in the browser
```

Alternatives:

```
Show HN: Free browser only versions of tools that charge at the last step
Show HN: I rebuilt 19 paywalled utilities as static pages with no server
```

## URL

https://plentyoftools.io

## First comment (post immediately after submitting)

> I'm a final year engineering student in Sydney. Over the last two weeks I built a set of
> small tools that each replace something people pay for at the exact moment they need the
> result: the CV builder that charges at the download button, the screen recorder with a five
> minute cap, the expense splitter that stops you after a few expenses a day, the ringtone apps
> on weekly subscriptions, the HEIC converter that uploads your photos to a server.
>
> The rule for every tool is the same: it runs in the browser, there is no server, nothing is
> uploaded, no account, no ads. That is what makes free sustainable. Each tool has a companion
> page that answers "is it worth paying for X?" honestly, including the cases where the answer
> is yes (DocuSign's audit trail, Splitwise's live sync, GuitarTuna's song library). They are
> all at plentyoftools.io/vs/.
>
> [Say in your own words how it was built. Most of the code was written with AI coding agents
> (Claude Code and Codex) under your direction and review; HN readers will ask, and saying it
> up front goes down far better than being found out. One or two sentences is enough.]
>
> Some technical notes:
> - Sign a PDF: pdf.js to render, pdf-lib to write, with coordinates mapped back through the
>   viewport transform so rotated pages work.
> - HEIC: libheif compiled to wasm, running in a worker.
> - Transcription: Whisper through transformers.js. This is the one place a model is fetched at
>   run time (from Hugging Face), and the page says so.
> - Tuner: a McLeod style pitch detector.
> - Expense splitter: the whole ledger lives in the URL hash, so sharing needs no backend.
> - Ringtone maker: exports MP3 through lamejs, resampling through an OfflineAudioContext
>   first. It does not export iPhone .m4r, because Chrome cannot encode AAC.
> - Disk analyser: uses the File System Access API, and refuses to delete a file unless its
>   size and modified time still match the scan.
> - Offline: eleven tools are precached so they work with no connection. Cloudflare Pages
>   ignores query strings when it serves a file, so each build gets its own cache holding every
>   page together with its own assets.
> - The whole site is a static build from a Python script (standard library only) on
>   Cloudflare Pages.
>
> Things I know are rough:
> - The screen recorder's MP4 is fragmented, so some players show 0:00 for the length. It only
>   streams to disk in Chromium; elsewhere it holds the recording in memory until you download.
> - Transcription is capped at 10 minutes and 50 MB a file.
> - Read Aloud can only use the voices your device has, so quality varies a lot by platform.
> - The disk analyser can only remove files in desktop Chromium; elsewhere it reads only.
> - A Google Drive storage analyser is waiting on Google's restricted scope review, so it is not
>   listed yet.
>
> Happy to answer anything. Source: github.com/lirv7136/plenty-of-tools (MIT)

## After posting

Note the post URL and time in `~/dev/idea-engine/PORTFOLIO.md`. The engagement plan treats
Show HN as one channel test: under 20 visits means HN is not repeated for the brand; a single
tool can still get its own Show HN in December if it earns it.
