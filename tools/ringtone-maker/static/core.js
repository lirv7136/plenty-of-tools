/* Ringtone Maker core: selection rules, trimming, fades, gain, waveform peaks and WAV writing.
   Pure functions over Float32Array channels. No DOM, no Web Audio, no libraries.
   UMD so node tests can require() it and the page can use RingtoneCore. */
(function (root) {
  'use strict';

  // Apple's limits: a ringtone may run to 40 seconds and an alert tone to 30. Android has no
  // limit worth enforcing, so "clip" is just a sane ceiling for a file people will carry around.
  const LIMITS = { ringtone: 40, alert: 30, clip: 300 };
  const KIND_LABELS = { ringtone: 'Ringtone, up to 40 seconds', alert: 'Alert or text tone, up to 30 seconds', clip: 'Any length' };

  const maxSeconds = kind => LIMITS[kind] || LIMITS.clip;
  const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;

  // A selection is always inside the file, never inverted, and never longer than the kind allows.
  function clampSelection(start, end, duration, kind) {
    duration = Math.max(0, duration || 0);
    start = clamp(Number(start) || 0, 0, duration);
    end = clamp(Number(end) || 0, start, duration);
    const max = maxSeconds(kind);
    if (end - start > max) end = Math.min(duration, start + max);
    return { start, end };
  }
  // Move the window without changing its length, keeping it inside the file.
  function moveSelection(start, end, delta, duration) {
    const span = end - start;
    const newStart = clamp(start + delta, 0, Math.max(0, duration - span));
    return { start: newStart, end: newStart + span };
  }
  // "Give me 40 seconds from here", trimmed by the end of the file.
  function snapFrom(start, duration, kind) {
    return clampSelection(start, start + maxSeconds(kind), duration, kind);
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Number(seconds) || 0);
    const m = Math.floor(seconds / 60);
    const s = seconds - m * 60;
    return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1);
  }

  // ---------- audio maths ----------
  // Copy the selected span out of each channel. A zero length or reversed selection gives one
  // sample rather than an empty buffer, because Web Audio refuses a zero length AudioBuffer.
  function trimRange(channels, sampleRate, start, end) {
    const from = Math.max(0, Math.round(start * sampleRate));
    const to = Math.max(from + 1, Math.round(end * sampleRate));
    const length = Math.min(to, channels[0].length) - from;
    return channels.map(data => data.slice(from, from + Math.max(1, length)));
  }

  // Equal power curves, so the first and last samples are exactly zero and there is no click.
  // Both fades are clamped to the clip and may overlap; a short clip with long fades becomes a
  // bell rather than an error.
  function applyFade(channels, sampleRate, fadeIn, fadeOut) {
    const length = channels[0].length;
    const nIn = Math.min(length, Math.max(0, Math.round((fadeIn || 0) * sampleRate)));
    const nOut = Math.min(length, Math.max(0, Math.round((fadeOut || 0) * sampleRate)));
    for (const data of channels) {
      for (let i = 0; i < nIn; i++) data[i] *= Math.sin(Math.PI / 2 * (i / nIn));
      for (let i = 0; i < nOut; i++) {
        const at = length - 1 - i;
        data[at] *= Math.sin(Math.PI / 2 * (i / nOut));
      }
    }
    return channels;
  }

  const peakOf = channels => {
    let peak = 0;
    for (const data of channels) for (let i = 0; i < data.length; i++) {
      const v = data[i] < 0 ? -data[i] : data[i];
      if (v > peak) peak = v;
    }
    return peak;
  };
  // Lift the clip so its loudest moment sits just under full scale. Returns the gain applied,
  // which is 1 when the clip is silent or already there.
  function normaliseGain(channels, target) {
    target = target == null ? 0.99 : target;
    const peak = peakOf(channels);
    if (!peak) return 1;
    const gain = target / peak;
    if (Math.abs(gain - 1) < 1e-4) return 1;
    for (const data of channels) for (let i = 0; i < data.length; i++) data[i] *= gain;
    return gain;
  }

  // One value per pixel column for drawing: the loudest sample in that column, across channels.
  function peaks(channels, buckets) {
    buckets = Math.max(1, Math.floor(buckets || 1));
    const length = channels[0].length;
    const out = new Float32Array(buckets);
    const per = length / buckets;
    for (let b = 0; b < buckets; b++) {
      const from = Math.floor(b * per), to = Math.min(length, Math.max(from + 1, Math.floor((b + 1) * per)));
      let peak = 0;
      for (const data of channels) {
        for (let i = from; i < to; i++) {
          const v = data[i] < 0 ? -data[i] : data[i];
          if (v > peak) peak = v;
        }
      }
      out[b] = peak;
    }
    return out;
  }

  // ---------- WAV ----------
  // 16 bit PCM, the format every phone accepts as a ringtone without a converter.
  function wavEncode(channels, sampleRate) {
    const count = channels.length, frames = channels[0].length;
    const dataBytes = frames * count * 2;
    const buffer = new ArrayBuffer(44 + dataBytes);
    const view = new DataView(buffer);
    const ascii = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    ascii(0, 'RIFF');
    view.setUint32(4, 36 + dataBytes, true);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    view.setUint32(16, 16, true);          // PCM header length
    view.setUint16(20, 1, true);           // format 1 = PCM
    view.setUint16(22, count, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * count * 2, true);   // bytes per second
    view.setUint16(32, count * 2, true);                // bytes per frame
    view.setUint16(34, 16, true);                       // bits per sample
    ascii(36, 'data');
    view.setUint32(40, dataBytes, true);
    let offset = 44;
    for (let i = 0; i < frames; i++) {
      for (let c = 0; c < count; c++) {
        const v = clamp(channels[c][i], -1, 1);
        view.setInt16(offset, Math.round(v < 0 ? v * 0x8000 : v * 0x7fff), true);
        offset += 2;
      }
    }
    return buffer;
  }
  // Enough of a reader to let a test prove the writer, and to sanity check a file.
  function wavInfo(buffer) {
    const view = new DataView(buffer);
    const tag = off => String.fromCharCode(view.getUint8(off), view.getUint8(off + 1), view.getUint8(off + 2), view.getUint8(off + 3));
    if (buffer.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    return {
      riffSize: view.getUint32(4, true),
      format: view.getUint16(20, true),
      channels: view.getUint16(22, true),
      sampleRate: view.getUint32(24, true),
      byteRate: view.getUint32(28, true),
      blockAlign: view.getUint16(32, true),
      bitsPerSample: view.getUint16(34, true),
      dataTag: tag(36),
      dataBytes: view.getUint32(40, true),
      frames: view.getUint32(40, true) / (view.getUint16(22, true) * 2),
      totalBytes: buffer.byteLength
    };
  }

  // Interleaved 16 bit samples per channel, which is what the MP3 encoder wants.
  function toInt16(channel) {
    const out = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i++) {
      const v = clamp(channel[i], -1, 1);
      out[i] = Math.round(v < 0 ? v * 0x8000 : v * 0x7fff);
    }
    return out;
  }

  // ---------- naming ----------
  function suggestName(sourceName, kind, extension) {
    const base = String(sourceName || 'ringtone')
      .replace(/\.[A-Za-z0-9]{1,5}$/, '')
      .replace(/[^\w\- ]+/g, '')
      .trim().replace(/\s+/g, '-').toLowerCase()
      .slice(0, 40) || 'ringtone';
    const suffix = kind === 'alert' ? 'alert' : kind === 'clip' ? 'clip' : 'ringtone';
    return `${base}-${suffix}.${extension}`;
  }

  // A recognisable tone so the tool has something to demonstrate itself with: a short rising
  // arpeggio, generated rather than shipped as a file.
  function sampleTone(sampleRate, seconds) {
    sampleRate = sampleRate || 44100;
    seconds = seconds || 12;
    const frames = Math.floor(sampleRate * seconds);
    const left = new Float32Array(frames), right = new Float32Array(frames);
    const notes = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63];
    const per = frames / notes.length;
    for (let i = 0; i < frames; i++) {
      const n = Math.min(notes.length - 1, Math.floor(i / per));
      const t = (i - n * per) / sampleRate;
      const env = Math.exp(-3 * t) * (1 - Math.exp(-200 * t));
      const f = notes[n];
      const v = env * (0.5 * Math.sin(2 * Math.PI * f * t) + 0.2 * Math.sin(4 * Math.PI * f * t));
      left[i] = v;
      right[i] = v * 0.85;
    }
    return { channels: [left, right], sampleRate };
  }

  const api = {
    LIMITS, KIND_LABELS, maxSeconds, clampSelection, moveSelection, snapFrom, formatTime,
    trimRange, applyFade, normaliseGain, peakOf, peaks,
    wavEncode, wavInfo, toInt16, suggestName, sampleTone
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RingtoneCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
