const { test } = require('node:test');
const assert = require('node:assert/strict');
const C = require('../tools/settle-up/static/core.js');

test('toCents parses the ways people type money', () => {
  assert.equal(C.toCents('12.50'), 1250);
  assert.equal(C.toCents('12,50'), 1250);
  assert.equal(C.toCents('1,234.56'), 123456);
  assert.equal(C.toCents('1.234,56'), 123456);
  assert.equal(C.toCents('$ 12'), 1200);
  assert.equal(C.toCents('A$0.1'), 10);
  assert.equal(C.toCents(''), null);
  assert.equal(C.toCents('abc'), null);
  assert.equal(C.fmt(123456, 'A$'), 'A$1,234.56');
  assert.equal(C.fmt(-5, '$'), '-$0.05');
});

test('equal split spreads the odd cents to the first people', () => {
  assert.deepEqual(C.splitEqual(1000, 3), [334, 333, 333]);
  assert.deepEqual(C.splitEqual(1001, 3), [334, 334, 333]);
  assert.equal(C.splitEqual(999, 7).reduce((a, b) => a + b, 0), 999);
  assert.deepEqual(C.splitEqual(500, 0), []);
});

test('balances sum to zero and the settlement clears every balance', () => {
  const s = C.sample();
  const net = C.balances(s);
  assert.equal(Object.values(net).reduce((a, b) => a + b, 0), 0);
  const plan = C.settle(net);
  const after = Object.assign({}, net);
  for (const t of plan) { after[t.from] += t.cents; after[t.to] -= t.cents; assert.ok(t.cents > 0); }
  for (const id in after) assert.equal(after[id], 0);
  assert.ok(plan.length <= s.people.length - 1);
});

test('exact splits are honoured and custom amounts that do not add up are rejected', () => {
  const s = { name: 'x', currency: '$', people: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    expenses: [{ id: 'e1', desc: 'Dinner', payer: 'a', cents: 3000, date: '2026-01-01', split: { type: 'exact', amounts: { a: 1000, b: 2000 } } }] };
  assert.deepEqual(C.validate(s), []);
  assert.deepEqual(C.balances(s), { a: 2000, b: -2000 });
  s.expenses[0].split.amounts.b = 1500;
  const errs = C.validate(s);
  assert.equal(errs.length, 1);
  assert.match(errs[0], /add up to \$25\.00 but the expense is \$30\.00/);
});

test('validate catches missing payer, empty split, duplicate names', () => {
  const s = { name: '', currency: '$', people: [{ id: 'a', name: 'Sam' }, { id: 'b', name: 'sam ' }],
    expenses: [{ id: 'e1', desc: 'Taxi', payer: 'zz', cents: 100, split: { type: 'equal', among: [] } }] };
  const errs = C.validate(s);
  assert.ok(errs.some(e => /Two people are called/.test(e)));
  assert.ok(errs.some(e => /payer is not in the group/.test(e)));
  assert.ok(errs.some(e => /nobody is included/.test(e)));
});

test('share link round trips, including non ASCII names', () => {
  const s = C.sample();
  s.people[0].name = 'Zoë';
  s.name = 'Trip – 2026 ✈';
  const link = C.encode(s);
  assert.match(link, /^[A-Za-z0-9_-]+$/);
  const back = C.decode(link);
  assert.deepEqual(back, { name: s.name, currency: s.currency, people: s.people, expenses: s.expenses });
  assert.throws(() => C.decode('not-a-link'));
  assert.throws(() => C.decode(C.encode({ name: '', currency: '$', people: [], expenses: [{ id: 'e', payer: 'a', cents: 0 }] })));
});

test('CSV exports quote what needs quoting', () => {
  const s = C.sample();
  s.expenses[0].desc = 'Airbnb, "beach house"';
  const csv = C.csvExpenses(s);
  assert.match(csv, /^Date,Description,Paid by,Amount,Split\n/);
  assert.match(csv, /"Airbnb, ""beach house"""/);
  const plan = C.csvPlan(s, C.settle(C.balances(s)));
  assert.match(plan, /^From,To,Amount\n/);
});

test('a crafted link with markup in an id is rejected before it reaches the page', () => {
  const s = C.sample();
  s.expenses[0].id = 'x" onmouseover="alert(1)';
  assert.throws(() => C.decode(C.encode(s)), /invalid or duplicate expense id/);
  const t = C.sample();
  t.expenses[1].id = t.expenses[0].id;
  assert.throws(() => C.decode(C.encode(t)), /invalid or duplicate expense id/);
  const u = C.sample();
  u.people[0].id = '<b>';
  assert.throws(() => C.decode(C.encode(u)), /invalid id/);
  assert.deepEqual(C.validate(C.sample()), []);
});
