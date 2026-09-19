/* Settle Up core: money maths, balances, settlement plan, share link encoding, CSV.
   Pure functions, no DOM. UMD so node tests can require() it and the page can use SettleCore. */
(function (root) {
  'use strict';
  const VERSION = 1;

  // "12.50", "12,50", "1,234.56", "1.234,56", "$12" -> integer cents, or null if not a number.
  function toCents(input) {
    if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null;
    let s = String(input == null ? '' : input).trim().replace(/[^\d.,-]/g, '');
    if (!s || s === '-' ) return null;
    const lastDot = s.lastIndexOf('.'), lastComma = s.lastIndexOf(',');
    if (lastDot >= 0 && lastComma >= 0) {
      const dec = Math.max(lastDot, lastComma);
      s = s.slice(0, dec).replace(/[.,]/g, '') + '.' + s.slice(dec + 1).replace(/[.,]/g, '');
    } else if (lastComma >= 0) {
      const after = s.length - lastComma - 1;
      s = after > 0 && after <= 2 ? s.replace(',', '.') : s.replace(/,/g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }

  function fmt(cents, sym) {
    sym = sym == null ? '$' : sym;
    const neg = cents < 0, a = Math.abs(Math.round(cents));
    const whole = Math.floor(a / 100).toLocaleString('en-US');
    return (neg ? '-' : '') + sym + whole + '.' + String(a % 100).padStart(2, '0');
  }

  // Split cents into n integer parts; the first (cents mod n) parts carry the extra cent.
  function splitEqual(cents, n) {
    if (!(n > 0)) return [];
    const base = Math.floor(cents / n), rem = cents - base * n, out = [];
    for (let i = 0; i < n; i++) out.push(base + (i < rem ? 1 : 0));
    return out;
  }

  // {personId: cents} for one expense.
  function sharesOf(exp, people) {
    if (exp.split && exp.split.type === 'exact') return Object.assign({}, exp.split.amounts || {});
    const ids = people.map(p => p.id);
    const among = exp.split && Array.isArray(exp.split.among) && exp.split.among.length
      ? exp.split.among.filter(id => ids.includes(id)) : ids;
    const parts = splitEqual(exp.cents, among.length), out = {};
    among.forEach((id, i) => { out[id] = parts[i]; });
    return out;
  }

  // Net position per person: positive = is owed money, negative = owes money. Sums to zero.
  function balances(state) {
    const net = {};
    for (const p of state.people) net[p.id] = 0;
    for (const e of state.expenses) {
      if (!(e.payer in net)) continue;
      net[e.payer] += e.cents;
      const sh = sharesOf(e, state.people);
      for (const id in sh) if (id in net) net[id] -= sh[id];
    }
    return net;
  }

  function totals(state) {
    const paid = {}, share = {};
    for (const p of state.people) { paid[p.id] = 0; share[p.id] = 0; }
    let total = 0;
    for (const e of state.expenses) {
      total += e.cents;
      if (e.payer in paid) paid[e.payer] += e.cents;
      const sh = sharesOf(e, state.people);
      for (const id in sh) if (id in share) share[id] += sh[id];
    }
    return { total, paid, share };
  }

  // Minimal transfer plan: repeatedly pay the largest creditor from the largest debtor.
  function settle(net) {
    const debtors = [], creditors = [];
    for (const id in net) {
      if (net[id] < 0) debtors.push({ id, amt: -net[id] });
      else if (net[id] > 0) creditors.push({ id, amt: net[id] });
    }
    debtors.sort((a, b) => b.amt - a.amt || (a.id < b.id ? -1 : 1));
    creditors.sort((a, b) => b.amt - a.amt || (a.id < b.id ? -1 : 1));
    const out = [];
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const d = debtors[i], c = creditors[j], x = Math.min(d.amt, c.amt);
      if (x > 0) out.push({ from: d.id, to: c.id, cents: x });
      d.amt -= x; c.amt -= x;
      if (d.amt === 0) i++;
      if (c.amt === 0) j++;
    }
    return out;
  }

  function validate(state) {
    const errors = [];
    if (!state || !Array.isArray(state.people) || !Array.isArray(state.expenses)) return ['This is not a Settle Up ledger.'];
    const ids = new Set(), names = new Set(), expIds = new Set();
    const okId = id => typeof id === 'string' && /^[\w-]{1,40}$/.test(id);
    for (const p of state.people) {
      if (!p || !p.id || !String(p.name || '').trim()) { errors.push('Every person needs a name.'); continue; }
      if (!okId(p.id)) { errors.push('This ledger contains an invalid id.'); continue; }
      if (ids.has(p.id)) errors.push('Duplicate person id.');
      const n = String(p.name).trim().toLowerCase();
      if (names.has(n)) errors.push(`Two people are called "${p.name.trim()}". Give one of them a different name.`);
      ids.add(p.id); names.add(n);
    }
    state.expenses.forEach((e, i) => {
      const label = e && e.desc ? `"${e.desc}"` : `expense ${i + 1}`;
      if (!e || !Number.isInteger(e.cents) || e.cents <= 0) { errors.push(`${label}: the amount must be more than zero.`); return; }
      if (!okId(e.id) || expIds.has(e.id)) { errors.push(`${label}: invalid or duplicate expense id.`); return; }
      expIds.add(e.id);
      if (!ids.has(e.payer)) errors.push(`${label}: the payer is not in the group.`);
      if (e.split && e.split.type === 'exact') {
        const am = e.split.amounts || {};
        let sum = 0, bad = false;
        for (const id in am) { if (!ids.has(id)) bad = true; if (!Number.isInteger(am[id]) || am[id] < 0) bad = true; sum += am[id]; }
        if (bad) errors.push(`${label}: a custom amount is invalid.`);
        else if (sum !== e.cents) errors.push(`${label}: the custom amounts add up to ${fmt(sum)} but the expense is ${fmt(e.cents)}.`);
        else if (!Object.keys(am).length) errors.push(`${label}: nobody is included in the split.`);
      } else if (e.split && Array.isArray(e.split.among)) {
        if (!e.split.among.length) errors.push(`${label}: nobody is included in the split.`);
        else if (e.split.among.some(id => !ids.has(id))) errors.push(`${label}: someone in the split is not in the group.`);
      }
    });
    return errors;
  }

  // Share link payload: JSON -> UTF-8 -> base64url. Node 18+ and browsers both have TextEncoder and btoa.
  function encode(state) {
    const json = JSON.stringify({ v: VERSION, n: state.name || '', c: state.currency || '$', p: state.people, e: state.expenses });
    const bytes = new TextEncoder().encode(json);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(str) {
    const b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (String(str || '').length % 4)) % 4);
    const bin = atob(b64), bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const obj = JSON.parse(new TextDecoder().decode(bytes));
    if (!obj || obj.v !== VERSION || !Array.isArray(obj.p) || !Array.isArray(obj.e)) throw new Error('Not a Settle Up link.');
    const state = { name: String(obj.n || ''), currency: String(obj.c || '$'), people: obj.p, expenses: obj.e };
    const errors = validate(state);
    if (errors.length) throw new Error(errors[0]);
    return state;
  }

  function csvCell(v) { const s = String(v == null ? '' : v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
  function nameOf(state, id) { const p = state.people.find(x => x.id === id); return p ? p.name : '?'; }
  function csvExpenses(state) {
    const rows = [['Date', 'Description', 'Paid by', 'Amount', 'Split']];
    for (const e of state.expenses) {
      const sh = sharesOf(e, state.people);
      const split = Object.keys(sh).map(id => `${nameOf(state, id)} ${(sh[id] / 100).toFixed(2)}`).join('; ');
      rows.push([e.date || '', e.desc || '', nameOf(state, e.payer), (e.cents / 100).toFixed(2), split]);
    }
    return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
  }
  function csvPlan(state, transfers) {
    const rows = [['From', 'To', 'Amount']];
    for (const t of transfers) rows.push([nameOf(state, t.from), nameOf(state, t.to), (t.cents / 100).toFixed(2)]);
    return rows.map(r => r.map(csvCell).join(',')).join('\n') + '\n';
  }

  function sample() {
    const P = ['Mia', 'Tom', 'Priya', 'Jack', 'Leo'].map((name, i) => ({ id: 'p' + (i + 1), name }));
    const all = P.map(p => p.id);
    const ex = (desc, payer, amount, date, among) => ({ id: 'e' + Math.random().toString(36).slice(2, 8), desc, payer, cents: Math.round(amount * 100), date, split: { type: 'equal', among: among || all } });
    return {
      name: 'Jervis Bay weekend', currency: 'A$', people: P,
      expenses: [
        ex('Airbnb, two nights', 'p1', 860.00, '2026-09-11'),
        ex('Groceries', 'p2', 143.60, '2026-09-11'),
        ex('Fuel', 'p3', 92.35, '2026-09-11'),
        ex('Fish and chips', 'p4', 78.50, '2026-09-12', ['p1', 'p2', 'p3', 'p4']),
        ex('Kayak hire', 'p5', 120.00, '2026-09-12', ['p1', 'p4', 'p5']),
        ex('Coffees', 'p2', 31.20, '2026-09-13'),
        ex('Ice', 'p3', 6.00, '2026-09-13'),
        ex('Bottle shop', 'p1', 64.90, '2026-09-12', ['p1', 'p2', 'p4', 'p5'])
      ]
    };
  }

  const api = { VERSION, toCents, fmt, splitEqual, sharesOf, balances, totals, settle, validate, encode, decode, csvExpenses, csvPlan, sample };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SettleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
