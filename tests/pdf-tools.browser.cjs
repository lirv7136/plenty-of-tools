/* PDF Tools in a real browser. Run after a build:
     node tests/pdf-tools.browser.cjs
   The selection and range arithmetic is covered by tests/pdf-tools.test.cjs. This drives
   the page against real PDFs: it builds a sample with pdf-lib, manipulates it, then reads
   the saved bytes back with pdf.js to check the page count, order and rotation are what
   was asked for. Nothing here trusts the page's own report of what it did. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8776;
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-pdftools-'));
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

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'tools', 'pdf-tools', 'index.html')), 'run python3 build.py first');
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable');

  await metrics(1280, 900, false);
  await go(`${BASE}/tools/pdf-tools/`);
  await until('!!window.PdfToolsCore && !!window.__pdfTools && !!window.PDFLib && !!window.pdfjsLib', 'the tool and its libraries');
  assert.equal(await evaluate("document.getElementById('pt-work').hidden"), true, 'nothing to work on before a file is opened');
  ok('loads with the libraries vendored, not fetched');

  // The site's one third party script is the Cloudflare Web Analytics beacon, which is
  // named in /privacy/. Nothing else may be fetched from another origin: the PDF
  // libraries are vendored precisely so a document never brings a stranger's code with it.
  const external = await evaluate(`performance.getEntriesByType('resource')
    .map(e => e.name).filter(n => !n.startsWith(location.origin)).filter(n => !n.startsWith('data:'))`);
  const unexpected = external.filter(n => !/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(n));
  assert.deepEqual(unexpected, [], 'the only third party request may be the analytics beacon');
  ok('the PDF libraries are vendored; the analytics beacon is the only outside request');

  // ---- the sample ----
  await evaluate("document.getElementById('pt-sample').click()");
  await until("document.querySelectorAll('#pt-grid .pt-page').length === 4", 'four sample pages');
  assert.equal(await evaluate("document.getElementById('pt-work').hidden"), false);
  assert.match(await evaluate("document.getElementById('pt-summary').textContent"), /^4 of 4 pages selected/);
  await until("document.querySelectorAll('#pt-grid canvas').length === 4", 'thumbnails to render');
  ok('a sample PDF opens and every page gets a thumbnail');

  // ---- selecting ----
  await evaluate("document.getElementById('pt-odd').click()");
  assert.match(await evaluate("document.getElementById('pt-summary').textContent"), /^2 of 4/);
  await evaluate("document.getElementById('pt-none').click()");
  assert.match(await evaluate("document.getElementById('pt-summary').textContent"), /No pages selected/);
  assert.equal(await evaluate("document.getElementById('pt-save').disabled"), true, 'nothing to save with nothing selected');

  await evaluate("(() => { document.getElementById('pt-range').value = '2-3'; document.getElementById('pt-range-go').click(); })()");
  assert.match(await evaluate("document.getElementById('pt-summary').textContent"), /^2 of 4/);
  assert.equal(await evaluate("document.getElementById('pt-error').hidden"), true);

  await evaluate("(() => { document.getElementById('pt-range').value = '1-9'; document.getElementById('pt-range-go').click(); })()");
  assert.equal(await evaluate("document.getElementById('pt-error').hidden"), false, 'a range past the end is reported');
  assert.match(await evaluate("document.getElementById('pt-error').textContent"), /4 pages/);
  ok('selection by button and by typed range, with an impossible range refused');

  // ---- saving a selection, then reading the result back ----
  const twoPages = await evaluate(`(async () => {
    const t = window.__pdfTools;
    document.getElementById('pt-range').value = '2-3';
    document.getElementById('pt-range-go').click();
    const chosen = PdfToolsCore.selectedPages(t.state.pages, t.state.selection);
    const bytes = await t.buildPdf(chosen);
    const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    const texts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const c = await (await doc.getPage(i)).getTextContent();
      texts.push(c.items.map(it => it.str).join(' ').trim());
    }
    return { pages: doc.numPages, texts, name: PdfToolsCore.outputName(t.state.files, chosen, t.state.pages) };
  })()`);
  assert.equal(twoPages.pages, 2, 'saving pages 2 to 3 produces a two page file');
  assert.match(twoPages.texts[0], /Terms/, 'and it starts at the page that was asked for');
  assert.match(twoPages.texts[1], /Schedule/);
  assert.equal(twoPages.name, 'Sample contract-pages-2-3.pdf');
  ok('a saved selection really contains those pages, read back with pdf.js');

  // ---- rotation survives into the file ----
  const rotated = await evaluate(`(async () => {
    const t = window.__pdfTools;
    document.getElementById('pt-all').click();
    document.getElementById('pt-none').click();
    // select page 1 only, then turn it right twice
    document.getElementById('pt-range').value = '1';
    document.getElementById('pt-range-go').click();
    document.getElementById('pt-right').click();
    document.getElementById('pt-right').click();
    document.getElementById('pt-all').click();
    const chosen = PdfToolsCore.selectedPages(t.state.pages, t.state.selection);
    const bytes = await t.buildPdf(chosen);
    const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    const rot = [];
    for (let i = 1; i <= doc.numPages; i++) rot.push((await doc.getPage(i)).rotate);
    return { rot, shown: t.state.pages[0].rotation };
  })()`);
  assert.equal(rotated.shown, 180, 'two right turns is a half turn on screen');
  assert.deepEqual(rotated.rot, [180, 0, 0, 0], 'and the saved file carries it on that page alone');
  ok('rotation reaches the saved PDF, on the right page only');

  // ---- reorder and reverse reach the file ----
  const reordered = await evaluate(`(async () => {
    const t = window.__pdfTools;
    document.getElementById('pt-reverse').click();
    document.getElementById('pt-all').click();
    const chosen = PdfToolsCore.selectedPages(t.state.pages, t.state.selection);
    const bytes = await t.buildPdf(chosen);
    const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    const texts = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const c = await (await doc.getPage(i)).getTextContent();
      texts.push(c.items.map(it => it.str).join(' ').split(' ')[0]);
    }
    return texts;
  })()`);
  assert.deepEqual(reordered, ['Signatures', 'Schedule', 'Terms', 'Cover'], 'reversing the order reverses the file');
  ok('reordering reaches the saved PDF');

  // ---- deleting ----
  await evaluate(`(() => {
    document.getElementById('pt-none').click();
    document.getElementById('pt-range').value = '1-2';
    document.getElementById('pt-range-go').click();
    document.getElementById('pt-delete').click();
  })()`);
  await until("document.querySelectorAll('#pt-grid .pt-page').length === 2", 'two pages to remain');
  assert.match(await evaluate("document.getElementById('pt-summary').textContent"), /^2 of 2/);
  ok('deleting removes exactly the selected pages');

  await evaluate("document.getElementById('pt-all').click()");
  assert.equal(await evaluate("document.getElementById('pt-delete').disabled"), false,
    'the button stays live so the click can explain itself');
  await evaluate("document.getElementById('pt-delete').click()");
  assert.match(await evaluate("document.getElementById('pt-error').textContent"), /every page/,
    'deleting everything is refused rather than leaving an empty document');
  assert.equal(await evaluate("document.querySelectorAll('#pt-grid .pt-page').length"), 2, 'and nothing was deleted');
  ok('deleting every page is refused');

  // ---- merging two documents ----
  const merged = await evaluate(`(async () => {
    const t = window.__pdfTools;
    document.getElementById('pt-reset').click();
    const a = new File([await t.samplePdf()], 'First.pdf', { type: 'application/pdf' });
    const b = new File([await t.samplePdf()], 'Second.pdf', { type: 'application/pdf' });
    await t.addFiles([a, b]);
    const chosen = PdfToolsCore.selectedPages(t.state.pages, t.state.selection);
    const bytes = await t.buildPdf(chosen);
    const doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
    return { files: t.state.files.length, pages: t.state.pages.length, out: doc.numPages,
             name: PdfToolsCore.outputName(t.state.files, chosen, t.state.pages) };
  })()`);
  assert.equal(merged.files, 2);
  assert.equal(merged.pages, 8, 'two four page documents make eight pages');
  assert.equal(merged.out, 8, 'and the merged file really has eight');
  assert.equal(merged.name, 'merged.pdf');
  ok('two documents merge into one file');

  // ---- a file that is not a PDF ----
  await evaluate(`(async () => {
    const junk = new File([new Uint8Array([1,2,3,4,5])], 'broken.pdf', { type: 'application/pdf' });
    await window.__pdfTools.addFiles([junk]);
  })()`);
  assert.match(await evaluate("document.getElementById('pt-error').textContent"), /broken\.pdf/,
    'a file that is not really a PDF is named rather than crashing the page');
  ok('a corrupt file is refused by name');

  // ---- phone layout ----
  await metrics(390, 844, true);
  await evaluate("window.dispatchEvent(new Event('resize'))");
  await new Promise(r => setTimeout(r, 400));
  const scrolledBy = await evaluate("(() => { window.scrollTo(9999, 0); const x = window.scrollX; window.scrollTo(0,0); return x; })()");
  assert.equal(scrolledBy, 0, `the page moved sideways by ${scrolledBy}px at 390 px`);
  ok('no sideways scroll at 390 px');

  assert.deepEqual(exceptions.map(e => e.text), [], 'the console must be clean');
  ok('no uncaught exceptions');

  console.log('\nAll PDF tools browser checks passed.');
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
