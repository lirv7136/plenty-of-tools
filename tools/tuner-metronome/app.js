/* Tuner and Metronome — Web Audio only, no libraries. Pitch maths in TunerCore (static/core.js). */
(() => {
'use strict';
const T = window.TunerCore;
const $ = id => document.getElementById(id);
const KEY = 'pot:tuner-metronome:v1';
const els = {
  mic: $('btn-mic'), preset: $('preset'), a4: $('a4'), strings: $('strings'), noteName: $('note-name'), noteOct: $('note-oct'), needle: $('needle'),
  freq: $('freq'), status: $('tune-status'), micError: $('mic-error'),
  play: $('btn-play'), bpm: $('bpm'), marking: $('marking'), slider: $('bpm-slider'), down: $('bpm-down'), up: $('bpm-up'), sig: $('sig'), sub: $('sub'),
  accent: $('accent'), tap: $('btn-tap'), beats: $('beats')
};
if (!T) { els.freq.textContent = 'The page did not load completely. Reload and try again.'; return; }

const DEF = { preset: 'guitar', a4: 440, bpm: 100, sig: 4, sub: 1, accent: true };
let cfg = Object.assign({}, DEF);
try { Object.assign(cfg, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
cfg.bpm = Math.min(300, Math.max(30, +cfg.bpm || 100)); cfg.a4 = Math.min(466, Math.max(415, +cfg.a4 || 440));
if (!T.PRESETS[cfg.preset]) cfg.preset = 'guitar';
if (![2, 3, 4, 5, 6, 7].includes(+cfg.sig)) cfg.sig = 4;
if (![1, 2, 3, 4].includes(+cfg.sub)) cfg.sub = 1;
cfg.accent = cfg.accent !== false;
function save() { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ignore */ } }

let ctx = null;
function audio() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

// ---------- tuner ----------
let stream = null, analyser = null, source = null, raf = 0, buf = null, hist = [], lastGood = 0, lastFrame = 0;
els.preset.replaceChildren(...Object.keys(T.PRESETS).map(k => new Option(T.PRESETS[k].label, k)));
els.preset.value = cfg.preset; els.a4.value = cfg.a4;
const notes = () => T.PRESETS[cfg.preset].notes;

function renderStrings() {
  els.strings.replaceChildren(...notes().map(n => {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.note = n; b.textContent = n; b.title = `Play ${n}`;
    b.addEventListener('click', () => playTone(T.freqFromMidi(T.midiFromName(n), cfg.a4)));
    return b;
  }));
  if (!notes().length) { const s = document.createElement('span'); s.className = 'hint'; s.textContent = 'Any note. Pick an instrument to see its strings.'; els.strings.appendChild(s); }
}
function playTone(freq) {
  const c = audio(), t = c.currentTime, osc = c.createOscillator(), g = c.createGain();
  osc.type = 'triangle'; osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
  osc.connect(g).connect(c.destination); osc.start(t); osc.stop(t + 1.65);
}
function idleDisplay(msg) {
  els.noteName.textContent = '–'; els.noteOct.textContent = ''; els.needle.style.left = '50%'; els.needle.classList.remove('live', 'ok');
  els.status.textContent = ''; els.status.className = 'status'; els.freq.textContent = msg;
  for (const b of els.strings.querySelectorAll('button')) b.classList.remove('near', 'tuned');
}
function show(f) {
  let name, oct, cents, targetName = null;
  if (notes().length) { const nt = T.nearestTarget(f, notes(), cfg.a4); targetName = nt.name; name = nt.name.replace(/-?\d$/, ''); oct = nt.name.match(/-?\d$/)[0]; cents = nt.cents; }
  else { const n = T.noteFromFreq(f, cfg.a4); name = n.name; oct = n.octave; cents = n.cents; }
  els.noteName.textContent = name; els.noteOct.textContent = oct;
  const shown = Math.max(-50, Math.min(50, cents));
  els.needle.style.left = (50 + shown) + '%'; els.needle.classList.add('live');
  const ok = Math.abs(cents) <= 3;
  els.needle.classList.toggle('ok', ok);
  els.status.textContent = ok ? 'In tune' : Math.abs(cents) > 50 ? (cents < 0 ? 'Well below, tune up' : 'Well above, tune down') : (cents < 0 ? `${Math.abs(cents).toFixed(0)} cents flat, tune up` : `${cents.toFixed(0)} cents sharp, tune down`);
  els.status.className = 'status ' + (ok ? 'ok' : 'off');
  els.freq.textContent = `${f.toFixed(1)} Hz${targetName ? ` · nearest string ${targetName}` : ''}`;
  for (const b of els.strings.querySelectorAll('button')) { const near = b.dataset.note === targetName; b.classList.toggle('near', near && !ok); b.classList.toggle('tuned', near && ok); }
}
function loop(now) {
  raf = requestAnimationFrame(loop);
  if (now - lastFrame < 40) return; lastFrame = now;
  analyser.getFloatTimeDomainData(buf);
  const f = T.detectPitch(buf, ctx.sampleRate, { minFreq: 28, maxFreq: 1800 });
  if (f > 0) {
    hist.push(f); if (hist.length > 5) hist.shift();
    const sorted = hist.slice().sort((a, b) => a - b); const med = sorted[Math.floor(sorted.length / 2)];
    show(med); lastGood = now;
  } else if (now - lastGood > 1200 && hist.length) { hist = []; idleDisplay('Listening… play a note.'); }
}
async function startMic() {
  els.micError.hidden = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  } catch (e) {
    els.micError.textContent = e && e.name === 'NotAllowedError' ? 'Microphone access was blocked. Allow it in the address bar and try again.' : 'No microphone could be opened: ' + (e && e.message ? e.message : e);
    els.micError.hidden = false; return;
  }
  const c = audio();
  source = c.createMediaStreamSource(stream); analyser = c.createAnalyser(); analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0;
  source.connect(analyser); buf = new Float32Array(analyser.fftSize);
  hist = []; lastGood = performance.now();
  els.mic.textContent = 'Stop'; els.mic.classList.remove('primary'); idleDisplay('Listening… play a note.');
  raf = requestAnimationFrame(loop);
}
function stopMic() {
  cancelAnimationFrame(raf); raf = 0;
  if (source) { try { source.disconnect(); } catch (e) { /* ignore */ } source = null; }
  if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; }
  els.mic.textContent = 'Start tuning'; els.mic.classList.add('primary'); idleDisplay('Press Start tuning, then play a note.');
}
els.mic.addEventListener('click', () => stream ? stopMic() : startMic());
els.preset.addEventListener('change', () => { cfg.preset = els.preset.value; save(); renderStrings(); hist = []; if (!stream) idleDisplay('Press Start tuning, then play a note.'); });
els.a4.addEventListener('change', () => { cfg.a4 = Math.min(466, Math.max(415, +els.a4.value || 440)); els.a4.value = cfg.a4; save(); hist = []; });
renderStrings();
document.addEventListener('visibilitychange', () => { if (document.hidden && stream) stopMic(); });

// ---------- metronome ----------
let playing = false, nextTime = 0, beat = 0, subBeat = 0, timer = null, vraf = 0;
const queue = []; const stats = { scheduled: 0, minLead: Infinity };
const LOOKAHEAD_MS = 25, AHEAD_S = 0.12;

function setBpm(v, fromSlider) {
  cfg.bpm = Math.min(300, Math.max(30, Math.round(v))); save();
  els.bpm.textContent = cfg.bpm; els.marking.textContent = T.tempoMarking(cfg.bpm);
  if (!fromSlider) els.slider.value = cfg.bpm;
}
function renderBeats() {
  const n = +cfg.sig;
  els.beats.replaceChildren(...Array.from({ length: n }, (_, i) => { const d = document.createElement('i'); if (i === 0 && cfg.accent) d.className = 'accent'; return d; }));
}
function click(t, isAccent, isSub) {
  const c = ctx, osc = c.createOscillator(), g = c.createGain();
  osc.type = 'sine'; osc.frequency.value = isSub ? 800 : isAccent ? 1500 : 1000;
  const vol = isSub ? 0.12 : isAccent ? 0.5 : 0.32;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + (isSub ? 0.03 : 0.05));
  osc.connect(g).connect(c.destination); osc.start(t); osc.stop(t + 0.07);
}
function scheduler() {
  const c = ctx;
  while (nextTime < c.currentTime + AHEAD_S) {
    const sub = +cfg.sub, sig = +cfg.sig;
    click(nextTime, beat === 0 && cfg.accent && subBeat === 0, subBeat !== 0);
    if (subBeat === 0) queue.push({ t: nextTime, beat });
    stats.scheduled++; stats.minLead = Math.min(stats.minLead, nextTime - c.currentTime);
    nextTime += 60 / cfg.bpm / sub;
    subBeat++; if (subBeat >= sub) { subBeat = 0; beat = (beat + 1) % sig; }
  }
  timer = setTimeout(scheduler, LOOKAHEAD_MS);
}
function visual() {
  vraf = requestAnimationFrame(visual);
  const now = ctx.currentTime, dots = els.beats.children;
  while (queue.length && queue[0].t <= now) {
    const ev = queue.shift();
    for (let i = 0; i < dots.length; i++) dots[i].classList.toggle('on', i === ev.beat);
    setTimeout(() => { if (dots[ev.beat]) dots[ev.beat].classList.remove('on'); }, Math.min(120, 60000 / cfg.bpm * 0.5));
  }
}
function start() {
  const c = audio();
  playing = true; beat = 0; subBeat = 0; queue.length = 0; stats.scheduled = 0; stats.minLead = Infinity;
  nextTime = c.currentTime + 0.06;
  scheduler(); vraf = requestAnimationFrame(visual);
  els.play.textContent = 'Stop'; els.play.classList.remove('primary');
}
function stop() {
  playing = false; clearTimeout(timer); cancelAnimationFrame(vraf); queue.length = 0;
  for (const d of els.beats.children) d.classList.remove('on');
  els.play.textContent = 'Start'; els.play.classList.add('primary');
}
els.play.addEventListener('click', () => playing ? stop() : start());
els.slider.addEventListener('input', () => setBpm(+els.slider.value, true));
els.down.addEventListener('click', () => setBpm(cfg.bpm - 1)); els.up.addEventListener('click', () => setBpm(cfg.bpm + 1));
els.sig.addEventListener('change', () => { cfg.sig = +els.sig.value; save(); beat = 0; renderBeats(); });
els.sub.addEventListener('change', () => { cfg.sub = +els.sub.value; save(); subBeat = 0; });
els.accent.addEventListener('change', () => { cfg.accent = els.accent.checked; save(); renderBeats(); });
let taps = [];
els.tap.addEventListener('click', () => {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 3000) taps = [];
  taps.push(now);
  const bpm = T.tapTempo(taps);
  if (bpm) setBpm(bpm);
  els.tap.textContent = taps.length < 2 ? 'Keep tapping…' : `Tap tempo · ${bpm || '…'}`;
  clearTimeout(els.tap._t); els.tap._t = setTimeout(() => { els.tap.textContent = 'Tap tempo'; }, 3000);
});
document.addEventListener('keydown', e => {
  const tag = (document.activeElement && document.activeElement.tagName) || '';
  if (e.code === 'Space' && !/INPUT|SELECT|TEXTAREA|BUTTON/.test(tag)) { e.preventDefault(); playing ? stop() : start(); }
});
els.sig.value = cfg.sig; els.sub.value = cfg.sub; els.accent.checked = !!cfg.accent;
setBpm(cfg.bpm); renderBeats();

window.__tuner = { core: T, detectPitch: (buf, sr) => T.detectPitch(buf, sr, { minFreq: 28, maxFreq: 1800 }), metro: { start, stop, get playing() { return playing; }, get stats() { return Object.assign({ now: ctx && ctx.currentTime, next: nextTime }, stats); } }, cfg };
})();
