/* Invoice PDF: draws the document with pdf-lib as real, selectable text on A4, so it can be
   downloaded, attached to an email or shared without the print dialog. Pure: takes the PDFLib
   namespace and InvoiceCore as arguments, so node tests can run it.

   pdf-lib's built in Helvetica can only encode Windows-1252 text. Characters outside it (Chinese,
   Japanese, ticks, the true minus sign…) are swapped for a close equivalent or "?", and listed in
   `replaced` so the page can say so and point to Print / save PDF, which uses system fonts. */
(function (root) {
  'use strict';
  const A4 = [595.28, 841.89], M = { l: 48, r: 48, t: 50, b: 56 };
  const W = A4[0] - M.l - M.r;
  const SWAP = { '−': '-', '‐': '-', '‑': '-', '‒': '-', ' ': ' ', '\t': ' ', ' ': ' ', ' ': ' ' };

  async function build(PDFLib, core, data) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const totals = core.calculate(data);
    const doc = await PDFDocument.create();
    const reg = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const C = { ink: rgb(0.09, 0.13, 0.15), grey: rgb(0.32, 0.38, 0.42), green: rgb(0.043, 0.478, 0.353),
      head: rgb(0.933, 0.953, 0.941), line: rgb(0.88, 0.9, 0.92) };
    const replaced = new Set(), ok = new Map();
    function safe(text) {
      let out = '';
      for (const ch of String(text == null ? '' : text).replace(/\r/g, '')) {
        if (ch === '\n') { out += ch; continue; }
        const c = SWAP[ch] || ch;
        if (!ok.has(c)) { try { reg.encodeText(c); bold.encodeText(c); ok.set(c, true); } catch (e) { ok.set(c, false); } }
        if (ok.get(c)) out += c; else { out += '?'; replaced.add(ch); }
      }
      return out;
    }
    function wrap(text, font, size, width) {
      const lines = [];
      for (const para of safe(text).split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
          const tryLine = line ? line + ' ' + word : word;
          if (font.widthOfTextAtSize(tryLine, size) <= width) { line = tryLine; continue; }
          if (line) lines.push(line);
          line = '';
          let w = word;
          while (font.widthOfTextAtSize(w, size) > width) {
            let n = w.length - 1;
            while (n > 1 && font.widthOfTextAtSize(w.slice(0, n), size) > width) n--;
            lines.push(w.slice(0, n)); w = w.slice(n);
          }
          line = w;
        }
        lines.push(line);
      }
      return lines;
    }

    let page, y;
    const pages = [];
    function newPage() { page = doc.addPage(A4); pages.push(page); y = A4[1] - M.t; }
    const text = (s, x, yy, size, font = reg, color = C.ink) => page.drawText(s, { x, y: yy, size, font, color });
    const right = (s, xr, yy, size, font = reg, color = C.ink) => text(s, xr - font.widthOfTextAtSize(s, size), yy, size, font, color);
    const rule = (yy, color = C.line, thickness = 0.6, x1 = M.l, x2 = A4[0] - M.r) => page.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness, color });
    function need(h) { if (y - h < M.b) { newPage(); return true; } return false; }
    const money = c => safe(core.aud(c));
    const date = v => core.validDate(v) ? new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(v + 'T00:00:00Z')) : '';

    newPage();
    // ---- header: seller on the left, document title and dates on the right
    const leftW = W * 0.56, rightX = A4[0] - M.r;
    let ly = y;
    for (const l of wrap(data.sellerName || 'Your business', bold, 16, leftW)) { text(l, M.l, ly - 14, 16, bold); ly -= 19; }
    ly -= 4;
    const sellerLines = [];
    if (data.sellerAbn.trim()) sellerLines.push('ABN ' + data.sellerAbn.trim());
    for (const k of ['sellerAddress', 'sellerEmail', 'sellerPhone']) if (data[k].trim()) sellerLines.push(data[k].trim());
    for (const l of wrap(sellerLines.join('\n'), reg, 9.5, leftW)) { text(l, M.l, ly - 10, 9.5, reg, C.grey); ly -= 13; }
    let ry = y;
    right(safe(core.title(data)), rightX, ry - 22, 24, bold, C.green); ry -= 34;
    for (const l of [data.number.trim(), 'Issued: ' + date(data.issueDate), (data.kind === 'quote' ? 'Valid until: ' : 'Due: ') + date(data.dueDate)]) {
      right(safe(l), rightX, ry - 10, 10); ry -= 14;
    }
    y = Math.min(ly, ry) - 12;
    rule(y, C.green, 2); y -= 26;

    // ---- parties: customer on the left, amount on the right
    const half = W / 2;
    let py = y;
    text(data.kind === 'quote' ? 'PREPARED FOR' : 'BILL TO', M.l, py - 8, 8, bold, C.grey); py -= 22;
    for (const l of wrap(data.clientName || 'Customer', bold, 11, half - 12)) { text(l, M.l, py, 11, bold); py -= 14; }
    const clientLines = [];
    if (data.clientAbn.trim()) clientLines.push('ABN ' + data.clientAbn.trim());
    for (const k of ['clientAddress', 'clientEmail']) if (data[k].trim()) clientLines.push(data[k].trim());
    for (const l of wrap(clientLines.join('\n'), reg, 9.5, half - 12)) { text(l, M.l, py, 9.5, reg, C.grey); py -= 13; }
    let ay = y;
    const ax = M.l + half + 12;
    text(data.kind === 'quote' ? 'QUOTE TOTAL (AUD)' : 'AMOUNT DUE (AUD)', ax, ay - 8, 8, bold, C.grey); ay -= 30;
    text(money(data.kind === 'quote' ? totals.total : totals.due), ax, ay, 20, bold, C.green); ay -= 18;
    if (data.kind === 'quote') { text('This quote is not a tax invoice.', ax, ay, 8.5, reg, C.grey); ay -= 12; }
    y = Math.min(py, ay) - 16;

    // ---- line items
    const tax = data.gstMode !== 'none', cols = data.columns || [];
    const fixed = [['Qty', 42], [data.gstMode === 'inclusive' ? 'Unit (incl.)' : tax ? 'Unit (excl.)' : 'Unit price', 74], ...(tax ? [['GST', 60]] : []), ['Amount', 78]];
    const fixedW = fixed.reduce((s, f) => s + f[1], 0);
    const extraW = cols.length ? Math.max(48, Math.min(84, (W - fixedW - 130) / cols.length)) : 0;
    const columns = [{ label: 'Description', w: W - fixedW - extraW * cols.length, align: 'l' },
      ...cols.map(label => ({ label: label.trim(), w: extraW, align: 'l' })), ...fixed.map(([label, w]) => ({ label, w, align: 'r' }))];
    const PAD = 5;
    function headerRow() {
      need(24);
      page.drawRectangle({ x: M.l, y: y - 20, width: W, height: 20, color: C.head });
      let x = M.l;
      for (const c of columns) {
        const label = wrap(c.label, bold, 8.5, c.w - PAD * 2)[0] || '';
        if (c.align === 'r') right(label, x + c.w - PAD, y - 13.5, 8.5, bold); else text(label, x + PAD, y - 13.5, 8.5, bold);
        x += c.w;
      }
      y -= 20;
    }
    headerRow();
    data.items.forEach((item, i) => {
      const t = totals.items[i];
      const values = [item.description, ...cols.map((_, k) => (item.extra || [])[k] || ''), item.quantity, money(t.price),
        ...(tax ? [t.taxable ? money(t.gst) : 'No GST'] : []), money(t.total)];
      const cells = values.map((v, k) => wrap(v, reg, 9, columns[k].w - PAD * 2));
      const h = Math.max(...cells.map(l => l.length)) * 11.5 + 10;
      if (need(h)) headerRow();
      let x = M.l;
      cells.forEach((lines, k) => {
        lines.forEach((l, n) => {
          const ty = y - 13 - n * 11.5;
          if (columns[k].align === 'r') right(l, x + columns[k].w - PAD, ty, 9); else text(l, x + PAD, ty, 9);
        });
        x += columns[k].w;
      });
      y -= h; rule(y);
    });
    y -= 14;

    // ---- totals
    const rows = [[tax ? 'Subtotal (excl. GST)' : 'Subtotal', money(totals.subtotal)]];
    if (tax) rows.push(['GST', money(totals.gst)]);
    rows.push([data.kind === 'quote' ? 'Quote total' : 'Total', money(totals.total), 'strong']);
    if (data.kind === 'invoice') {
      if (totals.paid) rows.push(['Already paid', '-' + money(totals.paid)]);
      rows.push(['Amount due', money(totals.due), 'strong', 'green']);
    }
    need(rows.length * 18 + 16);
    const tx = A4[0] - M.r - 220;
    for (const [label, value, strong, green] of rows) {
      const f = strong ? bold : reg, size = strong ? 11.5 : 10, color = green ? C.green : C.ink;
      if (strong) { rule(y + 2, C.line, 0.8, tx, A4[0] - M.r); y -= 4; }
      text(label, tx, y - 11, size, f, color); right(value, A4[0] - M.r, y - 11, size, f, color);
      y -= strong ? 20 : 17;
    }
    y -= 8;

    // ---- payment details and notes
    for (const [key, heading] of [['payment', 'PAYMENT DETAILS / TERMS'], ['notes', 'NOTES']]) {
      if (!data[key].trim()) continue;
      need(40); rule(y); y -= 18;
      text(heading, M.l, y, 8, bold, C.grey); y -= 15;
      for (const l of wrap(data[key].trim(), reg, 9.5, W)) { if (need(14)) { } text(l, M.l, y, 9.5); y -= 13; }
      y -= 6;
    }
    const foot = tax ? 'All amounts in AUD. GST applies only to taxable lines and is rounded per line. Line amounts include any GST.'
      : 'All amounts in AUD. No GST charged - supplier not registered for GST.';
    need(30); rule(y); y -= 14;
    for (const l of wrap(foot, reg, 7.5, W)) { text(l, M.l, y, 7.5, reg, C.grey); y -= 10; }

    if (pages.length > 1) pages.forEach((p, i) => {
      const s = `Page ${i + 1} of ${pages.length}`;
      p.drawText(s, { x: A4[0] - M.r - reg.widthOfTextAtSize(s, 7.5), y: 28, size: 7.5, font: reg, color: C.grey });
    });
    doc.setTitle(safe(`${core.title(data)} ${data.number.trim()}`));
    if (data.sellerName.trim()) doc.setAuthor(safe(data.sellerName.trim()));
    doc.setCreator('Plenty of Tools invoice generator');
    const bytes = await doc.save();
    return { bytes, replaced: [...replaced], pages: pages.length };
  }

  const api = { build };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.InvoicePdf = api;
})(typeof self !== 'undefined' ? self : this);
