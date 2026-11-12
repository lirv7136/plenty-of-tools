/* Many invoices from a spreadsheet, and the invoice list back out as one. Pure functions: CSV in
   and out, rows to invoice documents, and a ZIP writer for the PDFs. Nothing here touches the
   page or the network, so node tests can run all of it.

   A CSV row is one line of work. Rows for the same customer (and, for NDIS, the same participant)
   become one invoice, unless an invoice_number column says otherwise. The business details, tax
   setting, bank details and terms come from the document open in the form. */
(function (root) {
  'use strict';
  const MAX_ROWS = 2000, MAX_INVOICES = 500, MAX_BYTES = 2000000;

  // ---------- CSV ----------
  // RFC 4180 with the usual leniencies: CRLF or LF, a BOM, quoted fields with "" escapes, and a
  // comma, semicolon or tab as the separator (Excel writes semicolons in many regions).
  function parseCsv(text) {
    let s = String(text || '').replace(/^﻿/, '');
    if (s.length > MAX_BYTES) throw new Error('That file is larger than 2 MB.');
    const first = s.split(/\r?\n/, 1)[0];
    const sep = [',', ';', '\t'].map(c => [c, first.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
    const rows = []; let row = [], cell = '', quoted = false, i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (quoted) {
        if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i += 2; continue; } quoted = false; i++; continue; }
        cell += ch; i++; continue;
      }
      if (ch === '"' && cell === '') { quoted = true; i++; continue; }
      if (ch === sep) { row.push(cell); cell = ''; i++; continue; }
      if (ch === '\r') { i++; continue; }
      if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; i++; continue; }
      cell += ch; i++;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim() !== ''));
  }
  // A cell that starts with = + - or @ could run as a formula when the CSV is opened in Excel.
  const csvCell = v => { let t = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const toCsv = rows => rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

  // ---------- the templates people download ----------
  const HEADERS = ['customer', 'customer_email', 'date', 'description', 'quantity', 'unit_price', 'tax'];
  const NDIS_HEADERS = ['participant', 'ndis_number', 'plan_manager', 'plan_manager_email', 'date', 'support_item', 'description', 'quantity', 'unit_price'];
  function template(kind) {
    return kind === 'ndis'
      ? toCsv([NDIS_HEADERS, ['Jane Citizen', '430000000', 'Plan Partners', 'accounts@example.com', '2026-11-10', '01_011_0107_1_1', 'Assistance with self care', '2', '70.23'],
        ['Jane Citizen', '430000000', 'Plan Partners', 'accounts@example.com', '2026-11-12', '01_011_0107_1_1', 'Assistance with self care', '3', '70.23']])
      : toCsv([HEADERS, ['Sue Smith', 'sue@example.com', '2026-11-04', 'Home clean', '3', '50.00', 'yes'], ['Sue Smith', 'sue@example.com', '2026-11-18', 'Home clean', '3', '50.00', 'yes'],
        ['Bob Brown', '', '2026-11-05', 'Lawn mowing', '1', '80.00', 'yes']]);
  }

  // ---------- rows to invoices ----------
  const ALIASES = { customer: ['customer', 'customer_name', 'client', 'client_name', 'name', 'bill_to'], customer_email: ['customer_email', 'client_email', 'email'],
    customer_address: ['customer_address', 'client_address', 'address'], date: ['date', 'date_of_support', 'support_date', 'service_date', 'visit_date', 'shift_date'],
    description: ['description', 'item', 'service', 'details', 'work'], quantity: ['quantity', 'qty', 'hours', 'units'], unit_price: ['unit_price', 'price', 'rate', 'amount', 'unit_cost'],
    tax: ['tax', 'gst', 'vat', 'taxable'], invoice_number: ['invoice_number', 'invoice_no', 'invoice', 'number'], participant: ['participant', 'participant_name', 'ndis_participant'],
    ndis_number: ['ndis_number', 'ndis_no', 'participant_number', 'participant_reference_number'], plan_manager: ['plan_manager', 'plan_manager_name'],
    plan_manager_email: ['plan_manager_email'], support_item: ['support_item', 'support_item_number', 'item_number', 'ndis_item'], funding: ['funding', 'managed'] };
  const norm = h => String(h || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  function isoDate(v, monthFirst) {
    const t = String(v || '').trim(); if (!t) return '';
    let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
    if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    m = /^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})$/.exec(t);
    if (!m) return null;
    const y = m[3].length === 2 ? '20' + m[3] : m[3], [d, mo] = monthFirst ? [m[2], m[1]] : [m[1], m[2]];
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const amount = v => String(v || '').trim().replace(/[^0-9.\-]/g, '');

  /* rows: parseCsv output including the header row. base: the document in the form (its seller,
     tax and payment details are copied). opts: {core, today, known} where known is every number
     already used on this device. Returns {invoices, errors, skipped}. */
  function toInvoices(rows, base, opts) {
    const core = opts.core, today = opts.today || core.today(), errors = [];
    if (rows.length < 2) return { invoices: [], errors: ['The file needs a header row and at least one row of work.'] };
    if (rows.length - 1 > MAX_ROWS) return { invoices: [], errors: [`Use at most ${MAX_ROWS} rows in one file.`] };
    const col = {}; rows[0].map(norm).forEach((h, i) => { for (const [key, names] of Object.entries(ALIASES)) if (names.includes(h) && col[key] === undefined) col[key] = i; });
    const ndis = col.participant !== undefined || col.ndis_number !== undefined || col.support_item !== undefined;
    for (const need of ndis ? ['participant', 'ndis_number', 'date', 'support_item', 'description', 'unit_price'] : ['customer', 'description', 'unit_price'])
      if (col[need] === undefined) errors.push(`The file has no "${need}" column.`);
    if (ndis && !core.isAU(base)) errors.push('NDIS invoices are for Australian businesses. Set "Where is your business?" to Australia.');
    // Your own details are the same on every invoice, so a problem with them is reported once.
    const SELLER = /business name|your ABN|Your ABN|Your email|BSB|account number|rate as a percentage/i;
    const mine = core.validate({ ...JSON.parse(JSON.stringify(base)), ndis: '', clientName: 'x', clientAbn: '', clientEmail: '', columns: [], items: [{ description: 'x', quantity: '1', price: '1', tax: 'gst', extra: [] }] }).filter(m => SELLER.test(m));
    if (ndis && !String(base.sellerAbn || '').trim()) mine.push('Plan managers need your ABN on the invoice.');
    if (mine.length) return { invoices: [], errors: ['Fill in your own details in the form first. ' + mine.join(' ')] };
    if (errors.length) return { invoices: [], errors };
    const monthFirst = base.region === 'US', get = (r, k) => col[k] === undefined ? '' : String(r[col[k]] || '').trim();
    const groups = new Map();
    rows.slice(1).forEach((r, n) => {
      const line = n + 2, who = ndis ? get(r, 'participant') : get(r, 'customer');
      if (!who) { errors.push(`Row ${line}: no ${ndis ? 'participant' : 'customer'}.`); return; }
      const date = isoDate(get(r, 'date'), monthFirst);
      if (date === null || (date && !core.validDate(date))) { errors.push(`Row ${line}: "${get(r, 'date')}" is not a date. Use 2026-11-04 or ${monthFirst ? '11/4/2026' : '4/11/2026'}.`); return; }
      const key = get(r, 'invoice_number') ? 'n:' + get(r, 'invoice_number') : 'c:' + who.toLowerCase() + '|' + get(r, 'ndis_number');
      if (!groups.has(key)) groups.set(key, { who, first: r, line, rows: [] });
      groups.get(key).rows.push({ r, line, date });
    });
    if (groups.size > MAX_INVOICES) return { invoices: [], errors: [`That would make ${groups.size} invoices. Use at most ${MAX_INVOICES} in one file.`] };
    const hasDate = col.date !== undefined, columns = [...(hasDate ? ['Date'] : []), ...(ndis ? ['Support item'] : [])];
    const known = (opts.known || []).slice(); let last = opts.lastInvoice || '';
    const invoices = [];
    for (const g of groups.values()) {
      const f = g.first, given = get(f, 'invoice_number');
      const number = given || core.nextFrom(last, known);
      if (!given) { last = number; known.push(number); }
      const taxOn = v => !/^(n|no|false|0|free|none|exempt)$/i.test(String(v).trim());
      const doc = { ...JSON.parse(JSON.stringify(base)), kind: 'invoice', number, issueDate: today, dueDate: core.addDays(today, Math.max(0, opts.termsDays == null ? 14 : opts.termsDays)), paid: '0.00', columns,
        clientName: ndis ? (get(f, 'plan_manager') || g.who) : g.who, clientEmail: ndis ? get(f, 'plan_manager_email') : get(f, 'customer_email'),
        clientAddress: get(f, 'customer_address'), clientAbn: '',
        ndis: ndis ? (/self/i.test(get(f, 'funding')) ? 'self' : 'plan') : '', ndisName: ndis ? g.who : '', ndisNumber: ndis ? get(f, 'ndis_number') : '',
        items: g.rows.map(({ r, date }) => ({ description: get(r, 'description'), quantity: amount(get(r, 'quantity')) || '1', price: amount(get(r, 'unit_price')),
          tax: ndis ? 'none' : (col.tax === undefined || taxOn(get(r, 'tax')) ? 'gst' : 'none'), extra: [...(hasDate ? [date] : []), ...(ndis ? [get(r, 'support_item')] : [])] })) };
      let clean; try { clean = core.cleanData(doc); } catch (e) { errors.push(`${g.who} (row ${g.line}): ${e.message}`); continue; }
      const problems = core.validate(clean);
      if (problems.length) { errors.push(`${g.who} (rows ${g.rows.map(x => x.line).join(', ')}): ${problems.join(' ')}`); continue; }
      invoices.push(clean);
    }
    return { invoices, errors, ndis };
  }

  // ---------- the invoice list as a CSV: one row per line of each document ----------
  function historyCsv(history, core) {
    const head = ['number', 'type', 'issue_date', 'due_date', 'customer', 'ndis_participant', 'ndis_number', 'line_date', 'support_item', 'description', 'quantity', 'unit_price', 'tax_on_line', 'line_total', 'document_total', 'currency', 'paid'];
    const rows = [head];
    for (const h of history) {
      const d = h.doc; let c; try { c = core.calculate(d); } catch (e) { continue; }
      const di = d.columns.findIndex(core.isDateHeading), si = d.columns.findIndex(core.isItemHeading);
      d.items.forEach((it, i) => rows.push([d.number, d.kind, d.issueDate, d.dueDate, d.clientName, d.ndisName || '', d.ndisNumber || '', di >= 0 ? it.extra[di] : '', si >= 0 ? it.extra[si] : '',
        it.description, it.quantity, (c.items[i].price / 100).toFixed(2), (c.items[i].gst / 100).toFixed(2), (c.items[i].total / 100).toFixed(2), (c.total / 100).toFixed(2), d.currency || 'AUD',
        d.kind === 'quote' ? '' : h.paidAt ? 'yes' : 'no']));
    }
    return toCsv(rows);
  }

  // ---------- ZIP (stored, no compression: PDFs are already compressed) ----------
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  /* files: [{name, bytes: Uint8Array}] -> Uint8Array of a ZIP archive. Names are made unique. */
  function zip(files) {
    const enc = new TextEncoder(), parts = [], central = [], seen = new Set(); let offset = 0;
    const u16 = n => [n & 255, (n >>> 8) & 255], u32 = n => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
    for (const f of files) {
      let name = String(f.name).replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').slice(0, 120) || 'file', base = name, k = 2;
      while (seen.has(name.toLowerCase())) name = base.replace(/(\.[^.]*)?$/, ` (${k++})$1`);
      seen.add(name.toLowerCase());
      const nb = enc.encode(name), crc = crc32(f.bytes), size = f.bytes.length;
      const local = new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(size), ...u32(size), ...u16(nb.length), 0, 0]);
      parts.push(local, nb, f.bytes);
      central.push(new Uint8Array([0x50, 0x4b, 1, 2, 20, 0, 20, 0, 0, 8, 0, 0, 0, 0, 0x21, 0, ...u32(crc), ...u32(size), ...u32(size), ...u16(nb.length), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, ...u32(offset)]), nb);
      offset += local.length + nb.length + size;
    }
    const cdSize = central.reduce((s, p) => s + p.length, 0);
    const end = new Uint8Array([0x50, 0x4b, 5, 6, 0, 0, 0, 0, ...u16(files.length), ...u16(files.length), ...u32(cdSize), ...u32(offset), 0, 0]);
    const out = new Uint8Array(offset + cdSize + end.length); let p = 0;
    for (const part of [...parts, ...central, end]) { out.set(part, p); p += part.length; }
    return out;
  }

  const api = { parseCsv, toCsv, template, toInvoices, historyCsv, zip, crc32, MAX_ROWS, MAX_INVOICES };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.InvoiceBulk = api;
})(typeof self !== 'undefined' ? self : this);
