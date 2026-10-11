/* UV Index Now — live ARPANSA readings. The feed allows cross origin requests, so the browser
   fetches it directly: no server of ours sits in between. City choice is kept in localStorage. */
(() => {
'use strict';
const U = window.UvCore;
const $ = id => document.getElementById(id);
const KEY = 'pot:uv-index:station';
const els = { station: $('station'), reading: $('reading'), number: $('number'), cat: $('cat'), advice: $('advice'),
  when: $('when'), status: $('status'), all: $('all') };
if (!U) { els.status.textContent = 'The page did not load completely. Reload and try again.'; return; }

let stations = [];
let timer = null;
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = v => { try { localStorage.setItem(KEY, v); } catch { /* private mode: fine */ } };

// A sensible default from the browser's time zone, before anyone picks.
function guessStation() {
  const tz = (Intl.DateTimeFormat().resolvedOptions().timeZone || '').split('/')[1] || '';
  const map = { Sydney: 'Sydney', Melbourne: 'Melbourne', Brisbane: 'Brisbane', Perth: 'Perth', Adelaide: 'Adelaide', Hobart: 'Kingston', Darwin: 'Darwin' };
  return map[tz] || 'Sydney';
}

function show() {
  const now = Date.now();
  const chosen = stations.find(s => s.id === els.station.value) || stations[0];
  if (!chosen) return;
  const cat = U.category(chosen.index);
  els.reading.hidden = false;
  els.number.textContent = chosen.index.toFixed(1).replace(/\.0$/, '');
  els.number.className = `uv-number uv-${cat.key}`;
  els.cat.textContent = cat.label;
  els.advice.textContent = U.advice(chosen.index);
  const ago = U.minutesAgo(chosen, now);
  els.when.textContent = U.isStale(chosen, now)
    ? `This reading is out of date (${ago} minutes old). The sensor may be offline.`
    : `Measured ${chosen.localTime} local time, ${ago === 0 ? 'just now' : `${ago} minute${ago === 1 ? '' : 's'} ago`}.`;

  els.all.textContent = '';
  for (const s of stations) {
    const b = document.createElement('button');
    b.type = 'button';
    if (U.isStale(s, now)) b.classList.add('stale');
    const name = document.createElement('span'); name.textContent = s.name;
    const value = document.createElement('b'); value.textContent = s.index.toFixed(1).replace(/\.0$/, '');
    value.className = `uv-${U.category(s.index).key}`;
    b.append(name, value);
    b.setAttribute('aria-label', `${s.name}: UV ${s.index}, ${U.category(s.index).label}`);
    b.addEventListener('click', () => { els.station.value = s.id; write(s.id); show(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    els.all.append(b);
  }
}

async function refresh() {
  try {
    const res = await fetch(U.FEED_URL, { cache: 'no-store' });
    if (!res.ok) throw new Error(String(res.status));
    const parsed = U.parseFeed(await res.text());
    if (!parsed.length) throw new Error('empty');
    // Antarctic stations last; cities first, alphabetically.
    stations = parsed.sort((a, b) => (a.antarctic - b.antarctic) || a.name.localeCompare(b.name));
    const current = els.station.value || read() || guessStation();
    els.station.textContent = '';
    for (const s of stations) { const o = document.createElement('option'); o.value = s.id; o.textContent = s.name; els.station.append(o); }
    els.station.value = stations.some(s => s.id === current) ? current : stations[0].id;
    els.status.textContent = '';
    show();
  } catch {
    els.status.textContent = stations.length
      ? 'Couldn’t refresh just now; showing the last reading. It will try again shortly.'
      : 'Couldn’t reach ARPANSA’s UV feed. Check your connection and reload.';
  }
}

els.station.addEventListener('change', () => { write(els.station.value); show(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
refresh();
timer = setInterval(() => { if (!document.hidden) refresh(); }, 5 * 60 * 1000);
window.__uv = { refresh, get stations() { return stations; }, stop: () => clearInterval(timer) };
})();
