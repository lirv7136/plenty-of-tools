/* Hours Log in a real browser. Run after a build:
     node tests/hours-log.browser.cjs
   Covers the DOM and the layout; the maths is covered by tests/hours-log.test.cjs.
   Device metrics are set over CDP rather than by resizing a window, because a window resize
   does not reliably reflow the layout and a phone width check then passes when it should not. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8772;
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-hours-'));
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
const rows = () => evaluate("document.querySelectorAll('#hl-rows tr').length");
const PAGE = BASE + '/tools/hours-log/';

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true }, null)).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await metrics(1280, 1000);
  await go(PAGE);
  await until('!!window.HoursCore && !!window.__hours', 'the page scripts');
  assert.match(await text('hl-summary'), /Nothing logged yet/);
  ok('empty state explains what to do');

  // manual entry at home, with a break
  const today = await evaluate('HoursCore.todayISO()');
  await set('hl-date', today); await set('hl-start', '09:00'); await set('hl-end', '17:30'); await set('hl-break', '30');
  assert.equal(await text('hl-length'), '8.00 hours');
  await set('hl-client', 'Acme Pty Ltd');
  await click('hl-save');
  await until("document.querySelectorAll('#hl-rows tr').length === 1", 'the first entry');
  assert.equal(await text('hl-home'), '8.00');
  assert.match(await text('hl-ded'), /^\$5$/, '8 h × 70c = $5.60, cents disregarded');
  ok('an entry at home adds 8 hours and a $5 deduction, cents disregarded');

  // a break as long as the shift is refused
  await set('hl-start', '09:00'); await set('hl-end', '10:00'); await set('hl-break', '60');
  await click('hl-save');
  assert.match(await text('hl-error'), /as long as the whole shift/);
  assert.equal(await rows(), 1);
  ok('a break as long as the shift is refused with a reason');

  // workplace hours count in the total, not at home; an overnight shift
  await set('hl-break', '0'); await set('hl-start', '22:00'); await set('hl-end', '02:00');
  await evaluate("document.querySelector('input[name=hl-place][value=work]').click()");
  assert.match(await text('hl-length'), /4.00 hours, finishing the next day/);
  await click('hl-save');
  await until("document.querySelectorAll('#hl-rows tr').length === 2");
  assert.equal(await text('hl-home'), '8.00'); assert.equal(await text('hl-all'), '12.00');
  ok('workplace hours count in the total but not towards the fixed rate, and overnight shifts work');

  // the current income year is provisional
  assert.match(await text('hl-rate'), /70c \(provisional\)/);
  assert.match(await text('hl-year-note'), /not yet published/);
  ok('the current year is marked provisional until the ATO publishes its rate');

  // timesheet by client with a rate
  await until("document.querySelectorAll('#hl-client-rows tr').length === 2", 'client rows');
  await evaluate(`(() => { const i = [...document.querySelectorAll('#hl-client-rows tr')].find(r => r.textContent.includes('Acme')).querySelector('input'); i.value = '100'; i.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await until("[...document.querySelectorAll('#hl-client-rows tr')].some(r => r.textContent.includes('$800.00'))", 'the client amount');
  ok('the timesheet totals hours by client, and a rate gives the amount');

  // the timer runs, survives a reload, and saves an entry
  await evaluate("document.getElementById('hl-t-place').value = 'home'");
  await click('hl-t-toggle');
  await until("document.getElementById('hl-t-toggle').textContent === 'Stop and save'");
  await go(PAGE); await until('!!window.__hours');
  assert.equal(await text('hl-t-toggle'), 'Stop and save', 'the timer keeps running across a reload');
  // pretend it started 90 minutes ago, then stop it
  await evaluate("(() => { const s = window.__hours.state(); s.timer.startedAt = new Date(Date.now() - 90 * 60000).toISOString(); localStorage.setItem('pot:hours-log:v1', JSON.stringify({ v: 1, entries: s.entries, rates: s.rates, timer: s.timer })); })()");
  await go(PAGE); await until('!!window.__hours');
  await click('hl-t-toggle');
  await until("document.querySelectorAll('#hl-rows tr').length === 3", 'the timer entry');
  assert.equal(await text('hl-t-toggle'), 'Start');
  assert.match(await evaluate("[...document.querySelectorAll('#hl-rows tr')].map(r => r.textContent).join('|')"), /1\.50Home[^|]*\(timer\)/, 'a 1.5 hour entry at home made by the timer');
  ok('the timer survives a reload and saves its hours as an entry');

  // markup is shown as text
  await set('hl-date', today); await set('hl-start', '06:00'); await set('hl-end', '07:00'); await set('hl-break', '0');
  await set('hl-note', '<img src=x onerror="window.__pwned=1">');
  await click('hl-save');
  await until("document.querySelectorAll('#hl-rows tr').length === 4");
  assert.equal(await evaluate('window.__pwned === undefined && !document.querySelector("#hl-rows img")'), true);
  ok('text typed into an entry is shown as text, never as markup');

  // example, then the two print layouts
  await click('hl-sample');
  await until("document.querySelectorAll('#hl-rows tr').length > 30", 'the example entries');
  const vis = `(s => getComputedStyle(document.querySelector(s)).display !== 'none')`;
  await send('Emulation.setEmulatedMedia', { media: 'print' });
  await evaluate("document.body.dataset.print = 'year'");
  const year = await evaluate(`(() => { const v = ${vis}; return { head: v('.hl-print-head'), year: v('.hl-year'), list: v('.hl-list'), week: v('.hl-week'), add: v('.hl-add'), timer: v('.hl-timer') }; })()`);
  await evaluate("document.body.dataset.print = 'week'");
  const wk = await evaluate(`(() => { const v = ${vis}; return { year: v('.hl-year'), list: v('.hl-list'), week: v('.hl-week') }; })()`);
  await evaluate("delete document.body.dataset.print");
  await send('Emulation.setEmulatedMedia', { media: '' });
  assert.deepEqual(year, { head: true, year: true, list: true, week: false, add: false, timer: false });
  assert.deepEqual(wk, { year: false, list: false, week: true });
  ok('the year report and the weekly timesheet each print only what they should');

  // a damaged backup is refused
  const bad = path.join(profile, 'bad.json');
  fs.writeFileSync(bad, JSON.stringify({ app: 'plentyoftools hours-log', v: 1, entries: [{ id: 'x', date: '2026-01-01' }] }));
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#hl-import' });
  const before = await rows();
  await send('DOM.setFileInputFiles', { nodeId, files: [bad] });
  await until("/not restored/.test(document.getElementById('hl-toast').textContent)", 'the refusal message');
  assert.equal(await rows(), before);
  ok('a damaged backup file is refused and the log is untouched');

  // phone width
  await metrics(390, 844, true);
  await go(PAGE); await until('!!window.__hours');
  const layout = await evaluate(`(() => {
    window.scrollTo(9999, 0); const x = Math.round(window.scrollX); window.scrollTo(0, 0);
    return { x, cols: getComputedStyle(document.querySelector('.hl-grid')).gridTemplateColumns.split(' ').length };
  })()`);
  assert.equal(layout.x, 0, 'the page scrolled sideways by ' + layout.x + ' px');
  assert.equal(layout.cols, 1);
  ok('no sideways scroll at 390 px, and the layout stacks');

  const outside = requests.filter(u => /^https?:/.test(u) && !u.startsWith(BASE) && !/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(u));
  assert.deepEqual(outside, [], 'requests to other hosts');
  ok('no request leaves the site');

  assert.deepEqual(exceptions.map(e => e.text), [], 'uncaught page exceptions');
  console.log('\nPASS: empty state, entries, refusals, workplace and overnight, provisional rate, timesheet, timer across reload, escaping, example, print layouts, restore refusal, phone layout, privacy.');
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
