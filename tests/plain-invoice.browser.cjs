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
const bulk0 = require('../tools/invoice-generator/static/bulk.js');

(async () => {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  // Test visits must not count as real ones in the site's analytics…
  // …nor in its own counts or waitlist: against a real site the /api endpoints are blocked too.
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)[:/]/.test(ROOT);
  await send('Network.setBlockedURLs', { urls: ['*cloudflareinsights.com*', ...(local ? [] : ['*/api/*'])] });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dir });
  await send('Emulation.setTimezoneOverride', { timezoneId: 'Australia/Sydney' });   // the region is guessed from the time zone

  // Every page answers, has one h1, and fits a phone.
  await size(390, 844);
  for (const p of ['', 'pricing/', 'privacy/', 'terms/', 'guides/', 'invoice-template-no-gst/', 'tax-invoice-template/', 'cleaning-invoice-template/', 'tutoring-invoice-template/', 'ndis-invoice-template/']) {
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
  await click('#inv-history-csv');
  const listCsv = fs.readdirSync(dir).find(f => /^your-invoices-.*\.csv$/.test(f)) || (await wait(500), fs.readdirSync(dir).find(f => /^your-invoices-.*\.csv$/.test(f)));
  const listRows = bulk0.parseCsv(fs.readFileSync(path.join(dir, listCsv), 'utf8'));
  assert.deepEqual([listRows.length, listRows[1][0], listRows[1][4], listRows[1][7], listRows[1][14], listRows[1][16]], [3, 'INV-001', 'Sue Smith', '2026-11-04', '300.00', 'yes']);
  ok('after saving, the invoice is listed as unpaid, and Mark paid works, and the list downloads as a CSV');

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

  // NDIS: plan managed, the participant on the invoice, a date and support item on each line.
  await open(ROOT + '?start=ndis'); await ev('localStorage.clear()'); await open(ROOT + '?start=ndis');
  assert.ok(await ev("!document.getElementById('inv-ndis-fields').hidden"));
  assert.deepEqual(await ev('window.__invoice.state().columns'), ['Date', 'Support item']);
  await setv('#inv-sellerName', 'Ali Support'); await setv('#inv-clientName', 'Plan Partners');
  await setv('.inv-line textarea', 'Assistance with self care'); await setv('.inv-line [data-field="quantity"]', '2'); await setv('.inv-line [data-field="price"]', '70.23');
  await setv('.inv-line [data-extra="0"]', '2026-11-10');
  const missing = await ev("InvoiceCore.validate(window.__invoice.state()).join(' ')");
  for (const m of ['participant’s name', 'NDIS number', 'Plan managers need your ABN', 'support item number for item 1']) assert.ok(missing.includes(m), m);
  await setv('#inv-ndisName', 'Jane Citizen'); await setv('#inv-ndisNumber', '430000000'); await setv('#inv-sellerAbn', '51 824 753 556');
  await setv('.inv-line [data-extra="1"]', '01_011_0107_1_1');
  assert.equal(await text('#inv-validation'), 'Ready to print');
  assert.match(await text('#inv-paper'), /NDIS participant: Jane Citizen\s*NDIS number: 430000000\s*Funding: plan managed/);
  await setv('#inv-number', 'NDIS-001'); await click('#inv-pdf');
  const t3 = await pdfText('NDIS-001.pdf');
  for (const s of ['NDIS participant: Jane Citizen', 'NDIS number: 430000000', 'Support item', '01_011_0107_1_1', '10 Nov 2026', '$140.46']) assert.ok(t3.includes(s), s + ' missing from the NDIS PDF');
  await setv('.inv-line [data-extra="0"]', '2026-01-05');
  assert.match(await text('#inv-ndis-note'), /more than 90 days old/);
  await setv('.inv-line [data-extra="0"]', '2026-11-10');
  await until("!document.getElementById('inv-offer').hidden"); assert.equal(await text('#inv-offer-who'), 'Jane Citizen');
  await click('#inv-offer-save'); await open();
  assert.match(await text('[data-quick]'), /New invoice for Jane Citizen/);
  await ev("document.getElementById('inv-preview').scrollIntoView()"); await size(1280, 900); await click('[data-quick]'); await ev("document.getElementById('inv-preview').scrollIntoView()"); await shot('laptop-ndis-invoice'); await size(390, 844);
  ok('an NDIS invoice asks for the participant, NDIS number, ABN, date and support item, warns at 90 days, and "New invoice for" names the participant');

  // Many invoices from a spreadsheet: the template goes in, a ZIP of PDFs comes out.
  const bulk = require('../tools/invoice-generator/static/bulk.js');
  await open(); await ev('localStorage.clear()'); await open();
  const pick = async file => { const { root } = await send('DOM.getDocument'); const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#inv-bulk-file' }); await send('DOM.setFileInputFiles', { nodeId, files: [file] }); };
  const csv = path.join(dir, 'rows.csv'); fs.writeFileSync(csv, bulk.template('general'));
  await pick(csv);
  await until("!document.getElementById('inv-bulk-result').hidden");
  assert.match(await text('#inv-bulk-errors'), /Fill in your own details in the form first.*business name/, 'your own details are asked for once');
  await setv('#inv-sellerName', 'Sam Clean Co'); await setv('#inv-bankBsb', '062-000'); await setv('#inv-bankAccount', '12345678');
  await pick(csv);
  await until("/2 invoices ready, \\$380\\.00 in all/.test(document.getElementById('inv-bulk-sum').textContent)");
  assert.deepEqual(await ev("[...document.querySelectorAll('#inv-bulk-list strong')].map(e=>e.textContent)"), ['INV-001 · Sue Smith', 'INV-002 · Bob Brown']);
  await click('#inv-bulk-make');
  await until("/Downloaded 2 PDFs in one ZIP/.test(document.getElementById('inv-bulk-sum').textContent)");
  let zipName; for (let i = 0; i < 100 && !zipName; i++) { zipName = fs.readdirSync(dir).find(f => /^invoices-.*\.zip$/.test(f)); if (!zipName) await wait(100); }
  assert.ok(zipName, 'the ZIP was downloaded');
  await wait(300); const out = path.join(dir, 'unzipped'); execFileSync('unzip', ['-q', path.join(dir, zipName), '-d', out]);
  assert.deepEqual(fs.readdirSync(out).sort(), ['INV-001 Sue Smith.pdf', 'INV-002 Bob Brown.pdf', 'invoices.csv']);
  const sue = execFileSync('pdftotext', ['-layout', path.join(out, 'INV-001 Sue Smith.pdf'), '-'], { encoding: 'utf8' });
  for (const s2 of ['Sam Clean Co', 'Sue Smith', '4 Nov 2026', '18 Nov 2026', '$300.00', 'BSB: 062-000', 'Reference: INV-001']) assert.ok(sue.includes(s2), s2 + ' missing from a bulk PDF');
  const bad = path.join(dir, 'bad.csv'); fs.writeFileSync(bad, 'customer,date,description,unit_price\nSue,4/11/2026,Clean,60\n,5/11/2026,Clean,60\nBob,99/99/2026,Mow,80\n');
  await pick(bad);
  await until("/1 invoice ready/.test(document.getElementById('inv-bulk-sum').textContent)");
  assert.match(await text('#inv-bulk-errors'), /Row 3: no customer.*Row 4: "99\/99\/2026" is not a date/);
  const xl = path.join(dir, 'book.xlsx'); fs.writeFileSync(xl, 'PK'); await pick(xl);
  await until("/Excel workbook/.test(document.getElementById('inv-bulk-errors').textContent)");
  ok('a spreadsheet of jobs becomes one invoice per customer, downloaded as a ZIP of PDFs; bad rows are named and left out');

  // Other countries: a visitor in the UK gets pounds and VAT, and nothing Australian.
  await send('Emulation.setTimezoneOverride', { timezoneId: 'Europe/London' });
  await open(); await ev('localStorage.clear()'); await open();
  assert.deepEqual(await ev("(()=>{const d=window.__invoice.state();return [d.region,d.currency,d.taxName,d.taxRate]})()"), ['GB', 'GBP', 'VAT', '20']);
  assert.ok(await ev("document.getElementById('inv-ndis').closest('label').hidden&&document.querySelector('.inv-bank').hidden&&!document.getElementById('inv-region-more').hidden"), 'NDIS and BSB are put away, the rate is shown');
  assert.equal(await ev("document.getElementById('inv-sellerAbn').parentElement.firstChild.textContent"), 'VAT number');
  await setv('#inv-sellerName', 'Thames Tutors'); await setv('#inv-sellerAbn', 'GB123456789'); await setv('#inv-clientName', 'Mrs Patel');
  await setv('#inv-gstMode', 'exclusive'); await setv('.inv-line textarea', 'Maths tuition'); await setv('.inv-line [data-field="quantity"]', '3'); await setv('.inv-line [data-field="price"]', '45.50');
  await setv('#inv-payment', 'Sort code 12-34-56, account 12345678'); await setv('#inv-number', 'UK-001');
  assert.equal(await text('#inv-validation'), 'Ready to print');
  const ukPaper = await text('#inv-paper');
  for (const s of ['£163.80', 'VAT number: GB123456789', 'Subtotal (excl. VAT)', 'All amounts in GBP']) assert.ok(ukPaper.includes(s), s + ' missing from the UK preview');
  assert.ok(!/ABN|GST|AUD|Tax Invoice/.test(ukPaper), 'nothing Australian on a UK invoice');
  await click('#inv-pdf');
  const tuk = await pdfText('UK-001.pdf');
  for (const s of ['£163.80', '£27.30', 'VAT number: GB123456789', 'Sort code 12-34-56']) assert.ok(tuk.includes(s), s + ' missing from the UK PDF');
  await setv('#inv-region', 'AU');
  assert.deepEqual(await ev("(()=>{const d=window.__invoice.state();return [d.currency,d.taxName,d.taxRate]})()"), ['AUD', 'GST', '10']);
  assert.ok(await ev("!document.querySelector('.inv-bank').hidden"));
  await send('Emulation.setTimezoneOverride', { timezoneId: 'Australia/Sydney' });
  ok('a UK visitor gets pounds, VAT at 20% and a VAT number, with no ABN, BSB or NDIS; switching back to Australia restores them');

  // Pro: shown beside the moments people want it, never sold. Only where the site has its endpoints.
  const api = await ev("fetch('/api/count',{method:'POST',body:'pro_page'}).then(r=>r.status).catch(()=>0)");
  if (api === 204) {
    await open(ROOT + 'pro/?f=reminders');
    assert.equal(await ev("document.getElementById('pro-feature').value"), 'reminders');
    assert.match(await text('main'), /Cancel any time/);
    await setv('#pro-email', 'nope'); await click('#pro-form button[type=submit]');
    assert.match(await text('#pro-result'), /Enter your email address first/);
    const addr = `test+${Date.now()}@example.com`;
    await setv('#pro-email', addr); await click('#pro-form button[type=submit]');
    await until("/You will get one email when it opens/.test(document.getElementById('pro-result').textContent)");
    assert.deepEqual(await ev("fetch('/api/waitlist',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'x@y.co',website:'spam'})}).then(r=>r.json())"), { ok: true }, 'the honeypot is ignored quietly');
    assert.equal(await ev("fetch('/api/count',{method:'POST',body:'not-an-event'}).then(r=>r.status)"), 400);
    await click('#pro-remove');
    await until("/no longer on the list/.test(document.getElementById('pro-result').textContent)");
    ok('the Pro page says it is not open, takes an email, refuses junk and lets people take it back');
  } else console.log('  --  no /api here (static server): Pro waitlist and counts not tested');

  // Delete everything saved here.
  await open(); await setv('#inv-sellerName', 'X'); await click('#inv-forget');
  assert.equal(await ev("Object.keys(localStorage).filter(k=>k.startsWith('pot:invoice-generator')).length"), 0);
  ok('Delete everything saved here clears the browser storage');

  await size(1280, 900); await open(); await shot('laptop-first-screen');
  assert.deepEqual(errors, [], JSON.stringify(errors));
  console.log('PASS: Plain Invoice pages, first screen, bank details, visits, PDF, invoice list, same again, quote to invoice, offline and delete.');
  console.log('Screenshots: ' + shots);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { chrome.kill(); for (const p of pending.values()) clearTimeout(p.t); });
