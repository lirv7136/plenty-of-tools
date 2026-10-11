/* Receipts to Expenses in a real browser, with the real OCR engine. Run after a build:
     node tests/receipts.browser.cjs
   Draws a receipt on a canvas, feeds it to the file input, waits for Tesseract to read it,
   and checks the parsed row, persistence across reload, and that nothing leaves the machine.
   Parsing rules are covered by tests/receipts.test.cjs. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8769;
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-receipts-'));
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

async function waitLong(expression, label, seconds = 120) {
  for (let i = 0; i < seconds * 4; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 250)); }
  throw new Error('Timed out waiting for ' + label);
}

const RECEIPT = ['AMPOL FOODARY GLEBE', 'TAX INVOICE', 'ABN 40 004 201 307', '12/10/2026 07:42', '',
  'Pump 4 Unleaded E10', '42.31 L @ 199.9', 'U91          $84.58', '', 'TOTAL        $84.58', 'GST INCLUDED  $7.69', 'EFTPOS       $84.58'];

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'tools', 'receipts', 'index.html')), 'run python3 build.py first');
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await metrics(1280, 900, false);

  await go(`${BASE}/tools/receipts/`);
  await until('!!window.ReceiptCore && !!window.Tesseract', 'the tool and the reader to load');
  assert.equal(await evaluate("document.getElementById('empty').hidden"), false);
  ok('loads empty, with the reader script present');

  // A receipt drawn on a canvas, handed to the real file input.
  await evaluate(`(async () => {
    const lines = ${JSON.stringify(RECEIPT)};
    const c = document.createElement('canvas'); c.width = 640; c.height = 60 + lines.length * 44;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#111'; g.font = '28px monospace';
    lines.forEach((l, i) => g.fillText(l, 30, 50 + i * 44));
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'receipt.png', { type: 'image/png' }));
    const input = document.getElementById('files'); input.files = dt.files; input.dispatchEvent(new Event('change'));
    return true;
  })()`);
  await waitLong("document.querySelectorAll('#rows tr').length === 1", 'the receipt to be read');
  const row = await evaluate(`(() => { const i = [...document.querySelectorAll('#rows tr td input, #rows tr td select')].map(e => e.value); return i; })()`);
  const [date, merchant, category, total, gst, abn] = row;
  assert.equal(date, '2026-10-12', 'date');
  assert.match(merchant, /AMPOL/i, 'merchant');
  assert.equal(category, 'Fuel', 'category');
  assert.equal(total, '84.58', 'total');
  assert.equal(gst, '7.69', 'GST');
  assert.equal(abn, '40004201307', 'ABN');
  ok(`read a receipt on the device: ${merchant}, ${date}, $${total}, GST $${gst}, ABN ${abn}, ${category}`);

  assert.match(await evaluate("document.getElementById('foot').textContent"), /\$84\.58/);
  assert.match(await evaluate("document.getElementById('by-category').textContent"), /Fuel \$84\.58/);
  ok('totals and the category summary');

  // Edit a cell, reload, and the table is still there with the edit.
  await evaluate(`(() => { const n = document.querySelectorAll('#rows tr td input')[5]; n.value = 'Client visit, Parramatta'; n.dispatchEvent(new Event('change')); return true; })()`);
  await go(`${BASE}/tools/receipts/`);
  await until("document.querySelectorAll('#rows tr').length === 1", 'the saved row after reload');
  assert.equal(await evaluate("document.querySelectorAll('#rows tr td input')[5].value"), 'Client visit, Parramatta');
  ok('edits autosave and survive a reload');

  // The site wide, cookieless Cloudflare Web Analytics beacon is the only thing allowed off
  // site; it reports page loads, never page content. Anything else would be a leak.
  const offsite = requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:')
    && !/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(u));
  assert.deepEqual(offsite, [], 'nothing but the site analytics beacon leaves the site');
  ok(`${requests.length} requests: the OCR engine and model all came from this site; no receipt left the machine`);

  assert.deepEqual(exceptions.map(e => e.text), [], 'uncaught page exceptions');
  console.log('\nPASS: real OCR of a receipt, parsed row, totals, autosave, no offsite requests.');
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
