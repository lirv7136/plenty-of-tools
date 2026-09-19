/* Habit Tracker in a real browser. Run after a build:
     node tests/habit-tracker.browser.cjs
   Covers the DOM and the layout; the maths is covered by tests/habit-tracker.test.cjs.
   Device metrics are set over CDP rather than by resizing a window, because a window resize
   does not reliably reflow the layout and a phone width check then passes when it should not. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8768;
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

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-habits-'));
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
  assert.ok(fs.existsSync(path.join(DIST, 'tools', 'habit-tracker', 'index.html')), 'run python3 build.py first');
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable');

  await metrics(1280, 900, false);
  await go(`${BASE}/tools/habit-tracker/`);
  await until('!!window.HabitCore && !!window.__habits', 'the tool to start');
  assert.equal(await evaluate("document.getElementById('ht-empty').hidden"), false, 'an empty tracker should say so');
  ok('loads with an empty state');

  await evaluate("document.getElementById('ht-sample').click()");
  await until("document.querySelectorAll('#ht-rows tr').length === 3");
  const firstStreak = await evaluate("document.querySelectorAll('#ht-rows tr')[0].cells[2].textContent");
  assert.match(firstStreak, /\d+ (day|week)s?/, 'the sample should show a streak');
  assert.equal(await evaluate("document.querySelectorAll('#ht-heat .ht-cell').length"), 53 * 7);
  assert.ok(await evaluate("document.querySelectorAll('#ht-heat .ht-cell.done').length > 10"), 'the heatmap should be populated');
  ok('the sample loads with streaks and a year of history');

  // tick today through the real button, and check it persists
  const tick = `(() => {
    const id = window.__habits.state.habits[0].id, t = HabitCore.todayISO();
    document.querySelector('.ht-day[data-habit="' + id + '"][data-date="' + t + '"]').click();
    return id;
  })()`;
  const before = await evaluate("(() => { const id = window.__habits.state.habits[0].id; return window.__habits.state.ticks[id].includes(HabitCore.todayISO()); })()");
  await evaluate(tick);
  const after = await evaluate("(() => { const id = window.__habits.state.habits[0].id; return window.__habits.state.ticks[id].includes(HabitCore.todayISO()); })()");
  assert.equal(after, !before, 'the button should toggle today');
  await evaluate(tick);
  assert.equal(await evaluate("(() => { const id = window.__habits.state.habits[0].id; return window.__habits.state.ticks[id].includes(HabitCore.todayISO()); })()"), before,
    'a second click should put it back');
  ok('ticking a day toggles and re-renders cleanly');

  // add a habit through the form, then refuse a duplicate name
  await evaluate(`(() => {
    document.getElementById('ht-name').value = 'Stretch';
    const r = document.querySelector('input[name=ht-when][value=times]');
    r.checked = true; r.dispatchEvent(new Event('change'));
    document.getElementById('ht-n').value = '4';
    document.getElementById('ht-form').requestSubmit();
  })()`);
  await until("document.querySelectorAll('#ht-rows tr').length === 4");
  assert.match(await evaluate("[...document.querySelectorAll('#ht-rows tr')].map(r => r.cells[0].textContent).join('|')"), /Stretch4 times a week/);
  await evaluate("document.getElementById('ht-name').value='stretch';document.getElementById('ht-form').requestSubmit()");
  assert.match(await evaluate("document.getElementById('ht-error').textContent"), /already a habit called/);
  ok('the form adds a habit and refuses a duplicate name');

  // the file round trip, through the real input and its confirm
  await evaluate(`(() => {
    window.__snapshot = HabitCore.exportJson(window.__habits.state);
    const dt = new DataTransfer();
    dt.items.add(new File([window.__snapshot], 'habits.json', { type: 'application/json' }));
    document.getElementById('ht-clear').click();
    const input = document.getElementById('ht-import');
    input.files = dt.files; input.dispatchEvent(new Event('change'));
  })()`);
  await until("document.querySelectorAll('#ht-rows tr').length === 4", 'the import to restore four habits');
  assert.ok(await evaluate("JSON.stringify(window.__habits.state.ticks) === JSON.stringify(JSON.parse(window.__snapshot).ticks)"),
    'every recorded day should come back');
  ok('clear then import restores the file exactly');

  const untouched = await evaluate("JSON.stringify(window.__habits.state)");
  await evaluate(`(() => {
    const dt = new DataTransfer();
    dt.items.add(new File(['{"v":1,"habits":[{"id":"bad id","name":"x","schedule":{"type":"daily"}}],"ticks":{}}'], 'bad.json', { type: 'application/json' }));
    const input = document.getElementById('ht-import');
    input.files = dt.files; input.dispatchEvent(new Event('change'));
  })()`);
  await until("document.getElementById('ht-toast').textContent.includes('not imported')", 'the bad file to be refused');
  assert.equal(await evaluate("JSON.stringify(window.__habits.state)"), untouched, 'a refused import must change nothing');
  ok('a malformed file is refused and changes nothing');

  await go(`${BASE}/tools/habit-tracker/`);
  await until("!!window.__habits");
  assert.equal(await evaluate("document.querySelectorAll('#ht-rows tr').length"), 4, 'the habits should survive a reload');
  ok('everything survives a reload');

  // phone width: nothing may push the page sideways except the two scrollers
  await metrics(390, 844, true);
  await go(`${BASE}/tools/habit-tracker/`);
  await until("!!window.__habits");
  const layout = await evaluate(`(() => {
    const limit = document.documentElement.clientWidth;
    // Content inside a horizontal scroller is allowed past the edge; that is the whole point of
    // one. Only report elements that widen the page itself.
    const scrolled = el => {
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (/auto|scroll|hidden|clip/.test(getComputedStyle(p).overflowX)) return true;
      }
      return false;
    };
    const bad = [];
    for (const el of document.querySelectorAll('main, main *')) {
      const r = el.getBoundingClientRect();
      if (r.width && r.right > limit + 1 && !scrolled(el)) {
        bad.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : ''));
      }
    }
    // When the page does overflow, name the widest things in the document so the cause is obvious.
    const widest = [...document.querySelectorAll('body *')]
      .map(el => ({ el: el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : ''),
        right: Math.round(el.getBoundingClientRect().right), scrollW: el.scrollWidth, clientW: el.clientWidth,
        overflowX: getComputedStyle(el).overflowX }))
      .filter(x => x.right > limit + 1).sort((a, b) => b.right - a.right).slice(0, 6);
    const chain = ['main.ht', '.ht-grid', '.ht-list', '.ht-tablewrap', '#ht-table', '.ht-history', '.ht-heat-scroll']
      .map(sel => { const el = document.querySelector(sel); if (!el) return sel + ': missing';
        const cs = getComputedStyle(el);
        return sel + ' w=' + Math.round(el.getBoundingClientRect().width) + ' minW=' + cs.minWidth + ' maxW=' + cs.maxWidth + ' ovx=' + cs.overflowX + ' disp=' + cs.display; });
    // The definitive check: try to scroll the page sideways and see whether it moves.
    // documentElement.scrollWidth can report the width of content that a clipping ancestor
    // already contains, so on its own it produces false failures.
    window.scrollTo(9999, 0);
    const scrolledBy = Math.round(window.scrollX);
    window.scrollTo(0, 0);
    return { limit, chain, scrolledBy, scrollWidth: document.documentElement.scrollWidth, bad: [...new Set(bad)].slice(0, 6), widest,
      columns: getComputedStyle(document.querySelector('.ht-grid')).gridTemplateColumns.split(' ').length };
  })()`);
  assert.equal(layout.limit, 390);
  assert.deepEqual(layout.bad, [], 'these elements run past the right edge at 390 px');
  assert.equal(layout.scrolledBy, 0, 'the page scrolls sideways at phone width by '
    + layout.scrolledBy + ' px\n' + JSON.stringify(layout.widest, null, 1) + '\n' + layout.chain.join('\n'));
  assert.equal(layout.columns, 1, 'the grid should stack to one column');
  ok('no sideways scroll at 390 px, and the layout stacks');

  await evaluate("document.getElementById('ht-sample').click()");
  await until("document.querySelectorAll('#ht-rows tr').length === 3");
  const scrollers = await evaluate(`(() => {
    const t = document.querySelector('.ht-tablewrap'), h = document.querySelector('.ht-heat-scroll');
    window.scrollTo(9999, 0);
    const scrolledBy = Math.round(window.scrollX);
    window.scrollTo(0, 0);
    return { table: t.scrollWidth > t.clientWidth, heat: h.scrollWidth > h.clientWidth, scrolledBy };
  })()`);
  assert.ok(scrollers.heat, 'the year grid should scroll inside its own container on a phone');
  assert.equal(scrollers.scrolledBy, 0, 'the wide content pushed the page sideways by ' + scrollers.scrolledBy + ' px');
  ok('the table and the year grid scroll inside themselves, not the page');

  assert.deepEqual(exceptions.map(e => e.text), [], 'uncaught page exceptions');
  console.log('\nPASS: empty state, sample, ticking, the form, import and refusal, reload, phone layout.');
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
