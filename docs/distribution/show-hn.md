# Show HN draft

Post during the mid semester break (28 September to 9 October), a weekday, between 8 and
10 am US Eastern, which is 10 pm to midnight Sydney. Show HN posts get one shot; do not post
until the two manual tests (recorder, real PDF) are done and the analyser is either approved
or left out of the pitch.

## Title (under 80 characters)

```
Show HN: Plenty of Tools – free browser only versions of tools that charge at the last step
```

Alternative if that reads as salesy:

```
Show HN: 13 single purpose tools that run entirely in the browser, MIT licensed
```

## URL

https://plentyoftools.io

## First comment (post immediately after submitting)

> I'm a final year engineering student in Sydney. Over the last week I built a set of small
> tools that each replace something people pay for at the exact moment they need the result:
> the CV builder that charges at the download button, the screen recorder with a five minute
> cap, the PDF signer that watermarks, the HEIC converter that uploads your photos to a server.
>
> The rule for every tool is the same: it runs in the browser, there is no server, nothing is
> uploaded, no account, no ads. That is what makes free sustainable. Each tool has a companion
> page that answers "is it worth paying for X?" honestly, including the cases where the answer
> is yes (DocuSign's audit trail, Splitwise's live sync, GuitarTuna's song library).
>
> Technical notes for this crowd: pdf.js plus pdf-lib for the signer with coordinates mapped
> back through the viewport transform so rotated pages work; libheif compiled to wasm in a
> worker for HEIC; Whisper tiny via transformers.js for transcription (the one place a model is
> fetched at run time, from Hugging Face, disclosed on the page); a McLeod style pitch detector
> for the tuner; the expense splitter keeps the whole ledger in the URL hash so sharing needs no
> backend. Static site, Python build script, Cloudflare Pages.
>
> Things I know are rough: the screen recorder's MP4 is fragmented and some players show 0:00
> for the length; the recorder only streams to disk in Chromium (elsewhere it holds the
> recording in memory until you download); transcription is capped at 10 minutes and 50 MB a
> file; the Google storage analyser is waiting on Google's restricted scope review, so it is
> not listed yet. Happy to answer anything. Source: github.com/lirv7136/plenty-of-tools
