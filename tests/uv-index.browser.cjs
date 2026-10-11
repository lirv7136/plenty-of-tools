/* UV Index Now in a real browser. Run after a build:
     node tests/uv-index.browser.cjs
   ARPANSA's feed is intercepted over CDP and answered from tests/fixtures/arpansa-uvvalues.xml,
   edited to daytime readings, so the test never depends on the live feed or the weather. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8770;
const BASE = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/vnd.microsoft.icon', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  let file = pathname === '/offline' ? path.join(DIST, 'offline.html')
    : pathname.endsWith('/') ? path.join(DIST, pathname, 'index.html') : path.join(DIST, pathname);
  const ok = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) file = path.join(DIST, '404.html');
  res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-uv-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}/p`],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

let buffer = '', sequence = 0, session, stderr = '';
const pending = new Map(), exceptions = [], requests = [];
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
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
    if (message.method === 'Fetch.requestPaused') answerFeed(message.params.requestId, message.sessionId);
    if (message.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: dialogAccept }).catch(() => {});
    }
  }
});
let dialogAccept = true;
function send(method, params = {}, target = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out. ${stderr.slice(-600)}`)); }, 20000);
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
  for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out waiting for ' + (label || expression));
}
const metrics = (width, height, mobile) => send('Emulation.setDeviceMetricsOverride',
  { width, height, deviceScaleFactor: 1, mobile: !!mobile });
async function go(url) { await send('Page.navigate', { url }); await until("document.readyState==='complete'"); }
const ok = m => console.log('  ok  ' + m);

const utc = (ms) => { const d = new Date(ms); const p = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`; };
function daytimeFeed() {
  let xml = fs.readFileSync(path.join(__dirname, 'fixtures', 'arpansa-uvvalues.xml'), 'utf8');
  xml = xml.replace(/<utcdatetime>[^<]*<\/utcdatetime>/g, `<utcdatetime>${utc(Date.now() - 2 * 60000)}</utcdatetime>`);
  const set = (id, index, when) => {
    xml = xml.replace(new RegExp(`(<location id="${id}">[\\s\\S]*?<index>)[^<]*(</index>)`), `$1${index}$2`);
    if (when) xml = xml.replace(new RegExp(`(<location id="${id}">[\\s\\S]*?<utcdatetime>)[^<]*(</utcdatetime>)`), `$1${when}$2`);
  };
  set('Sydney', '9.4'); set('Perth', '2.1'); set('Kingston', '5.0', utc(Date.now() - 3 * 3600000));
  return xml;
}
let feedFails = false;
function answerFeed(requestId, sessionId) {
  const params = feedFails
    ? { requestId, responseCode: 500, responseHeaders: [{ name: 'Access-Control-Allow-Origin', value: '*' }], body: '' }
    : { requestId, responseCode: 200, responseHeaders: [{ name: 'Content-Type', value: 'text/xml' }, { name: 'Access-Control-Allow-Origin', value: '*' }],
      body: Buffer.from(daytimeFeed()).toString('base64') };
  send('Fetch.fulfillRequest', params, sessionId).catch(() => {});
}
const text = id => evaluate(`document.getElementById('${id}').textContent`);

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'tools', 'uv-index', 'index.html')), 'run python3 build.py first');
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Fetch.enable', { patterns: [{ urlPattern: 'https://uvdata.arpansa.gov.au/*' }] });
  await send('Emulation.setTimezoneOverride', { timezoneId: 'Australia/Sydney' });
  await metrics(1280, 900, false);

  await go(`${BASE}/tools/uv-index/`);
  await until("document.getElementById('number').textContent === '9.4'", 'the Sydney reading (picked from the time zone)');
  assert.equal(await text('cat'), 'Very high');
  assert.match(await text('advice'), /essential/);
  assert.ok(await evaluate("document.getElementById('number').classList.contains('uv-very-high')"));
  assert.match(await text('when'), /[23] minutes ago/); // the fixture's times drop the seconds
  ok('Sydney by time zone: 9.4, very high, protection essential, measured minutes ago');

  assert.equal(await evaluate("document.querySelectorAll('#all button').length"), 16);
  assert.ok(await evaluate("[...document.querySelectorAll('#all button')].find(b => b.textContent.startsWith('Hobart')).classList.contains('stale')"), 'Hobart is out of date');
  assert.ok(await evaluate("[...document.querySelectorAll('#all button')].pop().textContent.includes('Antarctica')"), 'Antarctic stations last');
  ok('every station listed, cities first, the stale one marked');

  await evaluate("(() => { const s = document.getElementById('station'); s.value = 'Perth'; s.dispatchEvent(new Event('change')); return true; })()");
  assert.equal(await text('number'), '2.1');
  assert.equal(await text('cat'), 'Low');
  assert.match(await text('advice'), /isn.t needed/);
  await go(`${BASE}/tools/uv-index/`);
  await until("document.getElementById('number').textContent === '2.1'", 'Perth remembered after reload');
  ok('switching to Perth (2.1, low) and it is remembered after a reload');

  await evaluate("(() => { const s = document.getElementById('station'); s.value = 'Kingston'; s.dispatchEvent(new Event('change')); return true; })()");
  assert.match(await text('when'), /out of date/);
  ok('a stale station says so instead of looking current');

  feedFails = true;
  await evaluate('window.__uv.refresh()');
  await until("/showing the last reading/.test(document.getElementById('status').textContent)", 'the failure message');
  assert.equal(await text('number'), '5');
  ok('a failed refresh keeps the last reading and says so');

  assert.deepEqual(exceptions.map(e => e.text), [], 'uncaught page exceptions');
  console.log('\nPASS: reading, categories, advice, staleness, station memory, feed failure.');
})().catch(e => {
  console.error('\nFAIL:', e && e.message ? e.message : e);
  if (exceptions.length) console.error(exceptions);
  process.exitCode = 1;
}).finally(async () => {
  server.close();
  chrome.kill();
  for (const p of pending.values()) clearTimeout(p.timer);
  for (let i = 0; i < 25; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; }
    catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
});
