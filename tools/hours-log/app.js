/* Hours Log — UI over HoursCore. Everything lives in this browser under pot:hours-log:v1.
   Nothing is uploaded. All data reaching the DOM goes through textContent, never innerHTML. */
(() => {
'use strict';
const C = window.HoursCore;
const $ = id => document.getElementById('hl-' + id);
const KEY = 'pot:hours-log:v1';
if (!C) { $('toast').textContent = 'The page did not load completely. Reload and try again.'; return; }

let S = { entries: [], rates: {}, timer: null };
let editing = null, toastTimer = null, tick = null;
const today = () => C.todayISO();
let fy = C.incomeYearStart(today());
let week = C.weekStart(today());
const uid = () => 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const h = m => C.fmtHours(m);
const money = n => '$' + n.toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function fmtDate(iso, long) {
  const d = C.fromISO(iso);
  return d ? d.toLocaleDateString('en-AU', long ? { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' }) : iso;
}
const fmtStamp = ts => { const d = new Date(ts); return isNaN(d) ? '' : d.toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }); };
function toast(msg) {
  $('toast').textContent = msg || '';
  clearTimeout(toastTimer);
  if (msg) toastTimer = setTimeout(() => { $('toast').textContent = ''; }, 5000);
}
function showError(msg) { $('error').textContent = msg || ''; $('error').hidden = !msg; }

// ---------- persistence ----------
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const o = JSON.parse(raw);
    const next = { entries: o.entries, rates: o.rates || {}, timer: o.timer || null };
    const errors = C.validate(next);
    if (errors.length) return toast('The saved hours could not be read, so they were left alone: ' + errors[0]);
    S = next;
  } catch (e) { /* private mode, or nothing saved */ }
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: C.VERSION, entries: S.entries, rates: S.rates, timer: S.timer })); }
  catch (e) { toast('This browser would not save the change. Private windows and full storage both do that; use Backup file to keep your hours.'); }
}
function commit() { persist(); render(); }
function tryState(next) {
  const errors = C.validate(next);
  if (errors.length) { toast(errors[0]); return false; }
  S = next; commit(); return true;
}

// ---------- manual entries ----------
const place = () => document.querySelector('input[name="hl-place"]:checked').value;
function formEntry() {
  const b = $('break').value.trim();
  return Object.assign({}, editing || { id: uid(), createdAt: new Date().toISOString() }, {
    date: $('date').value, start: $('start').value, end: $('end').value, breakMin: b === '' ? 0 : Number(b), place: place(),
    client: $('client').value.replace(/\s+/g, ' ').trim(), note: $('note').value.replace(/\s+/g, ' ').trim()
  });
}
function showLength() {
  const e = formEntry();
  $('length').textContent = C.entryErrors(e).length ? '' : `${h(C.minutes(e))} hours` + (C.span(e).overnight ? ', finishing the next day' : '');
}
['date', 'start', 'end', 'break'].forEach(k => $(k).addEventListener('input', showLength));
function resetForm() {
  editing = null;
  $('date').value = today(); $('start').value = ''; $('end').value = ''; $('break').value = '0';
  $('client').value = ''; $('note').value = '';
  document.querySelector('input[name="hl-place"][value="home"]').checked = true;
  $('save').textContent = 'Add hours'; $('cancel').hidden = true;
  showError(''); showLength();
}
$('cancel').addEventListener('click', resetForm);
$('form').addEventListener('submit', ev => {
  ev.preventDefault();
  const e = formEntry();
  const errs = C.entryErrors(e);
  if (errs.length) return showError(errs[0]);
  const wasEditing = !!editing;
  const next = Object.assign({}, S, { entries: wasEditing ? S.entries.map(x => x.id === e.id ? e : x) : S.entries.concat(e) });
  if (!tryState(next)) return;
  fy = C.incomeYearStart(e.date); week = C.weekStart(e.date);
  resetForm(); render();
  toast((wasEditing ? 'Updated. The time it was first entered is kept. ' : 'Added. ') + `${h(C.minutes(e))} hours on ${fmtDate(e.date)}.`);
});
function edit(e) {
  editing = e;
  $('date').value = e.date; $('start').value = e.start; $('end').value = e.end; $('break').value = String(e.breakMin);
  document.querySelector(`input[name="hl-place"][value="${e.place}"]`).checked = true;
  $('client').value = e.client || ''; $('note').value = e.note || '';
  $('save').textContent = 'Save entry'; $('cancel').hidden = false;
  showError(''); showLength(); $('date').focus();
}
function remove(e) {
  if (!confirm(`Delete ${h(C.minutes(e))} hours on ${fmtDate(e.date)}?`)) return;
  S.entries = S.entries.filter(x => x.id !== e.id);
  if (editing && editing.id === e.id) resetForm();
  commit(); toast('Deleted.');
}

// ---------- timer ----------
function paintTimer() {
  const t = S.timer;
  $('t-toggle').textContent = t ? 'Stop and save' : 'Start';
  $('t-discard').hidden = !t;
  $('t-place').disabled = !!t; $('t-client').disabled = !!t;
  if (t) { $('t-place').value = t.place; $('t-client').value = t.client || ''; }
  const secs = t ? Math.max(0, Math.floor((Date.now() - new Date(t.startedAt)) / 1000)) : 0;
  $('clock').textContent = `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  $('timer-state').textContent = t ? `Running since ${fmtStamp(t.startedAt)}, ${t.place === 'home' ? 'at home' : t.place === 'work' ? 'at the workplace' : 'elsewhere'}.`
    : 'Start it when you start work. It keeps running if you close the tab.';
  clearInterval(tick);
  if (t) tick = setInterval(paintTimer, 1000);
}
$('t-toggle').addEventListener('click', () => {
  if (!S.timer) {
    return tryState(Object.assign({}, S, { timer: { startedAt: new Date().toISOString(), place: $('t-place').value, client: $('t-client').value.trim().slice(0, 80) } }))
      && toast('Timer started.');
  }
  const r = C.stopTimer(S.timer, new Date().toISOString());
  if (r.error) { toast(r.error); return tryState(Object.assign({}, S, { timer: null })); }
  const e = Object.assign({ id: uid() }, r.entry);
  if (tryState(Object.assign({}, S, { entries: S.entries.concat(e), timer: null }))) {
    fy = C.incomeYearStart(e.date); week = C.weekStart(e.date); render();
    toast(`Saved ${h(C.minutes(e))} hours. Add an unpaid break by editing the entry if you took one.`);
  }
});
$('t-discard').addEventListener('click', () => {
  if (!confirm('Discard the running timer without saving any hours?')) return;
  tryState(Object.assign({}, S, { timer: null })); toast('Timer discarded.');
});

// ---------- year, week and entries ----------
function render() {
  paintTimer();
  const years = new Set([C.incomeYearStart(today()), ...S.entries.map(e => C.incomeYearStart(e.date))]);
  $('fy').replaceChildren(...[...years].sort((a, b) => b - a).map(y => new Option(C.incomeYearLabel(y), String(y), false, y === fy)));
  const clients = [...new Set(S.entries.map(e => e.client).filter(Boolean))].slice(-60);
  $('clients').replaceChildren(...clients.map(c => new Option(c)));
  renderYear(); renderWeek(); renderEntries();
}
function renderYear() {
  const s = C.yearSummary(S.entries, fy);
  $('home').textContent = h(s.homeMinutes);
  $('all').textContent = h(s.allMinutes);
  $('rate').textContent = s.rate ? `${s.rate.cents}c` + (s.rate.provisional ? ' (provisional)' : '') : 'n/a';
  $('ded').textContent = s.deduction == null ? 'n/a' : '$' + s.deduction.toLocaleString('en-AU');
  const notes = [];
  if (s.rate && s.rate.provisional) notes.push(`The ATO has not yet published the ${s.label} rate, so this uses ${s.rate.cents} cents until it does.`);
  if (!s.rate) notes.push('The fixed rate method in its current form starts in 2020–21.');
  if (s.lateHome) notes.push(`${s.lateHome} home entr${s.lateHome === 1 ? 'y was' : 'ies were'} added after the day. Only a record kept at the time counts.`);
  notes.push(`Covers ${fmtDate(s.from, true)} to ${fmtDate(s.to, true)}. Hours × rate, cents disregarded.`);
  $('year-note').textContent = notes.join(' ');
  $('month-rows').replaceChildren(...s.months.map(m => {
    const tr = document.createElement('tr');
    const [y, mo] = m.key.split('-');
    [new Date(+y, +mo - 1, 1).toLocaleDateString('en-AU', { month: 'long', year: 'numeric' }), h(m.home), h(m.other)].forEach((t, i) => {
      const td = document.createElement(i ? 'td' : 'th'); td.textContent = t; if (i) td.className = 'num'; else td.scope = 'row'; tr.appendChild(td);
    });
    return tr;
  }));
  const running = C.incomeYearStart(today()) === fy;
  $('summary').textContent = S.entries.length
    ? `${s.label}: ${h(s.homeMinutes)} hours at home, fixed rate deduction ${s.deduction == null ? 'n/a' : '$' + s.deduction}${s.rate && s.rate.provisional ? ' (provisional rate)' : ''}${running ? ' so far' : ''}.`
    : 'Nothing logged yet. Start the timer or add today\'s hours.';
}
function renderWeek() {
  const w = C.weekSummary(S.entries, week, S.rates);
  $('weeklabel').textContent = `Week of ${fmtDate(w.from, true)}`;
  $('day-rows').replaceChildren(...w.days.map(d => {
    const tr = document.createElement('tr');
    const th = document.createElement('th'); th.scope = 'row'; th.textContent = fmtDate(d.date); tr.appendChild(th);
    for (const v of [h(d.minutes), h(d.home)]) { const td = document.createElement('td'); td.className = 'num'; td.textContent = v; tr.appendChild(td); }
    return tr;
  }));
  $('week-total').textContent = h(w.minutes);
  $('week-home').textContent = h(w.days.reduce((s, d) => s + d.home, 0));
  $('client-rows').replaceChildren(...(w.clients.length ? w.clients : []).map(c => {
    const tr = document.createElement('tr');
    const name = document.createElement('th'); name.scope = 'row'; name.textContent = c.client; tr.appendChild(name);
    const hrs = document.createElement('td'); hrs.className = 'num'; hrs.textContent = h(c.minutes); tr.appendChild(hrs);
    const rt = document.createElement('td'); rt.className = 'num';
    const inp = document.createElement('input');
    inp.type = 'number'; inp.min = '0'; inp.step = '0.01'; inp.inputMode = 'decimal'; inp.className = 'hl-rate';
    inp.value = c.rate == null ? '' : String(c.rate);
    inp.setAttribute('aria-label', `Hourly rate for ${c.client}`);
    inp.addEventListener('change', () => {
      const v = inp.value.trim() === '' ? null : Number(inp.value);
      const rates = Object.assign({}, S.rates);
      if (v == null || !(v >= 0)) delete rates[c.client]; else rates[c.client] = Math.round(v * 100) / 100;
      tryState(Object.assign({}, S, { rates }));
    });
    rt.appendChild(inp); tr.appendChild(rt);
    const amt = document.createElement('td'); amt.className = 'num'; amt.textContent = c.amount == null ? '' : money(c.amount); tr.appendChild(amt);
    return tr;
  }));
  $('print-sub').dataset.week = `${fmtDate(w.from, true)} to ${fmtDate(w.to, true)}`;
}
function renderEntries() {
  const { from, to } = C.incomeYearRange(fy);
  const list = C.sortEntries(S.entries.filter(e => e.date >= from && e.date <= to)).reverse();
  $('count').textContent = String(list.length);
  $('empty').hidden = list.length > 0;
  $('wrap').hidden = !list.length;
  $('rows').replaceChildren(...list.map(e => {
    const tr = document.createElement('tr');
    const td = (text, cls) => { const d = document.createElement('td'); d.textContent = text; if (cls) d.className = cls; tr.appendChild(d); return d; };
    td(fmtDate(e.date));
    td(`${e.start} to ${e.end}` + (e.breakMin ? `, ${e.breakMin} min break` : ''));
    td(h(C.minutes(e)), 'num');
    td(C.PLACES[e.place]);
    td([e.client, e.note].filter(Boolean).join(' · '));
    const when = td(fmtStamp(e.createdAt) + (e.timer ? ' (timer)' : ''), 'hl-when');
    if (C.isLate(e)) { const b = document.createElement('span'); b.className = 'hl-late'; b.textContent = 'added later'; when.append(' ', b); }
    const act = td('', 'no-print hl-rowact');
    for (const [label, fn] of [['Edit', edit], ['Delete', remove]]) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.textContent = label;
      b.setAttribute('aria-label', `${label} the entry on ${fmtDate(e.date)} starting ${e.start}`);
      b.addEventListener('click', () => fn(e)); act.appendChild(b);
    }
    return tr;
  }));
}
$('fy').addEventListener('change', () => { fy = Number($('fy').value); renderYear(); renderEntries(); });
$('prev').addEventListener('click', () => { week = C.addDays(week, -7); renderWeek(); });
$('next').addEventListener('click', () => { week = C.addDays(week, 7); renderWeek(); });

// ---------- printing ----------
function printAs(kind) {
  const s = C.yearSummary(S.entries, fy);
  document.body.dataset.print = kind;
  $('print-title').textContent = kind === 'year' ? `Hours worked from home, ${s.label}` : 'Timesheet';
  $('print-sub').textContent = kind === 'year'
    ? `${h(s.homeMinutes)} hours at home × ${s.rate ? s.rate.cents + 'c' + (s.rate.provisional ? ' (provisional)' : '') : 'n/a'} = ${s.deduction == null ? 'n/a' : '$' + s.deduction} (cents disregarded). ${s.entries} entries; ${s.late} added after the day. Printed ${fmtDate(today(), true)}.`
    : `${$('print-sub').dataset.week}. Printed ${fmtDate(today(), true)}.`;
  window.print();
}
window.addEventListener('afterprint', () => { delete document.body.dataset.print; });
$('print-year').addEventListener('click', () => printAs('year'));
$('print-week').addEventListener('click', () => printAs('week'));

// ---------- files ----------
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
$('lines').addEventListener('click', async () => {
  const w = C.weekSummary(S.entries, week, S.rates);
  if (!w.clients.length) return toast('There are no hours in this week to invoice.');
  const text = C.invoiceLines(w);
  try { await navigator.clipboard.writeText(text.replace(/^﻿/, '')); toast('Copied one line per client: description, hours and rate. Paste into your invoice or a spreadsheet.'); }
  catch (e) { download(`invoice-lines-${w.from}.csv`, text, 'text/csv'); toast('Saved the invoice lines as a CSV file instead.'); }
});
$('csv').addEventListener('click', () => {
  if (!S.entries.length) return toast('There is nothing to export yet.');
  download(`hours-${today()}.csv`, C.csv(S.entries), 'text/csv');
});
$('export').addEventListener('click', () => {
  if (!S.entries.length && !S.timer) return toast('There is nothing to back up yet.');
  download(`hours-log-${today()}.json`, C.exportJson(S), 'application/json');
  toast('Saved a backup of every entry. Keep it somewhere safe, or restore it on another device.');
});
$('import').addEventListener('change', async () => {
  const file = $('import').files && $('import').files[0];
  $('import').value = '';
  if (!file) return;
  if (file.size > 16 * 1024 * 1024) return toast('That file is larger than 16 MB, which no hours log should be.');
  let incoming;
  try { incoming = C.importJson(await file.text()); }
  catch (e) { return toast('That file was not restored: ' + e.message); }
  if (S.entries.length && !confirm(`Replace what is on this device with the backup (${incoming.entries.length} entries)?`)) return;
  S = incoming; commit(); resetForm();
  toast(`Restored ${incoming.entries.length} entries.`);
});
$('sample').addEventListener('click', () => {
  if (S.entries.length && !confirm('Replace what is here with the example? Back up first if you want to keep your hours.')) return;
  S = C.sample(today()); fy = C.incomeYearStart(today()); week = C.weekStart(today());
  commit(); resetForm();
  toast('Example loaded: eight weeks, home three days a week. Clear it when you have had a look.');
});
$('clear').addEventListener('click', () => {
  if ((S.entries.length || S.timer) && !confirm('Clear every entry and the timer on this device? Use Backup file first if you want to keep them.')) return;
  S = { entries: [], rates: {}, timer: null };
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  render(); resetForm(); toast('Cleared.');
});

load(); render(); resetForm();
window.__hours = { state: () => S };   // test hook
})();
