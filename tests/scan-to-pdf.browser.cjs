/* Scan to PDF in a real browser. Run after a build:
     node tests/scan-to-pdf.browser.cjs
   Draws a photo of a tilted page, loads it through the real file input, drags a corner with
   real pointer events, adds pages, and opens the PDF with the site's own pdf.js to check the
   page came out straight: the mark centred, the page white to its edges. */
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
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  let file = pathname === '/offline' ? path.join(DIST, 'offline.html')
    : pathname.endsWith('/') ? path.join(DIST, pathname, 'index.html') : path.join(DIST, pathname);
  const ok = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) file = path.join(DIST, '404.html');
  res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-scan-'));
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

const PAGE = [{ x: 180, y: 120 }, { x: 860, y: 190 }, { x: 800, y: 1080 }, { x: 120, y: 1010 }];

async function addPhoto() {
  await evaluate(`(async () => {
    const page = ${JSON.stringify(PAGE)};
    const c = document.createElement('canvas'); c.width = 1000; c.height = 1200;
    const g = c.getContext('2d'); g.fillStyle = '#2b2b2b'; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.moveTo(page[0].x, page[0].y); page.slice(1).forEach(p => g.lineTo(p.x, p.y)); g.closePath(); g.fill();
    // A black square at the page's centre, drawn in page coordinates.
    const H = ScanCore.homography([{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}], page);
    const q = [[0.4,0.4],[0.6,0.4],[0.6,0.6],[0.4,0.6]].map(([u,v]) => ScanCore.apply(H, u, v));
    g.fillStyle = '#000'; g.beginPath(); g.moveTo(q[0].x, q[0].y); q.slice(1).forEach(p => g.lineTo(p.x, p.y)); g.closePath(); g.fill();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    const dt = new DataTransfer(); dt.items.add(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
    const input = document.getElementById('files'); input.files = dt.files; input.dispatchEvent(new Event('change'));
    return true;
  })()`);
  await until("!document.getElementById('editor').hidden && !!window.__scan.current", 'the editor to open');
  // The editor scrolls smoothly into view; wait until it has stopped moving.
  let last = null;
  for (let i = 0; i < 40; i++) {
    const top = await evaluate("document.getElementById('overlay').getBoundingClientRect().top");
    if (last !== null && Math.abs(top - last) < 0.5) break;
    last = top;
    await new Promise(r => setTimeout(r, 100));
  }
}

async function drag(from, to) {
  const rect = await evaluate(`(() => { const r = document.getElementById('overlay').getBoundingClientRect(); const o = document.getElementById('overlay'); return { x: r.left, y: r.top, sx: r.width / o.width, sy: r.height / o.height }; })()`);
  const at = p => ({ x: rect.x + p.x * rect.sx, y: rect.y + p.y * rect.sy });
  const a = at(from), b = at(to);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: a.x, y: a.y, button: 'left', clickCount: 1 });
  for (let i = 1; i <= 5; i++) await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: a.x + (b.x - a.x) * i / 5, y: a.y + (b.y - a.y) * i / 5, button: 'left', buttons: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: b.x, y: b.y, button: 'left', clickCount: 1 });
}

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'tools', 'scan-to-pdf', 'index.html')), 'run python3 build.py first');
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await metrics(1280, 1000, false);

  await go(`${BASE}/tools/scan-to-pdf/`);
  await until('!!window.ScanCore && !!window.__scan', 'the tool to start');
  assert.equal(await evaluate("document.getElementById('btn-pdf').disabled"), true, 'nothing to download yet');
  await addPhoto();
  ok('a photo opens in the corner editor with default corners');

  // Drag the top left handle (default 4% inset) onto the page corner with real pointer input.
  const start = await evaluate('window.__scan.current.corners[0]');
  await drag(start, PAGE[0]);
  const moved = await evaluate('window.__scan.current.corners[0]');
  assert.ok(Math.hypot(moved.x - PAGE[0].x, moved.y - PAGE[0].y) < 6, `dragged to ${JSON.stringify(moved)}`);
  ok('dragging a handle moves that corner');

  await evaluate(`window.__scan.setCorners(${JSON.stringify(PAGE)})`);
  await evaluate("document.getElementById('btn-page').click()");
  await until('window.__scan.pages.length === 1', 'the first page');
  await addPhoto();
  await evaluate(`window.__scan.setCorners(${JSON.stringify(PAGE)})`);
  await evaluate("document.getElementById('mode').value = 'colour'");
  await evaluate("document.getElementById('btn-page').click()");
  await until('window.__scan.pages.length === 2', 'the second page');
  assert.equal(await evaluate("document.querySelectorAll('#thumbs li').length"), 2);
  ok('two pages added, one in document mode and one in colour');

  // Open the PDF with the site's vendored pdf.js and check page 1 is straight.
  const result = await evaluate(`(async () => {
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/assets/pdf-tools-vendor/pdf.min.js'; s.onload = res; s.onerror = rej; document.head.append(s); });
    const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = '/assets/pdf-tools/pdf.worker.min.js';
    const doc = await lib.getDocument({ data: window.__scan.pdfBytes() }).promise;
    const page = await doc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const g = c.getContext('2d');
    const lum = (x, y) => { const d = g.getImageData(Math.round(x), Math.round(y), 1, 1).data; return (d[0] + d[1] + d[2]) / 3; };
    // The image area inside the 24 pt margin.
    const W = vp.width, H = vp.height;
    return { pages: doc.numPages, w: W, h: H, centre: lum(W / 2, H / 2),
      corners: [lum(40, 40), lum(W - 40, 40), lum(W - 40, H - 40), lum(40, H - 40)],
      sides: [lum(W / 2, 60), lum(W / 2, H - 60), lum(60, H / 2), lum(W - 60, H / 2)] };
  })()`);
  assert.equal(result.pages, 2);
  assert.equal(Math.round(result.w), 595, 'A4 portrait width');
  assert.ok(result.centre < 80, `the mark is in the centre (lum ${result.centre})`);
  for (const v of [...result.corners, ...result.sides]) assert.ok(v > 200, `page white near its edges (lum ${v})`);
  ok('the PDF opens in pdf.js: 2 A4 pages, the page straightened with its mark centred and white to the edges');

  await evaluate("document.querySelectorAll('#thumbs li')[1].querySelector('button[aria-label^=\"Remove\"]').click()");
  assert.equal(await evaluate('window.__scan.pages.length'), 1);
  ok('removing a page');

  const offsite = requests.filter(u => !u.startsWith(BASE) && !u.startsWith('data:') && !u.startsWith('blob:') && !/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(u));
  assert.deepEqual(offsite, [], 'nothing leaves the site');
  assert.deepEqual(exceptions.map(e => e.text), [], 'uncaught page exceptions');
  console.log('\nPASS: photo in, corner drag, two pages, a straight PDF that pdf.js renders, nothing uploaded.');
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
