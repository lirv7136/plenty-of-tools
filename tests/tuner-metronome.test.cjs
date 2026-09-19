const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../tools/tuner-metronome/static/core.js');

const tone = (freq, sr, n, harmonics) => {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = Math.sin(2 * Math.PI * freq * i / sr);
    for (let h = 2; h <= (harmonics || 1); h++) v += Math.sin(2 * Math.PI * freq * h * i / sr) / h;
    buf[i] = v * 0.4;
  }
  return buf;
};

test('note maths: names, midi numbers and cents', () => {
  assert.equal(T.midiFromName('A4'), 69);
  assert.equal(T.midiFromName('E2'), 40);
  assert.equal(T.midiFromName('Bb3'), 58);
  assert.equal(T.nameFromMidi(60), 'C4');
  assert.equal(Math.round(T.freqFromMidi(40) * 100) / 100, 82.41);
  const a = T.noteFromFreq(440);
  assert.deepEqual([a.name, a.octave, a.cents], ['A', 4, 0]);
  const sharp = T.noteFromFreq(446);
  assert.equal(sharp.name, 'A'); assert.ok(sharp.cents > 20 && sharp.cents < 26);
  const e = T.noteFromFreq(82.41);
  assert.deepEqual([e.name, e.octave], ['E', 2]);
  assert.equal(T.noteFromFreq(0), null);
  assert.equal(T.noteFromFreq(432, 432).cents, 0);
});

test('pitch detection finds a pure tone within a fraction of a hertz', () => {
  const sr = 48000;
  for (const f of [82.41, 110, 196, 329.63, 440, 880]) {
    const got = T.detectPitch(tone(f, sr, 4096), sr);
    assert.ok(Math.abs(got - f) < 0.5, `expected ${f}, got ${got}`);
  }
});

test('pitch detection picks the fundamental of a harmonic rich low string', () => {
  const sr = 44100;
  const got = T.detectPitch(tone(110, sr, 4096, 6), sr);
  assert.ok(Math.abs(got - 110) < 1, `expected 110, got ${got}`);
  const low = T.detectPitch(tone(41.2, sr, 8192, 4), sr, { minFreq: 30 });
  assert.ok(Math.abs(low - 41.2) < 0.5, `expected 41.2, got ${low}`);
});

test('silence and noise return no pitch', () => {
  assert.equal(T.detectPitch(new Float32Array(4096), 48000), -1);
  let seed = 7; const noise = new Float32Array(4096).map(() => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647 - 0.5) * 0.6; });
  assert.equal(T.detectPitch(noise, 48000), -1);
});

test('instrument presets map to the nearest string', () => {
  const g = T.PRESETS.guitar.notes;
  const near = T.nearestTarget(84, g, 440);
  assert.equal(near.name, 'E2'); assert.ok(near.cents > 30 && near.cents < 35);
  assert.equal(T.nearestTarget(440, T.PRESETS.ukulele.notes, 440).name, 'A4');
  for (const k in T.PRESETS) for (const n of T.PRESETS[k].notes) assert.ok(T.midiFromName(n) != null, `${k}: ${n}`);
});

test('tempo helpers', () => {
  assert.equal(T.tempoMarking(50), 'Largo');
  assert.equal(T.tempoMarking(120), 'Allegro');
  assert.equal(T.tempoMarking(210), 'Prestissimo');
  assert.equal(T.tapTempo([0, 500, 1000, 1500]), 120);
  assert.equal(T.tapTempo([0, 500, 1000, 2500, 3000]), 120); // one late tap ignored by the median
  assert.equal(T.tapTempo([0]), null);
});

test('high notes are not read an octave low', () => {
  const sr = 48000;
  for (const f of [1318.5, 1500, 1760]) {
    const got = T.detectPitch(tone(f, sr, 4096), sr, { minFreq: 28, maxFreq: 1800 });
    assert.ok(Math.abs(got - f) < 2, `expected ${f}, got ${got}`);
  }
  assert.equal(T.detectPitch(tone(2500, sr, 4096), sr, { minFreq: 28, maxFreq: 1800 }), -1); // above the range, not halved
});
