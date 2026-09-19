/* Habit Tracker — UI over HabitCore. Everything lives in this browser: habits and ticks under
   pot:habit-tracker:v1, preferences under pot:habit-tracker:settings:v1. Nothing is uploaded.
   All data reaching the DOM goes through textContent or a validated attribute, never innerHTML. */
(() => {
'use strict';
const C = window.HabitCore;
const $ = id => document.getElementById(id);
const KEY = 'pot:habit-tracker:v1';
const SETTINGS = 'pot:habit-tracker:settings:v1';
const WEEKS = 53;

const els = {
  summary: $('ht-summary'), sample: $('ht-sample'), exportBtn: $('ht-export'), importInput: $('ht-import'),
  csv: $('ht-csv'), print: $('ht-print'), clear: $('ht-clear'), toast: $('ht-toast'),
  heading: $('ht-form-heading'), form: $('ht-form'), name: $('ht-name'), colour: $('ht-colour'),
  days: $('ht-days'), times: $('ht-times'), n: $('ht-n'), note: $('ht-note'), error: $('ht-error'),
  save: $('ht-save'), cancel: $('ht-cancel'),
  remindAt: $('ht-remind-at'), remindToggle: $('ht-remind-toggle'), remindState: $('ht-remind-state'),
  count: $('ht-count'), empty: $('ht-empty'), wrap: $('ht-wrap'), rows: $('ht-rows'), archivedNote: $('ht-archived-note'),
  pick: $('ht-pick'), months: $('ht-months'), heat: $('ht-heat'), heatNote: $('ht-heat-note')
};
if (!C) { els.toast.textContent = 'The page did not load completely. Reload and try again.'; return; }

let S = { habits: [], ticks: {} };
let settings = { remind: false, at: '20:00', last: '', pick: '' };
let editing = null, toastTimer = null;

const empty = () => ({ habits: [], ticks: {} });
const activeHabits = () => S.habits.filter(h => !h.archived);
const ticksOf = id => S.ticks[id] || (S.ticks[id] = []);
const isTicked = (id, iso) => ticksOf(id).indexOf(iso) >= 0;
const today = () => C.todayISO();

function toast(msg) {
  els.toast.textContent = msg || '';
  clearTimeout(toastTimer);
  if (msg) toastTimer = setTimeout(() => { els.toast.textContent = ''; }, 4000);
}
function showError(msg) { els.error.textContent = msg || ''; els.error.hidden = !msg; }

// ---------- persistence ----------
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const errors = C.validate(parsed);
      if (!errors.length) S = { habits: parsed.habits, ticks: parsed.ticks };
      else toast('The saved data could not be read, so it was left alone: ' + errors[0]);
    }
  } catch (e) { /* private mode, or nothing saved */ }
  try {
    const raw = localStorage.getItem(SETTINGS);
    if (raw) Object.assign(settings, JSON.parse(raw) || {});
  } catch (e) { /* ignore */ }
  if (!/^\d{2}:\d{2}$/.test(String(settings.at))) settings.at = '20:00';
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify({ v: C.VERSION, habits: S.habits, ticks: S.ticks })); }
  catch (e) { toast('This browser would not save the change. Private windows and full storage both do that; export a file to keep your history.'); }
}
function saveSettings() { try { localStorage.setItem(SETTINGS, JSON.stringify(settings)); } catch (e) { /* ignore */ } }
function commit() { persist(); render(); }

// ---------- form ----------
els.colour.replaceChildren(...C.COLOURS.map((hex, i) => {
  const o = new Option(['Green', 'Teal', 'Blue', 'Violet', 'Orange', 'Red', 'Amber', 'Olive'][i] || hex, hex);
  return o;
}));
els.days.replaceChildren(...[1, 2, 3, 4, 5, 6, 0].map(d => {
  const l = document.createElement('label');
  const i = document.createElement('input');
  i.type = 'checkbox'; i.value = String(d); i.checked = d >= 1 && d <= 5;
  l.append(i, document.createTextNode(C.SHORT[d]));
  return l;
}));
const whenValue = () => {
  const r = els.form.querySelector('input[name=ht-when]:checked');
  return r ? r.value : 'daily';
};
function syncWhen() {
  const when = whenValue();
  els.days.hidden = when !== 'days';
  els.times.hidden = when !== 'times';
}
els.form.querySelectorAll('input[name=ht-when]').forEach(r => r.addEventListener('change', syncWhen));

function readSchedule() {
  const when = whenValue();
  if (when === 'days') {
    const days = [...els.days.querySelectorAll('input:checked')].map(i => +i.value);
    if (!days.length) return { error: 'Pick at least one day.' };
    return { schedule: { type: 'days', days: days.sort((a, b) => a - b) } };
  }
  if (when === 'times') return { schedule: { type: 'times', n: +els.n.value } };
  return { schedule: { type: 'daily' } };
}
function resetForm() {
  editing = null;
  els.heading.textContent = 'Add a habit';
  els.save.textContent = 'Add habit';
  els.cancel.hidden = true;
  els.name.value = ''; els.note.value = '';
  els.colour.selectedIndex = S.habits.length % C.COLOURS.length;
  els.form.querySelector('input[name=ht-when][value=daily]').checked = true;
  els.days.querySelectorAll('input').forEach(i => { i.checked = +i.value >= 1 && +i.value <= 5; });
  els.n.value = '3';
  syncWhen(); showError('');
}
els.form.addEventListener('submit', e => {
  e.preventDefault();
  showError('');
  const name = els.name.value.trim();
  if (!name) return showError('Give the habit a name.');
  const clash = S.habits.find(h => h.name.trim().toLowerCase() === name.toLowerCase() && h.id !== editing);
  if (clash) return showError(`There is already a habit called "${clash.name}".`);
  const read = readSchedule();
  if (read.error) return showError(read.error);
  if (!editing && S.habits.length >= C.MAX_HABITS) return showError(`That is ${C.MAX_HABITS} habits. Archive a few before adding more.`);
  const habit = {
    id: editing || C.uniqueId(new Set(S.habits.map(h => h.id))),
    name, colour: els.colour.value, schedule: read.schedule,
    note: els.note.value.trim(), created: today(), archived: false
  };
  if (editing) {
    const i = S.habits.findIndex(h => h.id === editing);
    habit.created = S.habits[i].created || today();
    habit.archived = !!S.habits[i].archived;
    S.habits[i] = habit;
    toast('Saved.');
  } else {
    S.habits.push(habit);
    ticksOf(habit.id);
    settings.pick = habit.id; saveSettings();
    toast(`Added "${name}". Tick it when you do it.`);
  }
  resetForm(); commit();
});
els.cancel.addEventListener('click', () => { resetForm(); render(); });

function edit(h) {
  editing = h.id;
  els.heading.textContent = 'Edit habit';
  els.save.textContent = 'Save changes';
  els.cancel.hidden = false;
  els.name.value = h.name;
  els.note.value = h.note || '';
  els.colour.value = h.colour || C.COLOURS[0];
  if (els.colour.selectedIndex < 0) els.colour.selectedIndex = 0;
  const type = (h.schedule && h.schedule.type) || 'daily';
  els.form.querySelector(`input[name=ht-when][value=${type === 'days' ? 'days' : type === 'times' ? 'times' : 'daily'}]`).checked = true;
  if (type === 'days') els.days.querySelectorAll('input').forEach(i => { i.checked = h.schedule.days.indexOf(+i.value) >= 0; });
  if (type === 'times') els.n.value = String(h.schedule.n);
  syncWhen(); showError('');
  els.name.focus();
  els.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// ---------- rendering ----------
function render() {
  renderSummary();
  renderList();
  renderPicker();
  renderHeatmap();
}
function remainingToday() {
  const t = today();
  return activeHabits().filter(h => {
    if (isTicked(h.id, t)) return false;
    if (C.isWeekly(h)) {
      const ws = C.weekStart(t);
      let n = 0;
      for (let i = 0; i < 7; i++) if (isTicked(h.id, C.addDays(ws, i))) n++;
      return n < C.targetPerWeek(h);
    }
    return C.isDue(h, t);
  });
}
function renderSummary() {
  const total = activeHabits().length;
  if (!total) { els.summary.textContent = 'Nothing tracked yet.'; return; }
  const left = remainingToday().length;
  const doneOf = total - left;
  els.summary.textContent = left === 0
    ? `All done today. ${total} habit${total === 1 ? '' : 's'} tracked.`
    : `${doneOf} of ${total} done today, ${left} to go.`;
}
function strip(h) {
  const box = document.createElement('div');
  box.className = 'ht-strip';
  const t = today();
  for (let i = 6; i >= 0; i--) {
    const date = C.addDays(t, -i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'ht-day';
    b.dataset.habit = h.id;
    b.dataset.date = date;
    const done = isTicked(h.id, date), due = C.isDue(h, date);
    if (done) { b.classList.add('done'); b.style.background = h.colour; b.style.borderColor = h.colour; }
    else if (due) b.classList.add('due');
    else b.classList.add('off');
    if (date === t) b.classList.add('today');
    b.textContent = C.SHORT[C.weekdayOf(date)].slice(0, 1);
    b.setAttribute('aria-pressed', String(done));
    b.setAttribute('aria-label', `${h.name}, ${C.DAYS[C.weekdayOf(date)]} ${date}${done ? ', done' : due ? ', not done' : ', not scheduled'}`);
    b.title = `${date}${due ? '' : ' (not scheduled)'}`;
    box.appendChild(b);
  }
  return box;
}
function cell(text, cls) {
  const td = document.createElement('td');
  if (cls) td.className = cls;
  td.textContent = text;
  return td;
}
function renderList() {
  const all = S.habits;
  els.count.textContent = String(activeHabits().length);
  els.empty.hidden = all.length > 0;
  els.wrap.hidden = all.length === 0;
  els.rows.replaceChildren();
  const ordered = all.filter(h => !h.archived).concat(all.filter(h => h.archived));
  for (const h of ordered) {
    const tr = document.createElement('tr');
    if (h.archived) tr.className = 'archived';

    const name = document.createElement('td');
    name.className = 'ht-name-cell';
    const dot = document.createElement('i');
    dot.className = 'ht-dot';
    dot.style.background = h.colour || C.COLOURS[0];
    const label = document.createElement('span');
    label.className = 'ht-habit-name';
    label.textContent = h.name;
    const sub = document.createElement('small');
    sub.textContent = C.describeSchedule(h) + (h.note ? ' · ' + h.note : '') + (h.archived ? ' · archived' : '');
    name.append(dot, label, sub);
    tr.appendChild(name);

    const stripCell = document.createElement('td');
    stripCell.appendChild(strip(h));
    tr.appendChild(stripCell);

    const s = C.streaks(h, ticksOf(h.id), today());
    const rate = C.completionRate(h, ticksOf(h.id), today(), 30);
    tr.appendChild(cell(s.current ? `${s.current} ${s.unit}${s.current === 1 ? '' : 's'}` : '—', 'num'));
    tr.appendChild(cell(s.best ? `${s.best} ${s.unit}${s.best === 1 ? '' : 's'}` : '—', 'num'));
    tr.appendChild(cell(rate == null ? '—' : Math.round(rate * 100) + '%', 'num'));

    const actions = document.createElement('td');
    actions.className = 'no-print ht-actions-cell';
    const mk = (text, cls, handler, title) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn small' + (cls ? ' ' + cls : ''); b.textContent = text;
      if (title) b.title = title;
      b.addEventListener('click', handler);
      return b;
    };
    actions.append(
      mk('Edit', '', () => edit(h)),
      mk(h.archived ? 'Restore' : 'Archive', '', () => {
        h.archived = !h.archived;
        if (h.archived && settings.pick === h.id) { settings.pick = ''; saveSettings(); }
        commit();
      }, h.archived ? 'Bring it back into the list' : 'Keep the history, stop showing it as due'),
      mk('Delete', 'danger', () => {
        const n = ticksOf(h.id).length;
        if (!confirm(`Delete "${h.name}"? That also removes ${n} recorded day${n === 1 ? '' : 's'}, and cannot be undone.`)) return;
        S.habits = S.habits.filter(x => x.id !== h.id);
        delete S.ticks[h.id];
        if (editing === h.id) resetForm();
        if (settings.pick === h.id) { settings.pick = ''; saveSettings(); }
        commit(); toast('Deleted.');
      })
    );
    tr.appendChild(actions);
    els.rows.appendChild(tr);
  }
  const archived = all.filter(h => h.archived).length;
  els.archivedNote.hidden = !archived;
  if (archived) els.archivedNote.textContent = `${archived} archived habit${archived === 1 ? '' : 's'} kept at the bottom. Their history is safe; they are just not due any more.`;
}
els.rows.addEventListener('click', e => {
  const b = e.target.closest('button.ht-day');
  if (!b) return;
  const { habit, date } = b.dataset;
  const list = ticksOf(habit);
  const at = list.indexOf(date);
  if (at >= 0) list.splice(at, 1); else { list.push(date); list.sort(); }
  commit();
});

function renderPicker() {
  const options = activeHabits();
  els.pick.replaceChildren(...options.map(h => new Option(h.name, h.id)));
  if (!options.length) { els.pick.disabled = true; return; }
  els.pick.disabled = false;
  if (!options.some(h => h.id === settings.pick)) settings.pick = options[0].id;
  els.pick.value = settings.pick;
}
function renderHeatmap() {
  const h = activeHabits().find(x => x.id === settings.pick);
  els.heat.replaceChildren();
  els.months.replaceChildren();
  if (!h) {
    els.heatNote.textContent = 'Add a habit to see a year of it here.';
    els.heat.setAttribute('aria-label', 'No habit selected');
    return;
  }
  const cells = C.heatmapCells(h, ticksOf(h.id), today(), WEEKS);
  els.heat.style.setProperty('--weeks', String(WEEKS));
  els.months.style.setProperty('--weeks', String(WEEKS));
  let last = '';
  for (let w = 0; w < WEEKS; w++) {
    const span = document.createElement('span');
    const monday = cells[w * 7].date;
    const month = monday.slice(0, 7);
    // label a column only when its month differs from the previous one, and never twice running
    if (month !== last && +monday.slice(8, 10) <= 7) {
      span.textContent = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+monday.slice(5, 7) - 1];
      last = month;
    }
    els.months.appendChild(span);
  }
  for (const c of cells) {
    const i = document.createElement('i');
    i.className = 'ht-cell' + (c.future ? ' future' : c.done ? ' done' : c.scheduled ? ' miss' : ' off');
    if (c.done) i.style.background = h.colour || C.COLOURS[0];
    i.title = `${c.date}${c.future ? '' : c.done ? ' · done' : c.scheduled ? ' · missed' : ' · not scheduled'}`;
    els.heat.appendChild(i);
  }
  const s = C.streaks(h, ticksOf(h.id), today());
  const year = C.completionRate(h, ticksOf(h.id), today(), 365);
  const total = ticksOf(h.id).length;
  els.heat.setAttribute('aria-label',
    `${h.name}: ${total} day${total === 1 ? '' : 's'} recorded, current streak ${s.current} ${s.unit}${s.current === 1 ? '' : 's'}`);
  els.heatNote.textContent = `${h.name}: ${total} day${total === 1 ? '' : 's'} recorded, `
    + `${s.current} ${s.unit}${s.current === 1 ? '' : 's'} running, best ${s.best}. `
    + (year == null ? '' : `Over the last year, ${Math.round(year * 100)}% of what was scheduled.`);
}
els.pick.addEventListener('change', () => { settings.pick = els.pick.value; saveSettings(); renderHeatmap(); });

// ---------- files ----------
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
els.exportBtn.addEventListener('click', () => {
  if (!S.habits.length) return toast('There is nothing to export yet.');
  download(`habits-${today()}.json`, C.exportJson(S), 'application/json');
  toast('Saved a file with every habit and every day. Keep it somewhere safe, or import it on another device.');
});
els.csv.addEventListener('click', () => {
  if (!S.habits.length) return toast('There is nothing to export yet.');
  download(`habits-${today()}.csv`, C.csv(S), 'text/csv');
});
els.importInput.addEventListener('change', async () => {
  const file = els.importInput.files && els.importInput.files[0];
  els.importInput.value = '';
  if (!file) return;
  if (file.size > 8 * 1024 * 1024) return toast('That file is larger than 8 MB, which no habit history should be.');
  let incoming;
  try { incoming = C.importJson(await file.text()); }
  catch (e) { return toast('That file was not imported: ' + e.message); }
  const days = Object.keys(incoming.ticks).reduce((n, k) => n + incoming.ticks[k].length, 0);
  if (!S.habits.length) {
    S = incoming;
    commit();
    return toast(`Imported ${incoming.habits.length} habit${incoming.habits.length === 1 ? '' : 's'} and ${days} recorded day${days === 1 ? '' : 's'}.`);
  }
  const merge = confirm(
    `That file holds ${incoming.habits.length} habit${incoming.habits.length === 1 ? '' : 's'} and ${days} recorded day${days === 1 ? '' : 's'}.\n\n`
    + 'OK to merge it with what is already here.\nCancel to replace everything with the file.');
  S = merge ? C.merge(S, incoming) : incoming;
  const errors = C.validate(S);
  if (errors.length) { load(); render(); return toast('That import was refused: ' + errors[0]); }
  commit();
  toast(merge ? 'Merged. Habits with the same name kept one history.' : 'Replaced everything with the file.');
});
els.sample.addEventListener('click', () => {
  if (S.habits.length && !confirm('Replace what is here with the sample?')) return;
  S = C.sample(today());
  settings.pick = S.habits[0].id; saveSettings();
  resetForm(); commit();
  toast('Sample loaded: two months of three habits. Clear it when you have had a look.');
});
els.clear.addEventListener('click', () => {
  if (S.habits.length && !confirm('Clear every habit and all of their history on this device? Export a file first if you want to keep it.')) return;
  S = empty();
  try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  settings.pick = ''; saveSettings();
  resetForm(); commit(); toast('Cleared.');
});
els.print.addEventListener('click', () => window.print());

// ---------- reminder ----------
function remindSupported() { return typeof window.Notification === 'function'; }
function describeReminder() {
  if (!remindSupported()) return 'This browser cannot show notifications, so the reminder is unavailable here.';
  if (Notification.permission === 'denied') return 'Notifications are blocked for this site. Allow them in the address bar, then turn this on.';
  if (!settings.remind) return 'Off.';
  return `On for ${settings.at}, while this page is open.`;
}
function paintReminder() {
  els.remindAt.value = settings.at;
  els.remindToggle.textContent = settings.remind ? 'Turn off' : 'Turn on';
  els.remindToggle.classList.toggle('primary', !settings.remind);
  els.remindToggle.disabled = !remindSupported();
  els.remindState.textContent = describeReminder();
}
els.remindToggle.addEventListener('click', async () => {
  if (!remindSupported()) return;
  if (settings.remind) { settings.remind = false; saveSettings(); return paintReminder(); }
  let permission = Notification.permission;
  if (permission === 'default') { try { permission = await Notification.requestPermission(); } catch (e) { permission = 'denied'; } }
  if (permission !== 'granted') { paintReminder(); return toast('Without permission there is nothing to show you.'); }
  settings.remind = true; settings.last = ''; saveSettings(); paintReminder();
  toast('On. It will nudge you at ' + settings.at + ', as long as this page is still open.');
});
els.remindAt.addEventListener('change', () => {
  if (/^\d{2}:\d{2}$/.test(els.remindAt.value)) settings.at = els.remindAt.value;
  settings.last = ''; saveSettings(); paintReminder();
});
function checkReminder() {
  if (!settings.remind || !remindSupported() || Notification.permission !== 'granted') return;
  const t = today();
  if (settings.last === t) return;
  const now = new Date();
  const hhmm = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  if (hhmm < settings.at) return;
  settings.last = t; saveSettings();
  const left = remainingToday();
  if (!left.length) return;
  try {
    new Notification('Plenty of Tools', {
      body: left.length === 1 ? `${left[0].name} is still waiting today.` : `${left.length} habits still waiting today.`,
      tag: 'pot-habit-tracker'
    });
  } catch (e) { /* some browsers only allow notifications from a service worker */ }
}
setInterval(checkReminder, 30000);

// The page can be left open past midnight, and then every date on it is wrong.
let renderedFor = today();
setInterval(() => {
  if (today() === renderedFor) return;
  renderedFor = today();
  settings.last = ''; saveSettings();
  render();
  toast('A new day. The week strip has moved on.');
}, 30000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden || today() === renderedFor) return;
  renderedFor = today(); render();
});

// ---------- boot ----------
load();
resetForm();
paintReminder();
render();

window.__habits = {
  core: C,
  get state() { return S; },
  get settings() { return settings; },
  load: s => { S = s; resetForm(); commit(); },
  tick: (id, iso) => { const l = ticksOf(id); const i = l.indexOf(iso); if (i >= 0) l.splice(i, 1); else { l.push(iso); l.sort(); } commit(); },
  remaining: () => remainingToday().map(h => h.name)
};
})();
