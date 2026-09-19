const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../tools/ringtone-maker/static/core.js');

const tone = (seconds, sampleRate, freq, amp) => {
  const n = Math.floor(seconds * sampleRate);
  const a = new Float32Array(n), b = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    a[i] = (amp == null ? 0.5 : amp) * Math.sin(2 * Math.PI * (freq || 440) * i / sampleRate);
    b[i] = a[i] * 0.5;
  }
  return [a, b];
};

test('the selection obeys the file and the format', () => {
  // a ringtone tops out at 40 seconds, an alert tone at 30
  assert.deepEqual(R.clampSelection(0, 90, 180, 'ringtone'), { start: 0, end: 40 });
  assert.deepEqual(R.clampSelection(0, 90, 180, 'alert'), { start: 0, end: 30 });
  assert.deepEqual(R.clampSelection(10, 90, 180, 'ringtone'), { start: 10, end: 50 });
  assert.deepEqual(R.clampSelection(0, 12, 180, 'ringtone'), { start: 0, end: 12 }, 'a short pick is left alone');
  // and never runs off either end of the file
  assert.deepEqual(R.clampSelection(-5, 999, 8, 'clip'), { start: 0, end: 8 });
  assert.deepEqual(R.clampSelection(170, 999, 180, 'ringtone'), { start: 170, end: 180 }, 'clamped by the end of the file, not by 40 s');
  // a reversed or empty pick collapses instead of inverting
  assert.deepEqual(R.clampSelection(30, 10, 180, 'clip'), { start: 30, end: 30 });
  assert.deepEqual(R.clampSelection(0, 0, 180, 'clip'), { start: 0, end: 0 });
  assert.equal(R.maxSeconds('ringtone'), 40);
  assert.equal(R.maxSeconds('alert'), 30);
  assert.equal(R.maxSeconds('nonsense'), R.LIMITS.clip, 'an unknown kind falls back to the plain ceiling');
});

test('dragging the window keeps its length and stays inside the file', () => {
  assert.deepEqual(R.moveSelection(10, 30, 5, 180), { start: 15, end: 35 });
  assert.deepEqual(R.moveSelection(10, 30, -100, 180), { start: 0, end: 20 }, 'stops at the start');
  assert.deepEqual(R.moveSelection(150, 170, 100, 180), { start: 160, end: 180 }, 'stops at the end');
  assert.deepEqual(R.snapFrom(60, 180, 'ringtone'), { start: 60, end: 100 });
  assert.deepEqual(R.snapFrom(160, 180, 'ringtone'), { start: 160, end: 180 }, 'a snap near the end is shortened, not moved');
  assert.deepEqual(R.snapFrom(0, 12, 'alert'), { start: 0, end: 12 });
});

test('times read the way people say them', () => {
  assert.equal(R.formatTime(0), '0:00.0');
  assert.equal(R.formatTime(9.25), '0:09.3');
  assert.equal(R.formatTime(61.5), '1:01.5');
  assert.equal(R.formatTime(-4), '0:00.0');
});

test('trimming takes exactly the span asked for', () => {
  const sampleRate = 8000;
  const channels = tone(4, sampleRate);
  const cut = R.trimRange(channels, sampleRate, 1, 3);
  assert.equal(cut.length, 2, 'both channels survive');
  assert.equal(cut[0].length, 2 * sampleRate);
  assert.equal(cut[0][0], channels[0][sampleRate], 'the first sample is the one at one second');
  assert.notEqual(cut[0], channels[0], 'the original is not handed back');
  // a selection past the end is bounded by the file
  assert.equal(R.trimRange(channels, sampleRate, 3.5, 99)[0].length, 0.5 * sampleRate);
  // a zero length pick still yields a playable buffer, because Web Audio rejects an empty one
  assert.equal(R.trimRange(channels, sampleRate, 2, 2)[0].length, 1);
  assert.equal(R.trimRange(channels, sampleRate, 2, 1)[0].length, 1, 'and so does a reversed one');
});

test('a fade starts and ends at exactly zero', () => {
  const sampleRate = 8000;
  const channels = tone(2, sampleRate, 440, 1);
  const before = channels[0].slice();
  R.applyFade(channels, sampleRate, 0.5, 0.5);
  for (const data of channels) {
    // === rather than assert.equal, because a negative sample times zero is -0, which is
    // silence but not the same value as 0 under the strict assertion's rules.
    assert.ok(data[0] === 0, 'the very first sample must be silent, got ' + data[0]);
    assert.ok(data[data.length - 1] === 0, 'and so must the very last, got ' + data[data.length - 1]);
  }
  const quarter = Math.round(0.25 * sampleRate);
  assert.ok(Math.abs(channels[0][quarter]) < Math.abs(before[quarter]), 'the fade in pulls the level down');
  const mid = Math.round(1 * sampleRate);
  assert.equal(channels[0][mid], before[mid], 'the middle is untouched');
  // fades longer than the clip make a bell rather than an error
  const short = tone(0.2, sampleRate, 440, 1);
  R.applyFade(short, sampleRate, 5, 5);
  assert.ok(short[0][0] === 0);
  assert.ok(short[0][short[0].length - 1] === 0);
  assert.ok(short[0].some(v => v !== 0), 'and it is not silenced completely');
  // no fade changes nothing
  const flat = tone(0.1, sampleRate, 440, 1);
  const copy = flat[0].slice();
  R.applyFade(flat, sampleRate, 0, 0);
  assert.deepEqual(flat[0], copy);
});

test('normalising lifts the peak to just under full scale', () => {
  const channels = tone(0.5, 8000, 440, 0.1);
  const gain = R.normaliseGain(channels);
  assert.ok(gain > 9 && gain < 11, 'a tenth of full scale needs about ten times the gain, got ' + gain);
  assert.ok(Math.abs(R.peakOf(channels) - 0.99) < 1e-3);
  assert.equal(R.normaliseGain([new Float32Array(100)]), 1, 'silence is left alone');
  const loud = tone(0.5, 8000, 440, 0.99);
  assert.equal(R.normaliseGain(loud), 1, 'a clip already at the target is not touched');
});

test('the waveform has one value per column and never exceeds the signal', () => {
  const channels = tone(3, 8000, 100, 0.8);
  const p = R.peaks(channels, 200);
  assert.equal(p.length, 200);
  assert.ok(p.every(v => v >= 0 && v <= 0.81));
  assert.ok(p.filter(v => v > 0.5).length > 150, 'a steady tone should be loud in most columns');
  assert.equal(R.peaks(channels, 0).length, 1, 'a zero width request still returns something drawable');
  assert.equal(R.peaks([new Float32Array(10)], 5).length, 5);
});

test('the WAV header describes the file that follows it', () => {
  const sampleRate = 44100;
  const channels = tone(1, sampleRate, 440, 0.5);
  const buffer = R.wavEncode(channels, sampleRate);
  const info = R.wavInfo(buffer);
  assert.equal(info.format, 1, 'uncompressed PCM');
  assert.equal(info.channels, 2);
  assert.equal(info.sampleRate, sampleRate);
  assert.equal(info.bitsPerSample, 16);
  assert.equal(info.blockAlign, 4, 'two channels at two bytes each');
  assert.equal(info.byteRate, sampleRate * 4);
  assert.equal(info.dataTag, 'data');
  assert.equal(info.frames, sampleRate);
  assert.equal(info.dataBytes, sampleRate * 4);
  assert.equal(info.totalBytes, 44 + sampleRate * 4, 'header plus samples, no padding');
  assert.equal(info.riffSize, info.totalBytes - 8, 'the RIFF size excludes its own first eight bytes');
  // mono writes half as much
  const mono = R.wavEncode([channels[0]], sampleRate);
  assert.equal(R.wavInfo(mono).totalBytes, 44 + sampleRate * 2);
  assert.equal(R.wavInfo(mono).channels, 1);
  assert.equal(R.wavInfo(new ArrayBuffer(10)), null, 'something too short is not a WAV');
});

test('samples are written little endian, interleaved, and clipped rather than wrapped', () => {
  const sampleRate = 8;
  const left = Float32Array.from([0, 1, -1, 0.5, 2, -2, 0, 0]);
  const right = Float32Array.from([0, -1, 1, -0.5, -2, 2, 0, 0]);
  const view = new DataView(R.wavEncode([left, right], sampleRate));
  const at = (frame, channel) => view.getInt16(44 + (frame * 2 + channel) * 2, true);
  assert.equal(at(0, 0), 0);
  assert.equal(at(1, 0), 32767, 'full positive scale');
  assert.equal(at(1, 1), -32768, 'full negative scale');
  assert.equal(at(2, 0), -32768);
  assert.equal(at(3, 0), 16384);
  assert.equal(at(4, 0), 32767, 'a value above one is clipped, not wrapped to a negative');
  assert.equal(at(5, 0), -32768, 'and below minus one likewise');
  const int16 = R.toInt16(left);
  assert.equal(int16.length, left.length);
  assert.deepEqual([int16[1], int16[2], int16[4]], [32767, -32768, 32767]);
});

test('file names come out tidy', () => {
  assert.equal(R.suggestName('My Song (Radio Edit).mp3', 'ringtone', 'wav'), 'my-song-radio-edit-ringtone.wav');
  assert.equal(R.suggestName('track.m4a', 'alert', 'mp3'), 'track-alert.mp3');
  assert.equal(R.suggestName('', 'clip', 'wav'), 'ringtone-clip.wav');
  assert.equal(R.suggestName('///.wav', 'ringtone', 'wav'), 'ringtone-ringtone.wav');
  assert.ok(R.suggestName('x'.repeat(200), 'ringtone', 'wav').length < 60);
});

test('the built in tone is real audio of the right shape', () => {
  const { channels, sampleRate } = R.sampleTone(44100, 6);
  assert.equal(sampleRate, 44100);
  assert.equal(channels.length, 2);
  assert.equal(channels[0].length, 44100 * 6);
  const peak = R.peakOf(channels);
  assert.ok(peak > 0.1 && peak <= 1, 'audible but not clipping, peak ' + peak);
  assert.ok(channels[0].some(v => v < 0) && channels[0].some(v => v > 0), 'it swings both ways');
  // a whole ringtone can be produced from it end to end
  const sel = R.clampSelection(1, 99, 6, 'ringtone');
  const cut = R.applyFade(R.trimRange(channels, sampleRate, sel.start, sel.end), sampleRate, 0.2, 0.5);
  R.normaliseGain(cut);
  const info = R.wavInfo(R.wavEncode(cut, sampleRate));
  assert.equal(info.frames, 5 * 44100);
  assert.equal(info.channels, 2);
});
