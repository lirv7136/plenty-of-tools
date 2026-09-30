const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../tools/hours-log/static/core.js');

let n = 0;
const entry = (date, start, end, o = {}) => Object.assign({ id: 'e' + (++n), date, start, end, breakMin: 0, place: 'home', client: '', note: '',
  createdAt: new Date((H.fromISO(date) || new Date(2026, 6, 1)).getTime() + 20 * 3600000).toISOString() }, o);

test('the published fixed rates, and a provisional rate for a year the ATO has not set', () => {
  assert.deepEqual(H.rateFor(2020), { cents: 52, provisional: false });
  assert.deepEqual(H.rateFor(2021), { cents: 52, provisional: false });
  assert.deepEqual(H.rateFor(2022), { cents: 67, provisional: false });
  assert.deepEqual(H.rateFor(2023), { cents: 67, provisional: false });
  assert.deepEqual(H.rateFor(2024), { cents: 70, provisional: false });
  assert.deepEqual(H.rateFor(2025), { cents: 70, provisional: false });
  assert.deepEqual(H.rateFor(2026), { cents: 70, provisional: true });
  assert.equal(H.rateFor(2019), null);
});

test('the deduction disregards cents rather than rounding them', () => {
  assert.equal(H.deduction(136 * 60, 70), 95, "the ATO's own example: 136 h × 70c = $95.20, claimed as $95");
  assert.equal(H.deduction(8159, 70), 95, '135.98 h is $95.18');
  assert.equal(H.deduction(0, 70), 0);
  assert.equal(H.deduction(1, 70), 0);
  // a total that lands exactly on a dollar must not fall a cent short through float error
  assert.equal(H.deduction(60 * 10, 70), 7);
  assert.equal(H.deduction(6000, 67), 67, '100 h × 67c = $67.00 exactly');
  assert.equal(H.deduction(1351 * 60 + 17, 70), 945, 'about 1,351 h gives $945, as in the ATO example');
});

test('income years run 1 July to 30 June, and the boundary days fall on the right side', () => {
  assert.equal(H.incomeYearStart('2026-06-30'), 2025);
  assert.equal(H.incomeYearStart('2026-07-01'), 2026);
  const list = [entry('2026-06-30', '09:00', '17:00'), entry('2026-07-01', '09:00', '17:00')];
  assert.equal(H.yearSummary(list, 2025).homeMinutes, 480);
  assert.equal(H.yearSummary(list, 2026).homeMinutes, 480);
  assert.equal(H.yearSummary(list, 2026).rate.provisional, true);
  assert.equal(H.yearSummary(list, 2025).deduction, 5, '8 h × 70c = $5.60, claimed as $5');
  assert.equal(H.yearSummary(list, 2026).months[0].key, '2026-07');
  assert.equal(H.yearSummary(list, 2026).months[11].key, '2027-06');
});

test('only hours at home count towards the fixed rate', () => {
  const list = [entry('2025-08-04', '09:00', '17:00', { place: 'home' }), entry('2025-08-05', '09:00', '17:00', { place: 'work' }),
    entry('2025-08-06', '09:00', '12:00', { place: 'other' })];
  const s = H.yearSummary(list, 2025);
  assert.equal(s.homeMinutes, 480); assert.equal(s.allMinutes, 480 + 480 + 180);
});

test('durations subtract breaks, run past midnight, and follow daylight saving', () => {
  assert.equal(H.minutes(entry('2026-08-03', '09:00', '17:30', { breakMin: 30 })), 480);
  assert.equal(H.minutes(entry('2026-08-03', '22:00', '06:00')), 480, 'overnight');
  assert.equal(H.minutes(entry('2026-08-03', '09:00', '09:00')), 1440, 'a start equal to the finish is a full day');
  // Sydney clocks go forward at 2 am on 4 Oct 2026 and back at 3 am on 4 Apr 2027. Only meaningful
  // when the test runs in an Australian eastern zone; elsewhere these are plain 8 hour shifts.
  if (/Sydney|Melbourne|Canberra|Hobart/.test(Intl.DateTimeFormat().resolvedOptions().timeZone)) {
    assert.equal(H.minutes(entry('2026-10-03', '22:00', '06:00')), 420, 'an hour lost to daylight saving');
    assert.equal(H.minutes(entry('2027-04-03', '22:00', '06:00')), 540, 'an hour gained back');
  }
});

test('entries are checked: times, breaks, place and length', () => {
  assert.deepEqual(H.entryErrors(entry('2026-08-03', '09:00', '17:00')), []);
  assert.match(H.entryErrors(entry('2026-08-03', '9am', '17:00')).join(), /start time/);
  assert.match(H.entryErrors(entry('2026-08-03', '09:00', '24:00')).join(), /finish time/);
  assert.match(H.entryErrors(entry('2026-08-03', '09:00', '10:00', { breakMin: 60 })).join(), /as long as the whole shift/);
  assert.match(H.entryErrors(entry('2026-08-03', '09:00', '10:00', { breakMin: -5 })).join(), /whole minutes/);
  assert.match(H.entryErrors(entry('2026-08-03', '09:00', '10:00', { breakMin: 2.5 })).join(), /whole minutes/);
  assert.match(H.entryErrors(entry('2026-08-03', '09:00', '10:00', { place: 'moon' })).join(), /where you worked/);
  assert.match(H.entryErrors(entry('2026-02-30', '09:00', '10:00')).join(), /date/);
});

test('an entry made after the day is flagged, with one day of grace for an overnight shift', () => {
  const at = (date, days, hour = 12) => new Date(H.fromISO(H.addDays(date, days)).getTime() + hour * 3600000).toISOString();
  assert.equal(H.isLate(entry('2026-08-03', '09:00', '17:00', { createdAt: at('2026-08-03', 0, 17) })), false);
  assert.equal(H.isLate(entry('2026-08-03', '09:00', '17:00', { createdAt: at('2026-08-03', 1, 8) })), true);
  assert.equal(H.isLate(entry('2026-08-03', '22:00', '06:00', { createdAt: at('2026-08-03', 1, 7) })), false);
  assert.equal(H.isLate(entry('2026-08-03', '22:00', '06:00', { createdAt: at('2026-08-03', 2, 7) })), true);
  const list = [entry('2025-09-01', '09:00', '17:00', { createdAt: at('2025-09-01', 10) })];
  assert.equal(H.yearSummary(list, 2025).lateHome, 1);
});

test('the timer becomes an entry, refuses under a minute and over a day, and keeps the start date', () => {
  const start = new Date(2026, 7, 3, 23, 30);
  const r = H.stopTimer({ startedAt: start.toISOString(), place: 'home', client: 'Acme' }, new Date(2026, 7, 4, 1, 15).toISOString());
  assert.equal(r.entry.date, '2026-08-03'); assert.equal(r.entry.start, '23:30'); assert.equal(r.entry.end, '01:15');
  assert.equal(H.minutes(Object.assign({ id: 'x' }, r.entry)), 105);
  assert.equal(H.isLate(Object.assign({ id: 'x' }, r.entry)), false, 'stopping after midnight is not late');
  assert.match(H.stopTimer({ startedAt: start.toISOString() }, new Date(start.getTime() + 20000).toISOString()).error, /less than a minute/);
  assert.match(H.stopTimer({ startedAt: start.toISOString() }, new Date(start.getTime() + 25 * 3600000).toISOString()).error, /more than 24 hours/);
});

test('a week adds up by day and by client, with amounts where a rate is set', () => {
  const list = [entry('2026-09-28', '09:00', '17:00', { client: 'A', breakMin: 30 }), entry('2026-09-29', '09:00', '12:00', { client: 'B' }),
    entry('2026-10-04', '10:00', '11:00', { client: 'A' }), entry('2026-10-05', '09:00', '17:00', { client: 'A' })];
  const w = H.weekSummary(list, '2026-09-28', { A: 100 });
  assert.equal(w.to, '2026-10-04');
  assert.equal(w.minutes, 450 + 180 + 60);
  assert.equal(w.days[0].minutes, 450); assert.equal(w.days[6].minutes, 60);
  assert.deepEqual(w.clients.map(c => [c.client, c.minutes, c.amount]), [['A', 510, 850], ['B', 180, null]]);
  assert.equal(H.weekStart('2026-10-04'), '2026-09-28', 'Sunday belongs to the week that started on Monday');
  const lines = H.invoiceLines(w).replace(/\r\n$/, '').split('\r\n');   // not trim(): it would strip the BOM
  assert.equal(lines[0], '﻿Description,Quantity,Unit price');
  assert.equal(lines[1], '"A, 2026-09-28 to 2026-10-04",8.50,100.00');
});

test('backups round trip, and damaged or foreign files are refused', () => {
  const s = H.sample('2026-09-30');
  assert.deepEqual(H.validate(s), []);
  assert.ok(s.entries.length > 30);
  const back = H.importJson(H.exportJson(s));
  assert.deepEqual(back.entries, s.entries);
  assert.deepEqual(back.rates, s.rates);
  assert.throws(() => H.importJson('{'), /not an hours log/);
  assert.throws(() => H.importJson('{"app":"plentyoftools car-logbook"}'), /not an hours log/);
  const bad = JSON.parse(H.exportJson(s)); bad.entries[0].breakMin = 9999;
  assert.throws(() => H.importJson(JSON.stringify(bad)), /break/);
  const markup = JSON.parse(H.exportJson(s)); markup.entries[0].id = '<b>';
  assert.throws(() => H.importJson(JSON.stringify(markup)), /id/);
  const rate = JSON.parse(H.exportJson(s)); rate.rates.X = 'free';
  assert.throws(() => H.importJson(JSON.stringify(rate)), /rate/);
  assert.equal(s.entries.filter(H.isLate).length, 0, 'the sample is kept at the time');
});

test('CSV keeps every entry, quotes safely and defuses formulas', () => {
  const out = H.csv([entry('2026-08-03', '09:00', '17:00', { client: '@evil', note: 'a, "b"' })]);
  assert.ok(out.startsWith('﻿Date,'));
  assert.ok(out.includes(",'@evil,"));
  assert.ok(out.includes('"a, ""b"""'));
  assert.ok(out.includes(',8.00,Home,'));
});
