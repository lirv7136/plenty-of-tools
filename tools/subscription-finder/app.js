/* Pure analysis functions are shared by the browser UI and Node's test runner. */
(function (root) {
  'use strict';
  const DAY = 86400000;
  const median = values => { const a = [...values].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };

  function parseCSV(source) {
    if (source.length > 10 * 1024 * 1024) throw new Error('Please use a file smaller than 10 MB.');
    const text = source.replace(/^\uFEFF/, '');
    if (text.includes('\0')) throw new Error('This looks like a binary file. Export a CSV, rather than an Excel workbook or PDF.');
    function read(delimiter) {
      const rows = []; let row = [], cell = '', quoted = false, closed = false;
      const endCell = () => { row.push(cell.trim()); cell = ''; closed = false; };
      const endRow = () => { endCell(); if (row.some(Boolean)) rows.push(row); row = []; if (rows.length > 100001) throw new Error('Please use fewer than 100,000 transactions.'); };
      for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (quoted) {
          if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
          else cell += ch;
        } else if (ch === delimiter) endCell();
        else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; endRow(); }
        else if (ch === '"' && !cell.trim() && !closed) { cell = ''; quoted = true; }
        else { if (closed && ch.trim()) throw new Error('Malformed CSV: unexpected text after a quoted field.'); cell += ch; }
      }
      if (quoted) throw new Error('Malformed CSV: an opening quote has no closing quote.');
      endRow(); return rows;
    }
    // Score complete records, so quoted commas and newlines do not affect detection.
    let best = null, error;
    for (const delimiter of [',', ';', '\t']) {
      try {
        const rows = read(delimiter), widths = rows.slice(0, 20).map(r => r.length);
        const width = widths.length ? median(widths) : 0;
        const score = width > 1 ? widths.filter(w => w === width).length / widths.length * 100 + Math.min(width, 20) : 0;
        if (!best || score > best.score) best = { rows, score };
      } catch (e) { error = e; }
    }
    if (!best || !best.score) throw error || new Error('No CSV columns found. Choose a comma, semicolon or tab-separated transaction export.');
    if (best.rows[0].length > 100) throw new Error('Please use a transaction export with fewer than 100 columns.');
    return best.rows;
  }

  function parseAmount(raw) {
    let s = String(raw ?? '').trim();
    if (!s) return null;
    let negative = false;
    if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1).trim(); }
    if (/\s*DR$/i.test(s)) { negative = true; s = s.replace(/\s*DR$/i, ''); }
    else s = s.replace(/\s*CR$/i, '');
    s = s.replace(/^(?:AUD|USD|GBP|EUR|CAD|NZD|INR)\s*/i, '').replace(/[$£€₹]/g, '').trim();
    if (!/^[+-]?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(s)) return null;
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) && Math.abs(n) < 1e12 ? (negative ? -Math.abs(n) : n) : null;
  }

  function parseDate(raw, order = 'dmy') {
    const s = String(raw ?? '').trim(); let year, month, day;
    const iso = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/.exec(s);
    const local = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})$/.exec(s);
    const named = /^(\d{1,2})[ -]([A-Za-z]{3})[ -](\d{4})$/.exec(s);
    if (iso) [, year, month, day] = iso.map(Number);
    else if (local) { year = Number(local[3]); if (local[3].length === 2) year += year < 70 ? 2000 : 1900; [day, month] = order === 'mdy' ? [Number(local[2]), Number(local[1])] : [Number(local[1]), Number(local[2])]; }
    else if (named) { day = Number(named[1]); month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(named[2].toLowerCase()) + 1; year = Number(named[3]); }
    else return null;
    if (year < 1900 || year > 2100) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? d.getTime() : null;
  }

  function merchantKey(raw) {
    return String(raw).normalize('NFKC').toUpperCase()
      .replace(/^(?:(?:VISA|MASTERCARD|DEBIT CARD|CARD PURCHASE|POS PURCHASE|DIRECT DEBIT|RECURRING PAYMENT)\s+)+/, '')
      .replace(/\b(?:REF|REFERENCE|AUTH|CARD)\s*[:#-]?\s*\d{4,}\b/g, '')
      .replace(/\b\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?\b/g, '')
      .replace(/\b\d{6,}\b/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  }

  function guessColumns(row) {
    const names = row.map(v => v.toLowerCase().replace(/[^a-z]/g, ''));
    const find = aliases => names.findIndex(v => aliases.includes(v));
    const debit = find(['debit','debitamount','withdrawal','withdrawals','moneyout','paidout']);
    return {
      date: find(['date','transactiondate','posteddate','postingdate','bookingdate','valuedate']),
      description: find(['description','transactiondescription','merchant','merchantname','payee','details','narrative','particulars']),
      amount: debit >= 0 ? debit : find(['amount','transactionamount','value']),
      sign: debit >= 0 ? 'debit' : 'negative'
    };
  }

  function transactionsFromRows(rows, mapping) {
    const indexes = [mapping.date, mapping.description, mapping.amount];
    if (indexes.some(i => !Number.isInteger(i) || i < 0) || new Set(indexes).size !== 3) throw new Error('Choose three different columns for date, description and amount.');
    const transactions = [], stats = { invalid: 0, nonSpending: 0, duplicates: 0, valid: 0, start: Infinity, end: -Infinity };
    const seen = new Set();
    for (const row of rows) {
      if (mapping.width && row.length !== mapping.width) { stats.invalid++; continue; }
      const date = parseDate(row[mapping.date], mapping.order);
      const raw = row[mapping.amount], amount = parseAmount(raw);
      const description = (row[mapping.description] || '').trim(), merchant = merchantKey(description);
      if (date === null || !merchant || (amount === null && !(mapping.sign === 'debit' && String(raw ?? '').trim() === ''))) { stats.invalid++; continue; }
      stats.valid++; stats.start = Math.min(stats.start, date); stats.end = Math.max(stats.end, date);
      if (amount === null || amount === 0 || (mapping.sign === 'negative' && amount > 0) || (mapping.sign === 'positive' && amount < 0)) { stats.nonSpending++; continue; }
      const cost = Math.round(Math.abs(amount) * 100) / 100;
      const key = JSON.stringify([date, description, cost]);
      if (seen.has(key)) { stats.duplicates++; continue; }
      seen.add(key); transactions.push({ date, amount: cost, description, merchant });
    }
    return { transactions, stats };
  }

  const periods = [
    { name: 'Weekly', days: 7, tolerance: 2, yearly: 52 },
    { name: 'Fortnightly', days: 14, tolerance: 3, yearly: 26 },
    { name: 'Monthly', days: 30.4375, tolerance: 5, yearly: 12, months: 1 },
    { name: 'Quarterly', days: 91.3125, tolerance: 9, yearly: 4, months: 3 },
    { name: 'Yearly', days: 365.25, tolerance: 16, yearly: 1, months: 12 }
  ];
  function nextDate(date, period) {
    if (!period.months) return date + period.days * DAY;
    const d = new Date(date), target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + period.months, 1));
    const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d.getUTCDate(), lastDay)); return target.getTime();
  }

  function findRecurring(transactions, end) {
    const groups = new Map();
    for (const t of transactions) { if (!groups.has(t.merchant)) groups.set(t.merchant, []); groups.get(t.merchant).push(t); }
    const candidates = [];
    for (const [merchant, entries] of groups) {
      const history = [...entries].sort((a, b) => a.date - b.date);
      if (history.length < 2) continue;
      const amounts = history.map(t => t.amount), typical = median(amounts);
      // Conservative grouping: do not turn frequent shopping into a subscription.
      if (amounts.some(a => Math.abs(a - typical) > Math.max(1, typical * 0.25))) continue;
      const gaps = history.slice(1).map((t, i) => (t.date - history[i].date) / DAY);
      const period = periods.find(p => gaps.every(g => Math.abs(g - p.days) <= p.tolerance));
      if (!period) continue;
      const latest = history[history.length - 1], stale = end - latest.date > (period.days * 1.6 + period.tolerance) * DAY;
      const changed = Math.abs(latest.amount - history[0].amount) >= 0.01;
      const strong = history.length >= 3 && gaps.every(g => Math.abs(g - period.days) <= period.tolerance * 0.8);
      candidates.push({ merchant, history, period: period.name, latest: latest.amount, last: latest.date,
        next: nextDate(latest.date, period), monthly: latest.amount * period.yearly / 12,
        yearly: latest.amount * period.yearly, stale, changed, confidence: strong ? 'Stronger pattern' : 'Possible pattern' });
    }
    return candidates.sort((a, b) => b.yearly - a.yearly);
  }

  function reportCSV(candidates, currency) {
    const escape = value => { let s = String(value); if (/^[\s]*[=+@-]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
    const rows = [['Merchant','Frequency','Latest charge','Monthly estimate','Yearly estimate','Currency','Charges observed','Last charge','Next expected after last charge','Pattern','Older pattern']];
    for (const c of candidates) rows.push([c.merchant,c.period,c.latest.toFixed(2),c.monthly.toFixed(2),c.yearly.toFixed(2),currency,c.history.length,new Date(c.last).toISOString().slice(0,10),new Date(c.next).toISOString().slice(0,10),c.confidence,c.stale ? 'Yes' : 'No']);
    return '\uFEFF' + rows.map(r => r.map(escape).join(',')).join('\r\n');
  }

  const api = { parseCSV, parseAmount, parseDate, merchantKey, guessColumns, transactionsFromRows, findRecurring, reportCSV };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  const $ = id => document.getElementById('sf-' + id);
  let rows = [], candidates = [], selected = new Set(), fileName = '', loadVersion = 0;
  const currency = () => $('currency').value;
  const money = n => new Intl.NumberFormat('en-AU', { style: 'currency', currency: currency() }).format(n);
  const dateText = n => new Intl.DateTimeFormat('en-AU', { day:'numeric', month:'short', year:'numeric', timeZone:'UTC' }).format(n);
  const el = (tag, text, className) => { const n = document.createElement(tag); if (text !== undefined) n.textContent = text; if (className) n.className = className; return n; };
  const showError = error => { $('error').textContent = error.message; $('error').hidden = false; };
  function hideResults() { candidates = []; selected.clear(); $('results').hidden = true; $('candidates').replaceChildren(); }
  function clear() {
    loadVersion++; rows = []; fileName = ''; hideResults(); $('file').value = ''; $('mapping').hidden = true;
    $('preview').replaceChildren(); $('message').textContent = ''; $('error').hidden = true; $('clear').hidden = true; $('file-info').textContent = '';
    for (const id of ['date','description','amount']) $(id).replaceChildren();
  }
  function configure() {
    hideResults(); const header = $('header').checked, first = rows[0], guessed = guessColumns(first);
    const labels = first.map((v, i) => header ? `${i + 1}. ${v || 'Unnamed'}` : `Column ${i + 1}`);
    for (const id of ['date','description','amount']) {
      $(id).replaceChildren(new Option('Choose a column', '-1'), ...labels.map((v, i) => new Option(v, String(i))));
      $(id).value = String(header ? guessed[id] : ({date:0, description:1, amount:2})[id]);
    }
    $('sign').value = header ? guessed.sign : 'negative';
    const table = $('preview'); table.replaceChildren();
    const tr = el('tr'); labels.forEach(label => tr.append(el('th', label))); const head = el('thead'); head.append(tr); table.append(head);
    const body = el('tbody');
    for (const row of rows.slice(header ? 1 : 0, header ? 6 : 5)) { const tr = el('tr'); first.forEach((_, i) => tr.append(el('td', row[i] || ''))); body.append(tr); }
    table.append(body);
    $('file-info').textContent = `${fileName} · ${rows.length - (header ? 1 : 0)} rows. Preview of the first five below.`;
  }
  function load(text, name) {
    rows = parseCSV(text); if (rows.length < 2) throw new Error('Please include at least two transactions.');
    fileName = name; const guess = guessColumns(rows[0]); $('header').checked = guess.date >= 0 || guess.amount >= 0 || guess.description >= 0;
    configure(); $('mapping').hidden = false; $('clear').hidden = false; $('message').textContent = 'File opened locally. Check the column mapping below.';
  }
  async function openFile(file) {
    clear(); const version = loadVersion;
    if (!file) return;
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error('Please use a file smaller than 10 MB.');
      if (!/\.(csv|tsv)$/i.test(file.name)) throw new Error('Choose a .csv or .tsv export from your bank.');
      $('message').textContent = 'Reading your file locally…';
      const text = await file.text(); if (version !== loadVersion) return; load(text, file.name);
    } catch (e) { if (version !== loadVersion) return; clear(); showError(e); }
  }
  function totals() {
    const included = candidates.filter((_, i) => selected.has(i));
    $('count').textContent = String(included.length); $('monthly').textContent = money(included.reduce((s, c) => s + c.monthly, 0)); $('yearly').textContent = money(included.reduce((s, c) => s + c.yearly, 0)); $('export').disabled = !included.length;
  }
  function renderCandidates() {
    $('candidates').replaceChildren();
    candidates.forEach((c, i) => {
      const article = el('article', undefined, 'sf-candidate'), top = el('div', undefined, 'sf-candidate-top');
      const check = el('input'); check.type = 'checkbox'; check.id = `sf-include-${i}`; check.checked = selected.has(i);
      check.addEventListener('change', () => { check.checked ? selected.add(i) : selected.delete(i); totals(); });
      const info = el('div', undefined, 'sf-candidate-info'), label = el('label', c.merchant); label.htmlFor = check.id;
      info.append(label, el('p', `${c.period} · ${c.confidence} · ${c.history.length} charges${c.changed ? ' · Amount changed' : ''}`), el('p', `Last charged ${dateText(c.last)}${c.stale ? ' · Older pattern — excluded by default' : ` · Next expected after last charge: ${dateText(c.next)}`}`));
      const price = el('div', undefined, 'sf-candidate-price'); price.append(el('strong', money(c.monthly) + ' / mo'), el('span', money(c.latest) + ' latest'));
      top.append(check, info, price); article.append(top);
      const details = el('details'); details.append(el('summary', 'View matching transactions'));
      const scroll = el('div', undefined, 'sf-scroll'), table = el('table'), head = el('thead'), header = el('tr');
      ['Date','Original description','Paid'].forEach(s => header.append(el('th', s))); head.append(header); table.append(head);
      const body = el('tbody'); for (const t of c.history) { const row = el('tr'); [dateText(t.date),t.description,money(t.amount)].forEach(s => row.append(el('td', s))); body.append(row); } table.append(body); scroll.append(table); details.append(scroll); article.append(details); $('candidates').append(article);
    }); totals();
  }
  $('file').addEventListener('change', e => openFile(e.target.files[0]));
  $('clear').addEventListener('click', clear);
  $('header').addEventListener('change', configure);
  for (const id of ['date','description','amount','sign','date-order','currency']) $(id).addEventListener('change', hideResults);
  $('analyse').addEventListener('click', () => {
    $('error').hidden = true; hideResults();
    try {
      const {transactions, stats} = transactionsFromRows(rows.slice($('header').checked ? 1 : 0), {
        date:Number($('date').value), description:Number($('description').value), amount:Number($('amount').value), sign:$('sign').value, order:$('date-order').value, width:rows[0].length
      });
      if (!transactions.length) throw new Error(`No spending transactions could be read (${stats.invalid} invalid rows; ${stats.nonSpending} blank, zero or non-spending amounts). Check the columns, date order and spending convention.`);
      candidates = findRecurring(transactions, stats.end); selected = new Set(candidates.map((c, i) => c.stale ? -1 : i).filter(i => i >= 0));
      $('summary').textContent = `${transactions.length} spending transactions · ${dateText(stats.start)} – ${dateText(stats.end)} · ${currency()}. Skipped: ${stats.nonSpending} blank, zero or non-spending amounts, ${stats.invalid} invalid rows, ${stats.duplicates} exact duplicates. Older patterns are judged against the end of this statement, not today. Repeated same-day identical transactions are counted once.`;
      renderCandidates(); $('empty').hidden = !!candidates.length; $('results').hidden = false; $('results-title').focus();
    } catch (e) { showError(e); }
  });
  $('export').addEventListener('click', () => {
    const blob = new Blob([reportCSV(candidates.filter((_, i) => selected.has(i)), currency())], {type:'text/csv;charset=utf-8'}), url = URL.createObjectURL(blob);
    const a = el('a'); a.href = url; a.download = 'subscription-report.csv'; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $('demo').addEventListener('click', () => {
    clear(); const demo = ['Date,Description,Amount'];
    for (let m = 1; m <= 6; m++) {
      const month = String(m).padStart(2, '0');
      demo.push(`2026-${month}-03,STREAMBOX,-18.99`, `2026-${month}-08,MUSIC CLUB,-12.99`, `2026-${month}-17,CLOUD STORAGE,-3.49`, `2026-${month}-01,Salary,3800`);
      demo.push(`2026-${month}-12,Local supermarket,-${45 + m * 13}.20`);
      if (m <= 2) demo.push(`2026-${month}-05,OLD MEMBERSHIP,-24.00`);
    }
    load(demo.join('\n'), 'Example data (fictional)'); $('currency').value = 'AUD'; $('message').textContent = 'Fictional example loaded. Check the columns, then find recurring payments.';
  });
  const drop = $('drop');
  for (const type of ['dragenter','dragover']) drop.addEventListener(type, e => { e.preventDefault(); drop.classList.add('dragging'); });
  for (const type of ['dragleave','drop']) drop.addEventListener(type, e => { e.preventDefault(); drop.classList.remove('dragging'); });
  drop.addEventListener('drop', e => { if (e.dataTransfer.files.length !== 1) { showError(new Error('Please open one bank CSV at a time.')); return; } openFile(e.dataTransfer.files[0]); });
})(typeof globalThis !== 'undefined' ? globalThis : this);
