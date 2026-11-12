/* "Type it like a text": turn a short message into invoice lines. No AI service: plain rules,
   so it runs in a browser, a Worker or node, and the same words always give the same result.

     3 hrs mowing for Sue at $60          -> Sue · Mowing · 3 × 60.00
     Sue Smith: house clean $150          -> Sue Smith · House clean · 1 × 150.00
     2 x lawn mow @ 80, hedge trim 45     -> two lines
     tutoring for Ann 4 Nov $60           -> dated line
     mowing for Sue, 3 hrs, $180 total    -> 3 × 60.00

   parse(text, {today, monthFirst}) returns {customer, items:[{description, quantity, price, date}], problems}.
   It never guesses a price: a line with no amount is reported in problems, not invented. */
(function (root) {
  'use strict';
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const UNIT = '(?:hours?|hrs?|h|days?|visits?|lessons?|sessions?|shifts?|cleans?|loads?|units?|x)';
  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : ''; };
  const shift = (today, days) => { const t = new Date(today + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); };
  const money = s => { const n = String(s).replace(/,/g, ''); const [w, f = ''] = n.split('.'); return `${w}.${f.padEnd(2, '0').slice(0, 2)}`; };
  const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
  const tidy = s => s.replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/,\s*\(/g, ' (').replace(/\),/g, ')').replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, '').trim();

  // Pull one date out of a piece of text. Returns [date, textWithoutIt].
  function takeDate(text, today, monthFirst) {
    const year = Number(today.slice(0, 4));
    let m;
    if ((m = /\b(?:on\s+)?(today|yesterday)\b/i.exec(text))) return [shift(today, m[1].toLowerCase() === 'today' ? 0 : -1), text.replace(m[0], ' ')];
    if ((m = /\b(?:on\s+)?(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(text))) { const d = iso(+m[1], +m[2], +m[3]); if (d) return [d, text.replace(m[0], ' ')]; }
    if ((m = /\b(?:on\s+)?(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2}|\d{4}))?\b(?!\s*(?:each|ea)\b)/.exec(text)) && !/[$@]\s*$/.test(text.slice(0, m.index))) {
      const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : year, [dd, mm] = monthFirst ? [+m[2], +m[1]] : [+m[1], +m[2]], d = iso(y, mm, dd);
      if (d) return [d, text.replace(m[0], ' ')];
    }
    const mon = '(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*';
    if ((m = new RegExp(`\\b(?:on\\s+)?(\\d{1,2})(?:st|nd|rd|th)?\\s+${mon}\\.?(?:\\s+(\\d{4}))?\\b`, 'i').exec(text))) { const d = iso(m[3] ? +m[3] : year, MONTHS[m[2].toLowerCase()], +m[1]); if (d) return [d, text.replace(m[0], ' ')]; }
    if ((m = new RegExp(`\\b(?:on\\s+)?${mon}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`, 'i').exec(text))) { const d = iso(m[3] ? +m[3] : year, MONTHS[m[1].toLowerCase()], +m[2]); if (d) return [d, text.replace(m[0], ' ')]; }
    return ['', text];
  }

  function parseLine(raw, today, monthFirst) {
    let text = ' ' + raw + ' ', customer = '', quantity = '', price = '', total = false, unitWord = '';
    let m;
    // "for Sue" / "to Sue Smith": a name is capitalised words not starting with a digit or $.
    if ((m = /\b(?:for|to)\s+((?:[A-Z][\w'’.-]*)(?:\s+(?:[A-Z][\w'’.-]*|&|and|of|the|Pty|Ltd)){0,4})(?=\s|,|$)/.exec(text))) { customer = tidy(m[1].replace(/\s+(?:and|of|the|&)$/i, '')); text = text.replace(m[0], ' '); }
    const [date, noDate] = takeDate(text, today, monthFirst); text = noDate;
    // Price: an amount with $, else one after "at" or "@", else the last bare number.
    const AMT = '(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)';
    const after = '(\\s*(?:each|ea|per\\s+\\w+|\\/\\s*\\w+|an?\\s+\\w+|ph|p\\/h|total|all up|in total)\\b)?';
    if ((m = new RegExp(`(?:\\bat\\s+|@\\s*|\\bfor\\s+)?[$]\\s*${AMT}${after}`, 'i').exec(text)) || (m = new RegExp(`(?:\\bat\\s+|@\\s*)${AMT}${after}`, 'i').exec(text))) {
      price = money(m[1]); total = /total|all up/i.test(m[2] || ''); text = text.replace(m[0], ' ');
    }
    // Quantity: "3 hrs", "2 x", "x2", "1.5 hours".
    if ((m = new RegExp(`\\b(\\d+(?:\\.\\d{1,3})?)\\s*${UNIT}\\b`, 'i').exec(text)) || (m = /\bx\s*(\d+(?:\.\d{1,3})?)\b/i.exec(text))) {
      quantity = m[1]; const unit = /x/i.test(m[0].replace(/[\d.\s]/g, '')) && !/[a-wyz]/i.test(m[0]) ? '' : m[0].replace(/^[\d.\s]+/, '').trim();
      unitWord = /^x$/i.test(unit) ? '' : unit;
      text = text.replace(m[0], unit && !/^x$/i.test(unit) ? ` (${m[1]} ${unit}) ` : ' ');
    }
    if (!price && (m = new RegExp(`${AMT}(?!.*\\d)`).exec(text.replace(/\(\d[^)]*\)/g, s => ' '.repeat(s.length))))) { price = money(m[1]); text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length); }
    let description = cap(tidy(text.replace(/\s+\(/g, ' (').replace(/\b(?:at|for|on|@)\s*$/i, '')));
    const noted = /\((\d[^)]*)\)/.exec(description);
    if (quantity && price && total) {            // "$180 total" for 3 hrs: unit price, if it divides to whole cents
      const cents = Math.round(parseFloat(price) * 100), q = parseFloat(quantity), each = cents / q;
      if (Number.isInteger(each)) price = (each / 100).toFixed(2); else quantity = '';
    }
    if (quantity && noted) description = tidy(description.replace(noted[0], ''));      // the quantity column already says it
    if (!description && unitWord && unitWord.length > 2) description = cap(unitWord);
    if (!quantity) quantity = '1';
    return { customer, item: { description: cap(description), quantity, price, date } };
  }

  function parse(message, opts = {}) {
    const today = opts.today || new Date().toISOString().slice(0, 10), problems = [];
    let text = String(message || '').replace(/\r/g, '').trim().slice(0, 4000), customer = '';
    const cmd = /^\s*\/?(?:invoice|inv|bill|new invoice)\b[:\s]*/i.exec(text);
    if (cmd) { text = text.slice(cmd[0].length); const named = /^([A-Z][\w'’.&-]*(?:\s+[A-Z&][\w'’.&-]*){0,4})\s+(?=\d|[$])/.exec(text); if (named) { customer = named[1].trim(); text = text.slice(named[0].length); } }
    // "Sue Smith: house clean $150" or "Sue - 3 hrs mowing $60": a leading name before a colon or dash.
    const lead = /^([A-Z][\w'’.&-]*(?:\s+[A-Z&][\w'’.&-]*){0,4})\s*(?::|\s[-–]\s)\s*(?=\S)/.exec(text);
    if (!customer && lead && !/\d/.test(lead[1])) { customer = lead[1].trim(); text = text.slice(lead[0].length); }
    // Lines: new lines, semicolons, " and "/"+" between items, and commas that start a new item
    // (a comma followed by something with its own amount).
    // Lines: new lines, semicolons, " and " or "+" between items. Within a line, commas join
    // details ("mowing for Sue, 3 hrs, $180 total") until a piece carries an amount; a piece with
    // its own amount after that starts a new item ("2 x lawn mow @ 80, hedge trim 45").
    const hasAmount = b => { const t = takeDate(b.replace(/\b(?:for|to)\s+[A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*)*\s*$/, ''), today, !!opts.monthFirst)[1]; return /[$@]|\bat\s+\d/i.test(t) || /\d\s*(?:each|ea|total)?\s*$/i.test(t.trim()); };
    const parts = text.split(/\n|;|\s\+\s|\s+and\s+(?=\S.*\d)/i).flatMap(p => {
      const out = []; let cur = '';
      for (const b of p.split(/,\s+/)) { cur = cur ? cur + ', ' + b : b; if (hasAmount(b)) { out.push(cur); cur = ''; } }
      if (cur) { if (out.length) out[out.length - 1] += ', ' + cur; else out.push(cur); }
      return out;
    }).map(tidy).filter(Boolean);
    const items = [];
    for (const p of parts) {
      const r = parseLine(p, today, !!opts.monthFirst);
      if (r.customer && !customer) customer = r.customer;
      if (!r.item.description) { if (r.item.price && items.length && !items[items.length - 1].price) items[items.length - 1].price = r.item.price; else if (r.item.price || r.customer) { if (r.item.price) problems.push(`"${p}": what was this for?`); } continue; }
      if (!r.item.price) { problems.push(`"${p}": no amount found. Add one, like $60.`); continue; }
      items.push(r.item);
    }
    if (!items.length && !problems.length) problems.push('Tell me what the work was and the amount, like: 3 hrs mowing for Sue at $60');
    if (items.length && !customer) problems.push('Who is it for? Add "for Sue" or start with "Sue:".');
    return { customer, items, problems };
  }

  const api = { parse };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.InvoiceQuick = api;
})(typeof self !== 'undefined' ? self : this);
