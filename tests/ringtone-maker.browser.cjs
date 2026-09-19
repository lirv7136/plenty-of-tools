/* Ringtone Maker in a real browser. Run after a build:
     node tests/ringtone-maker.browser.cjs
   Decodes a real file through the file input, checks the waveform is drawn, exercises the
   selection rules and the keyboard, plays the preview, and proves both exports by reading the
   bytes they produce. Device metrics come from CDP, and the phone layout is judged by trying to
   scroll the page, for the reasons noted in tests/habit-tracker.browser.cjs. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const CORE = require('../tools/ringtone-maker/static/core.js');
const PORT = 8769;
const BASE = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/vnd.microsoft.icon', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.wav': 'audio/wav' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  let file = pathname === '/offline' ? path.join(DIST, 'offline.html')
    : pathname.endsWith('/') ? path.join(DIST, pathname, 'index.html') : path.join(DIST, pathname);
  const ok = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) file = path.join(DIST, '404.html');
  res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-ringtone-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required',
    '--remote-debugging-pipe', `--user-data-dir=${work}/profile`],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

let buffer = '', sequence = 0, session, stderr = '';
const pending = new Map(), exceptions = [];
chrome.stderr.on('data', c => { stderr += c; });
chrome.stdio[4].on('data', chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer); pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  }
});
function send(method, params = {}, target = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out. ${stderr.slice(-600)}`)); }, 30000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }) + '\0');
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function until(expression, label) {
  for (let i = 0; i < 300; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out waiting for ' + (label || expression));
}
const metrics = (width, height, mobile) => send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: !!mobile });
async function go(url) { await send('Page.navigate', { url }); await until("document.readyState==='complete'"); }
async function upload(selector, files) {
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector });
  await send('DOM.setFileInputFiles', { nodeId, files });
}
const ok = m => console.log('  ok  ' + m);

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'tools', 'ringtone-maker', 'index.html')), 'run python3 build.py first');

  // A real file to open: eight seconds of stereo tone, written with the tool's own WAV writer.
  const sourceRate = 44100;
  const seconds = 8;
  const frames = sourceRate * seconds;
  const left = new Float32Array(frames), right = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    left[i] = 0.6 * Math.sin(2 * Math.PI * 440 * i / sourceRate);
    right[i] = 0.4 * Math.sin(2 * Math.PI * 660 * i / sourceRate);
  }
  const wavPath = path.join(work, 'source-tone.wav');
  fs.writeFileSync(wavPath, Buffer.from(CORE.wavEncode([left, right], sourceRate)));
  const junkPath = path.join(work, 'not-audio.wav');
  fs.writeFileSync(junkPath, Buffer.from('this is definitely not audio'));

  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');

  await metrics(1280, 900, false);
  await go(`${BASE}/tools/ringtone-maker/`);
  await until('!!window.RingtoneCore && !!window.__ringtone', 'the tool to start');
  assert.equal(await evaluate("document.getElementById('rm-editor').hidden"), true, 'the editor should be hidden until a file is open');
  assert.ok(await evaluate("!!window.lamejs && !!window.lamejs.Mp3Encoder"), 'the vendored MP3 encoder should be loaded');
  ok('loads with nothing open, and the MP3 encoder is present');

  // open a real file through the real input
  await upload('#rm-file', [wavPath]);
  await until("!document.getElementById('rm-editor').hidden", 'the file to decode');
  const opened = await evaluate(`({
    status: document.getElementById('rm-status').textContent,
    duration: Math.round(window.__ringtone.source.duration * 100) / 100,
    channels: window.__ringtone.source.channels.length,
    selection: window.__ringtone.selection,
    errorHidden: document.getElementById('rm-error').hidden
  })`);
  assert.equal(opened.channels, 2);
  assert.ok(Math.abs(opened.duration - seconds) < 0.05, 'decoded duration ' + opened.duration);
  assert.equal(opened.errorHidden, true);
  assert.match(opened.status, /source-tone\.wav/);
  assert.deepEqual([Math.round(opened.selection.start), Math.round(opened.selection.end)], [0, seconds],
    'the whole file is selected when it is shorter than the ringtone limit');
  ok('decodes a real file through the file input');

  const drawn = await evaluate(`(() => {
    const c = document.getElementById('rm-canvas');
    const g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let painted = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 0) painted++;
    return { width: c.width, height: c.height, painted };
  })()`);
  assert.ok(drawn.width > 100 && drawn.height > 100, 'the canvas should be sized');
  assert.ok(drawn.painted > 2000, 'the waveform should actually be drawn, painted pixels: ' + drawn.painted);
  ok('draws the waveform');

  // the selection rules, through the typed inputs and the keyboard
  await evaluate(`(() => {
    const s = document.getElementById('rm-start'), e = document.getElementById('rm-end');
    s.value = '2'; s.dispatchEvent(new Event('input'));
    e.value = '6'; e.dispatchEvent(new Event('input'));
  })()`);
  let state = await evaluate('window.__ringtone.selection');
  assert.deepEqual([state.start, state.end], [2, 6]);
  assert.match(await evaluate("document.getElementById('rm-length').textContent"), /4\.0 s selected/);
  const geometry = await evaluate(`(() => {
    const wave = document.getElementById('rm-wave').getBoundingClientRect();
    const selection = document.getElementById('rm-selection').getBoundingClientRect();
    const d = window.__ringtone.source.duration;
    return { startShare: (selection.left - wave.left) / wave.width, widthShare: selection.width / wave.width, duration: d };
  })()`);
  assert.ok(Math.abs(geometry.startShare - 2 / seconds) < 0.02, 'the overlay should sit where the selection does');
  assert.ok(Math.abs(geometry.widthShare - 4 / seconds) < 0.02);
  // arrow keys nudge, shift nudges further
  await evaluate("document.getElementById('rm-handle-end').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))");
  state = await evaluate('window.__ringtone.selection');
  assert.ok(Math.abs(state.end - 6.1) < 1e-6, 'an arrow key moves a tenth of a second, got ' + state.end);
  await evaluate("document.getElementById('rm-handle-end').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true}))");
  state = await evaluate('window.__ringtone.selection');
  assert.ok(Math.abs(state.end - 7.1) < 1e-6, 'shift moves a whole second, got ' + state.end);
  ok('the selection follows typed times, the overlay, and the arrow keys');

  // the length ceiling is enforced against the format, not just displayed
  await evaluate(`(() => { const k = document.getElementById('rm-kind'); k.value = 'alert'; k.dispatchEvent(new Event('change')); })()`);
  await evaluate("window.__ringtone.select(0, 999)");
  state = await evaluate('window.__ringtone.selection');
  assert.equal(state.end, seconds, 'a file shorter than the limit is bounded by the file');
  await evaluate("window.__ringtone.loadTone(120)");
  await evaluate(`(() => { const k = document.getElementById('rm-kind'); k.value = 'ringtone'; k.dispatchEvent(new Event('change')); })()`);
  await evaluate("window.__ringtone.select(0, 999)");
  state = await evaluate('window.__ringtone.selection');
  assert.equal(state.end, 40, 'a ringtone stops at 40 seconds');
  await evaluate(`(() => { const k = document.getElementById('rm-kind'); k.value = 'alert'; k.dispatchEvent(new Event('change')); })()`);
  state = await evaluate('window.__ringtone.selection');
  assert.equal(state.end, 30, 'switching to an alert tone shortens an over long selection');
  ok('Apple\'s 40 and 30 second limits are enforced, not merely explained');

  // preview
  await evaluate("window.__ringtone.select(5, 9)");
  await evaluate("document.getElementById('rm-play').click()");
  await until('window.__ringtone.playing', 'the preview to start');
  assert.equal(await evaluate("document.getElementById('rm-playhead').hidden"), false, 'the playhead should show while playing');
  assert.match(await evaluate("document.getElementById('rm-play').textContent"), /Stop/);
  await evaluate("document.getElementById('rm-play').click()");
  await until('!window.__ringtone.playing', 'the preview to stop');
  assert.equal(await evaluate("document.getElementById('rm-playhead').hidden"), true);
  ok('the preview plays the selection and stops');

  // the WAV it would download, checked byte by byte
  const wavCheck = await evaluate(`(() => {
    document.getElementById('rm-fade-in').value = '0.5';
    document.getElementById('rm-fade-in').dispatchEvent(new Event('input'));
    document.getElementById('rm-fade-out').value = '1';
    document.getElementById('rm-fade-out').dispatchEvent(new Event('input'));
    document.getElementById('rm-mono').checked = false;
    document.getElementById('rm-mono').dispatchEvent(new Event('change'));
    const buffer = window.__ringtone.wav();
    const info = RingtoneCore.wavInfo(buffer);
    const view = new DataView(buffer);
    const lastFrame = info.frames - 1;
    return { info, firstSample: view.getInt16(44, true),
      lastSample: view.getInt16(44 + (lastFrame * info.channels) * 2, true),
      expectedFrames: Math.round(4 * window.__ringtone.source.sampleRate),
      name: RingtoneCore.suggestName(window.__ringtone.source.name, 'alert', 'wav') };
  })()`);
  assert.equal(wavCheck.info.format, 1);
  assert.equal(wavCheck.info.channels, 2);
  assert.equal(wavCheck.info.bitsPerSample, 16);
  assert.equal(wavCheck.info.frames, wavCheck.expectedFrames, 'the file should be exactly the selection long');
  assert.equal(wavCheck.info.totalBytes, 44 + wavCheck.info.dataBytes);
  assert.equal(wavCheck.firstSample, 0, 'the fade in must start from silence');
  assert.equal(wavCheck.lastSample, 0, 'the fade out must end in silence');
  assert.equal(wavCheck.name, 'built-in-tone-alert.wav');
  ok('the WAV is the right length and fades from and to silence');

  const mono = await evaluate(`(() => {
    document.getElementById('rm-mono').checked = true;
    document.getElementById('rm-mono').dispatchEvent(new Event('change'));
    const info = RingtoneCore.wavInfo(window.__ringtone.wav());
    return { channels: info.channels, bytes: info.totalBytes };
  })()`);
  assert.equal(mono.channels, 1, 'mixing down should write one channel');
  assert.ok(mono.bytes < wavCheck.info.totalBytes, 'and a smaller file');
  ok('the mono option halves the file');

  // the MP3, produced by the vendored encoder and checked for a real MPEG frame
  const mp3 = await evaluate(`(async () => {
    const blob = await window.__ringtone.mp3(128);
    const head = new Uint8Array(await blob.slice(0, 4).arrayBuffer());
    return { size: blob.size, type: blob.type, head: [...head] };
  })()`);
  assert.equal(mp3.type, 'audio/mpeg');
  assert.ok(mp3.size > 4000, 'four seconds at 128 kbps should be tens of kilobytes, got ' + mp3.size);
  const id3 = mp3.head[0] === 0x49 && mp3.head[1] === 0x44 && mp3.head[2] === 0x33;
  const sync = mp3.head[0] === 0xff && (mp3.head[1] & 0xe0) === 0xe0;
  assert.ok(id3 || sync, 'the MP3 should start with a frame sync or an ID3 tag, got ' + mp3.head);
  ok('the MP3 encodes to a real MPEG stream');

  // a file the browser cannot decode is refused, and nothing is left half loaded
  await go(`${BASE}/tools/ringtone-maker/`);
  await until('!!window.__ringtone');
  await upload('#rm-file', [junkPath]);
  await until("!document.getElementById('rm-error').hidden", 'the undecodable file to be refused');
  assert.match(await evaluate("document.getElementById('rm-error').textContent"), /could not decode/);
  assert.equal(await evaluate("document.getElementById('rm-editor').hidden"), true, 'a failed decode must not open the editor');
  ok('a file it cannot decode is refused with a clear message');

  // phone width
  await metrics(390, 844, true);
  await go(`${BASE}/tools/ringtone-maker/`);
  await until('!!window.__ringtone');
  await evaluate("document.getElementById('rm-sample').click()");
  await until("!document.getElementById('rm-editor').hidden");
  const layout = await evaluate(`(() => {
    const limit = document.documentElement.clientWidth;
    const scrolled = el => { for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) { if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) return true; } return false; };
    const bad = [];
    for (const el of document.querySelectorAll('main, main *')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > limit + 1 && !scrolled(el)) bad.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : ''));
    }
    window.scrollTo(9999, 0);
    const scrolledBy = Math.round(window.scrollX);
    window.scrollTo(0, 0);
    return { limit, bad: [...new Set(bad)].slice(0, 6), scrolledBy,
      columns: getComputedStyle(document.querySelector('.rm-grid')).gridTemplateColumns.split(' ').length,
      canvasWidth: document.getElementById('rm-canvas').getBoundingClientRect().width };
  })()`);
  assert.equal(layout.limit, 390);
  assert.deepEqual(layout.bad, [], 'these elements run past the right edge at 390 px');
  assert.equal(layout.scrolledBy, 0, 'the page scrolls sideways at phone width by ' + layout.scrolledBy + ' px');
  assert.equal(layout.columns, 1, 'the panels should stack');
  assert.ok(layout.canvasWidth <= 390, 'the waveform should fit, got ' + layout.canvasWidth);
  ok('fits a phone, and the waveform is redrawn to the narrower width');

  assert.deepEqual(exceptions.map(e => e.text), [], 'uncaught page exceptions');
  console.log('\nPASS: decode, waveform, selection, limits, keyboard, preview, WAV, mono, MP3, refusal, phone layout.');
})().catch(e => {
  console.error('\nFAIL:', e && e.message ? e.message : e);
  if (exceptions.length) console.error(exceptions);
  process.exitCode = 1;
}).finally(async () => {
  server.close();
  chrome.kill();
  for (const p of pending.values()) clearTimeout(p.timer);
  for (let i = 0; i < 25; i++) {
    try { fs.rmSync(work, { recursive: true, force: true }); break; }
    catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
});
