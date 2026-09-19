const { test } = require('node:test');
const assert = require('node:assert/strict');
const H = require('../tools/habit-tracker/static/core.js');

const daily = { id: 'h1', name: 'Read', schedule: { type: 'daily' } };
const onDays = days => ({ id: 'h2', name: 'Run', schedule: { type: 'days', days } });
const weekly = n => ({ id: 'h3', name: 'Ring someone', schedule: { type: 'times', n } });
const back = (today, list) => list.map(i => H.addDays(today, -i));

test('calendar days are local, and survive month, year and leap boundaries', () => {
  assert.equal(H.addDays('2026-01-31', 1), '2026-02-01');
  assert.equal(H.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(H.addDays('2024-03-01', -1), '2024-02-29');     // leap year
  assert.equal(H.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(H.addDays('2027-01-01', -1), '2026-12-31');
  assert.equal(H.daysBetween('2025-12-25', '2026-01-05'), 11);
  assert.equal(H.toISO(H.fromISO('2026-09-19')), '2026-09-19');
  assert.equal(H.fromISO('2026-02-30'), null, 'a date that does not exist must not round trip');
  assert.equal(H.fromISO('19/09/2026'), null);
  assert.equal(H.fromISO(''), null);
  assert.equal(H.fromISO(null), null);
  // weeks run Monday to Sunday
  for (const iso of ['2026-09-14', '2026-09-17', '2026-09-20']) assert.equal(H.weekStart(iso), '2026-09-14');
  assert.equal(H.weekStart('2026-09-21'), '2026-09-21');
  assert.equal(H.weekdayOf('2026-09-14'), 1);
  assert.equal(H.weekdayOf('2026-09-20'), 0);
});

test('schedules say which days count, and read back in plain words', () => {
  assert.ok(H.isDue(daily, '2026-09-19'));
  const monWedSat = onDays([1, 3, 6]);
  assert.ok(H.isDue(monWedSat, '2026-09-14'));
  assert.ok(!H.isDue(monWedSat, '2026-09-15'));
  assert.ok(H.isDue(weekly(2), '2026-09-15'), 'a weekly target can be met on any day');
  assert.equal(H.describeSchedule(daily), 'Every day');
  assert.equal(H.describeSchedule(onDays([1, 2, 3, 4, 5])), 'Weekdays');
  assert.equal(H.describeSchedule(onDays([0, 6])), 'Weekends');
  assert.equal(H.describeSchedule(onDays([3, 1])), 'Mon, Wed');
  assert.equal(H.describeSchedule(weekly(1)), 'Once a week');
  assert.equal(H.describeSchedule(weekly(3)), '3 times a week');
  assert.equal(H.targetPerWeek(onDays([1, 3, 6])), 3);
  assert.equal(H.targetPerWeek(daily), 7);
});

test('a daily streak counts back from today, and today stays open until it ends', () => {
  const today = '2026-09-19';
  const done = back(today, [1, 2, 3, 4]);                       // yesterday back four days
  let s = H.streaks(daily, done, today);
  assert.equal(s.current, 4, 'not ticking today yet must not break the run');
  assert.equal(s.best, 4);
  s = H.streaks(daily, done.concat(today), today);
  assert.equal(s.current, 5);
  s = H.streaks(daily, back(today, [1, 2, 4, 5, 6]), today);    // a gap three days ago
  assert.equal(s.current, 2);
  assert.equal(s.best, 3);
  assert.equal(H.streaks(daily, [], today).current, 0);
  assert.equal(H.streaks(daily, [], today).best, 0);
});

test('a rest day never breaks a streak', () => {
  const today = '2026-09-19';                                   // a Saturday
  const habit = onDays([1, 3, 6]);                              // Mon, Wed, Sat
  const scheduled = [];
  for (let i = 0; i < 40; i++) {
    const d = H.addDays(today, -i);
    if (H.isDue(habit, d)) scheduled.push(d);
  }
  const s = H.streaks(habit, scheduled, today);
  assert.equal(s.current, scheduled.length, 'skipped days are not failures');
  // ticking an extra day the habit is not scheduled for is not part of the run
  const extra = H.streaks(habit, scheduled.concat(['2026-09-18']), today);
  assert.equal(extra.current, s.current);
  // missing one scheduled day ends it there
  const missing = scheduled.filter(d => d !== scheduled[2]);
  assert.equal(H.streaks(habit, missing, today).current, 2);
});

test('a streak crosses a month and a year boundary', () => {
  const today = '2026-01-03';
  const done = ['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02'];
  assert.equal(H.streaks(daily, done, today).current, 5);
  const feb = H.streaks(daily, ['2026-02-26', '2026-02-27', '2026-02-28'], '2026-03-01');
  assert.equal(feb.current, 3);
  const leap = H.streaks(daily, ['2024-02-28', '2024-02-29'], '2024-03-01');
  assert.equal(leap.current, 2);
});

test('an n times a week habit is counted in whole weeks', () => {
  const today = '2026-09-19';                                   // Saturday of the week starting 14 Sep
  const habit = weekly(2);
  const twoAWeek = [
    '2026-08-25', '2026-08-27',                                 // week of 24 Aug
    '2026-09-01', '2026-09-03',                                 // week of 31 Aug
    '2026-09-08', '2026-09-10',                                 // week of 7 Sep
    '2026-09-15', '2026-09-17'                                  // week of 14 Sep, the week in progress
  ];
  let s = H.streaks(habit, twoAWeek, today);
  assert.equal(s.unit, 'week');
  assert.equal(s.current, 4, 'the week in progress counts once its target is met');
  // one short this week: the run is the completed weeks before it, and nothing is lost
  s = H.streaks(habit, twoAWeek.slice(0, -1), today);
  assert.equal(s.current, 3);
  assert.equal(s.best, 3);
  // a week that missed the target breaks it
  s = H.streaks(habit, twoAWeek.filter(d => d !== '2026-09-03'), today);
  assert.equal(s.current, 2);
  assert.equal(s.best, 2);
  // the gap between the weeks of 24 Aug and 7 Sep is not bridged
  assert.equal(H.streaks(weekly(3), twoAWeek, today).current, 0, 'three a week was never met');
});

test('completion rate uses what was actually scheduled', () => {
  const today = '2026-09-19';
  assert.equal(H.completionRate(daily, back(today, [0, 1, 2, 3, 4]), today, 10), 0.5);
  assert.equal(H.completionRate(daily, [], today, 10), 0);
  const habit = onDays([1, 3, 6]);
  const scheduled = [];
  for (let i = 0; i < 28; i++) { const d = H.addDays(today, -i); if (H.isDue(habit, d)) scheduled.push(d); }
  assert.equal(H.completionRate(habit, scheduled, today, 28), 1, 'every scheduled day done is 100 per cent');
  // a weekly target prorates: 2 a week over 28 days expects 8
  assert.equal(H.completionRate(weekly(2), back(today, [0, 2, 4, 6]), today, 28), 0.5);
  assert.equal(H.completionRate(onDays([]), [], today, 28), null, 'nothing scheduled is not the same as zero');
  assert.ok(H.completionRate(daily, back(today, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]), today, 10) <= 1, 'extra days cannot exceed 100 per cent');
});

test('the heatmap is whole Monday weeks ending with this one', () => {
  const today = '2026-09-19';
  const cells = H.heatmapCells(daily, ['2026-09-17'], today, 53);
  assert.equal(cells.length, 53 * 7);
  assert.equal(H.weekdayOf(cells[0].date), 1, 'the grid starts on a Monday');
  assert.equal(cells[cells.length - 1].date, '2026-09-20', 'and ends on the Sunday of this week');
  assert.equal(cells.filter(c => c.done).length, 1);
  assert.ok(cells.some(c => c.future), 'days later this week are marked as future');
  assert.ok(!cells.find(c => c.date === today).future);
  const sparse = H.heatmapCells(onDays([1]), [], today, 4);
  assert.equal(sparse.filter(c => c.scheduled).length, 4, 'one scheduled day per week');
});

test('validate refuses anything a page should not render', () => {
  const good = { habits: [daily], ticks: { h1: ['2026-09-18'] } };
  assert.deepEqual(H.validate(good), []);
  const bad = s => H.validate(s).join(' | ');
  assert.match(bad(null), /not a Habit Tracker file/);
  assert.match(bad({ habits: [], ticks: [] }), /not a Habit Tracker file/);
  assert.match(bad({ habits: [{ id: '<img src=x>', name: 'x', schedule: { type: 'daily' } }], ticks: {} }), /invalid id/);
  assert.match(bad({ habits: [daily, { id: 'h1', name: 'Other', schedule: { type: 'daily' } }], ticks: {} }), /duplicate id/);
  assert.match(bad({ habits: [daily, { id: 'h9', name: ' read ', schedule: { type: 'daily' } }], ticks: {} }), /both called/);
  assert.match(bad({ habits: [{ id: 'h1', name: '', schedule: { type: 'daily' } }], ticks: {} }), /needs a name/);
  assert.match(bad({ habits: [{ id: 'h1', name: 'x', schedule: { type: 'sometimes' } }], ticks: {} }), /unknown schedule/);
  assert.match(bad({ habits: [{ id: 'h1', name: 'x', schedule: { type: 'days', days: [9] } }], ticks: {} }), /days are invalid/);
  assert.match(bad({ habits: [{ id: 'h1', name: 'x', schedule: { type: 'days', days: [1, 1] } }], ticks: {} }), /days are invalid/);
  assert.match(bad({ habits: [{ id: 'h1', name: 'x', schedule: { type: 'times', n: 0 } }], ticks: {} }), /1 to 7/);
  assert.match(bad({ habits: [{ id: 'h1', name: 'x', schedule: { type: 'daily' }, colour: 'red' }], ticks: {} }), /invalid colour/);
  assert.match(bad({ habits: [daily], ticks: { nope: [] } }), /does not contain/);
  assert.match(bad({ habits: [daily], ticks: { h1: ['2026-02-30'] } }), /not a date/);
  assert.match(bad({ habits: [daily], ticks: { h1: ['2026-09-01', '2026-09-01'] } }), /same day twice/);
  assert.match(bad({ habits: [daily], ticks: { h1: 'nope' } }), /not a list of dates/);
});

test('a file round trips, and a bad one is refused before it replaces anything', () => {
  const state = H.sample('2026-09-19');
  const back = H.importJson(H.exportJson(state));
  assert.deepEqual(back.habits, state.habits);
  assert.deepEqual(back.ticks, state.ticks);
  assert.throws(() => H.importJson('not json'), /not readable JSON/);
  assert.throws(() => H.importJson('{"v":99,"habits":[],"ticks":{}}'), /newer version/);
  assert.throws(() => H.importJson('{"v":1,"habits":[{"id":"a b","name":"x","schedule":{"type":"daily"}}],"ticks":{}}'), /invalid id/);
  assert.throws(() => H.importJson('{"v":1,"habits":[],"ticks":{"ghost":[]}}'), /does not contain/);
});

test('merging adds what is new and keeps what is here', () => {
  const mine = { habits: [{ id: 'h1', name: 'Read', schedule: { type: 'daily' } }], ticks: { h1: ['2026-09-01'] } };
  const theirs = {
    habits: [
      { id: 'h1', name: 'Read', schedule: { type: 'daily' } },
      { id: 'h2', name: 'Swim', schedule: { type: 'times', n: 2 } }
    ],
    ticks: { h1: ['2026-09-02', '2026-09-01'], h2: ['2026-09-03'] }
  };
  const merged = H.merge(mine, theirs);
  assert.deepEqual(merged.ticks.h1, ['2026-09-01', '2026-09-02'], 'the same habit unions its days without duplicates');
  assert.equal(merged.habits.length, 2);
  assert.deepEqual(merged.ticks.h2, ['2026-09-03']);
  // an id that collides with a different habit gets a fresh one instead of overwriting
  const clash = H.merge(mine, { habits: [{ id: 'h1', name: 'Cycle', schedule: { type: 'daily' } }], ticks: { h1: ['2026-09-05'] } });
  assert.equal(clash.habits.length, 2);
  assert.deepEqual(clash.ticks.h1, ['2026-09-01'], 'the original history is untouched');
  const added = clash.habits.find(h => h.name === 'Cycle');
  assert.notEqual(added.id, 'h1');
  assert.deepEqual(clash.ticks[added.id], ['2026-09-05']);
  assert.deepEqual(H.validate(merged), []);
  assert.deepEqual(H.validate(clash), []);
});

test('the CSV quotes what needs quoting', () => {
  const state = { habits: [{ id: 'h1', name: 'Read "Dune", daily', schedule: { type: 'daily' } }], ticks: { h1: ['2026-09-14'] } };
  const out = H.csv(state);
  assert.match(out, /^Habit,Date,Weekday,Schedule\n/);
  assert.match(out, /"Read ""Dune"", daily",2026-09-14,Monday,Every day/);
});

test('the sample is valid, deterministic and shows a live streak', () => {
  const a = H.sample('2026-09-19'), b = H.sample('2026-09-19');
  assert.deepEqual(a, b);
  assert.deepEqual(H.validate(a), []);
  assert.equal(a.habits.length, 3);
  assert.ok(H.streaks(a.habits[1], a.ticks['sample-read'], '2026-09-19').current >= 6);
  for (const h of a.habits) {
    for (const d of a.ticks[h.id]) {
      assert.ok(H.fromISO(d), 'sample date ' + d);
      assert.ok(d <= '2026-09-19', 'the sample must not contain future days');
    }
  }
  assert.notDeepEqual(H.sample('2026-09-19'), H.sample('2026-09-20'));
  const { dueToday, doneToday } = H.counts(a, '2026-09-19');
  assert.ok(dueToday >= 2 && doneToday >= 0);
});
