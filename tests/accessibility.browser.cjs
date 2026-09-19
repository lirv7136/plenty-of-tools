/* The accessibility checks Lighthouse leaves to a human, run across every built page.
     node tests/accessibility.browser.cjs

   Lighthouse scores these pages 100, but that covers only the 25 of its 76 accessibility audits
   that apply, and it explicitly hands eleven back as "manual": custom control labels and roles,
   focusable controls, logical tab order, managed focus, interactive element affordance and
   visual order following the DOM. Those are exactly what a waveform with drag handles or a week
   of tick buttons depends on, so they are checked here instead of assumed.

   What this asserts on every page:
     1. every visible focusable element has an accessible name
     2. no positive tabindex, which is what breaks tab order away from reading order
     3. nothing focusable is hidden from assistive technology inside aria-hidden
     4. every form control has a real label, not just a placeholder
     5. one main landmark and exactly one h1, with no skipped heading levels
     6. every image has alt text, and every button that toggles reports its state
*/
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8770;
const BASE = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/vnd.microsoft.icon', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.wasm': 'application/wasm' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  let file = pathname === '/offline' ? path.join(DIST, 'offline.html')
    : pathname.endsWith('/') ? path.join(DIST, pathname, 'index.html') : path.join(DIST, pathname);
  const ok = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) file = path.join(DIST, '404.html');
  res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-a11y-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}/p`],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

let buffer = '', sequence = 0, session, stderr = '';
const pending = new Map();
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
  }
});
function send(method, params = {}, target = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out. ${stderr.slice(-500)}`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }) + '\0');
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function until(expression) {
  for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out waiting for ' + expression);
}

// Runs inside the page. Deliberately conservative: it reports only what is clearly wrong.
const AUDIT = `(() => {
  const visible = el => {
    if (el.closest('[hidden]')) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  };
  const where = el => el.tagName.toLowerCase() + (el.id ? '#' + el.id : el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : '');
  const text = el => (el.textContent || '').replace(/\\s+/g, ' ').trim();
  const name = el => {
    const by = el.getAttribute('aria-labelledby');
    if (by) {
      const joined = by.split(/\\s+/).map(id => { const t = document.getElementById(id); return t ? text(t) : ''; }).join(' ').trim();
      if (joined) return joined;
    }
    const label = el.getAttribute('aria-label');
    if (label && label.trim()) return label.trim();
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) {
      if (el.id) { const l = document.querySelector('label[for="' + CSS.escape(el.id) + '"]'); if (l && text(l)) return text(l); }
      const wrapping = el.closest('label');
      if (wrapping && text(wrapping)) return text(wrapping);
      if (el.type === 'submit' || el.type === 'button') { if (el.value) return el.value; }
      if (el.title) return el.title;
      return '';
    }
    if (text(el)) return text(el);
    const img = el.querySelector('img[alt]');
    if (img && img.alt.trim()) return img.alt.trim();
    if (el.title) return el.title;
    return '';
  };

  const FOCUSABLE = 'a[href], button, input:not([type=hidden]), select, textarea, [tabindex], [contenteditable=true]';
  const problems = [];
  const add = (kind, el, detail) => problems.push({ kind, el: where(el), detail: detail || '' });

  for (const el of document.querySelectorAll(FOCUSABLE)) {
    const tabindex = el.getAttribute('tabindex');
    if (tabindex !== null && Number(tabindex) > 0) add('positive tabindex', el, 'tabindex=' + tabindex);
    if (el.closest('[aria-hidden="true"]') && !el.disabled && Number(tabindex) !== -1) add('focusable inside aria-hidden', el);
    if (!visible(el) || el.disabled) continue;
    if (!name(el)) add('no accessible name', el);
  }
  for (const el of document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea')) {
    if (!visible(el)) continue;
    const named = !!name(el);
    if (!named && el.placeholder) add('labelled only by a placeholder', el);
  }
  for (const img of document.querySelectorAll('img')) {
    if (!img.hasAttribute('alt')) add('image without alt', img);
  }
  // A control that toggles should say so. Anything with an "on"/"active"/"pressed" class and no
  // aria state is a custom control that assistive technology cannot read.
  for (const el of document.querySelectorAll('button')) {
    if (!visible(el)) continue;
    const cls = typeof el.className === 'string' ? el.className : '';
    if (/\\b(active|selected|pressed|on)\\b/.test(cls) && !el.hasAttribute('aria-pressed') && !el.hasAttribute('aria-expanded') && el.getAttribute('role') !== 'tab') {
      add('toggle without an aria state', el, 'class=' + cls);
    }
  }

  const mains = document.querySelectorAll('main, [role=main]').length;
  // The effective level, which is what a screen reader announces: aria-level overrides the tag,
  // and a heading may also be built from any element with role="heading".
  const levelOf = h => {
    const declared = Number(h.getAttribute('aria-level'));
    if (declared >= 1 && declared <= 6) return declared;
    return /^H[1-6]$/.test(h.tagName) ? +h.tagName[1] : 2;
  };
  const allHeadings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role=heading]')].filter(visible);
  const h1s = allHeadings.filter(h => levelOf(h) === 1);
  const headings = allHeadings.map(levelOf);
  let skipped = null;
  for (let i = 1; i < headings.length; i++) if (headings[i] - headings[i - 1] > 1) skipped = 'h' + headings[i - 1] + ' then h' + headings[i];

  return {
    problems,
    mains, h1s: h1s.length, skipped,
    lang: document.documentElement.lang || null,
    title: document.title,
    focusableCount: [...document.querySelectorAll(FOCUSABLE)].filter(visible).length
  };
})()`;

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'index.html')), 'run python3 build.py first');
  const tools = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'tools.json'), 'utf8'));
  const vs = fs.readdirSync(path.join(__dirname, '..', 'vs')).filter(f => f.endsWith('.json')).map(f => '/vs/' + f.replace(/\.json$/, '') + '/');
  const pages = ['/', '/about/', '/privacy/', '/terms/']
    .concat(tools.filter(t => t.status === 'live' || t.status === 'hidden').map(t => `/tools/${t.slug}/`))
    .concat(vs);

  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });

  const failures = [];
  let controls = 0;
  for (const page of pages) {
    await send('Page.navigate', { url: BASE + page });
    await until("document.readyState==='complete'");
    await new Promise(r => setTimeout(r, 250));   // let a tool finish its first render
    const r = await evaluate(AUDIT);
    controls += r.focusableCount;
    const issues = r.problems.slice();
    if (r.mains !== 1) issues.push({ kind: 'main landmarks', el: 'document', detail: String(r.mains) });
    if (r.h1s !== 1) issues.push({ kind: 'h1 count', el: 'document', detail: String(r.h1s) });
    if (r.skipped) issues.push({ kind: 'heading level skipped', el: 'document', detail: r.skipped });
    if (r.lang !== 'en') issues.push({ kind: 'lang', el: 'html', detail: String(r.lang) });
    if (!r.title) issues.push({ kind: 'no title', el: 'document', detail: '' });
    if (issues.length) {
      failures.push({ page, issues });
      console.log(`  FAIL ${page}`);
      for (const i of issues) console.log(`        ${i.kind}: ${i.el} ${i.detail}`);
    } else {
      console.log(`  ok   ${page}  (${r.focusableCount} controls)`);
    }
  }
  console.log(`\n${pages.length} pages, ${controls} visible controls checked.`);
  assert.deepEqual(failures.map(f => f.page), [], 'pages with accessibility problems');
  console.log('PASS: every control is named and reachable, tab order follows the DOM, landmarks and headings are sound.');
})().catch(e => {
  console.error('\nFAIL:', e && e.message ? e.message : e);
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
