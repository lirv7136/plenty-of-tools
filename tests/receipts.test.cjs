const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../tools/receipts/static/core.js');

const FUEL = `AMPOL FOODARY GLEBE
TAX INVOICE
ABN 40 004 201 307
12/10/2026 07:42
Pump 4 Unleaded E10
42.31 L @ 199.9
U91 ............ $84.58
TOTAL $84.58
GST INCLUDED $7.69
EFTPOS $84.58`;

const CAFE = `The Grounds of Alexandria
Tax Invoice
2 Flat White 11.00
Smashed Avo 24.50
SUBTOTAL 35.50
Total savings 2.00
Total 33.50
Includes GST of 3.05
Card 33.50
Thank you!`;

test('money: cents, commas, and nothing that isn\'t money', () => {
  assert.equal(C.toCents('$1,234.56'), 123456);
  assert.equal(C.toCents('12.5'), 1250);
  assert.equal(C.toCents('abc'), null);
  assert.deepEqual(C.amountsIn('Pump 4 Unleaded 42.31 L @ 199.9 $84.58'), [4231, 8458]);
  assert.deepEqual(C.amountsIn('Ph 02 9555 1234 on 12/10/2026'), []);
  assert.equal(C.fmt(123456), '$1,234.56');
});

test('dates are read day first, in the ways receipts write them', () => {
  assert.equal(C.findDate('12/10/2026 07:42'), '2026-10-12');
  assert.equal(C.findDate('Date: 3-7-26'), '2026-07-03');
  assert.equal(C.findDate('5 Oct 2026'), '2026-10-05');
  assert.equal(C.findDate('21st September, 2026'), '2026-09-21');
  assert.equal(C.findDate('2026-10-07T10:00'), '2026-10-07');
  assert.equal(C.findDate('31/02/2026'), null, 'not a real date');
  assert.equal(C.findDate('no date here'), null);
});

test('a fuel receipt', () => {
  const r = C.parseReceipt(FUEL);
  assert.equal(r.merchant, 'AMPOL FOODARY GLEBE');
  assert.equal(r.date, '2026-10-12');
  assert.equal(r.total, 8458);
  assert.equal(r.gst, 769);
  assert.equal(r.category, 'Fuel');
  assert.equal(r.abn, '40004201307');
});

test('the total, not the subtotal or the savings', () => {
  const r = C.parseReceipt(CAFE);
  assert.equal(r.total, 3350);
  assert.equal(r.gst, 305);
  assert.equal(r.category, 'Meals');
  assert.equal(r.merchant, 'The Grounds of Alexandria');
});

test('without a total line, the largest amount; GST estimated when not stated', () => {
  const r = C.parseReceipt('Secure Parking\nEntry 08:01 Exit 17:22\n$27.00\n$3.00 discount');
  assert.equal(r.total, 2700);
  assert.equal(r.gst, null);
  assert.equal(r.gstEstimated, 245);
  assert.equal(r.category, 'Parking');
});

test('ABNs must pass the ATO checksum', () => {
  assert.equal(C.validAbn('51824753556'), true);
  assert.equal(C.validAbn('51824753557'), false);
  assert.equal(C.parseReceipt('ABN 12 345 678 901\nTotal 10.00').abn, null);
});

test('totals by category, and CSV that spreadsheets cannot execute', () => {
  const rows = [
    { date: '2026-10-12', merchant: 'Ampol', category: 'Fuel', total: 8458, gst: 769 },
    { date: '2026-10-12', merchant: '=HYPERLINK("evil")', category: 'Meals', total: 3350, gst: 305, note: 'Lunch, client' },
    { date: '', merchant: 'Unread', category: 'Other', total: null, gst: null },
  ];
  const t = C.totals(rows);
  assert.equal(t.total, 11808);
  assert.equal(t.gst, 1074);
  assert.deepEqual(t.byCategory, { Fuel: 8458, Meals: 3350 });
  const csv = C.toCsv(rows);
  assert.match(csv, /^Date,Merchant,Category,Total,GST,ABN,Note\r\n/);
  assert.match(csv, /"=HYPERLINK\(""evil""\)"/);
  assert.match(csv, /"Lunch, client"/);
  assert.match(csv, /2026-10-12,Ampol,Fuel,84.58,7.69,,/);
});
