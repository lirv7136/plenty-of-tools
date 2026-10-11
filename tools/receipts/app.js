/* Receipts to Expenses — UI over ReceiptCore and a self-hosted Tesseract worker.
   Rows autosave in localStorage. Images are read and discarded; they are never stored or sent. */
(() => {
'use strict';
const C = window.ReceiptCore;
const $ = id => document.getElementById(id);
const KEY = 'pot:receipts:v1';
const VENDOR = '/assets/receipts/vendor';
const els = { drop: $('drop'), files: $('files'), status: $('status'), rows: $('rows'), foot: $('foot'), table: $('table'),
  empty: $('empty'), count: $('count'), cats: $('by-category'), add: $('btn-add'), csv: $('btn-csv'), print: $('btn-print'), clear: $('btn-clear') };
if (!C) { els.status.textContent = 'The page did not load completely. Reload and try again.'; return; }

const uid = () => Math.random().toString(36).slice(2, 10);
let rows = [];
let worker = null;
let clearArmed = false;

function load() {
  try { const saved = JSON.parse(localStorage.getItem(KEY) || '[]'); if (Array.isArray(saved)) rows = saved; } catch { rows = []; }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch { /* full or blocked: the table still works this session */ }
}
const say = (text) => { els.status.textContent = text; };

function input(value, attrs = {}) {
  const el = document.createElement('input');
  el.type = 'text';
  el.value = value == null ? '' : value;
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}
const money = (cents) => (cents == null ? '' : (cents / 100).toFixed(2));

function render() {
  els.rows.textContent = '';
  els.table.hidden = rows.length === 0;
  els.empty.hidden = rows.length > 0;
  els.count.textContent = rows.length ? `(${rows.length})` : '';
  for (const row of rows) {
    const tr = document.createElement('tr');
    const cell = (cls, child) => { const td = document.createElement('td'); if (cls) td.className = cls; td.append(child); tr.append(td); return child; };
    const date = cell('date', input(row.date, { placeholder: 'YYYY-MM-DD', 'aria-label': 'Date' }));
    date.addEventListener('change', () => { row.date = /^\d{4}-\d{2}-\d{2}$/.test(date.value.trim()) ? date.value.trim() : C.findDate(date.value) || date.value.trim(); date.value = row.date; save(); });
    const merchant = cell('', input(row.merchant, { 'aria-label': 'Merchant', maxlength: '80' }));
    merchant.addEventListener('change', () => { row.merchant = merchant.value.trim(); save(); });
    const sel = document.createElement('select');
    sel.setAttribute('aria-label', 'Category');
    for (const c of C.CATEGORIES) { const o = document.createElement('option'); o.value = o.textContent = c; sel.append(o); }
    sel.value = row.category || 'Other';
    cell('', sel).addEventListener('change', () => { row.category = sel.value; save(); renderTotals(); });
    const total = cell('n', input(money(row.total), { inputmode: 'decimal', 'aria-label': 'Total' }));
    total.addEventListener('change', () => { row.total = C.toCents(total.value); total.value = money(row.total); save(); renderTotals(); });
    const gstValue = row.gst != null ? row.gst : row.gstEstimated;
    const gst = cell('n', input(money(gstValue), { inputmode: 'decimal', 'aria-label': 'GST' }));
    if (row.gst == null && row.gstEstimated != null) { gst.classList.add('est'); gst.title = 'Estimated: one eleventh of the total'; }
    gst.addEventListener('change', () => { row.gst = C.toCents(gst.value); row.gstEstimated = null; gst.classList.remove('est'); gst.value = money(row.gst); save(); renderTotals(); });
    const abn = cell('', input(row.abn, { 'aria-label': 'ABN', inputmode: 'numeric', maxlength: '14' }));
    abn.addEventListener('change', () => { const d = abn.value.replace(/\s/g, ''); row.abn = C.validAbn(d) ? d : ''; abn.value = row.abn; if (d && !row.abn) say('That ABN fails the ATO checksum, so it was left blank.'); save(); });
    const note = cell('', input(row.note, { 'aria-label': 'Note', maxlength: '120' }));
    note.addEventListener('change', () => { row.note = note.value.trim(); save(); });
    const del = document.createElement('button');
    del.type = 'button'; del.className = 'icon-btn'; del.textContent = '×'; del.setAttribute('aria-label', `Remove ${row.merchant || 'row'}`);
    del.addEventListener('click', () => { rows = rows.filter(r => r !== row); save(); render(); });
    const td = document.createElement('td'); td.className = 'no-print'; td.append(del); tr.append(td);
    els.rows.append(tr);
  }
  renderTotals();
}

function renderTotals() {
  const t = C.totals(rows.map(r => ({ ...r, gst: r.gst != null ? r.gst : null })));
  els.foot.textContent = '';
  if (!rows.length) { els.cats.textContent = ''; return; }
  const tr = document.createElement('tr');
  tr.innerHTML = '<td></td><td>Total</td><td></td><td class="n"></td><td class="n"></td><td></td><td></td><td class="no-print"></td>';
  tr.children[3].textContent = C.fmt(t.total);
  tr.children[4].textContent = C.fmt(t.gst);
  tr.children[4].title = 'GST stated on receipts only';
  els.foot.append(tr);
  els.cats.textContent = '';
  for (const [cat, cents] of Object.entries(t.byCategory).sort((a, b) => b[1] - a[1])) {
    const s = document.createElement('span'); s.textContent = `${cat} ${C.fmt(cents)}`; els.cats.append(s);
  }
}

async function getWorker() {
  if (worker) return worker;
  if (!window.Tesseract) throw new Error('reader-missing');
  say('Loading the reader (once)...');
  worker = await window.Tesseract.createWorker('eng', 1, {
    workerPath: `${VENDOR}/worker.min.js`, corePath: `${VENDOR}/core`, langPath: `${VENDOR}/lang`,
    // The language data is cached by the browser, so later visits read straight away.
    cacheMethod: 'write',
  });
  return worker;
}

async function readFiles(fileList) {
  const files = [...fileList].filter(f => f.type.startsWith('image/'));
  if (!files.length) return say('Those weren’t images. Add photos of receipts.');
  let done = 0, failed = 0;
  for (const file of files) {
    say(`Reading receipt ${done + failed + 1} of ${files.length}...`);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error('too-big');
      const w = await getWorker();
      const { data } = await w.recognize(file);
      const parsed = C.parseReceipt(data.text);
      rows.push({ id: uid(), ...parsed, note: '' });
      done += 1;
      save();
      render();
    } catch (e) {
      failed += 1;
      if (String(e && e.message) === 'reader-missing') { say('The reader did not load. Check your connection and reload.'); return; }
    }
  }
  say(failed ? `Read ${done}; ${failed} couldn’t be read. Add those by hand with "Add a row".` : `Read ${done} receipt${done === 1 ? '' : 's'}. Check each row.`);
}

els.files.addEventListener('change', () => { if (els.files.files.length) readFiles(els.files.files).finally(() => { els.files.value = ''; }); });
['dragenter', 'dragover'].forEach(t => els.drop.addEventListener(t, e => { e.preventDefault(); els.drop.classList.add('over'); }));
['dragleave', 'drop'].forEach(t => els.drop.addEventListener(t, e => { e.preventDefault(); els.drop.classList.remove('over'); }));
els.drop.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files.length) readFiles(e.dataTransfer.files); });
els.add.addEventListener('click', () => { rows.push({ id: uid(), merchant: '', date: '', total: null, gst: null, gstEstimated: null, abn: '', category: 'Other', note: '' }); save(); render(); });
els.csv.addEventListener('click', () => {
  if (!rows.length) return say('Nothing to download yet.');
  const blob = new Blob([C.toCsv(rows.map(r => ({ ...r, gst: r.gst != null ? r.gst : null })))], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'expenses.csv';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
els.print.addEventListener('click', () => window.print());
els.clear.addEventListener('click', () => {
  if (!clearArmed) { clearArmed = true; els.clear.textContent = 'Click again to clear'; setTimeout(() => { clearArmed = false; els.clear.textContent = 'Clear'; }, 4000); return; }
  rows = []; save(); render(); clearArmed = false; els.clear.textContent = 'Clear'; say('Cleared.');
});

load();
render();
})();
