# Read aloud

Browser text reader at `/tools/read-aloud/`, with a comparison at `/vs/speechify/`.
Paste text, open UTF 8 TXT, or extract text from PDF. No accounts, document uploads, remote
voices or model downloads. EPUB and OCR are not implemented. Complex PDF column order and
line breaks may need correction in the text box before choosing Use this text again.

## Behaviour

- Voice picker includes only voices reported as local by `SpeechSynthesisVoice.localService`.
  The browser and operating system supply the voices; availability and sound differ by
  platform. Install local language voices in device settings if none appear.
- Rate 0.5× to 3×, pitch 0 to 2, pause/resume, stop, skip by sentence or paragraph, and click
  a sentence to seek. Changing voice/rate/pitch stops playback until Play is pressed again.
- Each utterance is at most 200 UTF 16 code units, split at spaces where possible and never
  through a surrogate pair. Only one utterance is queued. This avoids long utterance engine
  stalls, retains the utterance object and rejects stale events after cancellation.
  A timeout exposes a stopped voice with a retry instruction. It does not silently skip text.
- Reading pauses when the tab becomes hidden. Some platforms suspend speech in background
  tabs regardless. No screen lock or background playback promise is made.
- SHA 256 of normalised text identifies the document. At most 100 recent character offsets
  and timestamps are saved in local storage, with validation before use. The document text,
  file name and PDF are not stored. Reopening identical text resumes at its saved sentence;
  the current sentence may repeat. Edited text is a different document. Storage failure is
  visible and does not prevent listening. Forget saved positions deletes only this tool's key.
- TXT: 2 MiB; PDF: 25 MiB and 200 pages; extracted/pasted text: 500,000 characters and 10,000
  sentences. Scanned, password protected, malformed or oversized documents produce a clear
  error and retain the previous loaded document.

## Architecture and dependencies

`static/core.js` implements normalisation, segmentation with Intl.Segmenter and a fallback,
bounded utterance chunks, paragraph navigation and the position store. `static/player.js`
controls speech events and cancellation. `app.js` builds safe DOM nodes and handles input,
PDF extraction, voice availability and playback controls. Imported text never becomes HTML.

PDF.js 3.11.174 and its matching worker are copied from the existing PDF signer. Both have
Apache 2.0 notices beside them; `static/vendor-manifest.json` records hashes and origin.
PDF parsing sets `isEvalSupported:false` and disables font rendering. The only PDF worker
loads from this site. No runtime third party scripts, external PDF fetches or neural voices.
The tool is not opted into the offline cache; an open page can use local voices, but reopening
without internet is not promised.

Speechify's official pricing page was reviewed in September 2026. It showed US$29 per month
in the monthly view and offered a yearly option without exposing a verified annual total in
the retrieved page. The comparison therefore links to checkout rather than assuming the
older US$139 figure. Its free tier already includes basic voices and speeds up to 1.5×;
its natural voices, web import, PDF workflow and scanning are reasons to pay.

Sources: [Speechify pricing](https://speechify.com/pricing/),
[browser speech API](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis),
[local voice flag](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisVoice/localService).

## Validation

```sh
python3 build.py
node tests/read-aloud.test.cjs
node tests/read-aloud.browser.cjs
```

Unit checks cover sentence offsets, paragraphs, Unicode, fallback abbreviations and decimals,
lossless bounded chunks, navigation endpoints, hostile position data, the 100 document limit,
a 5,000 word simulated speech chain, and pause/cancel event races. The browser test serves
the built site locally and exercises text, genuine PDF extraction, invalid/scanned PDF errors,
position restore, literal HTML safety, mobile layout and the comparison route. On Linux its
Chrome invocation enables the installed speech dispatcher. When a local voice is available,
it also reads 5,000 words through the real speech engine and requires completion; otherwise
it prints an explicit unverified notice. No audio quality judgement is inferred from events.

Phone, Safari and Firefox listening checks remain separate manual checks.

September 2026 result: all seven unit tests passed. Chrome completed a real 5,000 word,
500 sentence run through the installed eSpeak voice with no stall or script exception.
The final short browser check also passed TXT/PDF input, malformed and scanned PDF recovery,
position restore, safe literal markup, mobile layout, no external HTTP requests and HTTP 200
for the Speechify comparison. This is speech event verification, not an audio quality review.
The tool is listed on the local homepage; Codex has not committed or deployed it.
