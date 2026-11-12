// Plain Invoice (sites/plain-invoice) in headless Chrome. Build it and serve dist on 8767 first:
//   python3 sites/plain-invoice/build.py
//   python3 -m http.server 8767 --bind 127.0.0.1 --directory sites/plain-invoice/dist
// Override with TEST_URL (the site root, ending in /) and CHROME_BIN. Screenshots go to SHOTS or a temp dir.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const assert = require('node:assert/strict');
const ROOT = process.env.TEST_URL || 'http://127.0.0.1:8767/';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'plain-invoice-'));
const shots = process.env.SHOTS || path.join(dir, 'shots'); fs.mkdirSync(shots, { recursive: true });
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${dir}/profile`], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let buf = '', seq = 0, session; const pending = new Map(), errors = [];
chrome.stdio[4].on('data', c => { buf += c; let e; while ((e = buf.indexOf('\0')) >= 0) { const m = JSON.parse(buf.slice(0, e)); buf = buf.slice(e + 1);
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); clearTimeout(p.t); pending.delete(m.id); m.error ? p.rej(new Error(JSON.stringify(m.error))) : p.res(m.result); }
  if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails); } });
const send = (method, params = {}) => new Promise((res, rej) => { const id = ++seq, t = setTimeout(() => { pending.delete(id); rej(new Error(method + ' timed out')); }, 20000); pending.set(id, { res, rej, t }); chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(session ? { sessionId: session } : {}) }) + '\0'); });
const ev = async x => { const r = await send('Runtime.evaluate', { expression: x, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(x + '\n' + JSON.stringify(r.exceptionDetails)); return r.result.value; };
const wait = ms => new Promise(r => setTimeout(r, ms));
async function until(x, tries = 150) { for (let i = 0; i < tries; i++) { if (await ev(x)) return; await wait(50); } throw new Error('Condition timed out: ' + x); }
const size = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
async function shot(name, full = false) { const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full }); fs.writeFileSync(path.join(shots, name + '.png'), Buffer.from(r.data, 'base64')); }
const setv = (sel, v) => ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
const click = sel => ev(`document.querySelector(${JSON.stringify(sel)}).click()`);
const text = sel => ev(`document.querySelector(${JSON.stringify(sel)}).textContent`);
async function open(url = ROOT) { await send('Page.navigate', { url }); await until("document.readyState==='complete'&&(!document.getElementById('inv-form')||(!!window.__invoice&&!!window.InvoicePdf))"); await ev('window.confirm=()=>true'); }
async function pdfText(name) { const f = path.join(dir, name); for (let i = 0; i < 200 && !fs.existsSync(f); i++) await wait(50); await wait(300); return execFileSync('pdftotext', ['-layout', f, '-'], { encoding: 'utf8' }); }
const ok = m => console.log('  ok  ' + m);

(async () => {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });

  // Every page answers, has one h1, and fits a phone.
  await size(390, 844);
  for (const p of ['', 'pricing/', 'privacy/', 'terms/', 'guides/', 'invoice-template-no-gst/', 'tax-invoice-template/', 'cleaning-invoice-template/', 'tutoring-invoice-template/']) {
    await open(ROOT + p);
    assert.equal(await ev("document.querySelectorAll('h1:not([aria-level])').length"), 1, p + ' has one h1');
    assert.ok(await ev('document.documentElement.scrollWidth<=390'), p + ' overflows at 390 px');
    assert.ok(!(await ev("document.body.textContent.includes('{{')")), p + ' has an unfilled placeholder');
  }
  ok('every page has one h1, no placeholders and no sideways scroll at 390 px');

  // The tool is usable on the first screen of a phone.
  await open(); await shot('phone-first-screen');
  const pdfTop = await ev("document.getElementById('inv-pdf').getBoundingClientRect().bottom");
  assert.ok(pdfTop < 844, 'Download PDF is below the first screen: ' + pdfTop);
  ok('on a phone the Download PDF button is on the first screen');

  // Bank details and PayID go on the invoice, with the number as the reference.
  await setv('#inv-sellerName', 'Sam Clean Co'); await setv('#inv-sellerAbn', '51 824 753 556');
  await setv('#inv-clientName', 'Sue Smith'); await setv('#inv-clientEmail', 'sue@example.com');
  await setv('.inv-line textarea', 'Home clean, 3 hours'); await setv('.inv-line [data-field="price"]', '150.00');
  await setv('#inv-bankBsb', '06200');
  assert.match(await text('#inv-validation'), /details needed/);
  assert.ok((await ev("InvoiceCore.validate(window.__invoice.state()).join(' ')")).includes('A BSB has 6 digits'));
  await setv('#inv-bankBsb', '062-000'); await setv('#inv-bankAccount', '1234 5678'); await setv('#inv-bankName', 'Sam Clean Co'); await setv('#inv-payId', '0400 000 000');
  const paper = await text('#inv-paper');
  for (const s of ['How to pay', 'BSB: 062-000', 'Account: 1234 5678', 'PayID: 0400 000 000', 'Reference: INV-001']) assert.ok(paper.includes(s), s + ' missing from the preview');
  ok('BSB, account and PayID show under How to pay, with the invoice number as the reference; a short BSB is refused');

  // People paid by the visit: a Date column, and another visit copies the line without its date.
  await click('#inv-date-col');
  assert.ok(await ev("!document.getElementById('inv-visit').hidden"));
  await setv('.inv-line [data-extra="0"]', '2026-11-04');
  await click('#inv-visit');
  assert.deepEqual(await ev("window.__invoice.state().items.map(i=>[i.description,i.price,i.extra[0]])"), [['Home clean, 3 hours', '150.00', '2026-11-04'], ['Home clean, 3 hours', '150.00', '']]);
  assert.equal(await ev('document.activeElement.type'), 'date', 'the new date picker has focus');
  await setv('.inv-line:nth-child(2) [data-extra="0"]', '2026-11-18');
  ok('"Another visit like the last" copies the line and leaves the date for the new visit');
  await size(1280, 900); await ev("document.getElementById('inv-preview').scrollIntoView()"); await shot('laptop-invoice-with-visits-and-bank');

  await click('#inv-pdf');
  const t1 = await pdfText('INV-001.pdf');
  for (const s of ['HOW TO PAY', 'BSB: 062-000', 'Reference: INV-001', '4 Nov 2026', '18 Nov 2026', '$300.00', 'Date: ']) assert.ok(t1.includes(s), s + ' missing from the PDF');
  ok('the PDF has the visit dates, the total and How to pay');

  // Save, then the invoice list: unpaid, mark paid.
  await until("!document.getElementById('inv-offer').hidden"); await click('#inv-offer-save');
  await until("!document.getElementById('inv-history').hidden");
  assert.match(await text('#inv-history-list'), /INV-001 · Sue Smith/);
  assert.match(await text('#inv-history-list'), /Unpaid/);
  assert.match(await text('#inv-history-sum'), /1 unpaid, \$300\.00 owed to you/);
  await click('[data-hpaid]');
  assert.match(await text('#inv-history-list'), /Paid/); assert.match(await text('#inv-history-sum'), /Everything is paid/);
  ok('after saving, the invoice is listed as unpaid, and Mark paid works');

  // Next month: one tap, last invoice's lines, dates cleared, next number, bank details kept.
  await size(390, 844); await open(); await shot('phone-returning');
  assert.match(await text('[data-quick]'), /New invoice for Sue Smith.*INV-002/);
  await click('[data-quick]');
  assert.deepEqual(await ev("(()=>{const d=window.__invoice.state();return [d.number,d.items.length,d.items.map(i=>i.extra[0]).join('|'),d.bankBsb,d.issueDate===InvoiceCore.today()]})()"), ['INV-002', 2, '|', '062-000', true]);
  await shot('phone-after-one-tap');
  ok('"New invoice for Sue Smith" brings back both visits with the dates cleared, the bank details and INV-002');

  // A quote becomes an invoice in one tap.
  await setv('#inv-kind', 'quote'); await setv('#inv-number', 'Q-001');
  assert.ok(await ev("!document.getElementById('inv-to-invoice').hidden"));
  await click('#inv-to-invoice');
  assert.deepEqual(await ev("(()=>{const d=window.__invoice.state();return [d.kind,d.number,d.clientName,d.items.length]})()"), ['invoice', 'INV-002', 'Sue Smith', 2]);
  assert.ok(await ev("document.getElementById('inv-to-invoice').hidden"));
  ok('a quote turns into an invoice with the next invoice number, same customer and lines');

  // Opening an old invoice from the list gives it back exactly.
  await click('[data-hopen]');
  assert.deepEqual(await ev("(()=>{const d=window.__invoice.state();return [d.number,d.items[1].extra[0]]})()"), ['INV-001', '2026-11-18']);
  ok('Open on the invoice list gives back the invoice as it was sent');

  // The same number for another customer is its own entry, with a warning, and leaves Sue's alone.
  await setv('#inv-clientName', 'Bob Brown'); await click('#inv-pdf');
  await until("/already used for Sue Smith/.test(document.getElementById('inv-status').textContent)");
  assert.deepEqual(await ev("window.__invoice.history().map(h=>[h.doc.number,h.doc.clientName,!!h.paidAt])"), [['INV-001', 'Bob Brown', false], ['INV-001', 'Sue Smith', true]]);
  ok('reusing a number for another customer warns, and Sue\'s paid invoice is untouched');

  // Same again takes the newest invoice by date, even after an older one is downloaded again.
  await ev("document.querySelector('[data-quick]').click()");
  await setv('#inv-issueDate', '2026-12-01'); await setv('#inv-dueDate', '2026-12-15'); await setv('.inv-line textarea', 'Deep clean'); await click('#inv-pdf');
  await until("window.__invoice.history().some(h=>h.doc.number==='INV-002')");
  await ev("[...document.querySelectorAll('[data-hopen]')].find(b=>/INV-001/.test(b.getAttribute('aria-label'))&&/Sue/.test(b.closest('li').textContent)).click()");
  assert.equal(await ev("window.__invoice.state().clientName"), 'Sue Smith');
  await click('#inv-pdf'); await wait(300);
  await open(); await click('[data-quick]');
  assert.equal(await ev("window.__invoice.state().items[0].description"), 'Deep clean');
  ok('"same again" copies the newest invoice by date, not the one downloaded most recently');

  // Offline: once the worker is installed, the tool and the PDF maker work with no connection.
  await ev('navigator.serviceWorker.ready.then(()=>true)'); await open();
  await until("!!navigator.serviceWorker.controller", 200);
  await until("caches.keys().then(k=>k.some(x=>x.startsWith('pi-app-')))", 200);
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await open(); await ev('localStorage.clear()'); await open();
  await setv('#inv-sellerName', 'Offline Co'); await setv('#inv-clientName', 'Bob'); await setv('.inv-line textarea', 'Mowing'); await setv('.inv-line [data-field="price"]', '60.00');
  await setv('#inv-number', 'OFF-001');
  await click('#inv-pdf');
  await until("/Downloaded/.test(document.getElementById('inv-status').textContent)");
  assert.ok((await pdfText('OFF-001.pdf')).includes('Offline Co'), 'no PDF was made offline');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  ok('offline, the page opens and Download PDF still works');

  // Delete everything saved here.
  await open(); await setv('#inv-sellerName', 'X'); await click('#inv-forget');
  assert.equal(await ev("Object.keys(localStorage).filter(k=>k.startsWith('pot:invoice-generator')).length"), 0);
  ok('Delete everything saved here clears the browser storage');

  await size(1280, 900); await open(); await shot('laptop-first-screen');
  assert.deepEqual(errors, [], JSON.stringify(errors));
  console.log('PASS: Plain Invoice pages, first screen, bank details, visits, PDF, invoice list, same again, quote to invoice, offline and delete.');
  console.log('Screenshots: ' + shots);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { chrome.kill(); for (const p of pending.values()) clearTimeout(p.t); });
