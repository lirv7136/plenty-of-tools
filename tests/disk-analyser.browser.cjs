/* What's Eating My Disk in a real browser. Run after a build:
     node tests/disk-analyser.browser.cjs
   The arithmetic is covered by tests/disk-analyser.test.cjs. This covers the page: the
   treemap, drilling in and out, duplicate finding over real bytes, the phone layout, and
   the removal guard, which is exercised against the origin private file system because it
   is the same FileSystemDirectoryHandle API a chosen folder gives you. */
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
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  let file = pathname === '/offline' ? path.join(DIST, 'offline.html')
    : pathname.endsWith('/') ? path.join(DIST, pathname, 'index.html') : path.join(DIST, pathname);
  const ok = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) file = path.join(DIST, '404.html');
  res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-disk-'));
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
  assert.ok(fs.existsSync(path.join(DIST, 'tools', 'disk-analyser', 'index.html')), 'run python3 build.py first');
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable');

  await metrics(1280, 900, false);
  await go(`${BASE}/tools/disk-analyser/`);
  await until('!!window.DiskCore && !!window.__diskAnalyser', 'the tool to start');
  assert.equal(await evaluate("document.getElementById('da-results').hidden"), true, 'nothing is shown before a folder is chosen');
  ok('loads with no folder chosen');

  // ---- the sample folder drives every report ----
  await evaluate("document.getElementById('da-demo').click()");
  await until("document.getElementById('da-results').hidden === false");

  const summary = await evaluate("Array.from(document.querySelectorAll('#da-summary dd')).map(d=>d.textContent)");
  assert.equal(summary[0], 'Sample folder');
  assert.match(summary[1], /GB$/, 'the sample is measured in gigabytes');
  assert.equal(summary[2], '17', 'seventeen sample files');
  ok('the summary reports the scan');

  const tiles = await evaluate("document.querySelectorAll('#da-map .da-tile').length");
  assert.ok(tiles >= 4, `the treemap drew ${tiles} tiles`);
  const labelled = await evaluate("Array.from(document.querySelectorAll('#da-map .da-tile')).every(t=>(t.getAttribute('aria-label')||'').length>3)");
  assert.equal(labelled, true, 'every tile has an accessible name, including the ones too small for text');
  const covers = await evaluate(`(() => {
    const map = document.getElementById('da-map');
    const area = map.clientWidth * map.clientHeight;
    let sum = 0;
    for (const t of map.querySelectorAll('.da-tile')) sum += (parseFloat(t.style.width)+1) * (parseFloat(t.style.height)+1);
    return Math.abs(sum - area) / area;
  })()`);
  assert.ok(covers < 0.02, `the tiles cover the map (off by ${(covers*100).toFixed(2)}%)`);
  ok('the treemap fills its box and every tile is named');

  const largest = await evaluate("document.querySelectorAll('#da-largest tbody tr').length");
  assert.equal(largest, 17);
  const firstRow = await evaluate("document.querySelector('#da-largest tbody tr').textContent");
  assert.match(firstRow, /ubuntu-24\.04\.iso/, 'the biggest file is first');
  ok('the biggest files table is filled and sorted');

  const types = await evaluate("Array.from(document.querySelectorAll('#da-types .da-bar .label')).map(l=>l.textContent)");
  assert.ok(types.includes('Video') && types.includes('Photos') && types.includes('Archives'));
  ok('the type breakdown names the categories');

  // ---- drilling in and back out ----
  await evaluate(`(() => {
    const t = Array.from(document.querySelectorAll('#da-map .da-tile')).find(x => x.dataset.kind === 'dir');
    t.click();
  })()`);
  await until("document.querySelectorAll('#da-crumbs button').length > 1", 'the breadcrumb to grow');
  const crumbs = await evaluate("Array.from(document.querySelectorAll('#da-crumbs button')).map(b=>b.textContent)");
  assert.equal(crumbs[0], 'Sample folder');
  assert.ok(crumbs.length >= 2, 'the breadcrumb shows where you are');
  assert.equal(await evaluate("document.querySelectorAll('#da-crumbs button[disabled]').length"), 1, 'only the folder you are in is inert');
  ok('clicking a folder opens it');

  await evaluate("document.querySelector('#da-crumbs button').click()");
  await until("document.querySelectorAll('#da-crumbs button').length === 1", 'the breadcrumb to collapse');
  ok('the breadcrumb walks back out');

  // ---- duplicates over real bytes ----
  await evaluate("document.getElementById('da-dupe-min').value='1024'");
  await evaluate("document.getElementById('da-dupe-run').click()");
  await until("/sets of identical files|No identical/.test(document.getElementById('da-dupe-status').textContent)", 'the duplicate scan to finish');
  const dupeStatus = await evaluate("document.getElementById('da-dupe-status').textContent");
  assert.match(dupeStatus, /^2 sets of identical files/, `expected two duplicate sets, got: ${dupeStatus}`);
  const dupeHeads = await evaluate("Array.from(document.querySelectorAll('.da-dupe h3')).map(h=>h.textContent)");
  assert.equal(dupeHeads.length, 2);
  assert.match(dupeHeads[0], /2 copies/, 'the pair that frees the most is first');
  const dupePaths = await evaluate("Array.from(document.querySelectorAll('.da-dupe .path')).map(p=>p.textContent)");
  assert.ok(dupePaths.includes('Video/holiday-final.mov') && dupePaths.includes('Video/holiday-final-v2.mov'),
    'the renamed copy is matched on content, not on name');
  assert.ok(dupePaths.includes('Photos/2023/Italy/DSC_0041.jpg') && dupePaths.includes('Photos/Duplicates/DSC_0041.jpg'));
  assert.ok(!dupePaths.includes('Downloads/statement.pdf'), 'files that only share a size are not called duplicates');
  ok('duplicates are found by content, including a renamed copy');

  // ---- the removal guard, against a real directory handle ----
  const guard = await evaluate(`(async () => {
    const dir = await navigator.storage.getDirectory();
    for await (const [n] of dir.entries()) await dir.removeEntry(n).catch(()=>{});
    const write = async (name, body) => {
      const h = await dir.getFileHandle(name, { create: true });
      const w = await h.createWritable(); await w.write(body); await w.close();
      return (await h.getFile());
    };
    const entryFor = name => ({
      getFile: () => dir.getFileHandle(name).then(h => h.getFile()),
      remove: () => dir.removeEntry(name),
    });
    const exists = async name => { try { await dir.getFileHandle(name); return true; } catch { return false; } };
    const R = window.__diskAnalyser.removeVerified;
    const out = {};

    const a = await write('match.bin', 'hello there');
    out.match = await R(entryFor('match.bin'), { size: a.size, mtime: a.lastModified });
    out.matchGone = !(await exists('match.bin'));

    const b = await write('grew.bin', 'hello there');
    out.sizeChanged = await R(entryFor('grew.bin'), { size: b.size + 10, mtime: b.lastModified });
    out.grewKept = await exists('grew.bin');

    const c = await write('touched.bin', 'hello there');
    out.timeChanged = await R(entryFor('touched.bin'), { size: c.size, mtime: c.lastModified - 60000 });
    out.touchedKept = await exists('touched.bin');

    out.missing = await R(entryFor('never-existed.bin'), { size: 5, mtime: Date.now() });
    out.readOnly = await R({ getFile: () => Promise.resolve(new File(['x'],'x')), remove: null }, { size: 1, mtime: 0 });
    return out;
  })()`);

  assert.deepEqual(guard.match, { ok: true }, 'a file that still matches the scan is removed');
  assert.equal(guard.matchGone, true, 'and it is really gone');
  assert.deepEqual(guard.sizeChanged, { ok: false, reason: 'size-changed' });
  assert.equal(guard.grewKept, true, 'a file whose size changed is left alone');
  assert.deepEqual(guard.timeChanged, { ok: false, reason: 'changed-since-scan' });
  assert.equal(guard.touchedKept, true, 'a file modified since the scan is left alone');
  assert.deepEqual(guard.missing, { ok: false, reason: 'missing' });
  assert.deepEqual(guard.readOnly, { ok: false, reason: 'no-access' });
  ok('the removal guard deletes only what still matches the scan');

  // ---- export ----
  const csv = await evaluate(`(() => {
    const rows = window.__diskAnalyser.state.files;
    return rows.length > 0 && document.getElementById('da-csv').disabled !== true;
  })()`);
  assert.equal(csv, true);
  ok('the CSV export is offered');

  // ---- phone layout ----
  // scrollWidth lies when a clipping ancestor is involved; scrolling and reading back does not.
  await metrics(390, 844, true);
  await evaluate("window.dispatchEvent(new Event('resize'))");
  await new Promise(r => setTimeout(r, 400));
  const overflow = await evaluate("(() => { window.scrollTo(9999, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; })()");
  assert.equal(overflow, 0, `the page must not move sideways on a 390 px phone, moved ${overflow}px`);
  const tilesPhone = await evaluate("document.querySelectorAll('#da-map .da-tile').length");
  assert.ok(tilesPhone >= 4, 'the treemap redraws at phone width');
  ok('no sideways scroll at 390 px, and the map redraws');

  assert.deepEqual(exceptions.map(e => e.text || (e.exception && e.exception.description)), [], 'the console must be clean');
  ok('no uncaught exceptions');

  console.log('\nAll disk analyser browser checks passed.');
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
