/* Car Logbook core: trips, the logbook period, business use, checks, import and export.
   Pure functions, no DOM. UMD so node tests can require() it and the page can use LogbookCore.

   Built around the ATO logbook method as published on ato.gov.au (read 29 September 2026):
   a logbook covers at least 12 continuous weeks; it records the odometer at the start and end
   of the period and the total kilometres; each work journey records its purpose, destination,
   start and end odometer and kilometres; two or more journeys in a row on the same day may be
   recorded as one; entries are made at the end of the journey or as soon as possible after;
   a logbook stays valid for five years. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const PERIOD_DAYS = 84;          // 12 continuous weeks
  const LATE_AFTER_DAYS = 7;       // an entry made more than a week after the trip is flagged
  const MAX_ODO = 9999999;
  const MAX_TRIPS = 20000;

  // ---------- dates (local calendar days as YYYY-MM-DD; never parse a bare ISO date) ----------
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
  // Rounded because a daylight saving change makes a day 23 or 25 hours long.
  const daysBetween = (a, b) => Math.round((fromISO(b) - fromISO(a)) / 86400000);
  // The Australian income year runs 1 July to 30 June. 2026-07-01 is in 2026–27.
  function incomeYearStart(iso) {
    const d = fromISO(iso);
    return d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
  }
  const incomeYearLabel = startYear => startYear + '–' + String((startYear + 1) % 100).padStart(2, '0');
  // Local calendar day of a timestamp (the moment an entry was made).
  function dayOfTimestamp(ts) {
    const d = new Date(ts);
    return isNaN(d) ? null : toISO(d);
  }

  // ---------- trips ----------
  const isNum = v => typeof v === 'number' && isFinite(v);
  const tripKm = t => Math.round((t.endOdo - t.startOdo) * 10) / 10;
  const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

  function tripErrors(t) {
    const e = [];
    if (!t || typeof t !== 'object') return ['That trip is empty.'];
    if (!fromISO(t.date)) e.push('Pick the date of the trip.');
    if (!isNum(t.startOdo) || t.startOdo < 0 || t.startOdo > MAX_ODO) e.push('The start odometer reading needs to be a number.');
    if (!isNum(t.endOdo) || t.endOdo < 0 || t.endOdo > MAX_ODO) e.push('The end odometer reading needs to be a number.');
    if (isNum(t.startOdo) && isNum(t.endOdo) && t.endOdo < t.startOdo) e.push('The end reading is lower than the start reading.');
    if (t.business) {
      if (!clean(t.purpose)) e.push('A work trip needs its purpose, for example "Client meeting".');
      if (!clean(t.destination)) e.push('A work trip needs its destination.');
    }
    return e;
  }

  // An entry made more than a week after the trip. Not an error: the ATO asks for entries at the
  // end of the journey or as soon as possible afterwards, so the report says so honestly.
  function isLate(t) {
    const made = dayOfTimestamp(t.createdAt);
    if (!made || !fromISO(t.date)) return false;
    return daysBetween(t.date, made) > LATE_AFTER_DAYS;
  }

  function sortTrips(trips) {
    return trips.slice().sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.startOdo - b.startOdo);
  }
  const tripsFor = (state, carId) => sortTrips((state.trips || []).filter(t => t.carId === carId));

  // The reading the next trip most likely starts from: the highest reading seen so far.
  function nextStartOdo(car, trips) {
    let top = car && isNum(car.startOdo) ? car.startOdo : 0;
    for (const t of trips) if (isNum(t.endOdo) && t.endOdo > top) top = t.endOdo;
    return top;
  }

  // Consecutive work journeys on the same day, where one ends where the next starts, can be
  // recorded as one journey. Returns a new list; the originals are untouched.
  function mergeSameDay(trips) {
    const out = [];
    for (const t of sortTrips(trips)) {
      const prev = out[out.length - 1];
      if (prev && prev.business && t.business && prev.carId === t.carId && prev.date === t.date
          && prev.endOdo === t.startOdo) {
        out[out.length - 1] = Object.assign({}, prev, {
          endOdo: t.endOdo,
          purpose: prev.purpose === t.purpose ? prev.purpose : prev.purpose + '; ' + t.purpose,
          destination: prev.destination + ' → ' + t.destination,
          createdAt: prev.createdAt > t.createdAt ? prev.createdAt : t.createdAt,
          merged: (prev.merged || 1) + 1
        });
      } else out.push(Object.assign({}, t));
    }
    return out;
  }

  // ---------- the logbook period ----------
  // Returns the numbers the report and the period panel show. The period ends on the car's end
  // date when one is set, otherwise it is still running and "today" is its last day so far.
  function summary(car, trips, today) {
    const end = car.endDate || today;
    const days = fromISO(car.start) && fromISO(end) ? daysBetween(car.start, end) + 1 : 0;
    const inPeriod = trips.filter(t => t.date >= car.start && t.date <= end);
    const lastReading = isNum(car.endOdo) ? car.endOdo : nextStartOdo(car, inPeriod);
    const totalKm = Math.max(0, Math.round((lastReading - car.startOdo) * 10) / 10);
    const businessKm = Math.round(inPeriod.filter(t => t.business).reduce((s, t) => s + tripKm(t), 0) * 10) / 10;
    const pct = totalKm > 0 ? Math.round(Math.min(businessKm, totalKm) / totalKm * 1000) / 10 : null;
    return {
      start: car.start, end, running: !car.endDate, days: Math.max(0, days),
      weeks: Math.floor(Math.max(0, days) / 7), complete: days >= PERIOD_DAYS,
      daysLeft: Math.max(0, PERIOD_DAYS - days),
      startOdo: car.startOdo, endOdo: lastReading, totalKm, businessKm,
      privateKm: Math.max(0, Math.round((totalKm - businessKm) * 10) / 10),
      businessPct: pct, workTrips: inPeriod.filter(t => t.business).length, trips: inPeriod.length,
      late: inPeriod.filter(isLate).length
    };
  }

  // Things worth fixing before the report goes to a tax agent. Gaps between trips are not listed:
  // unlogged kilometres are private driving, which the logbook does not need journey by journey.
  function checks(car, trips, today) {
    const out = [];
    const s = summary(car, trips, today);
    const sorted = trips.slice().sort((a, b) => a.startOdo - b.startOdo || (a.date < b.date ? -1 : 1));
    for (let i = 1; i < sorted.length; i++) {
      const a = sorted[i - 1], b = sorted[i];
      if (b.startOdo < a.endOdo) out.push({ kind: 'overlap', ids: [a.id, b.id],
        text: `Two trips overlap on the odometer: ${a.date} ends at ${a.endOdo} but ${b.date} starts at ${b.startOdo}.` });
    }
    for (const t of trips) {
      if (t.startOdo < car.startOdo) out.push({ kind: 'before-start', ids: [t.id],
        text: `A trip on ${t.date} starts below the logbook's opening reading of ${car.startOdo}.` });
      if (t.date < car.start || (car.endDate && t.date > car.endDate)) out.push({ kind: 'outside', ids: [t.id],
        text: `A trip on ${t.date} is outside the logbook period, so it is not counted.` });
    }
    if (isNum(car.endOdo) && trips.some(t => t.endOdo > car.endOdo)) out.push({ kind: 'end-odo',
      text: `A trip ends above the closing reading of ${car.endOdo}. Check the closing reading.` });
    if (car.endDate && s.days < PERIOD_DAYS) out.push({ kind: 'short',
      text: `The period is ${s.days} days. The ATO asks for at least 12 continuous weeks (84 days).` });
    if (s.late) out.push({ kind: 'late',
      text: `${s.late} trip${s.late === 1 ? ' was' : 's were'} entered more than a week after the day. The ATO expects each entry at the end of the journey or as soon as possible afterwards.` });
    return out;
  }

  // A logbook is valid for five years: the income year it was kept in and the four after it.
  function validUntil(car) {
    const y = incomeYearStart(car.start) + 4;
    return { startYear: y, label: incomeYearLabel(y), ends: (y + 1) + '-06-30' };
  }

  // ---------- validation, import and export ----------
  const idOk = s => typeof s === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(s);
  const textOk = (s, max) => typeof s === 'string' && s.length <= max;

  function validate(state) {
    const e = [];
    if (!state || typeof state !== 'object') return ['The data is not a logbook.'];
    if (!Array.isArray(state.cars) || !Array.isArray(state.trips) || !Array.isArray(state.favourites || []))
      return ['The data is missing its cars or trips.'];
    if (state.cars.length > 50) e.push('More than 50 cars.');
    if (state.trips.length > MAX_TRIPS) e.push('More trips than a logbook would hold.');
    const ids = new Set();
    for (const c of state.cars) {
      if (!c || !idOk(c.id) || ids.has(c.id)) { e.push('A car has a missing or repeated id.'); break; }
      ids.add(c.id);
      if (!textOk(c.name, 80) || !textOk(c.rego || '', 20) || !textOk(c.model || '', 80)) e.push('A car has a name that is too long.');
      if (!fromISO(c.start)) e.push(`The car "${String(c.name).slice(0, 30)}" has no valid start date.`);
      if (c.endDate != null && (!fromISO(c.endDate) || c.endDate < c.start)) e.push('A logbook period ends before it starts.');
      if (!isNum(c.startOdo) || c.startOdo < 0 || c.startOdo > MAX_ODO) e.push('A car has an invalid opening odometer reading.');
      if (c.endOdo != null && (!isNum(c.endOdo) || c.endOdo < c.startOdo)) e.push('A car has a closing reading below its opening reading.');
      if (!Array.isArray(c.years || [])) e.push('A car has unreadable yearly readings.');
      for (const y of c.years || []) {
        if (!y || !Number.isInteger(y.startYear) || y.startYear < 1990 || y.startYear > 2200) { e.push('A yearly reading has an invalid income year.'); break; }
        if ((y.open != null && !isNum(y.open)) || (y.close != null && !isNum(y.close))) { e.push('A yearly reading is not a number.'); break; }
      }
    }
    const tids = new Set();
    for (const t of state.trips) {
      if (!t || !idOk(t.id) || tids.has(t.id)) { e.push('A trip has a missing or repeated id.'); break; }
      tids.add(t.id);
      if (!ids.has(t.carId)) { e.push('A trip belongs to a car that is not in the file.'); break; }
      if (typeof t.business !== 'boolean') { e.push('A trip is not marked as work or private.'); break; }
      if (!textOk(t.purpose || '', 200) || !textOk(t.destination || '', 200)) { e.push('A trip note is too long.'); break; }
      if (typeof t.createdAt !== 'string' || isNaN(new Date(t.createdAt))) { e.push('A trip has no record of when it was entered.'); break; }
      const te = tripErrors(t);
      if (te.length) { e.push(`The trip on ${String(t.date).slice(0, 10)}: ${te[0]}`); break; }
    }
    for (const f of state.favourites || []) {
      if (!f || !idOk(f.id) || !textOk(f.label, 60) || !textOk(f.purpose || '', 200) || !textOk(f.destination || '', 200)
          || (f.km != null && (!isNum(f.km) || f.km < 0 || f.km > 5000))) { e.push('A saved trip is not readable.'); break; }
    }
    if (state.activeCar != null && !ids.has(state.activeCar)) e.push('The selected car is not in the file.');
    return e;
  }

  function exportJson(state) {
    return JSON.stringify({ app: 'plentyoftools car-logbook', v: VERSION, exported: new Date().toISOString(),
      cars: state.cars, trips: state.trips, favourites: state.favourites || [], activeCar: state.activeCar || null }, null, 1);
  }
  function importJson(text) {
    let o;
    try { o = JSON.parse(text); } catch (err) { throw new Error('it is not a logbook backup file.'); }
    if (!o || o.app !== 'plentyoftools car-logbook') throw new Error('it is not a logbook backup file.');
    if (o.v > VERSION) throw new Error('it was saved by a newer version of this page. Reload and try again.');
    const state = { cars: o.cars, trips: o.trips, favourites: o.favourites || [], activeCar: o.activeCar || (o.cars && o.cars[0] && o.cars[0].id) || null };
    const e = validate(state);
    if (e.length) throw new Error(e[0]);
    return state;
  }

  const csvCell = v => {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // keep a spreadsheet from running it as a formula
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  function csv(car, trips) {
    const rows = [['Date', 'Start odometer', 'End odometer', 'Kilometres', 'Type', 'Purpose', 'Destination', 'Entered', 'Entered more than a week later']];
    for (const t of sortTrips(trips)) rows.push([t.date, t.startOdo, t.endOdo, tripKm(t), t.business ? 'Work' : 'Private',
      t.purpose || '', t.destination || '', t.createdAt, isLate(t) ? 'yes' : '']);
    return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
  }

  // A realistic 12 week example ending today: a tradie's work runs on weekdays, some private
  // driving between them, entered on the day.
  function sample(today) {
    const start = addDays(today, -(PERIOD_DAYS - 1));
    const car = { id: 'c-sample', name: 'Work ute', rego: 'ABC123', model: 'Toyota Hilux', start, startOdo: 48210,
      endDate: null, endOdo: null, years: [] };
    const places = [['Site visit and quote', 'Parramatta'], ['Pick up materials', 'Bunnings Alexandria'],
      ['Job: bathroom renovation', 'Marrickville'], ['Client meeting', 'Chatswood'], ['Job: deck repair', 'Cronulla']];
    const trips = [];
    let odo = 48210, n = 0;
    for (let i = 0; i < PERIOD_DAYS; i++) {
      const date = addDays(start, i);
      const wd = fromISO(date).getDay();
      if (wd === 0) { odo += 35; continue; }                       // unlogged private driving
      if (wd === 6) { const km = 42; trips.push(mk(date, odo, odo + km, false, 'Weekend', '', n++)); odo += km; continue; }
      const p = places[(i * 7) % places.length];
      const km = 18 + ((i * 13) % 37);
      trips.push(mk(date, odo, odo + km, true, p[0], p[1], n++));
      odo += km + 6;                                                 // a few private km on the way home
    }
    function mk(date, a, b, business, purpose, destination, k) {
      return { id: 't-s' + k, carId: car.id, date, startOdo: a, endOdo: b, business, purpose, destination,
        createdAt: new Date(fromISO(date).getTime() + 17.5 * 3600000).toISOString() };
    }
    const favourites = [{ id: 'f-s1', label: 'Bunnings run', purpose: 'Pick up materials', destination: 'Bunnings Alexandria', km: 24 }];
    return { cars: [car], trips, favourites, activeCar: car.id };
  }

  const api = { VERSION, PERIOD_DAYS, LATE_AFTER_DAYS, fromISO, toISO, todayISO, addDays, daysBetween,
    incomeYearStart, incomeYearLabel, dayOfTimestamp, tripKm, tripErrors, isLate, sortTrips, tripsFor,
    nextStartOdo, mergeSameDay, summary, checks, validUntil, validate, exportJson, importJson, csv, sample };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LogbookCore = api;
})(typeof self !== 'undefined' ? self : this);
