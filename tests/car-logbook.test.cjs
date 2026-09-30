const { test } = require('node:test');
const assert = require('node:assert/strict');
const L = require('../tools/car-logbook/static/core.js');

const car = (o = {}) => Object.assign({ id: 'c1', name: 'Car', start: '2026-07-06', startOdo: 10000, endDate: null, endOdo: null, years: [] }, o);
let n = 0;
const trip = (date, a, b, business = true, o = {}) => Object.assign({ id: 't' + (++n), carId: 'c1', date, startOdo: a, endOdo: b, business,
  purpose: business ? 'Client visit' : '', destination: business ? 'Parramatta' : '', createdAt: new Date((L.fromISO(date) || new Date(2026, 6, 1)).getTime() + 18 * 3600000).toISOString() }, o);

test('dates are local days and income years turn over on 1 July', () => {
  assert.equal(L.addDays('2026-06-30', 1), '2026-07-01');
  assert.equal(L.daysBetween('2026-09-28', '2026-10-12'), 14, 'across the October daylight saving change');
  assert.equal(L.daysBetween('2027-03-29', '2027-04-12'), 14, 'across the April change');
  assert.equal(L.incomeYearStart('2026-06-30'), 2025);
  assert.equal(L.incomeYearStart('2026-07-01'), 2026);
  assert.equal(L.incomeYearLabel(2026), '2026–27');
  assert.equal(L.incomeYearLabel(2099), '2099–00');
  assert.equal(L.fromISO('2026-02-30'), null);
});

test('a trip needs readings in order, and a work trip needs its purpose and destination', () => {
  assert.deepEqual(L.tripErrors(trip('2026-07-07', 100, 120)), []);
  assert.deepEqual(L.tripErrors(trip('2026-07-07', 100, 100)), [], 'a zero km entry is allowed');
  assert.match(L.tripErrors(trip('2026-07-07', 120, 100))[0], /lower than the start/);
  assert.match(L.tripErrors(trip('2026-07-07', 100, 120, true, { purpose: '  ' })).join(' '), /purpose/);
  assert.match(L.tripErrors(trip('2026-07-07', 100, 120, true, { destination: '' })).join(' '), /destination/);
  assert.deepEqual(L.tripErrors(trip('2026-07-07', 100, 120, false)), [], 'private trips need no purpose');
  assert.match(L.tripErrors(trip('2026-02-30', 1, 2)).join(' '), /date/);
  assert.match(L.tripErrors(trip('2026-07-07', NaN, 2)).join(' '), /start odometer/);
  assert.match(L.tripErrors(trip('2026-07-07', 0, 1e8)).join(' '), /end odometer/);
  assert.equal(L.tripKm(trip('2026-07-07', 100.2, 120.5)), 20.3, 'tenths are kept without float noise');
});

test('business use percentage: none, all, mixed, and no driving at all', () => {
  const c = car();
  assert.equal(L.summary(c, [], '2026-09-28').businessPct, null, 'no kilometres means no percentage, not 0% or NaN');
  const all = [trip('2026-07-07', 10000, 10050), trip('2026-07-08', 10050, 10100)];
  assert.equal(L.summary(c, all, '2026-09-28').businessPct, 100);
  const none = [trip('2026-07-07', 10000, 10050, false)];
  assert.equal(L.summary(c, none, '2026-09-28').businessPct, 0);
  // 30 work km of 100 total, where 70 km were unlogged private driving before a closing reading
  const mixed = [trip('2026-07-07', 10000, 10030)];
  const s = L.summary(car({ endDate: '2026-09-28', endOdo: 10100 }), mixed, '2026-10-01');
  assert.equal(s.totalKm, 100); assert.equal(s.businessKm, 30); assert.equal(s.privateKm, 70); assert.equal(s.businessPct, 30);
  // one decimal place
  const third = [trip('2026-07-07', 10000, 10001)];
  assert.equal(L.summary(car({ endOdo: 10003, endDate: '2026-09-28' }), third, '2026-10-01').businessPct, 33.3);
});

test('the period reaches 12 weeks on day 84, not 83, and counts across daylight saving and 30 June', () => {
  const c = car({ start: '2026-06-01' });               // runs over 30 June and nothing else odd
  assert.equal(L.summary(c, [], L.addDays('2026-06-01', 82)).days, 83);
  assert.equal(L.summary(c, [], L.addDays('2026-06-01', 82)).complete, false);
  assert.equal(L.summary(c, [], L.addDays('2026-06-01', 83)).days, 84);
  assert.equal(L.summary(c, [], L.addDays('2026-06-01', 83)).complete, true);
  assert.equal(L.summary(c, [], L.addDays('2026-06-01', 84)).complete, true);
  const d = car({ start: '2026-09-20' });               // runs over the 4 October change
  const day84 = L.addDays('2026-09-20', 83);
  assert.equal(L.summary(d, [], day84).days, 84);
  assert.equal(L.summary(d, [], day84).daysLeft, 0);
  assert.equal(L.summary(d, [], '2026-09-20').days, 1, 'the first day counts');
  assert.equal(L.summary(d, [], '2026-09-20').daysLeft, 83);
});

test('trips outside the period are left out of the totals and flagged', () => {
  const c = car({ start: '2026-07-06', endDate: '2026-09-27', endOdo: 10500 });
  const t = [trip('2026-07-05', 9990, 10000), trip('2026-07-10', 10000, 10100), trip('2026-09-28', 10500, 10600)];
  const s = L.summary(c, t, '2026-10-05');
  assert.equal(s.businessKm, 100);
  assert.equal(s.trips, 1);
  const kinds = L.checks(c, t, '2026-10-05').map(x => x.kind);
  assert.ok(kinds.includes('outside'));
  assert.ok(kinds.includes('before-start'));
  assert.ok(kinds.includes('end-odo'));
});

test('overlapping odometer readings are flagged; gaps are private driving and are not', () => {
  const c = car();
  const gap = [trip('2026-07-07', 10000, 10050), trip('2026-07-08', 10080, 10100)];
  assert.deepEqual(L.checks(c, gap, '2026-07-10').filter(x => x.kind === 'overlap'), []);
  const lap = [trip('2026-07-07', 10000, 10050), trip('2026-07-08', 10040, 10100)];
  const o = L.checks(c, lap, '2026-07-10').filter(x => x.kind === 'overlap');
  assert.equal(o.length, 1);
  assert.deepEqual(o[0].ids.length, 2);
  const touching = [trip('2026-07-07', 10000, 10050), trip('2026-07-07', 10050, 10060)];
  assert.deepEqual(L.checks(c, touching, '2026-07-10').filter(x => x.kind === 'overlap'), [], 'end equal to next start is fine');
});

test('a short closed period is flagged, an open one is not yet', () => {
  assert.ok(L.checks(car({ endDate: '2026-08-01' }), [], '2026-08-02').some(x => x.kind === 'short'));
  assert.ok(!L.checks(car(), [], '2026-08-02').some(x => x.kind === 'short'));
  assert.ok(!L.checks(car({ endDate: L.addDays('2026-07-06', 83) }), [], '2026-12-01').some(x => x.kind === 'short'));
});

test('an entry made more than 7 days after the trip is flagged "added later"; 7 days is not', () => {
  const at = (date, days) => new Date(L.fromISO(L.addDays(date, days)).getTime() + 12 * 3600000).toISOString();
  assert.equal(L.isLate(trip('2026-07-07', 1, 2, true, { createdAt: at('2026-07-07', 0) })), false);
  assert.equal(L.isLate(trip('2026-07-07', 1, 2, true, { createdAt: at('2026-07-07', 7) })), false);
  assert.equal(L.isLate(trip('2026-07-07', 1, 2, true, { createdAt: at('2026-07-07', 8) })), true);
  assert.equal(L.isLate(trip('2026-07-07', 1, 2, true, { createdAt: at('2026-07-07', -1) })), false, 'a trip entered in advance is not late');
  assert.equal(L.isLate(trip('2026-07-07', 1, 2, true, { createdAt: 'nonsense' })), false);
  const late = [trip('2026-07-07', 10000, 10010, true, { createdAt: at('2026-07-07', 20) })];
  assert.equal(L.summary(car(), late, '2026-08-01').late, 1);
  assert.ok(L.checks(car(), late, '2026-08-01').some(x => x.kind === 'late'));
});

test('consecutive same day work journeys can be combined into one, and nothing else is', () => {
  const t = [trip('2026-07-07', 100, 120, true, { purpose: 'Quote', destination: 'A' }),
    trip('2026-07-07', 120, 135, true, { purpose: 'Quote', destination: 'B' }),
    trip('2026-07-07', 135, 150, false),
    trip('2026-07-07', 150, 170, true, { purpose: 'Install', destination: 'C' }),
    trip('2026-07-08', 170, 180, true, { purpose: 'Install', destination: 'C' }),
    trip('2026-07-08', 185, 190, true, { purpose: 'Install', destination: 'D' })];
  const m = L.mergeSameDay(t);
  assert.equal(m.length, 5, 'only the first two join: a private trip, a new day and a gap all break the run');
  assert.equal(m[0].startOdo, 100); assert.equal(m[0].endOdo, 135);
  assert.equal(m[0].destination, 'A → B'); assert.equal(m[0].purpose, 'Quote'); assert.equal(m[0].merged, 2);
  assert.equal(t[0].endOdo, 120, 'the original list is untouched');
  const kmBefore = t.filter(x => x.business).reduce((s, x) => s + L.tripKm(x), 0);
  const kmAfter = m.filter(x => x.business).reduce((s, x) => s + L.tripKm(x), 0);
  assert.equal(kmAfter, kmBefore, 'combining never changes the work kilometres');
});

test('the next start reading follows the highest reading so far', () => {
  assert.equal(L.nextStartOdo(car(), []), 10000);
  assert.equal(L.nextStartOdo(car(), [trip('2026-07-07', 10000, 10050), trip('2026-07-06', 10050, 10020)]), 10050);
});

test('a logbook stays valid for the income year it was kept in and four more', () => {
  assert.deepEqual(L.validUntil(car({ start: '2026-07-06' })), { startYear: 2030, label: '2030–31', ends: '2031-06-30' });
  assert.deepEqual(L.validUntil(car({ start: '2026-06-30' })).label, '2029–30');
});

test('backups round trip, and damaged or foreign files are refused', () => {
  const s = L.sample('2026-09-28');
  assert.deepEqual(L.validate(s), []);
  const back = L.importJson(L.exportJson(s));
  assert.deepEqual(back.trips, s.trips);
  assert.deepEqual(back.cars, s.cars);
  assert.throws(() => L.importJson('not json'), /not a logbook/);
  assert.throws(() => L.importJson('{"app":"something else"}'), /not a logbook/);
  const bad = JSON.parse(L.exportJson(s)); bad.trips[0].endOdo = bad.trips[0].startOdo - 5;
  assert.throws(() => L.importJson(JSON.stringify(bad)), /lower than the start/);
  const orphan = JSON.parse(L.exportJson(s)); orphan.trips[0].carId = 'nope';
  assert.throws(() => L.importJson(JSON.stringify(orphan)), /car that is not in the file/);
  const markup = JSON.parse(L.exportJson(s)); markup.trips[0].id = '"><img src=x onerror=alert(1)>';
  assert.throws(() => L.importJson(JSON.stringify(markup)), /id/);
  const newer = JSON.parse(L.exportJson(s)); newer.v = 99;
  assert.throws(() => L.importJson(JSON.stringify(newer)), /newer version/);
});

test('the sample is a complete, clean 12 week logbook', () => {
  const s = L.sample('2026-09-28');
  const c = s.cars[0];
  const sum = L.summary(c, L.tripsFor(s, c.id), '2026-09-28');
  assert.equal(sum.days, 84); assert.ok(sum.complete);
  assert.ok(sum.businessPct > 40 && sum.businessPct < 95, 'a believable business share: ' + sum.businessPct);
  assert.deepEqual(L.checks(c, L.tripsFor(s, c.id), '2026-09-28'), []);
});

test('CSV keeps every trip, quotes safely and defuses formulas', () => {
  const t = [trip('2026-07-07', 1, 2, true, { purpose: '=HYPERLINK("x")', destination: 'Smith, "Jones" & Co' })];
  const out = L.csv(car(), t);
  assert.ok(out.startsWith('﻿Date,'));
  assert.ok(out.includes(`"'=HYPERLINK(""x"")"`));
  assert.ok(out.includes('"Smith, ""Jones"" & Co"'));
  assert.equal(out.trim().split('\r\n').length, 2);
});
