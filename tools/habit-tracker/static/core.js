/* Habit Tracker core: schedules, streaks, completion, heatmap, import and export.
   Pure functions, no DOM. UMD so node tests can require() it and the page can use HabitCore. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const COLOURS = ['#0b7a5a', '#17b8a6', '#2b6cb0', '#7c3aed', '#c2410c', '#be123c', '#a16207', '#4d7c0f'];
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MAX_HABITS = 200;

  // ---------- dates ----------
  // Everything is a local calendar day as YYYY-MM-DD. Never hand a bare ISO date to the Date
  // constructor: "2026-09-19" is parsed as UTC midnight and comes back as the 18th anywhere west
  // of Greenwich. Build from parts instead, and read back with the local getters.
  function fromISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s));
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  function toISO(d) {
    const p = n => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  const todayISO = () => toISO(new Date());
  function addDays(iso, n) {
    const d = fromISO(iso);
    if (!d) return null;
    d.setDate(d.getDate() + n);
    return toISO(d);
  }
  const weekdayOf = iso => fromISO(iso).getDay();                 // 0 Sunday to 6 Saturday
  function weekStart(iso) {                                       // weeks run Monday to Sunday
    const d = fromISO(iso);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return toISO(d);
  }
  // Rounded because a daylight saving change makes the difference 23 or 25 hours.
  const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);

  // ---------- schedules ----------
  // {type:'daily'} | {type:'days', days:[0..6]} | {type:'times', n:1..7}
  function isDue(habit, iso) {
    const s = (habit && habit.schedule) || { type: 'daily' };
    if (s.type === 'days') return Array.isArray(s.days) && s.days.indexOf(weekdayOf(iso)) >= 0;
    return true;   // a daily habit, and an "n times a week" one, can be done on any day
  }
  const isWeekly = habit => !!(habit && habit.schedule && habit.schedule.type === 'times');
  function targetPerWeek(habit) {
    const s = (habit && habit.schedule) || { type: 'daily' };
    return s.type === 'times' ? s.n : s.type === 'days' ? s.days.length : 7;
  }
  function describeSchedule(habit) {
    const s = (habit && habit.schedule) || { type: 'daily' };
    if (s.type === 'times') return s.n === 1 ? 'Once a week' : s.n + ' times a week';
    if (s.type === 'days') {
      if (s.days.length === 7) return 'Every day';
      const order = [1, 2, 3, 4, 5, 6, 0].filter(d => s.days.indexOf(d) >= 0);
      if (order.length === 5 && order.every(d => d >= 1 && d <= 5)) return 'Weekdays';
      if (order.length === 2 && order.indexOf(6) >= 0 && order.indexOf(0) >= 0) return 'Weekends';
      return order.map(d => SHORT[d]).join(', ');
    }
    return 'Every day';
  }

  const tickSet = ticks => new Set(Array.isArray(ticks) ? ticks : []);

  // ---------- streaks ----------
  // Day based habits: consecutive scheduled days that were ticked, counting back from today. A
  // rest day never breaks a streak because it is skipped, not failed, and today does not break
  // one either until the day is over, so a habit due today but not yet done still shows the
  // streak it had yesterday. Ticks on days the habit is not scheduled are ignored here; they
  // are extra credit, not part of the run.
  // Weekly habits ("n times a week"): consecutive weeks that met the target. The week in
  // progress counts only once the target is met, so a streak never appears and then vanishes.
  function streaks(habit, ticks, today) {
    today = today || todayISO();
    const done = tickSet(ticks);
    const all = Array.from(done).filter(fromISO).sort();

    if (isWeekly(habit)) {
      const n = targetPerWeek(habit);
      const inWeek = ws => { let c = 0; for (let i = 0; i < 7; i++) if (done.has(addDays(ws, i))) c++; return c; };
      let cursor = weekStart(today), current = 0;
      if (inWeek(cursor) < n) cursor = addDays(cursor, -7);   // this week is still open
      while (inWeek(cursor) >= n) { current++; cursor = addDays(cursor, -7); }
      let best = 0, run = 0;
      if (all.length) {
        const stop = weekStart(today);
        for (let ws = weekStart(all[0]); ws <= stop; ws = addDays(ws, 7)) {
          if (inWeek(ws) >= n) { run++; if (run > best) best = run; } else run = 0;
        }
      }
      return { current, best: Math.max(best, current), unit: 'week' };
    }

    const s = (habit && habit.schedule) || { type: 'daily' };
    if (s.type === 'days' && (!Array.isArray(s.days) || !s.days.length)) return { current: 0, best: 0, unit: 'day' };

    let cursor = today, current = 0;
    if (isDue(habit, cursor) && !done.has(cursor)) cursor = addDays(cursor, -1);
    for (let guard = 0; guard < 4000; guard++) {
      if (isDue(habit, cursor)) {
        if (!done.has(cursor)) break;
        current++;
      }
      cursor = addDays(cursor, -1);
    }
    let best = 0, run = 0;
    if (all.length) {
      for (let d = all[0]; d <= today; d = addDays(d, 1)) {
        if (!isDue(habit, d)) continue;
        if (done.has(d)) { run++; if (run > best) best = run; } else run = 0;
      }
    }
    return { current, best: Math.max(best, current), unit: 'day' };
  }

  // Share of the last `days` days that was completed. For a weekly habit the denominator is the
  // weekly target prorated over the window, so 2 a week over 30 days expects about 8.6.
  // Returns null when nothing was scheduled in the window, which is not the same as zero.
  function completionRate(habit, ticks, today, days) {
    days = days || 30;
    today = today || todayISO();
    const done = tickSet(ticks);
    const start = addDays(today, -(days - 1));
    let hit = 0, expected = 0;
    for (let d = start; d <= today; d = addDays(d, 1)) {
      if (done.has(d)) hit++;
      if (!isWeekly(habit) && isDue(habit, d)) expected++;
    }
    if (isWeekly(habit)) expected = targetPerWeek(habit) * days / 7;
    if (!expected) return null;
    return Math.min(1, hit / expected);
  }

  // Calendar grid, oldest first, in whole Monday to Sunday weeks ending with the week of `today`.
  function heatmapCells(habit, ticks, today, weeks) {
    weeks = weeks || 53;
    today = today || todayISO();
    const done = tickSet(ticks);
    const first = addDays(weekStart(today), -7 * (weeks - 1));
    const cells = [];
    for (let i = 0; i < weeks * 7; i++) {
      const date = addDays(first, i);
      cells.push({ date, done: done.has(date), scheduled: isDue(habit, date), future: date > today });
    }
    return cells;
  }

  function counts(state, today) {
    today = today || todayISO();
    let dueToday = 0, doneToday = 0;
    for (const h of state.habits) {
      if (h.archived) continue;
      if (isDue(h, today)) dueToday++;
      if ((state.ticks[h.id] || []).indexOf(today) >= 0) doneToday++;
    }
    return { dueToday, doneToday };
  }

  // ---------- validation ----------
  // Everything that arrives from a file or from local storage passes through here before the
  // page renders any of it.
  const ID = /^[\w-]{1,40}$/;
  function validate(state) {
    const errors = [];
    if (!state || typeof state !== 'object' || !Array.isArray(state.habits)
      || !state.ticks || typeof state.ticks !== 'object' || Array.isArray(state.ticks)) {
      return ['This is not a Habit Tracker file.'];
    }
    if (state.habits.length > MAX_HABITS) errors.push(`That file holds more than ${MAX_HABITS} habits.`);
    const ids = new Set(), names = new Set();
    for (const h of state.habits) {
      if (!h || typeof h !== 'object') { errors.push('A habit could not be read.'); continue; }
      const label = String(h.name || '').trim() ? `"${String(h.name).trim().slice(0, 40)}"` : 'a habit';
      if (!ID.test(String(h.id == null ? '' : h.id))) { errors.push(`${label}: invalid id.`); continue; }
      if (ids.has(h.id)) { errors.push(`${label}: duplicate id.`); continue; }
      ids.add(h.id);
      const name = String(h.name == null ? '' : h.name).trim();
      if (!name) { errors.push('Every habit needs a name.'); continue; }
      if (name.length > 60) errors.push(`${label}: the name is longer than 60 characters.`);
      const key = name.toLowerCase();
      if (names.has(key)) errors.push(`Two habits are both called "${name}".`);
      names.add(key);
      const s = h.schedule;
      if (!s || typeof s !== 'object') errors.push(`${label}: no schedule.`);
      else if (s.type === 'days') {
        if (!Array.isArray(s.days) || !s.days.length || s.days.some(d => !Number.isInteger(d) || d < 0 || d > 6)
          || new Set(s.days).size !== s.days.length) errors.push(`${label}: the chosen days are invalid.`);
      } else if (s.type === 'times') {
        if (!Number.isInteger(s.n) || s.n < 1 || s.n > 7) errors.push(`${label}: a weekly target must be a whole number from 1 to 7.`);
      } else if (s.type !== 'daily') errors.push(`${label}: unknown schedule "${String(s.type).slice(0, 20)}".`);
      if (h.colour != null && !/^#[0-9a-fA-F]{6}$/.test(String(h.colour))) errors.push(`${label}: invalid colour.`);
      if (h.note != null && String(h.note).length > 200) errors.push(`${label}: the note is longer than 200 characters.`);
    }
    for (const id of Object.keys(state.ticks)) {
      if (!ids.has(id)) { errors.push('The file records days for a habit it does not contain.'); continue; }
      const list = state.ticks[id];
      if (!Array.isArray(list)) { errors.push('One history is not a list of dates.'); continue; }
      const seen = new Set();
      for (const d of list) {
        if (typeof d !== 'string' || !fromISO(d)) { errors.push('One history contains something that is not a date.'); break; }
        if (seen.has(d)) { errors.push('One history contains the same day twice.'); break; }
        seen.add(d);
      }
    }
    return errors;
  }

  function uniqueId(used) {
    let id;
    do { id = 'h' + Math.random().toString(36).slice(2, 9); } while (used && used.has(id));
    return id;
  }

  // ---------- files ----------
  function exportJson(state) {
    return JSON.stringify({ v: VERSION, exported: todayISO(), habits: state.habits, ticks: state.ticks }, null, 1) + '\n';
  }
  function importJson(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { throw new Error('That file is not readable JSON.'); }
    if (!obj || typeof obj !== 'object') throw new Error('That file is empty.');
    if (obj.v !== VERSION) throw new Error('That file was not written by this tool, or it came from a newer version of it.');
    const state = { habits: obj.habits, ticks: obj.ticks };
    const errors = validate(state);
    if (errors.length) throw new Error(errors[0]);
    return state;
  }
  // Keep everything already here, add the habits whose id is new, and union the days of the ones
  // that match. An id that collides with a different habit is given a fresh one rather than
  // silently overwriting what is already there.
  function merge(current, incoming) {
    const out = { habits: current.habits.slice(), ticks: {} };
    for (const id of Object.keys(current.ticks)) out.ticks[id] = current.ticks[id].slice();
    const used = new Set(out.habits.map(h => h.id));
    const sorted = list => Array.from(new Set(list || [])).sort();
    for (const h of incoming.habits) {
      const clash = out.habits.find(x => x.id === h.id);
      const sameName = clash && String(clash.name).trim().toLowerCase() === String(h.name).trim().toLowerCase();
      if (sameName) {
        out.ticks[h.id] = sorted((out.ticks[h.id] || []).concat(incoming.ticks[h.id] || []));
        continue;
      }
      const id = clash ? uniqueId(used) : h.id;
      used.add(id);
      out.habits.push(Object.assign({}, h, { id }));
      out.ticks[id] = sorted(incoming.ticks[h.id]);
    }
    return out;
  }
  const csvCell = v => {
    const s = String(v == null ? '' : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  function csv(state) {
    const rows = [['Habit', 'Date', 'Weekday', 'Schedule']];
    for (const h of state.habits) {
      for (const d of (state.ticks[h.id] || []).slice().sort()) {
        rows.push([h.name, d, DAYS[weekdayOf(d)], describeSchedule(h)]);
      }
    }
    return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
  }

  // ---------- sample ----------
  // Deterministic for a given day, so a test can assert on it.
  function sample(today) {
    today = today || todayISO();
    let seed = 20260919;
    const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const habits = [
      { id: 'sample-run', name: 'Run', colour: COLOURS[0], schedule: { type: 'days', days: [1, 3, 6] }, note: 'Five kilometres, easy pace' },
      { id: 'sample-read', name: 'Read 20 pages', colour: COLOURS[3], schedule: { type: 'daily' }, note: '' },
      { id: 'sample-call', name: 'Ring someone', colour: COLOURS[5], schedule: { type: 'times', n: 2 }, note: 'A call, not a text' }
    ];
    const chance = { 'sample-run': 0.86, 'sample-read': 0.8, 'sample-call': 0.32 };
    const ticks = {};
    for (const h of habits) {
      const days = [];
      for (let i = 59; i >= 0; i--) {
        const d = addDays(today, -i);
        if (isDue(h, d) && rnd() < chance[h.id]) days.push(d);
      }
      ticks[h.id] = days;
    }
    // Give the daily habit a visible run, so the sample shows what a streak looks like.
    const read = new Set(ticks['sample-read']);
    for (let i = 1; i <= 6; i++) read.add(addDays(today, -i));
    ticks['sample-read'] = Array.from(read).sort();
    return { habits, ticks };
  }

  const api = {
    VERSION, COLOURS, DAYS, SHORT, MAX_HABITS,
    fromISO, toISO, todayISO, addDays, weekdayOf, weekStart, daysBetween,
    isDue, isWeekly, targetPerWeek, describeSchedule,
    streaks, completionRate, heatmapCells, counts,
    validate, uniqueId, exportJson, importJson, merge, csv, sample
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HabitCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
