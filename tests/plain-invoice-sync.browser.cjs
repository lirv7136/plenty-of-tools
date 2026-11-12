// Pro sign in and sync, with two browser profiles as two devices.
// Needs: PI_SYNC=1 PI_PAYWALL=1 python3 sites/plain-invoice/build.py, and the private Pro Worker running locally
// (in ~/dev/plain-invoice-pro: npx wrangler dev --port 8799, with DEV="1" in .dev.vars).
// This file serves the built site and forwards /account/api to that Worker, so both share an origin.
const { spawn } = require('node:child_process');
const http = require('node:http'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const DIST = path.join(__dirname, '..', 'sites', 'plain-invoice', 'dist'), PORT = 8771, API = process.env.PRO_API || 'http://127.0.0.1:8799';
const ROOT = `http://127.0.0.1:${PORT}/`;
// A stand in for Stripe (the Worker's .dev.vars points STRIPE_API here). Checkout "succeeds" by
// sending the browser straight back, and the test then delivers the signed notification itself.
const crypto = require('node:crypto');
const stripeCalls = [], later = Math.floor(Date.now() / 1000) + 30 * 86400;
const fakeStripe = http.createServer((req, res) => { let b = ''; req.on('data', d => b += d); req.on('end', () => {
  stripeCalls.push(`${req.method} ${req.url} ${b}`); res.setHeader('Content-Type', 'application/json');
  if (req.url === '/v1/checkout/sessions') return res.end(JSON.stringify({ url: ROOT + '?pro=1#inv-bulk' }));
  if (req.url === '/v1/billing_portal/sessions') return res.end(JSON.stringify({ url: ROOT + '#inv-sync' }));
  if (req.url.startsWith('/v1/subscriptions/')) return res.end(JSON.stringify({ id: 'sub_t', customer: 'cus_t', status: req.method === 'DELETE' ? 'canceled' : 'active', current_period_end: later }));
  res.statusCode = 404; res.end('{}'); }); });
function stripeHook(event) { const payload = JSON.stringify(event), t = Math.floor(Date.now() / 1000);
  return fetch(API + '/account/api/stripe-webhook', { method: 'POST', headers: { 'Stripe-Signature': `t=${t},v1=${crypto.createHmac('sha256', 'whsec_test_fake').update(`${t}.${payload}`).digest('hex')}` }, body: payload }); }
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  if (req.url.startsWith('/account/api/')) {
    const body = await new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
    const headers = { ...req.headers }; delete headers.host; delete headers.connection; delete headers['content-length'];
    const up = await fetch(API + req.url, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body, redirect: 'manual' });
    const out = {}; up.headers.forEach((v, k) => { if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) out[k] = v; });
    res.writeHead(up.status, out); res.end(Buffer.from(await up.arrayBuffer())); return;
  }
  if (req.url.startsWith('/api/')) { res.writeHead(204); res.end(); return; }
  let p = decodeURIComponent(req.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(DIST, p);
  if (!f.startsWith(DIST) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f));
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pi-sync-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--remote-debugging-pipe', `--user-data-dir=${dir}/profile`], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let buf = '', seq = 0; const pending = new Map(), errors = [];
chrome.stdio[4].on('data', c => { buf += c; let e; while ((e = buf.indexOf('\0')) >= 0) { const m = JSON.parse(buf.slice(0, e)); buf = buf.slice(e + 1);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); clearTimeout(p.t); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails); } });
const raw = (method, params = {}, sessionId) => new Promise((res, rej) => { const id = ++seq, t = setTimeout(() => { pending.delete(id); rej(new Error(method + ' timed out')); }, 20000); pending.set(id, { res, rej, t }); chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0'); });
const wait = ms => new Promise(r => setTimeout(r, ms));
const ok = m => console.log('  ok  ' + m);

// One "device": its own cookies and storage.
async function device() {
  const { browserContextId } = await raw('Target.createBrowserContext');
  const { targetId } = await raw('Target.createTarget', { url: 'about:blank', browserContextId });
  const session = (await raw('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  const send = (m, p) => raw(m, p, session);
  await send('Runtime.enable'); await send('Page.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir, browserContextId }).catch(() => {});
  const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(x + '\n' + JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const until = async (x, tries = 200) => { for (let i = 0; i < tries; i++) { if (await ev(x).catch(() => false)) return; await wait(50); } throw new Error('Condition timed out: ' + x); };
  const open = async (url = ROOT) => { await send('Page.navigate', { url }); await until("document.readyState==='complete'&&!!window.__invoice&&!!window.InvoicePdf"); await ev('window.confirm=()=>true'); };
  const setv = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const click = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
  const text = sel => ev(`document.querySelector(${JSON.stringify(sel)}).textContent`);
  const inStep = () => until("/^In step/.test(document.getElementById('inv-sync-note').textContent)");
  async function signIn(email) {
    await setv('#inv-sync-email', email); await click('#inv-sync-send');
    await until('!!window.__devLink');
    assert.match(await text('#inv-sync-note'), /Check .* for a sign in link/);
    const link = (await ev('window.__devLink')).replace(/^https?:\/\/[^/]+/, ROOT.slice(0, -1));
    await send('Page.navigate', { url: link }); await until("!!document.querySelector('form button')");
    await ev("document.querySelector('form').submit()");
    await until("document.readyState==='complete'&&!!window.__invoice&&/signed-in=1/.test(location.search)"); await ev('window.confirm=()=>true');
    await until(`document.getElementById('inv-sync-who').textContent===${JSON.stringify(email)}`);
    await inStep();
  }
  const pick = async (sel, file) => { const { root } = await send('DOM.getDocument'); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: sel }); await send('DOM.setFileInputFiles', { nodeId, files: [file] }); };
  return { ev, until, open, setv, click, text, inStep, signIn, pick };
}

(async () => {
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  await new Promise(r => fakeStripe.listen(8798, '127.0.0.1', r));
  const email = `sync${Date.now()}@example.com`;
  const phone = await device(), laptop = await device();

  // The phone makes an invoice and saves the customer, signed out. Nothing has left the device.
  await phone.open();
  assert.ok(await phone.ev("!document.getElementById('inv-sync').hidden&&document.getElementById('inv-sync-in').hidden"));
  await phone.setv('#inv-sellerName', 'Sam Clean Co'); await phone.setv('#inv-clientName', 'Sue Smith');
  await phone.setv('.inv-line textarea', 'Home clean'); await phone.setv('.inv-line [data-field="price"]', '150.00');
  await phone.click('#inv-pdf'); await phone.until("!document.getElementById('inv-offer').hidden"); await phone.click('#inv-offer-save');
  await phone.signIn(email);
  ok('the phone signs in with a one time emailed link, no password');

  // The laptop signs in and has the customer and the invoice.
  await laptop.open(); await laptop.signIn(email);
  await laptop.until("!!document.querySelector('[data-quick]')");
  assert.match(await laptop.text('[data-quick]'), /New invoice for Sue Smith.*INV-002/);
  assert.match(await laptop.text('#inv-history-list'), /INV-001 · Sue Smith/);
  ok('the laptop gets the saved customer, the next number and the invoice list');

  // Marked paid on the laptop; the phone sees it. A second customer saved on the phone reaches the laptop.
  await laptop.click('[data-hpaid]'); await wait(1700); await laptop.inStep();
  await phone.click('#inv-sync-now'); await phone.until("/Paid/.test(document.getElementById('inv-history-list').textContent)");
  await phone.click('#inv-clear'); await phone.setv('#inv-sellerName', 'Sam Clean Co'); await phone.setv('#inv-clientName', 'Bob Brown'); await phone.setv('.inv-line textarea', 'Mowing'); await phone.setv('.inv-line [data-field="price"]', '80.00');
  assert.equal(await phone.ev("document.getElementById('inv-number').value"), 'INV-002');
  await phone.click('#inv-pdf'); await phone.until("!document.getElementById('inv-offer').hidden"); await phone.click('#inv-offer-save'); await wait(1700); await phone.inStep();
  await laptop.click('#inv-sync-now'); await laptop.until("document.querySelectorAll('[data-quick]').length===2");
  assert.deepEqual(await laptop.ev("[...document.querySelectorAll('[data-quick] small')].map(s=>s.textContent)"), ['Next number INV-003', 'Next number INV-003'], 'numbers stay in one sequence across devices');
  ok('paid on one device shows on the other, and a new customer and the running number sync both ways');

  // Both devices change something before either syncs: nothing is lost.
  await laptop.ev("document.getElementById('inv-tpl').value=window.__invoice.templates().templates.find(t=>t.name==='Bob Brown').id;document.getElementById('inv-tpl').dispatchEvent(new Event('change'))");
  await laptop.click('#inv-tpl-delete');
  await phone.ev("[...document.querySelectorAll('[data-hpaid]')].find(b=>/INV-002/.test(b.getAttribute('aria-label'))).click()");
  await wait(1900); await laptop.inStep(); await phone.inStep();
  await laptop.click('#inv-sync-now'); await wait(300); await laptop.inStep(); await phone.click('#inv-sync-now'); await wait(300); await phone.inStep();
  for (const d of [phone, laptop]) {
    assert.deepEqual(await d.ev("window.__invoice.templates().templates.map(t=>t.name)"), ['Sue Smith'], 'the deleted customer stays deleted on both');
    assert.deepEqual(await d.ev("window.__invoice.history().map(h=>[h.doc.number,!!h.paidAt]).sort()"), [['INV-001', true], ['INV-002', true]]);
  }
  ok('changes made on both devices at once are merged: the deletion sticks and both invoices are paid');

  // The paywall: the preview is free, downloading many invoices from a spreadsheet needs Pro.
  const bulk = require('../tools/invoice-generator/static/bulk.js');
  const csv = path.join(dir, 'rows.csv'); fs.writeFileSync(csv, bulk.template('general'));
  const zips = () => fs.readdirSync(dir).filter(f => /^invoices-.*\.zip$/.test(f)).length;
  const guest = await device(); await guest.open(); await guest.setv('#inv-sellerName', 'Sam Clean Co'); await guest.pick('#inv-bulk-file', csv);
  await guest.until("/2 invoices ready/.test(document.getElementById('inv-bulk-sum').textContent)");
  assert.equal(await guest.text('#inv-bulk-make'), '3. Download all the PDFs (Pro)');
  await guest.click('#inv-bulk-make');
  assert.ok(await guest.ev("!document.getElementById('inv-pay').hidden&&!document.getElementById('inv-pay-signin').hidden&&document.getElementById('inv-pay-month').hidden"), 'signed out: asked to sign in first');
  await phone.pick('#inv-bulk-file', csv); await phone.until("/2 invoices ready/.test(document.getElementById('inv-bulk-sum').textContent)");
  await phone.click('#inv-bulk-make');
  assert.ok(await phone.ev("!document.getElementById('inv-pay').hidden&&document.getElementById('inv-pay-signin').hidden&&!document.getElementById('inv-pay-month').hidden"), 'signed in, not Pro: offered Pro');
  await wait(800); assert.equal(zips(), 0, 'nothing downloads without Pro');
  ok('without Pro the spreadsheet preview is free and the download asks for Pro');
  // Pay: the page goes to checkout and comes back; Stripe's signed notification makes the account Pro.
  await phone.click('#inv-pay-year');
  await phone.until("/[?&]pro=1/.test(location.search)&&document.readyState==='complete'&&!!window.__invoice");
  const sent = stripeCalls.find(c => c.startsWith('POST /v1/checkout/sessions')); assert.match(sent, /price_year_test/);
  await stripeHook({ id: 'evt_' + Date.now(), type: 'checkout.session.completed', data: { object: { client_reference_id: /client_reference_id=([0-9a-f-]+)/.exec(sent)[1], customer: 'cus_t', subscription: 'sub_t' } } });
  await phone.until("/· Pro$/.test(document.getElementById('inv-sync-who').textContent)", 300);
  assert.ok(await phone.ev("!document.getElementById('inv-sync-billing').hidden"));
  await phone.ev('window.confirm=()=>true'); await phone.setv('#inv-sellerName', 'Sam Clean Co');
  await phone.pick('#inv-bulk-file', csv); await phone.until("/2 invoices ready/.test(document.getElementById('inv-bulk-sum').textContent)");
  assert.equal(await phone.text('#inv-bulk-make'), '3. Download all the PDFs');
  await phone.click('#inv-bulk-make'); await phone.until("/Downloaded 2 PDFs/.test(document.getElementById('inv-bulk-sum').textContent)");
  for (let i = 0; i < 50 && !zips(); i++) await wait(100); assert.equal(zips(), 1);
  ok('after paying, the account is Pro within seconds and the download works');

  // Sign out keeps the device's own copy; delete my account ends it everywhere.
  await phone.click('#inv-sync-signout'); await phone.until("!document.getElementById('inv-sync-out').hidden");
  assert.equal(await phone.ev("window.__invoice.templates().templates.length"), 1);
  await laptop.click('#inv-sync-delete'); await laptop.until("/have been deleted/.test(document.getElementById('inv-sync-note').textContent)");
  assert.equal(await laptop.ev("fetch('/account/api/me').then(r=>r.status)"), 401);
  assert.ok(stripeCalls.some(c => c.startsWith('DELETE /v1/subscriptions/sub_t')), 'deleting the account cancelled the subscription');
  assert.equal(await laptop.ev("window.__invoice.templates().templates.length"), 1, 'what is on the device stays');
  ok('sign out keeps this device\'s copy; delete my account removes the server copy and signs out');

  assert.deepEqual(errors, [], JSON.stringify(errors));
  console.log('PASS: Pro sign in by emailed link, sync both ways, merge of simultaneous changes, the paywall and payment, sign out and delete account.');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { chrome.kill(); server.close(); fakeStripe.close(); for (const p of pending.values()) clearTimeout(p.t); });
