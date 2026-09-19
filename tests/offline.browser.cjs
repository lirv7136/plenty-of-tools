/* Offline test for the service worker. Run after a build:
     node tests/offline.browser.cjs

   It serves dist/ itself on 127.0.0.1:8766 with Cache-Control: no-store on everything, so the
   browser's own HTTP cache can never satisfy a request. Anything that loads while the network
   is off therefore came from the service worker's cache and nowhere else.

   The important detail: emulating offline on the page target alone is not enough. A navigation
   is answered by the service worker, whose fetch runs in its own target and stays online, so
   the page appears to work offline when it does not. This test applies the emulation to every
   attached target, the service worker included. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8766;
const BASE = `http://127.0.0.1:${PORT}`;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.ico': 'image/vnd.microsoft.icon', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml', '.wasm': 'application/wasm'
};

// Mimics Cloudflare Pages: a trailing slash serves index.html, /offline serves offline.html,
// the query string is ignored, and an unknown path gets 404.html with a real 404.
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  let file = pathname === '/offline' ? path.join(DIST, 'offline.html')
    : pathname.endsWith('/') ? path.join(DIST, pathname, 'index.html')
      : path.join(DIST, pathname);
  const ok = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) file = path.join(DIST, '404.html');
  res.writeHead(ok ? 200 : 404, {
    'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
    'Cache-Control': 'no-store'
  });
  res.end(fs.readFileSync(file));
});

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-offline-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}/p`],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

let buffer = '', sequence = 0, pageSession = null, stderr = '', offline = false;
const pending = new Map(), sessions = new Map(), exceptions = [];
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
    if (message.method === 'Target.attachedToTarget') {
      const { sessionId, targetInfo } = message.params;
      sessions.set(sessionId, targetInfo.type);
      if (targetInfo.type === 'page' && !pageSession) pageSession = sessionId;
      // A service worker can be stopped and restarted at any time; a fresh one must inherit
      // whatever network state the test is currently asserting.
      send('Network.enable', {}, sessionId)
        .then(() => offline && emulate(sessionId, true))
        .catch(() => {});
    }
    if (message.method === 'Target.detachedFromTarget') sessions.delete(message.params.sessionId);
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
  }
});

function send(method, params = {}, target = pageSession) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out. ${stderr.slice(-800)}`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }) + '\0');
  });
}
const emulate = (sessionId, off) => send('Network.emulateNetworkConditions', {
  offline: off, latency: 0, downloadThroughput: off ? 0 : -1, uploadThroughput: off ? 0 : -1
}, sessionId);

async function setOffline(off) {
  offline = off;
  for (const [sessionId, type] of sessions) {
    if (type === 'page' || type === 'service_worker' || type === 'worker') {
      await emulate(sessionId, off).catch(() => {});
    }
  }
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function until(expression, label) {
  for (let i = 0; i < 300; i++) {
    if (await evaluate(expression)) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Timed out waiting for ' + (label || expression));
}
async function go(url) {
  await send('Page.navigate', { url });
  await until("document.readyState === 'complete'", 'load of ' + url);
}
const ok = msg => console.log('  ok  ' + msg);

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'sw.js')), 'run python3 build.py first');
  const manifest = JSON.parse(fs.readFileSync(path.join(DIST, 'offline-manifest.json'), 'utf8'));
  const precached = new Set(Object.values(manifest.pages).flat());
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));

  // Browser level auto attach, so service worker targets attach too, not only the page's workers.
  await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, null);
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  for (let i = 0; i < 100 && !pageSession; i++) await new Promise(r => setTimeout(r, 50));
  assert.ok(pageSession, 'no page session attached');
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');

  console.log('online: install the worker');
  await go(`${BASE}/tools/tuner-metronome/`);
  await until("navigator.serviceWorker.controller !== null", 'the worker to control the page');
  await until(`caches.keys().then(k => k.some(n => n === 'pot-app-${manifest.build}'))`, 'the build cache');
  await until(`caches.open('pot-app-${manifest.build}').then(c => c.keys()).then(k => k.length >= ${precached.size})`, 'precaching to finish');
  const cached = await evaluate(`caches.open('pot-app-${manifest.build}').then(c => c.keys()).then(k => k.map(r => new URL(r.url).pathname + new URL(r.url).search))`);
  for (const url of precached) assert.ok(cached.includes(url), 'not precached: ' + url);
  assert.ok(cached.includes('/offline'), 'the offline page was not precached');
  ok(`${cached.length} files precached, build ${manifest.build}`);
  const stale = await evaluate("caches.keys().then(k => k.filter(n => n.startsWith('pot-offline-')))");
  assert.deepEqual(stale, [], 'an old pot-offline-* cache survived activation');
  ok('the previous cache was deleted on activate');

  console.log('offline: every target, the worker included');
  await setOffline(true);
  assert.match(await evaluate("fetch('/vs/splitwise/', {cache:'no-store'}).then(r => 'status ' + r.status).catch(e => 'failed')"),
    /failed/, 'the page target still reached the network');

  await go(`${BASE}/tools/tuner-metronome/`);
  const tuner = await evaluate(`(() => {
    const T = window.__tuner, sr = 48000, n = 4096;
    const tone = f => { const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = 0.3 * Math.sin(2 * Math.PI * f * i / sr); return b; };
    const nav = performance.getEntriesByType('navigation')[0];
    return { transferSize: nav.transferSize, fromWorker: nav.workerStart > 0, title: document.title,
      radius: getComputedStyle(document.querySelector('.card')).borderRadius,
      presets: document.querySelectorAll('#preset option').length,
      strings: document.querySelectorAll('#strings button').length,
      a440: T ? Math.round(T.detectPitch(tone(440), sr)) : null,
      a1500: T ? Math.round(T.detectPitch(tone(1500), sr)) : null };
  })()`);
  assert.equal(tuner.transferSize, 0, 'the page came over the network, not from the cache');
  assert.ok(tuner.fromWorker, 'the service worker did not answer the navigation');
  assert.match(tuner.title, /tuner and metronome/i);
  assert.notEqual(tuner.radius, '0px', 'the stylesheet was not served from the cache');
  assert.equal(tuner.presets, 12);
  assert.equal(tuner.strings, 6);
  assert.equal(tuner.a440, 440);
  assert.equal(tuner.a1500, 1500, 'pitch detection is wrong above 1.3 kHz');
  ok('the tuner loads and detects pitch with the network off');

  const ledger = Buffer.from(JSON.stringify({
    v: 1, n: 'Offline test', c: 'A$',
    p: [{ id: 'p1', name: 'Mia' }, { id: 'p2', name: 'Tom' }, { id: 'p3', name: 'Priya' }],
    e: [{ id: 'e1', desc: 'Fuel', payer: 'p1', cents: 9000, date: '2026-09-19', split: { type: 'equal', among: ['p1', 'p2', 'p3'] } },
      { id: 'e2', desc: 'Cabin', payer: 'p2', cents: 30000, date: '2026-09-19', split: { type: 'equal', among: ['p1', 'p2', 'p3'] } }]
  })).toString('base64url');
  await go(`${BASE}/tools/settle-up/?ref=offline#${ledger}`);
  const settle = await evaluate(`({
    transferSize: performance.getEntriesByType('navigation')[0].transferSize,
    group: document.getElementById('group-name').value,
    plan: [...document.querySelectorAll('#plan li')].map(li => li.textContent.replace(/\\s+/g, ' ')),
    note: document.getElementById('plan-note').textContent
  })`);
  assert.equal(settle.transferSize, 0, 'a query string stopped the cache from matching the page');
  assert.equal(settle.group, 'Offline test');
  assert.deepEqual(settle.plan, ['Priya pays Tom A$130.00', 'Mia pays Tom A$40.00']);
  ok('a share link restores a ledger offline, query string and all');

  await go(`${BASE}/`);
  assert.ok(await evaluate("document.querySelectorAll('.card').length >= 13"), 'the home page did not come from the cache');
  ok('the home page, the installed app start url, works offline');

  await go(`${BASE}/vs/splitwise/`);
  assert.ok(await evaluate(`document.body.textContent.includes("You're offline")`),
    'a page that was never precached should fall back to the offline page');
  ok('a page outside the precache falls back to the offline page');

  console.log('back online');
  await setOffline(false);
  await go(`${BASE}/vs/splitwise/`);
  assert.match(await evaluate("document.querySelector('h1').textContent"), /Splitwise/);
  ok('normal service resumes');

  assert.deepEqual(exceptions.map(e => e.text || e.exception && e.exception.description), [], 'page exceptions');
  console.log('\nPASS: precache, offline navigation, offline assets, share link, fallback, recovery.');
})().catch(e => {
  console.error('\nFAIL:', e && e.message ? e.message : e);
  if (exceptions.length) console.error(exceptions);
  process.exitCode = 1;
}).finally(async () => {
  server.close();
  chrome.kill();
  for (const p of pending.values()) clearTimeout(p.timer);
  // Chrome keeps writing to the profile for a moment after the kill, so retry the cleanup.
  for (let i = 0; i < 25; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; }
    catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
});
