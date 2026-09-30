/* Car Logbook — UI over LogbookCore. Everything lives in this browser under pot:car-logbook:v1.
   Nothing is uploaded. All data reaching the DOM goes through textContent, never innerHTML. */
(() => {
'use strict';
const C = window.LogbookCore;
const $ = id => document.getElementById(id);
const KEY = 'pot:car-logbook:v1';
const els = {};
for (const id of ['summary', 'sample', 'print', 'csv', 'export', 'import', 'clear', 'toast', 'car-pick-row', 'car-pick', 'car-new',
  'car-form', 'car-name', 'car-rego', 'car-model', 'car-start', 'car-startodo', 'close', 'car-end', 'car-endodo', 'car-error', 'car-save',
  'trip-form', 'fav-row', 'fav', 'date', 'start', 'end', 'km', 'work-fields', 'purpose', 'dest', 'purposes', 'dests', 'savefav',
  'savefav-row', 'trip-error', 'trip-save', 'trip-cancel', 'period-empty', 'period-body', 'progress', 'progress-bar', 'progress-text',
  'pct', 'bkm', 'tkm', 'odo', 'checks', 'count', 'trips-empty', 'wrap', 'rows', 'merge', 'valid', 'year-form', 'year', 'year-open',
  'year-close', 'yearlist', 'print-car']) els[id] = $('lb-' + id);
if (!C) { els.toast.textContent = 'The page did not load completely. Reload and try again.'; return; }

let S = { cars: [], trips: [], favourites: [], activeCar: null };
let editingTrip = null, addingCar = false, toastTimer = null;
const today = () => C.todayISO();
const car = () => S.cars.find(c => c.id === S.activeCar) || null;
const trips = () => car() ? C.tripsFor(S, car().id) : [];
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const km = n => (Math.round(n * 10) / 10).toLocaleString('en-AU', { maximumFractionDigits: 1 });
const num = el => { const v = el.value.trim(); return v === '' ? null : Number(v); };
function fmtDate(iso) {
  const d = C.fromISO(iso);
  return d ? d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : iso;
}
function fmtStamp(ts) {
  const d = new Date(ts);
  return isNaN(d) ? '' : d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
function toast(msg) {
  els.toast.textContent = msg || '';
  clearTimeout(toastTimer);
  if (msg) toastTimer = setTimeout(() => { els.toast.textContent = ''; }, 5000);
}
function showError(el, msg) { el.textContent = msg || ''; el.hidden = !msg; }

// ---------- persistence ----------
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    const next = { cars: o.cars, trips: o.trips, favourites: o.favourites || [], activeCar: o.activeCar || null };
    const errors = C.validate(next);
    if (errors.length) return toast('The saved logbook could not be read, so it was left alone: ' + errors[0]);
    S = next;
    if (!car() && S.cars.length) S.activeCar = S.cars[0].id;
  } catch (e) { /* private mode, or nothing saved */ }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: C.VERSION, cars: S.cars, trips: S.trips, favourites: S.favourites, activeCar: S.activeCar })); return true; }
  catch (e) { toast('This browser would not save the change. Private windows and full storage both do that; use Backup file to keep your trips.'); return false; }
}
function commit() { persist(); render(); }

// ---------- car and period ----------
function fillCarForm() {
  const c = addingCar ? null : car();
  els['car-name'].value = c ? c.name : '';
  els['car-rego'].value = c ? c.rego || '' : '';
  els['car-model'].value = c ? c.model || '' : '';
  els['car-start'].value = c ? c.start : today();
  els['car-startodo'].value = c ? c.startOdo : '';
  els['car-end'].value = c && c.endDate ? c.endDate : '';
  els['car-endodo'].value = c && c.endOdo != null ? c.endOdo : '';
  els.close.hidden = !c;
  els.close.open = !!(c && c.endDate);
  els['car-save'].textContent = c ? 'Save changes' : 'Start logbook';
  showError(els['car-error'], '');
}
els['car-form'].addEventListener('submit', ev => {
  ev.preventDefault();
  const c = addingCar ? null : car();
  const next = Object.assign({}, c || { id: uid('c'), years: [] }, {
    name: els['car-name'].value.trim() || 'My car', rego: els['car-rego'].value.trim(), model: els['car-model'].value.trim(),
    start: els['car-start'].value, startOdo: num(els['car-startodo']),
    endDate: els['car-end'].value || null, endOdo: num(els['car-endodo'])
  });
  if (!C.fromISO(next.start)) return showError(els['car-error'], 'Pick the day the logbook starts.');
  if (next.startOdo == null || !(next.startOdo >= 0)) return showError(els['car-error'], 'Enter the odometer reading on that day.');
  if (next.endDate && next.endDate < next.start) return showError(els['car-error'], 'The end date is before the start date.');
  if (next.endDate && next.endOdo == null) return showError(els['car-error'], 'Enter the odometer reading on the last day as well.');
  if (!next.endDate && next.endOdo != null) return showError(els['car-error'], 'Pick the day the logbook ends as well, or clear the closing reading.');
  if (next.endOdo != null && next.endOdo < next.startOdo) return showError(els['car-error'], 'The closing reading is below the opening reading.');
  const trial = Object.assign({}, S, { cars: c ? S.cars.map(x => x.id === c.id ? next : x) : S.cars.concat(next), activeCar: next.id });
  const errors = C.validate(trial);
  if (errors.length) return showError(els['car-error'], errors[0]);
  S = trial; addingCar = false;
  commit();
  toast(c ? 'Saved.' : 'Logbook started. Add each trip when you finish it.');
});
els['car-pick'].addEventListener('change', () => { S.activeCar = els['car-pick'].value; addingCar = false; editingTrip = null; commit(); });
els['car-new'].addEventListener('click', () => { addingCar = true; fillCarForm(); els['car-name'].focus(); });

// ---------- trips ----------
function tripType() { return document.querySelector('input[name="lb-type"]:checked').value === 'work'; }
function setType(work) {
  document.querySelector(`input[name="lb-type"][value="${work ? 'work' : 'private'}"]`).checked = true;
  els['work-fields'].hidden = !work;
  els['savefav-row'].hidden = !work;
}
document.querySelectorAll('input[name="lb-type"]').forEach(r => r.addEventListener('change', () => setType(tripType())));
function showKm() {
  const a = num(els.start), b = num(els.end);
  els.km.textContent = a != null && b != null && b >= a ? km(b - a) + ' km' : '';
}
els.start.addEventListener('input', showKm);
els.end.addEventListener('input', showKm);
function resetTrip() {
  editingTrip = null;
  const c = car();
  els.date.value = today();
  els.start.value = c ? C.nextStartOdo(c, trips()) : '';
  els.end.value = '';
  els.purpose.value = ''; els.dest.value = ''; els.savefav.checked = false; els.fav.value = '';
  setType(true); showKm();
  els['trip-save'].textContent = 'Add trip';
  els['trip-cancel'].hidden = true;
  showError(els['trip-error'], '');
}
els['trip-cancel'].addEventListener('click', resetTrip);
els.fav.addEventListener('change', () => {
  const f = S.favourites.find(x => x.id === els.fav.value);
  if (!f) return;
  setType(true);
  els.purpose.value = f.purpose; els.dest.value = f.destination;
  const a = num(els.start);
  if (a != null && f.km) els.end.value = Math.round((a + f.km) * 10) / 10;
  showKm();
  els.end.focus();
});
els['trip-form'].addEventListener('submit', ev => {
  ev.preventDefault();
  const c = car();
  if (!c) return showError(els['trip-error'], 'Start the logbook first: add your car and its odometer reading.');
  const work = tripType();
  const t = Object.assign({}, editingTrip || { id: uid('t'), carId: c.id, createdAt: new Date().toISOString() }, {
    date: els.date.value, startOdo: num(els.start), endOdo: num(els.end), business: work,
    purpose: work ? els.purpose.value.replace(/\s+/g, ' ').trim() : '', destination: work ? els.dest.value.replace(/\s+/g, ' ').trim() : ''
  });
  if (t.startOdo == null) t.startOdo = NaN;
  if (t.endOdo == null) t.endOdo = NaN;
  const errs = C.tripErrors(t);
  if (errs.length) return showError(els['trip-error'], errs[0]);
  if (C.tripKm(t) > 2000 && !confirm(`That trip is ${km(C.tripKm(t))} km. Keep it?`)) return;
  const nextTrips = editingTrip ? S.trips.map(x => x.id === t.id ? t : x) : S.trips.concat(t);
  let favs = S.favourites;
  if (work && els.savefav.checked && !editingTrip) {
    const label = (t.destination + (t.purpose ? ', ' + t.purpose : '')).slice(0, 60);
    if (!favs.some(f => f.label === label)) favs = favs.concat({ id: uid('f'), label, purpose: t.purpose, destination: t.destination, km: C.tripKm(t) });
  }
  const trial = Object.assign({}, S, { trips: nextTrips, favourites: favs });
  const errors = C.validate(trial);
  if (errors.length) return showError(els['trip-error'], errors[0]);
  const wasEditing = !!editingTrip;
  S = trial;
  commit(); resetTrip();
  toast(wasEditing ? 'Trip updated. The time it was first entered is kept.' : `Added ${km(C.tripKm(t))} km on ${fmtDate(t.date)}.`);
});
function editTrip(t) {
  editingTrip = t;
  els.date.value = t.date; els.start.value = t.startOdo; els.end.value = t.endOdo;
  setType(t.business);
  els.purpose.value = t.purpose || ''; els.dest.value = t.destination || '';
  els['trip-save'].textContent = 'Save trip';
  els['trip-cancel'].hidden = false;
  showKm(); showError(els['trip-error'], '');
  els.date.focus();
}
function deleteTrip(t) {
  if (!confirm(`Delete the trip on ${fmtDate(t.date)} (${km(C.tripKm(t))} km)?`)) return;
  S.trips = S.trips.filter(x => x.id !== t.id);
  if (editingTrip && editingTrip.id === t.id) resetTrip();
  commit(); toast('Trip deleted.');
}
els.merge.addEventListener('click', () => {
  const mine = trips(), merged = C.mergeSameDay(mine);
  const groups = merged.filter(t => t.merged && t.merged > 1);
  if (!groups.length) return toast('There are no same day journeys that run straight into each other.');
  const before = groups.reduce((s, t) => s + t.merged, 0);
  if (!confirm(`Combine ${before} journeys into ${groups.length}? The ATO allows two or more journeys in a row on the same day to be one entry. The work kilometres stay the same.`)) return;
  S.trips = S.trips.filter(t => t.carId !== car().id).concat(merged);
  commit(); toast('Combined. Each combined entry lists every destination in order.');
});

// ---------- later years ----------
els['year-form'].addEventListener('submit', ev => {
  ev.preventDefault();
  const c = car();
  if (!c) return;
  const y = Number(els.year.value), open = num(els['year-open']), close = num(els['year-close']);
  if (open == null && close == null) return toast('Enter at least one reading.');
  if (open != null && close != null && close < open) return toast('The 30 June reading is below the 1 July reading.');
  const years = (c.years || []).filter(r => r.startYear !== y).concat({ startYear: y, open, close }).sort((a, b) => a.startYear - b.startYear);
  const trial = Object.assign({}, S, { cars: S.cars.map(x => x.id === c.id ? Object.assign({}, c, { years }) : x) });
  const errors = C.validate(trial);
  if (errors.length) return toast(errors[0]);
  S = trial; els['year-open'].value = ''; els['year-close'].value = '';
  commit(); toast('Saved the readings for ' + C.incomeYearLabel(y) + '.');
});

// ---------- render ----------
function render() {
  const c = car();
  els['car-pick-row'].hidden = S.cars.length < 1 || addingCar;
  els['car-pick'].replaceChildren(...S.cars.map(x => new Option(x.name + (x.rego ? ' · ' + x.rego : ''), x.id, false, x.id === S.activeCar)));
  fillCarForm();
  els['fav-row'].hidden = !S.favourites.length;
  els.fav.replaceChildren(new Option('Choose a saved trip', ''), ...S.favourites.map(f => new Option(f.label, f.id)));
  const mine = trips();
  const uniq = key => [...new Set(mine.map(t => t[key]).filter(Boolean))].slice(-40);
  els.purposes.replaceChildren(...uniq('purpose').map(v => new Option(v)));
  els.dests.replaceChildren(...uniq('destination').map(v => new Option(v)));
  if (!editingTrip) els.start.value = c ? C.nextStartOdo(c, mine) : '';
  renderPeriod(c, mine); renderTrips(c, mine); renderYears(c);
}
function renderPeriod(c, mine) {
  els['period-empty'].hidden = !!c;
  els['period-body'].hidden = !c;
  if (!c) { els.summary.textContent = 'No logbook yet. Add your car and today\'s odometer reading to start.'; els['print-car'].textContent = ''; return; }
  const s = C.summary(c, mine, today());
  const shown = Math.min(s.days, C.PERIOD_DAYS);
  els.progress.setAttribute('aria-valuenow', String(shown));
  els['progress-bar'].style.width = (shown / C.PERIOD_DAYS * 100) + '%';
  els.progress.classList.toggle('done', s.complete);
  els['progress-text'].textContent = s.complete
    ? `12 continuous weeks reached: ${s.days} days from ${fmtDate(s.start)}${s.running ? ' so far' : ' to ' + fmtDate(s.end)}.`
    : `Day ${s.days} of 84. ${s.daysLeft} day${s.daysLeft === 1 ? '' : 's'} to go until 12 continuous weeks.`;
  els.pct.textContent = s.businessPct == null ? '–' : s.businessPct.toLocaleString('en-AU') + '%';
  els.bkm.textContent = km(s.businessKm);
  els.tkm.textContent = km(s.totalKm);
  els.odo.textContent = `${km(s.startOdo)} to ${km(s.endOdo)}`;
  els.summary.textContent = `${c.name}: ${s.workTrips} work trip${s.workTrips === 1 ? '' : 's'}, business use `
    + (s.businessPct == null ? 'not known yet' : s.businessPct + '%') + (s.complete ? ', 12 weeks done.' : `, day ${s.days} of 84.`);
  els['print-car'].textContent = [c.name, c.rego, c.model].filter(Boolean).join(' · ')
    + ` — logbook ${fmtDate(s.start)} to ${fmtDate(s.end)}${s.running ? ' (running)' : ''}; odometer ${km(s.startOdo)} to ${km(s.endOdo)}; `
    + `${km(s.totalKm)} km in total, ${km(s.businessKm)} km for work; business use ${s.businessPct == null ? 'not known' : s.businessPct + '%'}. `
    + `Printed ${fmtDate(today())}.`;
  const list = C.checks(c, mine, today());
  els.checks.replaceChildren(...list.map(x => { const li = document.createElement('li'); li.textContent = x.text; return li; }));
}
function renderTrips(c, mine) {
  els.count.textContent = String(mine.length);
  els['trips-empty'].hidden = mine.length > 0;
  els['trips-empty'].textContent = c ? 'No trips yet. Add one above when you finish a drive.' : 'Start the logbook first.';
  els.wrap.hidden = !mine.length;
  els.merge.hidden = C.mergeSameDay(mine).length === mine.length;
  const rows = mine.slice().reverse().map(t => {
    const tr = document.createElement('tr');
    const td = (text, cls) => { const d = document.createElement('td'); d.textContent = text; if (cls) d.className = cls; tr.appendChild(d); return d; };
    td(fmtDate(t.date));
    td(`${km(t.startOdo)} to ${km(t.endOdo)}`, 'num');
    td(km(C.tripKm(t)), 'num');
    td(t.business ? 'Work' : 'Private');
    td(t.business ? `${t.purpose} · ${t.destination}` + (t.merged ? ` (${t.merged} journeys)` : '') : '');
    const when = td(fmtStamp(t.createdAt), 'lb-when');
    if (C.isLate(t)) { const b = document.createElement('span'); b.className = 'lb-late'; b.textContent = 'added later'; when.append(' ', b); }
    const act = td('', 'no-print lb-rowact');
    const e = document.createElement('button'); e.type = 'button'; e.className = 'btn small'; e.textContent = 'Edit';
    e.setAttribute('aria-label', `Edit the trip on ${fmtDate(t.date)}`); e.addEventListener('click', () => editTrip(t));
    const x = document.createElement('button'); x.type = 'button'; x.className = 'btn small'; x.textContent = 'Delete';
    x.setAttribute('aria-label', `Delete the trip on ${fmtDate(t.date)}`); x.addEventListener('click', () => deleteTrip(t));
    act.append(e, x);
    return tr;
  });
  els.rows.replaceChildren(...rows);
}
function renderYears(c) {
  els['year-form'].hidden = !c;
  if (!c) { els.valid.textContent = 'Once the logbook is running, record the odometer at the start and end of each later income year here.'; els.yearlist.replaceChildren(); return; }
  const v = C.validUntil(c), first = C.incomeYearStart(c.start);
  els.valid.textContent = `This logbook can be used up to the ${v.label} income year (it ends ${fmtDate(v.ends)}). In the years after the logbook, keep the odometer reading at the start and end of each income year.`;
  const sel = els.year.value;
  els.year.replaceChildren(...[0, 1, 2, 3, 4].map(i => new Option(C.incomeYearLabel(first + i), String(first + i))));
  if (sel) els.year.value = sel;
  els.yearlist.replaceChildren(...(c.years || []).map(r => {
    const li = document.createElement('li');
    const dist = r.open != null && r.close != null ? ` · ${km(r.close - r.open)} km` : '';
    li.textContent = `${C.incomeYearLabel(r.startYear)}: 1 July ${r.open == null ? 'not recorded' : km(r.open)}, 30 June ${r.close == null ? 'not recorded' : km(r.close)}${dist}`;
    return li;
  }));
}

// ---------- files ----------
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
const slug = s => String(s || 'car').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'car';
els.export.addEventListener('click', () => {
  if (!S.cars.length) return toast('There is nothing to back up yet.');
  download(`car-logbook-${today()}.json`, C.exportJson(S), 'application/json');
  toast('Saved a backup with every car and trip. Keep it somewhere safe, or restore it on another device.');
});
els.csv.addEventListener('click', () => {
  const c = car();
  if (!c || !trips().length) return toast('There are no trips to export yet.');
  download(`logbook-${slug(c.name)}-${today()}.csv`, C.csv(c, trips()), 'text/csv');
});
els.print.addEventListener('click', () => {
  if (!car()) return toast('Start a logbook first.');
  window.print();
});
els.import.addEventListener('change', async () => {
  const file = els.import.files && els.import.files[0];
  els.import.value = '';
  if (!file) return;
  if (file.size > 16 * 1024 * 1024) return toast('That file is larger than 16 MB, which no logbook should be.');
  let incoming;
  try { incoming = C.importJson(await file.text()); }
  catch (e) { return toast('That file was not restored: ' + e.message); }
  if (S.cars.length && !confirm(`Replace what is on this device with the backup (${incoming.cars.length} car${incoming.cars.length === 1 ? '' : 's'}, ${incoming.trips.length} trip${incoming.trips.length === 1 ? '' : 's'})?`)) return;
  S = incoming; addingCar = false;
  commit(); resetTrip();
  toast(`Restored ${incoming.trips.length} trip${incoming.trips.length === 1 ? '' : 's'}.`);
});
els.sample.addEventListener('click', () => {
  if (S.cars.length && !confirm('Replace what is here with the example? Back up first if you want to keep your trips.')) return;
  S = C.sample(today()); addingCar = false;
  commit(); resetTrip();
  toast('Example loaded: 12 weeks of a tradie\'s ute. Clear it when you have had a look.');
});
els.clear.addEventListener('click', () => {
  if (S.cars.length && !confirm('Clear every car and trip on this device? Use Backup file first if you want to keep them.')) return;
  S = { cars: [], trips: [], favourites: [], activeCar: null }; addingCar = false;
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  render(); resetTrip(); toast('Cleared.');
});

load(); render(); resetTrip();
window.__logbook = { state: () => S };   // test hook
})();
