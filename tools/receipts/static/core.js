/* Receipts to Expenses core: read OCR text from an Australian receipt into merchant, date,
   total, GST, ABN and a category guess; totals; CSV. Pure functions, no DOM. UMD so node
   tests can require() it and the page can use ReceiptCore. */
(function (root) {
  'use strict';
  const VERSION = 1;

  const CATEGORIES = ['Fuel', 'Parking', 'Tolls', 'Car servicing', 'Meals', 'Office supplies', 'Travel', 'Phone and internet', 'Other'];

  // Keyword hints, checked against the whole receipt in order; the first hit wins.
  const HINTS = [
    ['Fuel', /\b(unleaded|ulp|e10|premium\s*9[58]|diesel|fuel|petrol|litres?|ampol|caltex|shell|bp\b|7-?eleven|united petroleum|metro petroleum|liberty)\b/i],
    ['Parking', /\b(parking|car\s*park|wilson|secure\s*parking|care\s*park|parking\s*meter)\b/i],
    ['Tolls', /\b(toll|linkt|e-?toll|e-?tag|transurban|citylink|eastlink)\b/i],
    ['Car servicing', /\b(service|tyres?|mechanic|oil\s*change|ultra\s*tune|kmart\s*tyre|bob\s*jane|repco|supercheap)\b/i],
    ['Phone and internet', /\b(telstra|optus|vodafone|tpg|aussie\s*broadband|belong|internet|mobile\s*plan)\b/i],
    ['Office supplies', /\b(officeworks|stationery|printer|toner|ink\s*cartridge)\b/i],
    ['Travel', /\b(qantas|virgin|jetstar|rex\b|uber|didi|taxi|13cabs|opal|myki|go\s*card|hotel|motel|airbnb)\b/i],
    ['Meals', /\b(cafe|café|coffee|flat\s*white|latte|cappuccino|espresso|lunch|dinner|breakfast|restaurant|bistro|bar\b|pub\b|hotel\s*bar|mcdonald|hungry\s*jack|kfc|subway|menulog|uber\s*eats|doordash)\b/i],
  ];

  // "12.50", "1,234.56", "$12", "12.50-" -> integer cents, or null.
  function toCents(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
    const s = String(input == null ? '' : input).replace(/[^\d.,]/g, '');
    if (!s) return null;
    const m = s.match(/^(\d{1,3}(?:,\d{3})+|\d+)(?:[.,](\d{1,2}))?$/);
    if (!m) return null;
    return Number(m[1].replace(/,/g, '')) * 100 + (m[2] ? Number(m[2].padEnd(2, '0')) : 0);
  }

  function fmt(cents) {
    if (cents == null) return '';
    const neg = cents < 0, a = Math.abs(Math.round(cents));
    return (neg ? '-' : '') + '$' + Math.floor(a / 100).toLocaleString('en-US') + '.' + String(a % 100).padStart(2, '0');
  }

  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };

  function iso(y, m, d) {
    if (y < 100) y += 2000;
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    if (y < 2000 || y > 2099) return null;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }

  // Australian receipts are day first. ISO dates are also accepted.
  function findDate(text) {
    let m = text.match(/\b(20\d\d)-(\d\d)-(\d\d)(?!\d)/);
    if (m) { const r = iso(+m[1], +m[2], +m[3]); if (r) return r; }
    const re = /\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2}|\d{4})\b/g;
    while ((m = re.exec(text))) { const r = iso(+m[3], +m[2], +m[1]); if (r) return r; }
    const re2 = /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-]+(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?[\s\-,]+(\d{2,4})\b/gi;
    while ((m = re2.exec(text))) { const r = iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]); if (r) return r; }
    return null;
  }

  // Amounts on a line: "$12.50", "12.50", "1,234.56". Only values with cents count, which
  // keeps quantities, phone numbers and dates out.
  function amountsIn(line) {
    const out = [];
    const re = /\$?\s?(\d{1,3}(?:,\d{3})+|\d+)[.,](\d\d)(?!\d)/g;
    let m;
    while ((m = re.exec(line))) out.push(toCents(`${m[1]}.${m[2]}`));
    return out;
  }

  const TOTAL_WORDS = /\b(total|amount\s*due|balance\s*due|grand\s*total|amount\s*paid|total\s*paid|to\s*pay|eftpos|card\s*payment|visa|mastercard|amex|paid)\b/i;
  const NOT_TOTAL = /\b(sub\s*-?\s*total|subtotal|total\s*savings|savings|discount|change|rounding|cash\s*out|items?\b|qty)\b/i;

  function findTotal(lines) {
    // Strongest first: an explicit total line (not a subtotal), last one on the receipt.
    let best = null;
    lines.forEach((line, i) => {
      if (!TOTAL_WORDS.test(line) || NOT_TOTAL.test(line)) return;
      const amounts = amountsIn(line);
      const next = amounts.length ? amounts : amountsIn(lines[i + 1] || '');
      if (next.length) {
        const value = next[next.length - 1];
        const rank = /\btotal\b/i.test(line) ? 2 : 1;
        if (!best || rank > best.rank || (rank === best.rank)) best = { value, rank };
      }
    });
    if (best) return best.value;
    // Otherwise the largest amount on the receipt.
    const all = lines.flatMap(amountsIn);
    return all.length ? Math.max(...all) : null;
  }

  function findGst(lines, total) {
    for (const line of lines) {
      if (!/\bgst\b/i.test(line)) continue;
      const amounts = amountsIn(line).filter(a => total == null || a < total);
      if (amounts.length) return amounts[amounts.length - 1];
    }
    return null;
  }

  function findAbn(text) {
    const m = text.match(/\bA\.?\s?B\.?\s?N\.?[:\s]*((?:\d\s?){11})\b/i);
    if (!m) return null;
    const digits = m[1].replace(/\s/g, '');
    return validAbn(digits) ? digits : null;
  }

  // The ATO's ABN checksum: subtract 1 from the first digit, weight, sum, mod 89.
  function validAbn(abn) {
    if (!/^\d{11}$/.test(abn)) return false;
    const w = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19];
    const d = abn.split('').map(Number);
    d[0] -= 1;
    return d.reduce((s, x, i) => s + x * w[i], 0) % 89 === 0;
  }

  const SKIP_MERCHANT = /\b(tax\s*invoice|invoice|receipt|abn|phone|ph:|tel|www\.|\.com|customer\s*copy|merchant\s*copy|welcome|thank)/i;

  function findMerchant(lines) {
    for (const line of lines.slice(0, 6)) {
      const clean = line.replace(/[^A-Za-z0-9&'\-. ]/g, ' ').replace(/\s+/g, ' ').trim();
      if (clean.length < 3 || !/[A-Za-z]{3}/.test(clean) || SKIP_MERCHANT.test(clean) || amountsIn(line).length) continue;
      return clean.slice(0, 60);
    }
    return '';
  }

  function guessCategory(text) {
    for (const [category, re] of HINTS) if (re.test(text)) return category;
    return 'Other';
  }

  /** Everything we can read from a receipt's OCR text. Unknown fields are null or ''. */
  function parseReceipt(text) {
    const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const joined = lines.join('\n');
    const total = findTotal(lines);
    const gst = findGst(lines, total);
    return {
      merchant: findMerchant(lines),
      date: findDate(joined),
      total,
      // Most Australian prices include GST at 10%, so GST is 1/11 of the total. Only used
      // as a hint when the receipt doesn't state it.
      gst,
      gstEstimated: gst == null && total != null ? Math.round(total / 11) : null,
      abn: findAbn(joined),
      category: guessCategory(joined),
    };
  }

  function totals(rows) {
    const by = {};
    let total = 0, gst = 0;
    for (const r of rows) {
      if (r.total == null) continue;
      total += r.total;
      gst += r.gst || 0;
      by[r.category || 'Other'] = (by[r.category || 'Other'] || 0) + r.total;
    }
    return { total, gst, byCategory: by };
  }

  const cell = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n\r]/.test(s) || /^[=+\-@\t]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  function toCsv(rows) {
    const head = ['Date', 'Merchant', 'Category', 'Total', 'GST', 'ABN', 'Note'];
    const body = rows.map(r => [r.date || '', r.merchant || '', r.category || '', r.total == null ? '' : (r.total / 100).toFixed(2),
      r.gst == null ? '' : (r.gst / 100).toFixed(2), r.abn || '', r.note || '']);
    return [head, ...body].map(r => r.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  const api = { VERSION, CATEGORIES, toCents, fmt, findDate, amountsIn, parseReceipt, validAbn, totals, toCsv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ReceiptCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
