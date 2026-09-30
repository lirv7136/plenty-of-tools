/* Car Logbook in a real browser. Run after a build:
     node tests/car-logbook.browser.cjs
   Covers the DOM and the layout; the maths is covered by tests/car-logbook.test.cjs.
   Device metrics are set over CDP rather than by resizing a window, because a window resize
   does not reliably reflow the layout and a phone width check then passes when it should not. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8771;
const BASE = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/vnd.microsoft.icon', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const requests = [];
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  let file = pathname === '/offline' ? path.join(DIST, 'offline.html')
    : pathname.endsWith('/') ? path.join(DIST, pathname, 'index.html') : path.join(DIST, pathname);
  const ok = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) file = path.join(DIST, '404.html');
  res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-logbook-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}/p`],
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
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
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
const set = (id, v) => evaluate(`(() => { const e = document.getElementById(${JSON.stringify(id)}); e.value = ${JSON.stringify(String(v))}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); })()`);
const click = id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
const text = id => evaluate(`document.getElementById(${JSON.stringify(id)}).textContent`);
const rows = () => evaluate("document.querySelectorAll('#lb-rows tr').length");
const PAGE = BASE + '/tools/car-logbook/';

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await metrics(1280, 1000);
  await go(PAGE);
  await until('!!window.LogbookCore && !!window.__logbook', 'the page scripts');

  assert.match(await text('lb-summary'), /No logbook yet/);
  assert.equal(await evaluate("document.getElementById('lb-period-body').hidden"), true);
  ok('empty state explains what to do');

  // start a logbook
  const today = await evaluate('LogbookCore.todayISO()');
  const start = await evaluate(`LogbookCore.addDays(${JSON.stringify(today)}, -10)`);
  await set('lb-car-name', 'Test car'); await set('lb-car-rego', 'XYZ789');
  await set('lb-car-start', start); await set('lb-car-startodo', '50000');
  await click('lb-car-save');
  await until("!document.getElementById('lb-period-body').hidden", 'the period panel');
  assert.equal(await evaluate("document.getElementById('lb-start').value"), '50000', 'the first trip starts at the opening reading');
  assert.match(await text('lb-progress-text'), /Day 11 of 84/);
  ok('a logbook starts, and the period counts day 11 of 84');

  // a work trip without a purpose is refused
  await set('lb-date', today); await set('lb-end', '50025'); await set('lb-purpose', ''); await set('lb-dest', 'Parramatta');
  await click('lb-trip-save');
  assert.match(await text('lb-trip-error'), /purpose/);
  assert.equal(await rows(), 0);
  ok('a work trip without a purpose is refused with a reason');

  // work trip, saved as a favourite
  await set('lb-purpose', 'Client meeting');
  await evaluate("document.getElementById('lb-savefav').checked = true");
  assert.equal(await text('lb-km'), '25 km');
  await click('lb-trip-save');
  await until("document.querySelectorAll('#lb-rows tr').length === 1", 'the first trip row');
  assert.equal(await evaluate("document.getElementById('lb-start').value"), '50025', 'the next trip starts where the last ended');
  assert.equal(await text('lb-pct'), '100%');
  // private trip
  await evaluate("document.querySelector('input[name=lb-type][value=private]').click()");
  assert.equal(await evaluate("document.getElementById('lb-work-fields').hidden"), true, 'private trips hide purpose and destination');
  await set('lb-end', '50100');
  await click('lb-trip-save');
  await until("document.querySelectorAll('#lb-rows tr').length === 2", 'the second trip row');
  assert.equal(await text('lb-pct'), '25%', '25 work km of 100 total');
  assert.equal(await text('lb-bkm'), '25'); assert.equal(await text('lb-tkm'), '100');
  ok('work and private trips give the right business use percentage');

  // favourite fills purpose, destination and the end reading
  assert.equal(await evaluate("document.getElementById('lb-fav-row').hidden"), false);
  const favId = await evaluate("document.getElementById('lb-fav').options[1].value");
  await set('lb-fav', favId);
  assert.equal(await evaluate("document.getElementById('lb-purpose').value"), 'Client meeting');
  assert.equal(await evaluate("document.getElementById('lb-end').value"), '50125');
  await click('lb-trip-cancel');
  ok('a saved trip fills purpose, destination and the expected end reading');

  // markup in a field is shown as text, never run
  await set('lb-purpose', '<img src=x onerror="window.__pwned=1">'); await set('lb-dest', 'B'); await set('lb-end', '50130');
  await click('lb-trip-save');
  await until("document.querySelectorAll('#lb-rows tr').length === 3");
  assert.equal(await evaluate('window.__pwned === undefined && !document.querySelector("#lb-rows img")'), true);
  ok('text typed into a trip is shown as text, never as markup');

  // reload keeps everything
  await go(PAGE); await until('!!window.__logbook');
  assert.equal(await rows(), 3);
  assert.match(await text('lb-summary'), /Test car: 2 work trips/);
  ok('trips survive a reload');

  // the example: a finished 12 week logbook with no problems
  await click('lb-sample');
  await until("document.querySelectorAll('#lb-rows tr').length > 60", 'the example trips');
  assert.match(await text('lb-progress-text'), /12 continuous weeks reached/);
  assert.equal(await evaluate("document.getElementById('lb-progress').getAttribute('aria-valuenow')"), '84');
  assert.equal(await evaluate("document.querySelectorAll('#lb-checks li').length"), 0);
  assert.match(await text('lb-valid'), /income year/);
  assert.equal(await evaluate("document.getElementById('lb-merge').hidden"), true);
  ok('the example loads a complete 12 week logbook with no problems flagged');

  // print layout: the report, without the forms
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  const printed = await evaluate(`(() => {
    const vis = s => getComputedStyle(document.querySelector(s)).display !== 'none';
    return { head: vis('.lb-print-head'), car: vis('.lb-car'), add: vis('.lb-add'), table: vis('#lb-table'), bar: vis('.lb-bar'), faq: vis('.lb-faq'), footer: vis('.site-footer') };
  })()`);
  await send('Emulation.setEmulatedMedia', { media: '' });
  assert.deepEqual(printed, { head: true, car: false, add: false, table: true, bar: false, faq: false, footer: false });
  assert.match(await text('lb-print-car'), /Work ute · ABC123 · Toyota Hilux — logbook .* business use \d/);
  ok('the printed report has the summary and trips, and none of the controls');

  // a damaged backup is refused and nothing changes
  const bad = path.join(profile, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ app: 'plentyoftools car-logbook', v: 1, cars: [], trips: [{ id: 'x' }] }));
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#lb-import' });
  const before = await rows();
  await send('DOM.setFileInputFiles', { nodeId, files: [bad] });
  await until("/not restored/.test(document.getElementById('lb-toast').textContent)", 'the refusal message');
  assert.equal(await rows(), before);
  ok('a damaged backup file is refused and the logbook is untouched');

  // phone width: stacks and never scrolls sideways
  await metrics(390, 844, true);
  await go(PAGE); await until('!!window.__logbook');
  const layout = await evaluate(`(() => {
    window.scrollTo(9999, 0); const x = Math.round(window.scrollX); window.scrollTo(0, 0);
    return { x, cols: getComputedStyle(document.querySelector('.lb-grid')).gridTemplateColumns.split(' ').length };
  })()`);
  assert.equal(layout.x, 0, 'the page scrolled sideways by ' + layout.x + ' px');
  assert.equal(layout.cols, 1);
  ok('no sideways scroll at 390 px, and the layout stacks');

  // nothing leaves the device apart from the site's own files and its page view counter
  const outside = requests.filter(u => /^https?:/.test(u) && !u.startsWith(BASE) && !/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(u));
  assert.deepEqual(outside, [], 'requests to other hosts');
  ok('no request leaves the site');

  assert.deepEqual(exceptions.map(e => e.text), [], 'uncaught page exceptions');
  console.log('\nPASS: empty state, start, validation, trips, favourites, escaping, reload, example, print, restore refusal, phone layout, privacy.');
})().catch(e => {
  console.error('\nFAIL:', e && e.message ? e.message : e);
  if (exceptions.length) console.error(JSON.stringify(exceptions, null, 1).slice(0, 2000));
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

