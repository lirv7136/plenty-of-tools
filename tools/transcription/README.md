# Browser Transcription (#12)

English audio to editable segment text/times and TXT/SRT downloads at `/tools/transcription/`. No audio uploads, accounts, server inference, speaker identification or summaries. The initial page does not load the model/runtime; opening audio only creates a local blob URL. A self-hosted short JFK example is available.

## Runtime and network

- Self-hosted Transformers.js **2.17.2** (Apache 2.0) with ONNX Runtime Web **1.14.0** (MIT); JS and the SIMD/baseline WASM files are in `static/`. One WASM thread avoids requiring cross-origin isolation or GPU support.
- Model: **Xenova/whisper-tiny.en**, revision **79fb389fc764e7c395bd330e9531d9d32ada7049**, quantized encoder + merged decoder. Weight files total 40,852,295 bytes, plus tokenizers/configs. Loaded directly from Hugging Face via GET after Transcribe is pressed. No user audio, filename or transcript is included in those requests. The first run uses roughly 55 MB of runtime/model downloads.
- Weights remain remote: the decoder alone is about 30.7 MB, above Cloudflare Pages’ per-file deployment limit. Runtime WASM files remain below the limit.
- Optional model-only Cache Storage: `pot-transcription-whisper-tiny-en-v1`. A custom cache isolates this tool from other runtimes. Browser storage failures fall back to the current run; users can remove the cache. The audio and transcript are never persisted. The runtime also benefits from ordinary HTTP asset caching.
- Cached-model inference was tested with the model host blocked. First loading the webpage/runtime still needs available assets; there is no service worker claiming a fully installable offline app.

## Audio and cancellation

Maximum 50 MiB, 10 minutes. Browser-native `OfflineAudioContext.decodeAudioData` resamples to 16 kHz; channels are averaged to mono, then PCM is transferred to a module worker. Codec support depends on the browser. Silent/near-silent files bypass model loading. The worker processes 30-second overlapping windows with 5-second strides on each side and reports completed chunks. This is chunk-level progress, not a precise remaining-time estimate.

Stop terminates the worker, aborts an example fetch and invalidates in-flight decode callbacks with a run token. Native audio decoding cannot be interrupted synchronously; its eventual result is discarded after Stop. Completed workers are terminated to release model memory. Previous transcript edits are cleared when a new transcription starts. Clear removes audio URLs and all transcript DOM/state but leaves cached weights separate.

## Transcript handling

Model segment times are estimates. Missing endpoints/overlaps are bounded to the audio and the UI discloses adjustments. Users edit text and times independently. Blank text omits a cue from both exports. Invalid, zero-duration, out-of-range or overlapping cues disable SRT; TXT stays available. SRT uses sequential cue numbers and millisecond timestamps. All generated content is placed using textContent or form values.

## Licences and sources

`static/TRANSFORMERS-LICENSE.txt`, `ONNX-LICENSE.txt`, `ONNX-NOTICES.txt` and `WHISPER-LICENSE.txt` accompany the runtime. Upstream Whisper is MIT; the Xenova model card identifies the converted model as Apache 2.0. The unmodified bundle retains dependency notices. `vendor-manifest.json` records vendored URLs and SHA-256 hashes. The JFK audio is a short extract of his US presidential inaugural address distributed in the Transformers.js documentation dataset; its source is linked in the UI and manifest.

References: [Transformers.js 2.17.2 ASR API](https://huggingface.co/docs/transformers.js/v2.17.2/en/api/pipelines), [model](https://huggingface.co/Xenova/whisper-tiny.en), [example audio source](https://huggingface.co/datasets/Xenova/transformers.js-docs), [Otter plans](https://otter.ai/pricing).

## Validation

```sh
python3 build.py
node tests/transcription.test.cjs
# Serve dist at localhost:8765, then run Chrome with real model downloads:
node tests/transcription.browser.cjs
```

The browser test runs real inference, checks recognisable speech and timestamped downloads, verifies only model files are cached, checks cached inference with model-network access blocked, validates edits, and exercises cancellation, model/decode failures, file limits, silence and mobile layout. Unit tests cover timing normalisation, SRT boundaries, channel mixing and silence detection.
