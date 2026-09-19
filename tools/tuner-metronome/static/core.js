/* Tuner and Metronome core: pitch detection, note maths, presets, tempo helpers. No DOM, no audio.
   UMD so node tests can require() it and the page can use TunerCore. */
(function (root) {
  'use strict';
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

  function freqFromMidi(midi, a4) { return (a4 || 440) * Math.pow(2, (midi - 69) / 12); }
  function midiFromName(name) {
    const m = /^([A-Ga-g])([#b]?)(-?\d)$/.exec(String(name).trim());
    if (!m) return null;
    let n = NAMES.indexOf(m[1].toUpperCase());
    if (m[2] === '#') n += 1; else if (m[2] === 'b') n -= 1;
    return 12 * (parseInt(m[3], 10) + 1) + ((n + 12) % 12);
  }
  function nameFromMidi(midi) { return NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1); }

  // Nearest note to a frequency and how far off it is, in cents (positive = sharp).
  function noteFromFreq(freq, a4) {
    a4 = a4 || 440;
    if (!(freq > 0)) return null;
    const exact = 69 + 12 * Math.log2(freq / a4);
    const midi = Math.round(exact);
    return { midi, name: NAMES[((midi % 12) + 12) % 12], octave: Math.floor(midi / 12) - 1, cents: Math.round((exact - midi) * 1000) / 10, target: freqFromMidi(midi, a4) };
  }

  // Cents from a frequency to a specific target note (for instrument mode).
  function centsTo(freq, targetFreq) { return Math.round(1200 * Math.log2(freq / targetFreq) * 10) / 10; }

  // McLeod style pitch detection: normalised square difference over lags, first strong peak,
  // parabolic interpolation. Returns Hz, or -1 for silence / no clear pitch.
  function detectPitch(buf, sampleRate, opts) {
    opts = opts || {};
    const minFreq = opts.minFreq || 55, maxFreq = opts.maxFreq || 1600, gate = opts.gate == null ? 0.008 : opts.gate;
    const n = buf.length;
    let rms = 0;
    for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
    rms = Math.sqrt(rms / n);
    if (rms < gate) return -1;
    const minLag = Math.max(2, Math.floor(sampleRate / maxFreq)), maxLag = Math.min(n - 2, Math.ceil(sampleRate / minFreq));
    // The NSDF starts at lag 1, not minLag: for a note whose period is close to minLag, starting
    // inside the fundamental's own lobe would skip it as the "lag 0 lobe" and read an octave low.
    const nsdf = new Float32Array(maxLag + 1);
    for (let tau = 1; tau <= maxLag; tau++) {
      let acf = 0, m = 0;
      for (let i = 0; i + tau < n; i++) { const a = buf[i], b = buf[i + tau]; acf += a * b; m += a * a + b * b; }
      nsdf[tau] = m > 0 ? 2 * acf / m : 0;
    }
    // collect the highest point of every positive lobe
    const peaks = [];
    let tau = 1;
    while (tau <= maxLag && nsdf[tau] > 0) tau++;           // skip the initial lobe around lag 0
    while (tau <= maxLag) {
      while (tau <= maxLag && nsdf[tau] <= 0) tau++;
      let best = -1, bestV = -Infinity;
      while (tau <= maxLag && nsdf[tau] > 0) { if (nsdf[tau] > bestV) { bestV = nsdf[tau]; best = tau; } tau++; }
      if (best > 0) peaks.push({ tau: best, v: bestV });
    }
    if (!peaks.length) return -1;
    let maxV = -Infinity;
    for (const p of peaks) if (p.v > maxV) maxV = p.v;
    if (maxV < (opts.clarity || 0.6)) return -1;
    const k = opts.peakRatio || 0.85;
    let chosen = peaks[0];
    for (const p of peaks) { if (p.v >= k * maxV) { chosen = p; break; } }
    if (chosen.tau < minLag) return -1;   // the fundamental is above maxFreq: out of range, not a subharmonic
    // parabolic interpolation for sub sample precision
    const t = chosen.tau;
    let refined = t;
    if (t > 1 && t < maxLag) {
      const y0 = nsdf[t - 1], y1 = nsdf[t], y2 = nsdf[t + 1], d = y0 - 2 * y1 + y2;
      if (d !== 0) refined = t + 0.5 * (y0 - y2) / d;
    }
    return sampleRate / refined;
  }

  const PRESETS = {
    chromatic: { label: 'Chromatic (any note)', notes: [] },
    guitar: { label: 'Guitar, standard', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
    dropd: { label: 'Guitar, drop D', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
    halfdown: { label: 'Guitar, half step down', notes: ['D#2', 'G#2', 'C#3', 'F#3', 'A#3', 'D#4'] },
    bass: { label: 'Bass, 4 string', notes: ['E1', 'A1', 'D2', 'G2'] },
    bass5: { label: 'Bass, 5 string', notes: ['B0', 'E1', 'A1', 'D2', 'G2'] },
    ukulele: { label: 'Ukulele', notes: ['G4', 'C4', 'E4', 'A4'] },
    violin: { label: 'Violin', notes: ['G3', 'D4', 'A4', 'E5'] },
    viola: { label: 'Viola', notes: ['C3', 'G3', 'D4', 'A4'] },
    cello: { label: 'Cello', notes: ['C2', 'G2', 'D3', 'A3'] },
    mandolin: { label: 'Mandolin', notes: ['G3', 'D4', 'A4', 'E5'] },
    banjo: { label: 'Banjo, open G', notes: ['G4', 'D3', 'G3', 'B3', 'D4'] }
  };

  // Closest preset string to a detected frequency.
  function nearestTarget(freq, notes, a4) {
    let best = null;
    for (const name of notes) {
      const midi = midiFromName(name), f = freqFromMidi(midi, a4);
      const c = centsTo(freq, f);
      if (!best || Math.abs(c) < Math.abs(best.cents)) best = { name, midi, freq: f, cents: c };
    }
    return best;
  }

  function tempoMarking(bpm) {
    if (bpm < 40) return 'Grave';
    if (bpm < 60) return 'Largo';
    if (bpm < 76) return 'Adagio';
    if (bpm < 108) return 'Andante';
    if (bpm < 120) return 'Moderato';
    if (bpm < 156) return 'Allegro';
    if (bpm < 176) return 'Vivace';
    if (bpm < 200) return 'Presto';
    return 'Prestissimo';
  }

  // BPM from tap timestamps (ms). Uses the median of the last few intervals so one late tap does not swing it.
  function tapTempo(times) {
    if (!times || times.length < 2) return null;
    const recent = times.slice(-6), gaps = [];
    for (let i = 1; i < recent.length; i++) { const g = recent[i] - recent[i - 1]; if (g > 150 && g < 3000) gaps.push(g); }
    if (!gaps.length) return null;
    gaps.sort((a, b) => a - b);
    const mid = gaps.length % 2 ? gaps[(gaps.length - 1) / 2] : (gaps[gaps.length / 2 - 1] + gaps[gaps.length / 2]) / 2;
    return Math.max(30, Math.min(300, Math.round(60000 / mid)));
  }

  const api = { NAMES, PRESETS, freqFromMidi, midiFromName, nameFromMidi, noteFromFreq, centsTo, detectPitch, nearestTarget, tempoMarking, tapTempo };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TunerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
