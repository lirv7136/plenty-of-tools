const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCSV, parseAmount, parseDate, merchantKey, guessColumns, transactionsFromRows, findRecurring, reportCSV } = require('../tools/subscription-finder/app.js');
const mapping = { date:0, description:1, amount:2, order:'dmy', sign:'negative' };
const analyse = (rows, extra = {}) => { const r = transactionsFromRows(rows, {...mapping, ...extra}); return {...r, candidates:findRecurring(r.transactions, r.stats.end)}; };

test('CSV supports BOM, quoted separators, escaped quotes, multiline fields and CRLF', () => {
  assert.deepEqual(parseCSV('\uFEFFDate,Description,Amount\r\n2026-01-01,"Acme, ""Plus""\nplan",-12\r\n'), [['Date','Description','Amount'],['2026-01-01','Acme, "Plus"\nplan','-12']]);
  assert.deepEqual(parseCSV('Date;Description;Amount\n2026-01-01;Acme;-12')[1], ['2026-01-01','Acme','-12']);
  assert.deepEqual(parseCSV('Date\tDescription\tAmount\n2026-01-01\tAcme\t-12')[1], ['2026-01-01','Acme','-12']);
});
test('CSV rejects malformed, binary and non-tabular files', () => {
  for (const s of ['Date,Description\n1,"Unclosed', 'PDF content', 'a,b\n\0,1']) assert.throws(() => parseCSV(s));
});
test('amounts accept standard money notation and reject decimal commas or partial values', () => {
  for (const s of ['-$1,234.50','($1,234.50)','1,234.50 DR']) assert.equal(parseAmount(s), -1234.5);
  assert.equal(parseAmount('AUD 12.99'), 12.99);
  for (const s of ['', '12,99', '1.234,50', '12abc', '--12', 'Infinity']) assert.equal(parseAmount(s), null);
});
test('dates respect chosen order and validate calendar days', () => {
  assert.equal(parseDate('02/03/2026','dmy'), Date.UTC(2026,2,2));
  assert.equal(parseDate('02/03/2026','mdy'), Date.UTC(2026,1,3));
  assert.equal(parseDate('2024-02-29'), Date.UTC(2024,1,29));
  assert.equal(parseDate('03 Sep 2026'), Date.UTC(2026,8,3));
  assert.equal(parseDate('2026-09-03T12:30:00Z'), Date.UTC(2026,8,3));
  for (const s of ['31/02/2026','2026-02-29','2026-13-01','hello']) assert.equal(parseDate(s), null);
});
test('recognises debit headers and normalises transaction references conservatively', () => {
  assert.deepEqual(guessColumns(['Date','Details','Money Out','Money In']), {sign:'debit', date:0, description:1, amount:2});
});
test('merchant normalisation preserves provider and plan identifiers', () => {
  assert.equal(merchantKey('VISA Music Club REF 123456'), 'MUSIC CLUB');
  assert.notEqual(merchantKey('PAYPAL * VIDEO'), merchantKey('PAYPAL * MUSIC'));
  assert.notEqual(merchantKey('Studio 54'), merchantKey('Studio 55'));
});
test('spending conventions exclude income; debit blanks still extend statement range', () => {
  const rows = [['01/01/2026','Plan','-12'],['01/02/2026','Plan','-12'],['02/02/2026','Salary','4000'],['bad','Bad','xx']];
  const r = analyse(rows); assert.equal(r.transactions.length, 2); assert.equal(r.stats.nonSpending, 1); assert.equal(r.stats.invalid, 1); assert.equal(r.candidates.length, 1);
  assert.equal(analyse(rows, {sign:'positive'}).transactions.length, 1);
  const debit = analyse([['01/01/2026','Plan','12'],['01/02/2026','Plan','12'],['01/06/2026','Salary','']], {sign:'debit'});
  assert.equal(debit.candidates[0].stale, true);
  assert.throws(() => analyse(rows, {amount:0}), /different columns/);
});
test('headerless bank exports can map amount before description and skip broken-width rows', () => {
  const rows = parseCSV('01/01/2026,-10,Music\n01/02/2026,-10,Music\n01/03/2026,-10,Music,unexpected');
  const r = analyse(rows, {description:2,amount:1,width:3});
  assert.equal(r.transactions.length, 2); assert.equal(r.stats.invalid, 1); assert.equal(r.candidates[0].merchant, 'MUSIC');
});
test('monthly detection handles month ends, out of order rows, exact duplicates and price changes', () => {
  const r = analyse([['31/03/2026','Cloud','-12'],['31/01/2026','Cloud','-10'],['28/02/2026','Cloud','-10'],['28/02/2026','Cloud','-10']]);
  assert.equal(r.stats.duplicates, 1); assert.equal(r.candidates.length, 1);
  const c = r.candidates[0]; assert.equal(c.monthly, 12); assert.equal(c.yearly, 144); assert.equal(c.changed, true); assert.equal(c.period, 'Monthly'); assert.equal(c.next, Date.UTC(2026,3,30));
});
test('weekly, fortnightly, quarterly and yearly periods annualise correctly', () => {
  for (const [dates, period, yearly] of [
    [['2026-01-01','2026-01-08','2026-01-15'],'Weekly',520],
    [['2026-01-01','2026-01-15','2026-01-29'],'Fortnightly',260],
    [['2026-01-01','2026-04-01','2026-07-01'],'Quarterly',40],
    [['2024-02-29','2025-02-28'],'Yearly',10]
  ]) { const c = analyse(dates.map(d => [d,'Plan','-10'])).candidates[0]; assert.equal(c.period, period); assert.equal(c.yearly, yearly); }
});
test('irregular spending, single charges and variable shopping are not recurring', () => {
  assert.equal(analyse([['01/01/2026','Shop','-20'],['04/01/2026','Shop','-20'],['24/01/2026','Shop','-20'],['01/02/2026','Annual','-200']]).candidates.length, 0);
  assert.equal(analyse([['01/01/2026','Shop','-20'],['01/02/2026','Shop','-80'],['01/03/2026','Shop','-10']]).candidates.length, 0);
});
test('two observations are possible and old patterns are marked against statement end', () => {
  const c = analyse([['01/01/2026','Plan','-10'],['01/02/2026','Plan','-10'],['30/06/2026','Shop','-50']]).candidates[0];
  assert.equal(c.confidence,'Possible pattern'); assert.equal(c.stale, true);
});
test('report exports currency, evidence and protects spreadsheet formula cells', () => {
  const c = analyse([['01/01/2026','Plan','-10'],['01/02/2026','Plan','-10']]).candidates[0];
  c.merchant = '=HYPERLINK("bad")';
  const csv = reportCSV([c], 'AUD'); assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"')); assert.ok(csv.includes('"AUD"')); assert.ok(csv.includes('"120.00"'));
});
