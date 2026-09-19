/* Settle Up — UI over SettleCore. State lives in the URL hash (shareable) and in localStorage (autosave). */
(() => {
'use strict';
const C = window.SettleCore;
const $ = id => document.getElementById(id);
const KEY = 'pot:settle-up:v1';
const els = {
  name: $('group-name'), currency: $('currency'), link: $('btn-link'), csv: $('btn-csv'), csvPlan: $('btn-csv-plan'), print: $('btn-print'),
  sample: $('btn-sample'), clear: $('btn-clear'), toast: $('toast'), people: $('people'), personForm: $('person-form'), personName: $('person-name'),
  peopleHint: $('people-hint'), heading: $('exp-heading'), form: $('exp-form'), desc: $('exp-desc'), amount: $('exp-amount'), payer: $('exp-payer'),
  date: $('exp-date'), splitEqual: $('split-equal'), splitExact: $('split-exact'), splitNote: $('split-note'), error: $('exp-error'),
  save: $('btn-exp-save'), cancel: $('btn-exp-cancel'), count: $('exp-count'), empty: $('exp-empty'), wrap: $('exp-wrap'), rows: $('expenses'),
  summary: $('summary'), balances: $('balances'), balHint: $('bal-hint'), plan: $('plan'), planNote: $('plan-note')
};
if (!C) { els.toast.textContent = 'The page did not load completely. Reload and try again.'; return; }

const uid = () => Math.random().toString(36).slice(2, 9);
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const empty = () => ({ name: '', currency: 'A$', people: [], expenses: [] });
const nameOf = id => { const p = S.people.find(x => x.id === id); return p ? p.name : '?'; };
const money = c => C.fmt(c, S.currency);
let S = empty(), editing = null, toastTimer = null;

function toast(msg) { els.toast.textContent = msg; clearTimeout(toastTimer); toastTimer = setTimeout(() => { els.toast.textContent = ''; }, 3500); }
function showError(msg) { els.error.textContent = msg || ''; els.error.hidden = !msg; }
function hasData() { return S.people.length > 0 || S.expenses.length > 0 || S.name; }

// ---------- persistence: hash first, then this device ----------
function load() {
  const h = location.hash.slice(1);
  if (h) {
    try { S = C.decode(h); return 'link'; }
    catch (e) { toast('That link could not be read: ' + e.message); }
  }
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (!C.validate(s).length) { S = s; return 'saved'; } } } catch (e) { /* ignore */ }
  return 'new';
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode or full */ }
  try { history.replaceState(null, '', hasData() ? '#' + C.encode(S) : location.pathname); } catch (e) { /* ignore */ }
}
function commit() { persist(); render(); }

// ---------- rendering ----------
function render() {
  els.name.value = S.name; els.currency.value = S.currency;
  if (!els.currency.value) { els.currency.add(new Option(S.currency, S.currency, true, true)); }
  renderPeople(); renderPayer(); renderSplit(); renderExpenses(); renderBalances();
}
function renderPeople() {
  els.people.replaceChildren();
  const used = new Set();
  for (const e of S.expenses) { used.add(e.payer); for (const id of Object.keys(C.sharesOf(e, S.people))) used.add(id); }
  for (const p of S.people) {
    const chip = document.createElement('span'); chip.className = 'chip';
    chip.append(document.createTextNode(p.name));
    const b = document.createElement('button'); b.type = 'button'; b.textContent = '×'; b.setAttribute('aria-label', `Remove ${p.name}`);
    if (used.has(p.id)) { b.disabled = true; b.title = 'In an expense. Edit those expenses first.'; }
    b.addEventListener('click', () => { S.people = S.people.filter(x => x.id !== p.id); commit(); });
    chip.appendChild(b); els.people.appendChild(chip);
  }
  els.peopleHint.textContent = S.people.length ? (S.people.length < 2 ? 'Add at least one more person.' : '') : 'Add everyone who paid for something or shared a cost.';
}
function renderPayer() {
  const cur = els.payer.value;
  els.payer.replaceChildren(...S.people.map(p => new Option(p.name, p.id)));
  if (S.people.some(p => p.id === cur)) els.payer.value = cur;
}
function splitMode() { const r = els.form.querySelector('input[name=split]:checked'); return r ? r.value : 'equal'; }
function renderSplit(selected) {
  const mode = splitMode();
  els.splitEqual.hidden = mode !== 'equal'; els.splitExact.hidden = mode !== 'exact';
  const prevChecks = new Map([...els.splitEqual.querySelectorAll('input')].map(i => [i.value, i.checked]));
  const prevExact = new Map([...els.splitExact.querySelectorAll('input')].map(i => [i.dataset.id, i.value]));
  els.splitEqual.replaceChildren(...S.people.map(p => {
    const l = document.createElement('label'); const i = document.createElement('input'); i.type = 'checkbox'; i.value = p.id;
    i.checked = selected ? selected.has(p.id) : (prevChecks.has(p.id) ? prevChecks.get(p.id) : true);
    l.append(i, document.createTextNode(p.name)); return l;
  }));
  els.splitExact.replaceChildren(...S.people.map(p => {
    const l = document.createElement('label'); const i = document.createElement('input'); i.type = 'text'; i.inputMode = 'decimal'; i.placeholder = '0.00'; i.dataset.id = p.id;
    i.value = prevExact.get(p.id) || ''; i.addEventListener('input', updateSplitNote);
    l.append(document.createTextNode(p.name), i); return l;
  }));
  updateSplitNote();
}
function updateSplitNote() {
  const cents = C.toCents(els.amount.value);
  if (splitMode() === 'equal') {
    const n = els.splitEqual.querySelectorAll('input:checked').length;
    els.splitNote.textContent = cents > 0 && n ? `${money(Math.round(cents / n))} each${cents % n ? ', give or take a cent' : ''}` : '';
  } else {
    let sum = 0; for (const i of els.splitExact.querySelectorAll('input')) sum += C.toCents(i.value) || 0;
    if (!(cents > 0)) { els.splitNote.textContent = 'Enter the amount first.'; return; }
    const diff = cents - sum;
    els.splitNote.textContent = diff === 0 ? 'Adds up.' : diff > 0 ? `${money(diff)} still to allocate` : `${money(-diff)} over the total`;
  }
}
function renderExpenses() {
  els.count.textContent = String(S.expenses.length);
  els.empty.hidden = S.expenses.length > 0; els.wrap.hidden = S.expenses.length === 0;
  els.rows.replaceChildren();
  const sorted = S.expenses.slice().sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.id < b.id ? -1 : 1));
  for (const e of sorted) {
    const sh = C.sharesOf(e, S.people); const ids = Object.keys(sh);
    const splitText = e.split && e.split.type === 'exact' ? ids.map(id => `${nameOf(id)} ${money(sh[id])}`).join(', ')
      : ids.length === S.people.length ? 'Everyone' : ids.map(nameOf).join(', ');
    const tr = document.createElement('tr'); if (editing === e.id) tr.className = 'editing';
    tr.innerHTML = `<td>${esc(e.date || '')}</td><td>${esc(e.desc)}</td><td>${esc(nameOf(e.payer))}</td><td class="num">${esc(money(e.cents))}</td><td class="split-cell">${esc(splitText)}</td>`
      + `<td class="no-print"><button class="btn small" type="button" data-edit="${esc(e.id)}">Edit</button> <button class="btn small danger" type="button" data-del="${esc(e.id)}">Delete</button></td>`;
    els.rows.appendChild(tr);
  }
  const t = C.totals(S);
  els.summary.textContent = S.expenses.length ? `${S.expenses.length} expense${S.expenses.length === 1 ? '' : 's'} · ${money(t.total)} total${S.people.length ? ` · ${money(Math.round(t.total / S.people.length))} per person on average` : ''}` : '';
}
function renderBalances() {
  const net = C.balances(S), t = C.totals(S);
  els.balances.replaceChildren();
  const maxAbs = Math.max(1, ...Object.values(net).map(Math.abs));
  for (const p of S.people) {
    const n = net[p.id] || 0;
    const div = document.createElement('div'); div.className = 'person';
    const cls = n > 0 ? 'pos' : n < 0 ? 'neg' : '';
    const label = n > 0 ? `gets back ${money(n)}` : n < 0 ? `owes ${money(-n)}` : 'all square';
    const pct = Math.round(Math.abs(n) / maxAbs * 50);
    div.innerHTML = `<span class="name">${esc(p.name)}</span><span class="net ${cls}">${esc(label)}</span>`
      + `<span class="sub">paid ${esc(money(t.paid[p.id] || 0))} · share ${esc(money(t.share[p.id] || 0))}</span>`
      + `<span class="track"><i class="${cls}" style="${n >= 0 ? 'left:50%' : 'right:50%'};width:${pct}%"></i></span>`;
    els.balances.appendChild(div);
  }
  els.balHint.hidden = !S.people.length;
  const plan = C.settle(net);
  els.plan.replaceChildren(...plan.map(tr => { const li = document.createElement('li'); li.innerHTML = `${esc(nameOf(tr.from))} pays ${esc(nameOf(tr.to))} <span class="amt">${esc(money(tr.cents))}</span>`; return li; }));
  els.planNote.textContent = !S.expenses.length ? 'The plan appears once there are expenses.' : plan.length ? `${plan.length} transfer${plan.length === 1 ? '' : 's'} and everyone is square.` : 'Everyone is square already.';
}

// ---------- people ----------
els.personForm.addEventListener('submit', e => {
  e.preventDefault();
  const name = els.personName.value.trim();
  if (!name) return;
  if (S.people.some(p => p.name.toLowerCase() === name.toLowerCase())) { toast(`${name} is already in the group.`); return; }
  S.people.push({ id: uid(), name }); els.personName.value = '';
  commit(); els.personName.focus();
});

// ---------- expenses ----------
els.form.querySelectorAll('input[name=split]').forEach(r => r.addEventListener('change', () => renderSplit()));
els.amount.addEventListener('input', updateSplitNote);
els.splitEqual.addEventListener('change', updateSplitNote);
els.form.addEventListener('submit', e => {
  e.preventDefault(); showError('');
  if (S.people.length < 2) return showError('Add at least two people first.');
  const desc = els.desc.value.trim(); if (!desc) return showError('Say what the expense was.');
  const cents = C.toCents(els.amount.value); if (!(cents > 0)) return showError('Enter an amount greater than zero.');
  const payer = els.payer.value; if (!payer) return showError('Choose who paid.');
  let split;
  if (splitMode() === 'equal') {
    const among = [...els.splitEqual.querySelectorAll('input:checked')].map(i => i.value);
    if (!among.length) return showError('Tick at least one person to share it.');
    split = { type: 'equal', among };
  } else {
    const amounts = {}; let sum = 0;
    for (const i of els.splitExact.querySelectorAll('input')) { const v = C.toCents(i.value) || 0; if (v < 0) return showError('Amounts cannot be negative.'); if (v > 0) { amounts[i.dataset.id] = v; sum += v; } }
    if (!Object.keys(amounts).length) return showError('Enter at least one amount.');
    if (sum !== cents) return showError(`The amounts add up to ${money(sum)} but the expense is ${money(cents)}.`);
    split = { type: 'exact', amounts };
  }
  const exp = { id: editing || uid(), desc, payer, cents, date: els.date.value || today(), split };
  if (editing) { const i = S.expenses.findIndex(x => x.id === editing); if (i >= 0) S.expenses[i] = exp; else S.expenses.push(exp); toast('Expense updated.'); }
  else { S.expenses.push(exp); toast(`Added ${money(cents)} for ${desc}.`); }
  resetForm(); commit();
});
function resetForm() {
  editing = null; els.heading.textContent = 'Add an expense'; els.save.textContent = 'Add expense'; els.cancel.hidden = true;
  els.desc.value = ''; els.amount.value = ''; els.date.value = today();
  els.form.querySelector('input[name=split][value=equal]').checked = true;
  renderSplit(new Set(S.people.map(p => p.id))); showError('');
}
els.cancel.addEventListener('click', () => { resetForm(); render(); });
els.rows.addEventListener('click', e => {
  const editId = e.target.dataset.edit, delId = e.target.dataset.del;
  if (editId) {
    const x = S.expenses.find(z => z.id === editId); if (!x) return;
    editing = x.id; els.heading.textContent = 'Edit expense'; els.save.textContent = 'Save changes'; els.cancel.hidden = false;
    els.desc.value = x.desc; els.amount.value = (x.cents / 100).toFixed(2); els.payer.value = x.payer; els.date.value = x.date || today();
    const exact = x.split && x.split.type === 'exact';
    els.form.querySelector(`input[name=split][value=${exact ? 'exact' : 'equal'}]`).checked = true;
    renderSplit(exact ? null : new Set(x.split && x.split.among && x.split.among.length ? x.split.among : S.people.map(p => p.id)));
    if (exact) for (const i of els.splitExact.querySelectorAll('input')) i.value = x.split.amounts[i.dataset.id] ? (x.split.amounts[i.dataset.id] / 100).toFixed(2) : '';
    updateSplitNote(); renderExpenses(); els.desc.focus(); els.form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else if (delId) {
    const x = S.expenses.find(z => z.id === delId); if (!x) return;
    if (!confirm(`Delete "${x.desc}" (${money(x.cents)})?`)) return;
    S.expenses = S.expenses.filter(z => z.id !== delId); if (editing === delId) resetForm();
    commit(); toast('Deleted.');
  }
});

// ---------- group bar ----------
els.name.addEventListener('input', () => { S.name = els.name.value; persist(); });
els.currency.addEventListener('change', () => { S.currency = els.currency.value; commit(); });
els.link.addEventListener('click', async () => {
  if (!hasData()) return toast('Add some people and expenses first.');
  persist();
  const url = location.href;
  try { await navigator.clipboard.writeText(url); toast('Link copied. Anyone who opens it sees this ledger.'); }
  catch (e) { prompt('Copy this link:', url); }
});
function download(name, text, type) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000);
}
const fileBase = () => (S.name || 'settle-up').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'settle-up';
els.csv.addEventListener('click', () => { if (!S.expenses.length) return toast('No expenses yet.'); download(`${fileBase()}-expenses.csv`, C.csvExpenses(S), 'text/csv'); });
els.csvPlan.addEventListener('click', () => { if (!S.expenses.length) return toast('No expenses yet.'); download(`${fileBase()}-settle-up.csv`, C.csvPlan(S, C.settle(C.balances(S))), 'text/csv'); });
els.print.addEventListener('click', () => window.print());
els.sample.addEventListener('click', () => {
  if (hasData() && !confirm('Replace the current ledger with the sample?')) return;
  S = C.sample(); resetForm(); commit(); toast('Sample loaded: five friends, one weekend.');
});
els.clear.addEventListener('click', () => {
  if (hasData() && !confirm('Clear everything? This removes the autosaved copy on this device too. Links you already shared keep working.')) return;
  S = empty(); try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
  resetForm(); commit();
});
window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (!h) return; try { S = C.decode(h); resetForm(); commit(); toast('Loaded the ledger from the link.'); } catch (e) { toast('That link could not be read.'); } });

// ---------- boot ----------
const source = load();
els.date.value = today();
resetForm(); render();
if (source === 'link') toast('Loaded the ledger from the link. Changes update the address bar; copy it to share again.');
window.__settleup = { get state() { return S; }, core: C, load: s => { S = s; resetForm(); commit(); } };
})();
