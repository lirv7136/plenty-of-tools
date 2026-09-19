/* Ringtone Maker — decoding, the waveform, the selection, preview and export.
   The maths lives in static/core.js; this file is the browser half: Web Audio, canvas and files.
   Nothing is uploaded: the file is decoded, trimmed and encoded in this tab. */
(() => {
'use strict';
const C = window.RingtoneCore;
const $ = id => document.getElementById(id);
const MAX_FILE = 80 * 1024 * 1024;
const MAX_SECONDS = 20 * 60;
// The sample rates MPEG audio allows. Anything else is resampled before encoding.
const MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

const els = {
  file: $('rm-file'), sample: $('rm-sample'), kind: $('rm-kind'), reset: $('rm-reset'),
  status: $('rm-status'), error: $('rm-error'), editor: $('rm-editor'),
  wave: $('rm-wave'), canvas: $('rm-canvas'), selection: $('rm-selection'),
  shadeLeft: $('rm-shade-left'), shadeRight: $('rm-shade-right'), playhead: $('rm-playhead'),
  handleStart: $('rm-handle-start'), handleEnd: $('rm-handle-end'),
  start: $('rm-start'), end: $('rm-end'), length: $('rm-length'), snap: $('rm-snap'),
  fadeIn: $('rm-fade-in'), fadeInOut: $('rm-fade-in-out'), fadeOut: $('rm-fade-out'), fadeOutOut: $('rm-fade-out-out'),
  normalise: $('rm-normalise'), mono: $('rm-mono'),
  play: $('rm-play'), loop: $('rm-loop'),
  wav: $('rm-wav'), mp3: $('rm-mp3'), bitrate: $('rm-bitrate'), size: $('rm-size')
};
if (!C) { els.status.textContent = 'The page did not load completely. Reload and try again.'; return; }

let source = null;          // { channels, sampleRate, duration, name }
let sel = { start: 0, end: 0 };
let ctx = null, playing = null, raf = 0, peaks = null, busy = false;

const kind = () => els.kind.value;
const fadeIn = () => +els.fadeIn.value;
const fadeOut = () => +els.fadeOut.value;

function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function say(msg) { els.status.textContent = msg || ''; }
function fail(msg) { els.error.textContent = msg || ''; els.error.hidden = !msg; }

// ---------- loading ----------
async function loadFile(file) {
  fail('');
  if (file.size > MAX_FILE) return fail(`That file is ${(file.size / 1048576).toFixed(0)} MB. The limit here is 80 MB, because the whole thing is decoded in this tab.`);
  say(`Reading ${file.name}…`);
  let decoded;
  try {
    const bytes = await file.arrayBuffer();
    decoded = await audio().decodeAudioData(bytes);
  } catch (e) {
    say('Nothing open yet.');
    return fail('This browser could not decode that file. Which formats work depends on the browser; MP3, M4A and WAV are the safest. If it is a video, try extracting the audio first.');
  }
  if (decoded.duration > MAX_SECONDS) {
    say('Nothing open yet.');
    return fail(`That is ${Math.round(decoded.duration / 60)} minutes long. The limit here is 20 minutes, because the whole file is held in memory.`);
  }
  adopt(decoded, file.name);
}
function adopt(audioBuffer, name) {
  const channels = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) channels.push(audioBuffer.getChannelData(c).slice());
  begin({ channels, sampleRate: audioBuffer.sampleRate, duration: audioBuffer.duration, name });
}
function begin(loaded) {
  stop();
  source = loaded;
  peaks = null;
  sel = C.snapFrom(0, source.duration, kind());
  els.mono.disabled = source.channels.length < 2;
  if (els.mono.disabled) els.mono.checked = false;
  els.editor.hidden = false;
  els.reset.hidden = false;
  els.start.max = els.end.max = source.duration.toFixed(2);
  say(`${source.name} · ${C.formatTime(source.duration)} · ${source.sampleRate} Hz · ${source.channels.length === 1 ? 'mono' : 'stereo'}`);
  fail('');
  drawWave();
  paint();
}
els.file.addEventListener('change', () => {
  const file = els.file.files && els.file.files[0];
  els.file.value = '';
  if (file) loadFile(file);
});
els.sample.addEventListener('click', () => {
  const tone = C.sampleTone(audio().sampleRate, 12);
  begin({ channels: tone.channels, sampleRate: tone.sampleRate, duration: tone.channels[0].length / tone.sampleRate, name: 'built-in-tone' });
  say('A built in arpeggio, twelve seconds long. Trim it, fade it and download it to see how the whole thing works.');
});
els.reset.addEventListener('click', () => {
  stop();
  source = null; peaks = null;
  els.editor.hidden = true; els.reset.hidden = true;
  fail('');
  say('Nothing open yet. Most formats work: MP3, M4A, WAV, FLAC, OGG, and the audio inside an MP4 or MOV.');
});

// ---------- the waveform ----------
function cssVar(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function drawWave() {
  if (!source) return;
  const width = Math.max(200, els.wave.clientWidth);
  const height = els.canvas.height / (window.devicePixelRatio || 1) || 150;
  const ratio = window.devicePixelRatio || 1;
  els.canvas.width = Math.round(width * ratio);
  els.canvas.height = Math.round(150 * ratio);
  els.canvas.style.width = width + 'px';
  els.canvas.style.height = '150px';
  const g = els.canvas.getContext('2d');
  g.setTransform(ratio, 0, 0, ratio, 0, 0);
  g.clearRect(0, 0, width, 150);
  if (!peaks || peaks.length !== Math.round(width)) peaks = C.peaks(source.channels, Math.round(width));
  const mid = 75;
  g.fillStyle = cssVar('--muted', '#5d6774');
  for (let x = 0; x < peaks.length; x++) {
    const h = Math.max(1, peaks[x] * 70);
    g.fillRect(x, mid - h, 1, h * 2);
  }
  g.strokeStyle = cssVar('--line', '#e1e5ea');
  g.beginPath(); g.moveTo(0, mid + 0.5); g.lineTo(width, mid + 0.5); g.stroke();
}
const toTime = x => source ? Math.max(0, Math.min(source.duration, x / Math.max(1, els.wave.clientWidth) * source.duration)) : 0;
const toPercent = t => source && source.duration ? (t / source.duration) * 100 : 0;

function paint() {
  if (!source) return;
  const left = toPercent(sel.start), right = toPercent(sel.end);
  els.selection.style.left = left + '%';
  els.selection.style.width = Math.max(0, right - left) + '%';
  els.shadeLeft.style.width = left + '%';
  els.shadeRight.style.left = right + '%';
  els.shadeRight.style.width = Math.max(0, 100 - right) + '%';
  els.handleStart.style.left = left + '%';
  els.handleEnd.style.left = right + '%';
  if (document.activeElement !== els.start) els.start.value = sel.start.toFixed(1);
  if (document.activeElement !== els.end) els.end.value = sel.end.toFixed(1);
  const span = sel.end - sel.start;
  const max = C.maxSeconds(kind());
  els.length.textContent = `${span.toFixed(1)} s selected${span >= max ? `, the most a ${kind() === 'alert' ? 'alert tone' : kind() === 'ringtone' ? 'ringtone' : 'clip'} allows` : ''}`;
  els.fadeInOut.textContent = fadeIn().toFixed(1) + ' s';
  els.fadeOutOut.textContent = fadeOut().toFixed(1) + ' s';
  const channelCount = els.mono.checked ? 1 : source.channels.length;
  const frames = Math.max(1, Math.round(span * source.sampleRate));
  const wavBytes = 44 + frames * channelCount * 2;
  const mp3Bytes = Math.round(span * (+els.bitrate.value) * 1000 / 8);
  els.size.textContent = span > 0
    ? `About ${fmtBytes(wavBytes)} as a WAV, or ${fmtBytes(mp3Bytes)} as an MP3.`
    : 'Pick a section first.';
  const disabled = span <= 0;
  els.wav.disabled = els.mp3.disabled = els.play.disabled = disabled || busy;
}
function fmtBytes(n) {
  return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
}
function setSelection(start, end) {
  sel = C.clampSelection(start, end, source.duration, kind());
  paint();
}
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { peaks = null; drawWave(); paint(); }, 120);
});

// ---------- dragging ----------
let drag = null;
els.wave.addEventListener('pointerdown', e => {
  if (!source) return;
  const rect = els.wave.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const t = toTime(x);
  if (e.target === els.handleStart) drag = { mode: 'start' };
  else if (e.target === els.handleEnd) drag = { mode: 'end' };
  else if (e.target === els.selection) drag = { mode: 'move', from: t, start: sel.start, end: sel.end };
  else { drag = { mode: 'end', anchor: t }; setSelection(t, t); }
  els.wave.setPointerCapture(e.pointerId);
  e.preventDefault();
});
els.wave.addEventListener('pointermove', e => {
  if (!drag || !source) return;
  const rect = els.wave.getBoundingClientRect();
  const t = toTime(e.clientX - rect.left);
  if (drag.mode === 'start') setSelection(Math.min(t, sel.end), sel.end);
  else if (drag.mode === 'end') {
    const anchor = drag.anchor == null ? sel.start : drag.anchor;
    setSelection(Math.min(anchor, t), Math.max(anchor, t));
  } else if (drag.mode === 'move') {
    const moved = C.moveSelection(drag.start, drag.end, t - drag.from, source.duration);
    setSelection(moved.start, moved.end);
  }
});
const endDrag = e => {
  if (!drag) return;
  drag = null;
  try { els.wave.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
};
els.wave.addEventListener('pointerup', endDrag);
els.wave.addEventListener('pointercancel', endDrag);

for (const [handle, which] of [[els.handleStart, 'start'], [els.handleEnd, 'end']]) {
  handle.addEventListener('keydown', e => {
    if (!source) return;
    const step = e.shiftKey ? 1 : 0.1;
    let delta = 0;
    if (e.key === 'ArrowLeft') delta = -step;
    else if (e.key === 'ArrowRight') delta = step;
    else return;
    e.preventDefault();
    if (which === 'start') setSelection(sel.start + delta, sel.end);
    else setSelection(sel.start, sel.end + delta);
  });
}
els.start.addEventListener('input', () => { if (source) setSelection(+els.start.value, sel.end); });
els.end.addEventListener('input', () => { if (source) setSelection(sel.start, +els.end.value); });
els.snap.addEventListener('click', () => {
  const snapped = C.snapFrom(sel.start, source.duration, kind());
  setSelection(snapped.start, snapped.end);
});
els.kind.addEventListener('change', () => { if (source) setSelection(sel.start, sel.end); });
for (const el of [els.fadeIn, els.fadeOut, els.normalise, els.mono, els.bitrate]) {
  el.addEventListener('input', paint);
  el.addEventListener('change', paint);
}

// ---------- what the file will contain ----------
function processed() {
  let channels = C.trimRange(source.channels, source.sampleRate, sel.start, sel.end);
  if (els.mono.checked && channels.length > 1) {
    const mixed = new Float32Array(channels[0].length);
    for (let i = 0; i < mixed.length; i++) {
      let sum = 0;
      for (const data of channels) sum += data[i];
      mixed[i] = sum / channels.length;
    }
    channels = [mixed];
  }
  if (els.normalise.checked) C.normaliseGain(channels);
  C.applyFade(channels, source.sampleRate, fadeIn(), fadeOut());
  return { channels, sampleRate: source.sampleRate };
}

// ---------- preview ----------
function stop() {
  cancelAnimationFrame(raf); raf = 0;
  els.playhead.hidden = true;
  if (playing) { try { playing.node.stop(); } catch (e) { /* already stopped */ } playing = null; }
  els.play.textContent = 'Play the selection';
}
els.play.addEventListener('click', () => {
  if (playing) return stop();
  const c = audio();
  const p = processed();
  const buffer = c.createBuffer(p.channels.length, p.channels[0].length, p.sampleRate);
  for (let i = 0; i < p.channels.length; i++) buffer.copyToChannel(p.channels[i], i);
  const node = c.createBufferSource();
  node.buffer = buffer;
  node.loop = els.loop.checked;
  node.connect(c.destination);
  node.onended = () => { if (playing && playing.node === node) stop(); };
  node.start();
  playing = { node, startedAt: c.currentTime, span: buffer.duration };
  els.play.textContent = 'Stop';
  els.playhead.hidden = false;
  const follow = () => {
    if (!playing) return;
    let into = (audio().currentTime - playing.startedAt);
    if (playing.node.loop) into = into % playing.span;
    els.playhead.style.left = toPercent(sel.start + Math.min(playing.span, into)) + '%';
    raf = requestAnimationFrame(follow);
  };
  raf = requestAnimationFrame(follow);
});

// ---------- download ----------
function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
els.wav.addEventListener('click', () => {
  const p = processed();
  const buffer = C.wavEncode(p.channels, p.sampleRate);
  download(C.suggestName(source.name, kind(), 'wav'), new Blob([buffer], { type: 'audio/wav' }));
  say(`Saved ${fmtBytes(buffer.byteLength)} as a WAV. The instructions for getting it onto a phone are below.`);
});

// MPEG audio only allows certain sample rates. Rather than refuse, render the clip through an
// offline context at 44.1 kHz and encode that.
async function atMp3Rate(p) {
  if (MP3_RATES.indexOf(p.sampleRate) >= 0) return p;
  const target = 44100;
  const frames = Math.max(1, Math.round(p.channels[0].length * target / p.sampleRate));
  const off = new OfflineAudioContext(p.channels.length, frames, target);
  const input = off.createBuffer(p.channels.length, p.channels[0].length, p.sampleRate);
  for (let i = 0; i < p.channels.length; i++) input.copyToChannel(p.channels[i], i);
  const node = off.createBufferSource();
  node.buffer = input; node.connect(off.destination); node.start();
  const rendered = await off.startRendering();
  const channels = [];
  for (let i = 0; i < rendered.numberOfChannels; i++) channels.push(rendered.getChannelData(i).slice());
  return { channels, sampleRate: target };
}
async function encodeMp3(p, kbps, onProgress) {
  const lame = window.lamejs;
  if (!lame || !lame.Mp3Encoder) throw new Error('The MP3 encoder did not load. Reload the page, or use WAV.');
  const encoder = new lame.Mp3Encoder(p.channels.length, p.sampleRate, kbps);
  const left = C.toInt16(p.channels[0]);
  const right = p.channels.length > 1 ? C.toInt16(p.channels[1]) : null;
  const BLOCK = 1152, parts = [];
  for (let i = 0; i < left.length; i += BLOCK) {
    const to = Math.min(i + BLOCK, left.length);
    const chunk = right
      ? encoder.encodeBuffer(left.subarray(i, to), right.subarray(i, to))
      : encoder.encodeBuffer(left.subarray(i, to));
    if (chunk.length) parts.push(new Uint8Array(chunk));
    if ((i / BLOCK) % 96 === 0) {
      onProgress(i / left.length);
      await new Promise(r => setTimeout(r));   // let the page breathe and stay responsive
    }
  }
  const tail = encoder.flush();
  if (tail.length) parts.push(new Uint8Array(tail));
  return new Blob(parts, { type: 'audio/mpeg' });
}
els.mp3.addEventListener('click', async () => {
  if (busy) return;
  busy = true; paint();
  els.mp3.textContent = 'Encoding…';
  try {
    const p = await atMp3Rate(processed());
    const blob = await encodeMp3(p, +els.bitrate.value, share => {
      els.mp3.textContent = `Encoding ${Math.round(share * 100)}%`;
    });
    download(C.suggestName(source.name, kind(), 'mp3'), blob);
    say(`Saved ${fmtBytes(blob.size)} as an MP3 at ${els.bitrate.value} kbps. The instructions for getting it onto a phone are below.`);
    fail('');
  } catch (e) {
    fail(e && e.message ? e.message : 'The MP3 could not be made. WAV always works.');
  } finally {
    busy = false;
    els.mp3.textContent = 'MP3';
    paint();
  }
});

document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

window.__ringtone = {
  core: C,
  get source() { return source; },
  get selection() { return sel; },
  get playing() { return !!playing; },
  loadTone: (seconds) => {
    const tone = C.sampleTone(audio().sampleRate, seconds || 12);
    begin({ channels: tone.channels, sampleRate: tone.sampleRate, duration: tone.channels[0].length / tone.sampleRate, name: 'built-in-tone' });
  },
  select: (start, end) => setSelection(start, end),
  processed,
  wav: () => C.wavEncode(processed().channels, source.sampleRate),
  mp3: (kbps) => atMp3Rate(processed()).then(p => encodeMp3(p, kbps || 192, () => {}))
};
})();
