/* Hours Log core: entries, durations, income years, the ATO fixed rate, timesheets, import and
   export. Pure functions, no DOM. UMD so node tests can require() it and the page can use HoursCore.

   Built around the ATO working from home fixed rate method as published on ato.gov.au (read
   29 September 2026): 52 cents per work hour for 2020–21 and 2021–22, 67 cents for 2022–23 and
   2023–24, 70 cents for 2024–25 and 2025–26. The deduction is total hours worked from home in the
   income year times the rate, with the cents disregarded, not rounded. From 1 March 2023 the
   record must cover the whole year and be kept at the time; estimates and a four week
   representative diary are not accepted. No rate is published yet for 2026–27, so the latest
   rate is used and marked provisional until the ATO confirms it. */
(function (root) {
  'use strict';
  const VERSION = 1;
  // income year start → cents per hour, as published. Change here and nowhere else.
  const RATES = { 2020: 52, 2021: 52, 2022: 67, 2023: 67, 2024: 70, 2025: 70 };
  const LATEST = Math.max(...Object.keys(RATES).map(Number));
  const PLACES = { home: 'Home', work: 'Workplace', other: 'Other' };
  const MAX_ENTRY_MIN = 24 * 60;
  const MAX_ENTRIES = 50000;

  // ---------- dates and times ----------
  function fromISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s == null ? '' : s));
    if (!m) return null;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3] ? d : null;
  }
  const pad = n => String(n).padStart(2, '0');
  const toISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const todayISO = () => toISO(new Date());
  function addDays(iso, n) { const d = fromISO(iso); if (!d) return null; d.setDate(d.getDate() + n); return toISO(d); }
  const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
  function weekStart(iso) { const d = fromISO(iso); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return toISO(d); }
  function parseTime(s) {
    const m = /^(\d{2}):(\d{2})$/.exec(String(s == null ? '' : s));
    return m && +m[1] < 24 && +m[2] < 60 ? { h: +m[1], m: +m[2] } : null;
  }
  const hhmm = d => pad(d.getHours()) + ':' + pad(d.getMinutes());
  function incomeYearStart(iso) { const d = fromISO(iso); return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1; }
  const incomeYearLabel = y => y + '–' + String((y + 1) % 100).padStart(2, '0');
  const incomeYearRange = y => ({ from: y + '-07-01', to: (y + 1) + '-06-30' });

  // ---------- entries ----------
  // An entry is a date, a start and a finish on the local clock, and unpaid break minutes. A
  // finish at or before the start means the shift ran past midnight. Minutes are measured between
  // real moments, so a shift over a daylight saving change is an hour shorter or longer.
  function span(e) {
    const d = fromISO(e.date), a = parseTime(e.start), b = parseTime(e.end);
    if (!d || !a || !b) return null;
    const from = new Date(d.getFullYear(), d.getMonth(), d.getDate(), a.h, a.m);
    const to = new Date(d.getFullYear(), d.getMonth(), d.getDate(), b.h, b.m);
    const overnight = b.h * 60 + b.m <= a.h * 60 + a.m;
    if (overnight) to.setDate(to.getDate() + 1);
    return { from, to, overnight, minutes: Math.round((to - from) / 60000) };
  }
  function minutes(e) {
    const s = span(e);
    return s ? Math.max(0, s.minutes - (e.breakMin || 0)) : 0;
  }
  function entryErrors(e) {
    const out = [];
    if (!e || typeof e !== 'object') return ['That entry is empty.'];
    if (!fromISO(e.date)) out.push('Pick the date.');
    if (!parseTime(e.start)) out.push('Enter a start time.');
    if (!parseTime(e.end)) out.push('Enter a finish time.');
    if (!Number.isInteger(e.breakMin) || e.breakMin < 0) out.push('Breaks are whole minutes, zero or more.');
    if (!PLACES[e.place]) out.push('Choose where you worked.');
    const s = span(e);
    if (s && out.length === 0) {
      if (s.minutes > MAX_ENTRY_MIN) out.push('An entry cannot be longer than 24 hours.');
      else if (e.breakMin >= s.minutes) out.push('The break is as long as the whole shift.');
    }
    return out;
  }
  // Only a record kept at the time is acceptable, so an entry made after the day it describes
  // is marked. An overnight shift is naturally entered the next morning, so it gets one day.
  function isLate(e) {
    const made = new Date(e.createdAt), s = span(e);
    if (isNaN(made) || !s) return false;
    return daysBetween(e.date, toISO(made)) > (s.overnight ? 1 : 0);
  }

  // ---------- the fixed rate ----------
  function rateFor(startYear) {
    if (RATES[startYear] != null) return { cents: RATES[startYear], provisional: false };
    if (startYear > LATEST) return { cents: RATES[LATEST], provisional: true };
    return null;                         // before 2020–21 the fixed rate method did not exist in this form
  }
  // Hours times the rate with the cents disregarded, not rounded. Worked in whole minutes and
  // cents so no floating point error can tip a total over a dollar boundary.
  function deduction(totalMinutes, cents) {
    const hundredths = totalMinutes * cents;            // cents × minutes
    return Math.floor(hundredths / 6000);               // ÷ 60 minutes ÷ 100 cents
  }

  function inRange(entries, from, to) { return entries.filter(e => e.date >= from && e.date <= to); }
  function yearSummary(entries, startYear) {
    const { from, to } = incomeYearRange(startYear);
    const list = inRange(entries, from, to);
    const sum = f => list.filter(f).reduce((s, e) => s + minutes(e), 0);
    const home = sum(e => e.place === 'home');
    const rate = rateFor(startYear);
    const months = [];
    for (let i = 0; i < 12; i++) {
      const m = (6 + i) % 12, y = m >= 6 ? startYear : startYear + 1;
      const key = y + '-' + pad(m + 1);
      const inMonth = list.filter(e => e.date.slice(0, 7) === key);
      months.push({ key, home: inMonth.filter(e => e.place === 'home').reduce((s, e) => s + minutes(e), 0),
        other: inMonth.filter(e => e.place !== 'home').reduce((s, e) => s + minutes(e), 0) });
    }
    return { startYear, label: incomeYearLabel(startYear), from, to, entries: list.length,
      homeMinutes: home, allMinutes: sum(() => true), rate,
      deduction: rate ? deduction(home, rate.cents) : null,
      late: list.filter(isLate).length, lateHome: list.filter(e => e.place === 'home' && isLate(e)).length, months };
  }

  function weekSummary(entries, mondayISO, rates) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(mondayISO, i);
      const list = entries.filter(e => e.date === date);
      days.push({ date, minutes: list.reduce((s, e) => s + minutes(e), 0), home: list.filter(e => e.place === 'home').reduce((s, e) => s + minutes(e), 0) });
    }
    const list = inRange(entries, mondayISO, addDays(mondayISO, 6));
    return { from: mondayISO, to: addDays(mondayISO, 6), days, clients: clientTotals(list, rates),
      minutes: days.reduce((s, d) => s + d.minutes, 0), entries: sortEntries(list) };
  }
  // Per client (or employer) totals, with an amount where an hourly rate is set.
  function clientTotals(list, rates) {
    const by = new Map();
    for (const e of list) {
      const k = (e.client || '').trim() || '(no client)';
      by.set(k, (by.get(k) || 0) + minutes(e));
    }
    return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([client, mins]) => {
      const rate = rates && isFinite(rates[client]) && rates[client] > 0 ? rates[client] : null;
      return { client, minutes: mins, rate, amount: rate == null ? null : Math.round(mins * rate / 60 * 100) / 100 };
    });
  }

  // ---------- the timer ----------
  function stopTimer(timer, now) {
    const from = new Date(timer.startedAt), to = new Date(now);
    const mins = Math.round((to - from) / 60000);
    if (isNaN(mins) || mins < 1) return { error: 'The timer ran for less than a minute, so nothing was recorded.' };
    if (mins > MAX_ENTRY_MIN) return { error: 'The timer ran for more than 24 hours. Add the real hours by hand instead.' };
    return { entry: { date: toISO(from), start: hhmm(from), end: hhmm(to), breakMin: 0, place: timer.place || 'home',
      client: timer.client || '', note: timer.note || '', createdAt: to.toISOString(), timer: true } };
  }

  const sortEntries = list => list.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  const fmtHours = mins => (Math.round(mins / 60 * 100) / 100).toFixed(2);

  // ---------- validation, import and export ----------
  const idOk = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(s);
  const textOk = (s, max) => typeof s === 'string' && s.length <= max;
  function validate(state) {
    if (!state || typeof state !== 'object' || !Array.isArray(state.entries)) return ['The data is not an hours log.'];
    const e = [];
    if (state.entries.length > MAX_ENTRIES) e.push('More entries than an hours log would hold.');
    const ids = new Set();
    for (const x of state.entries) {
      if (!x || !idOk(x.id) || ids.has(x.id)) { e.push('An entry has a missing or repeated id.'); break; }
      ids.add(x.id);
      if (!textOk(x.client || '', 80) || !textOk(x.note || '', 200)) { e.push('An entry note is too long.'); break; }
      if (typeof x.createdAt !== 'string' || isNaN(new Date(x.createdAt))) { e.push('An entry has no record of when it was made.'); break; }
      const ee = entryErrors(x);
      if (ee.length) { e.push(`The entry on ${String(x.date).slice(0, 10)}: ${ee[0]}`); break; }
    }
    const rates = state.rates || {};
    if (typeof rates !== 'object' || Array.isArray(rates)) e.push('The client rates are unreadable.');
    else for (const [k, v] of Object.entries(rates)) {
      if (k.length > 80 || !(typeof v === 'number' && isFinite(v) && v >= 0 && v < 100000)) { e.push('A client rate is not a number.'); break; }
    }
    const t = state.timer;
    if (t != null && (typeof t !== 'object' || isNaN(new Date(t.startedAt)) || !PLACES[t.place] || !textOk(t.client || '', 80) || !textOk(t.note || '', 200)))
      e.push('The running timer is unreadable.');
    return e;
  }
  function exportJson(state) {
    return JSON.stringify({ app: 'plentyoftools hours-log', v: VERSION, exported: new Date().toISOString(),
      entries: state.entries, rates: state.rates || {}, timer: state.timer || null }, null, 1);
  }
  function importJson(text) {
    let o;
    try { o = JSON.parse(text); } catch (err) { throw new Error('it is not an hours log backup file.'); }
    if (!o || o.app !== 'plentyoftools hours-log') throw new Error('it is not an hours log backup file.');
    if (o.v > VERSION) throw new Error('it was saved by a newer version of this page. Reload and try again.');
    const state = { entries: o.entries, rates: o.rates || {}, timer: o.timer || null };
    const e = validate(state);
    if (e.length) throw new Error(e[0]);
    return state;
  }
  const csvCell = v => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const toCsv = rows => '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  function csv(entries) {
    const rows = [['Date', 'Start', 'Finish', 'Break (min)', 'Hours', 'Place', 'Client or employer', 'Note', 'Entered', 'Entered after the day']];
    for (const e of sortEntries(entries)) rows.push([e.date, e.start, e.end, e.breakMin, fmtHours(minutes(e)), PLACES[e.place],
      e.client || '', e.note || '', e.createdAt, isLate(e) ? 'yes' : '']);
    return toCsv(rows);
  }
  // Invoice lines, one per client, for pasting into an invoice: description, hours, hourly rate.
  function invoiceLines(week) {
    const rows = [['Description', 'Quantity', 'Unit price']];
    for (const c of week.clients) rows.push([`${c.client === '(no client)' ? 'Work' : c.client}, ${week.from} to ${week.to}`,
      fmtHours(c.minutes), c.rate == null ? '' : c.rate.toFixed(2)]);
    return toCsv(rows);
  }

  // Eight weeks ending today: home on Monday, Wednesday and Friday, the workplace on Tuesday and
  // Thursday, all entered on the day.
  function sample(today) {
    const entries = [];
    const first = addDays(weekStart(today), -49);
    let n = 0;
    for (let i = 0; i < 56; i++) {
      const date = addDays(first, i);
      if (date > today) break;
      const wd = fromISO(date).getDay();
      if (wd === 0 || wd === 6) continue;
      const home = wd === 1 || wd === 3 || wd === 5;
      const client = i % 3 === 0 ? 'Harbour Dental' : 'Northside Legal';
      entries.push({ id: 'e-s' + (n++), date, start: home ? '08:30' : '09:00', end: home ? '17:00' : '17:30', breakMin: home ? 30 : 45,
        place: home ? 'home' : 'work', client, note: '', createdAt: new Date(fromISO(date).getTime() + 17.25 * 3600000).toISOString() });
    }
    return { entries, rates: { 'Harbour Dental': 95, 'Northside Legal': 110 }, timer: null };
  }

  const api = { VERSION, RATES, PLACES, fromISO, toISO, todayISO, addDays, daysBetween, weekStart, parseTime,
    incomeYearStart, incomeYearLabel, incomeYearRange, span, minutes, entryErrors, isLate, rateFor, deduction,
    yearSummary, weekSummary, clientTotals, stopTimer, sortEntries, fmtHours, validate, exportJson, importJson,
    csv, invoiceLines, sample };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HoursCore = api;
})(typeof self !== 'undefined' ? self : this);
