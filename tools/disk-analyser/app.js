/* What's Eating My Disk — page logic.
   Two ways in: the File System Access API, which Chromium desktop grants per folder and
   which is the only route that can also remove a file, and a plain folder input, which
   every browser supports and which can only read. The analysis is identical either way. */
(function () {
  'use strict';
  const C = window.DiskCore;
  if (!C) return;

  const $ = id => document.getElementById(id);
  const el = {
    pick: $('da-pick'), open: $('da-open'), input: $('da-input'), inputLabel: $('da-input-label'),
    demo: $('da-demo'), cancel: $('da-cancel'), modeNote: $('da-mode-note'),
    status: $('da-status'), error: $('da-error'), results: $('da-results'),
    summary: $('da-summary'), csv: $('da-csv'), reset: $('da-reset'),
    crumbs: $('da-crumbs'), map: $('da-map'), mapNote: $('da-map-note'),
    largest: $('da-largest'), types: $('da-types'),
    dupeMin: $('da-dupe-min'), dupeRun: $('da-dupe-run'), dupeStop: $('da-dupe-stop'),
    dupeStatus: $('da-dupe-status'), dupes: $('da-dupes'),
    staleAge: $('da-stale-age'), staleMin: $('da-stale-min'), stale: $('da-stale'),
    removeCard: $('da-remove-card'), selected: $('da-selected'),
    remove: $('da-remove'), clearSel: $('da-clear-sel'), removeStatus: $('da-remove-status'),
  };

  const HAS_FS_ACCESS = typeof window.showDirectoryPicker === 'function';
  const TILE_COLOURS = ['#0b6b50', '#1d6fa5', '#6d4aa8', '#a3521c', '#96143c', '#7a6a12', '#3f6b19', '#15616d'];

  const state = {
    rootName: '', files: [], tree: null, cwd: '',
    access: new Map(),        // path -> { getFile(), remove() | null }
    canRemove: false,
    selected: new Set(),
    dupeSets: [],
    scanning: false, cancelled: false,
  };

  // ---------- small helpers ----------
  const fmt = C.formatBytes;
  function formatDate(ms) {
    if (!ms) return '—';
    const d = new Date(ms);
    return Number.isFinite(d.getTime())
      ? d.toLocaleDateString('en-AU', { year: 'numeric', month: 'short', day: 'numeric' })
      : '—';
  }
  function setStatus(text) { el.status.textContent = text || ''; }
  function showError(text) {
    el.error.textContent = text || '';
    el.error.hidden = !text;
  }
  // Coloured by position rather than by a hash of the name. Tiles are laid out biggest
  // first, so neighbours are always adjacent indices and therefore always different
  // colours; hashing the name let two large neighbours collide and read as one block.
  function colourAt(index) {
    return TILE_COLOURS[index % TILE_COLOURS.length];
  }
  const yieldToPage = () => new Promise(r => setTimeout(r, 0));

  // ---------- scanning ----------
  async function walkDirectory(dirHandle, prefix, collect, onProgress) {
    for await (const [name, handle] of dirHandle.entries()) {
      if (state.cancelled) return;
      const path = prefix ? prefix + '/' + name : name;
      if (handle.kind === 'directory') {
        await walkDirectory(handle, path, collect, onProgress);
      } else {
        let f;
        try {
          f = await handle.getFile();
        } catch {
          continue;                       // a file the browser cannot open is simply skipped
        }
        collect.push({ path, size: f.size, mtime: f.lastModified });
        state.access.set(path, {
          getFile: () => dirHandle.getFileHandle(name).then(h => h.getFile()),
          remove: () => dirHandle.removeEntry(name),
        });
        if (collect.length % 400 === 0) {
          onProgress(collect.length);
          await yieldToPage();
        }
      }
    }
  }

  async function scanWithAccess() {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker({ mode: 'readwrite', id: 'pot-disk' });
    } catch (err) {
      if (err && err.name === 'AbortError') return;      // the person closed the picker
      showError('That folder could not be opened. ' + (err && err.message ? err.message : ''));
      return;
    }
    let canRemove = false;
    try {
      canRemove = (await dirHandle.queryPermission({ mode: 'readwrite' })) === 'granted';
    } catch { canRemove = false; }

    beginScan(dirHandle.name);
    const collect = [];
    try {
      await walkDirectory(dirHandle, '', collect, n => setStatus(`Reading… ${C.formatCount(n)} files so far.`));
    } catch (err) {
      endScan();
      showError('The scan stopped: ' + (err && err.message ? err.message : String(err)));
      return;
    }
    finishScan(collect, canRemove);
  }

  function scanFromInput(fileList) {
    const list = Array.from(fileList || []);
    if (!list.length) return;
    const first = list[0].webkitRelativePath || list[0].name;
    beginScan(C.segments(first)[0] || 'Selected folder');
    const collect = [];
    for (const f of list) {
      const rel = f.webkitRelativePath || f.name;
      const path = C.segments(rel).slice(1).join('/') || f.name;
      collect.push({ path, size: f.size, mtime: f.lastModified });
      state.access.set(path, { getFile: () => Promise.resolve(f), remove: null });
    }
    finishScan(collect, false);
  }

  function beginScan(rootName) {
    state.rootName = rootName;
    state.cancelled = false;
    state.scanning = true;
    state.access = new Map();
    state.selected = new Set();
    state.dupeSets = [];
    showError('');
    el.cancel.hidden = false;
    el.results.hidden = true;
    setStatus('Reading…');
  }

  function endScan() {
    state.scanning = false;
    el.cancel.hidden = true;
  }

  function finishScan(collect, canRemove) {
    endScan();
    if (state.cancelled) { setStatus('Scan stopped. Nothing was changed.'); return; }
    const { files, skipped } = C.cleanEntries(collect);
    if (!files.length) {
      setStatus('');
      showError('That folder has no readable files in it.');
      return;
    }
    state.files = files;
    state.tree = C.buildTree(files);
    state.cwd = '';
    state.canRemove = Boolean(canRemove);
    el.removeCard.hidden = !state.canRemove;
    el.results.hidden = false;
    setStatus(skipped
      ? `Read ${C.formatCount(files.length)} files. ${C.formatCount(skipped)} were skipped because the browser could not read their details.`
      : `Read ${C.formatCount(files.length)} files.`);
    renderAll();
    el.results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------- rendering ----------
  function renderAll() {
    renderSummary();
    renderMap();
    renderLargest();
    renderTypes();
    renderStale();
    el.dupes.innerHTML = '';
    el.dupeStatus.textContent = '';
    updateSelection();
  }

  function renderSummary() {
    const s = C.summarise(state.files);
    const rows = [
      ['Folder', state.rootName],
      ['Total size', fmt(s.size)],
      ['Files', C.formatCount(s.count)],
      ['Oldest file', formatDate(s.oldest)],
    ];
    el.summary.innerHTML = '';
    for (const [label, value] of rows) {
      const wrap = document.createElement('div');
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = value;
      wrap.append(dt, dd);
      el.summary.append(wrap);
    }
  }

  function renderCrumbs() {
    el.crumbs.innerHTML = '';
    const parts = C.segments(state.cwd);
    const make = (label, path, isLast) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (isLast) b.disabled = true;
      else b.addEventListener('click', () => { state.cwd = path; renderMap(); });
      el.crumbs.append(b);
    };
    make(state.rootName || 'Folder', '', parts.length === 0);
    let walked = '';
    parts.forEach((part, i) => {
      walked = walked ? walked + '/' + part : part;
      const sep = document.createElement('span');
      sep.className = 'sep';
      sep.textContent = '/';
      el.crumbs.append(sep);
      make(part, walked, i === parts.length - 1);
    });
  }

  function renderMap() {
    renderCrumbs();
    el.map.innerHTML = '';
    const node = C.nodeAt(state.tree, state.cwd);
    const children = C.childrenOf(node);
    const withSize = children.filter(c => c.size > 0);

    if (!withSize.length) {
      const p = document.createElement('p');
      p.className = 'da-map-empty';
      p.textContent = children.length
        ? 'Everything in this folder is empty.'
        : 'This folder has nothing in it.';
      el.map.append(p);
      el.mapNote.textContent = '';
      return;
    }

    // Drawing thousands of tiles helps nobody; the tail is rolled into one.
    const LIMIT = 120;
    let shown = withSize;
    let rest = null;
    if (withSize.length > LIMIT) {
      shown = withSize.slice(0, LIMIT);
      const tailSize = withSize.slice(LIMIT).reduce((a, c) => a + c.size, 0);
      if (tailSize > 0) {
        rest = { name: `${withSize.length - LIMIT} smaller items`, size: tailSize, isDir: false, rest: true };
        shown = shown.concat([rest]);
      }
    }

    const rect = { x: 0, y: 0, w: el.map.clientWidth || 800, h: el.map.clientHeight || 420 };
    const total = node.size || 1;
    let index = 0;
    for (const r of C.squarify(shown, rect)) {
      const item = r.item;
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'da-tile';
      tile.dataset.kind = item.isDir ? 'dir' : 'file';
      tile.style.left = r.x + 'px';
      tile.style.top = r.y + 'px';
      tile.style.width = Math.max(0, r.w - 1) + 'px';
      tile.style.height = Math.max(0, r.h - 1) + 'px';
      tile.style.background = colourAt(index++);
      const share = Math.round((item.size / total) * 100);
      tile.setAttribute('aria-label',
        `${item.name}, ${fmt(item.size)}, ${share}% of this folder${item.isDir ? '. Open folder' : ''}`);
      if (r.w < 54 || r.h < 26) tile.classList.add('tiny');
      const b = document.createElement('b');
      b.textContent = item.name;
      const span = document.createElement('span');
      span.textContent = fmt(item.size);
      tile.append(b, span);
      if (item.isDir) {
        tile.addEventListener('click', () => { state.cwd = item.path; renderMap(); });
      } else {
        tile.disabled = !item.rest ? false : true;
        if (item.rest) tile.style.cursor = 'default';
      }
      el.map.append(tile);
    }
    el.mapNote.textContent = `${C.formatCount(children.length)} items here, ${fmt(node.size)} in total.`;
  }

  function fillTable(table, rows) {
    const body = table.querySelector('tbody');
    body.innerHTML = '';
    if (!rows.length) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 3;
      td.className = 'da-empty';
      td.textContent = 'Nothing to show.';
      tr.append(td);
      body.append(tr);
      return;
    }
    for (const f of rows) {
      const tr = document.createElement('tr');
      const name = document.createElement('td');
      name.className = 'path';
      const dir = C.parentPath(f.path);
      if (dir) {
        const small = document.createElement('span');
        small.className = 'dir';
        small.textContent = dir + '/';
        name.append(small);
      }
      name.append(document.createTextNode(C.baseName(f.path)));
      const size = document.createElement('td');
      size.className = 'num';
      size.textContent = fmt(f.size);
      const when = document.createElement('td');
      when.className = 'num';
      when.textContent = formatDate(f.mtime);
      tr.append(name, size, when);
      body.append(tr);
    }
  }

  function renderLargest() { fillTable(el.largest, C.largestFiles(state.files, 50)); }

  function renderStale() {
    const days = Number(el.staleAge.value) || 365;
    const min = Number(el.staleMin.value) || 0;
    const cutoff = Date.now() - days * 86400000;
    fillTable(el.stale, C.staleFiles(state.files, cutoff, min).slice(0, 50));
  }

  function renderTypes() {
    const cats = C.byCategory(state.files);
    const total = cats.reduce((a, c) => a + c.size, 0) || 1;
    el.types.innerHTML = '';
    for (const c of cats) {
      const row = document.createElement('div');
      row.className = 'da-bar';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = c.name;
      const value = document.createElement('span');
      value.className = 'value';
      value.textContent = `${fmt(c.size)} · ${C.formatCount(c.count)} files`;
      const track = document.createElement('span');
      track.className = 'track';
      const fill = document.createElement('span');
      fill.className = 'fill';
      fill.style.width = Math.max(1, Math.round((c.size / total) * 100)) + '%';
      track.append(fill);
      row.append(label, value, track);
      el.types.append(row);
    }
  }

  // ---------- duplicates ----------
  let dupeRunning = false;
  let dupeCancelled = false;

  async function sha256(buffer) {
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function hashFile(path, bytes) {
    const entry = state.access.get(path);
    if (!entry) return null;
    const file = await entry.getFile();
    const blob = bytes && file.size > bytes ? file.slice(0, bytes) : file;
    return sha256(await blob.arrayBuffer());
  }

  /** Groups a candidate list by a hash, skipping anything that cannot be read. */
  async function groupByHash(list, bytes, onStep) {
    const out = new Map();
    for (const f of list) {
      if (dupeCancelled) return out;
      let key;
      try {
        key = await hashFile(f.path, bytes);
      } catch {
        key = null;
      }
      if (key) {
        const arr = out.get(key);
        if (arr) arr.push(f); else out.set(key, [f]);
      }
      onStep(f.size);
      await yieldToPage();
    }
    return out;
  }

  async function findDuplicates() {
    if (dupeRunning) return;
    const min = Number(el.dupeMin.value) || 1;
    const groups = C.sizeGroups(state.files, min);
    const work = C.hashWorkload(groups);
    if (!groups.length) {
      el.dupeStatus.textContent = 'No two files in this folder are even the same size, so there are no duplicates to find.';
      el.dupes.innerHTML = '';
      return;
    }

    dupeRunning = true;
    dupeCancelled = false;
    el.dupeRun.disabled = true;
    el.dupeStop.hidden = false;
    el.dupes.innerHTML = '';

    // Pass one reads only the first slice of each candidate, which rules most pairs out
    // for the price of one block. Pass two reads in full only what still matches.
    let done = 0;
    const report = () => {
      el.dupeStatus.textContent =
        `Comparing ${C.formatCount(work.files)} files that share a size… ${Math.min(100, Math.round((done / Math.max(1, work.bytes)) * 100))}%`;
    };
    report();

    const confirmed = new Map();
    for (const group of groups) {
      if (dupeCancelled) break;
      const quick = await groupByHash(group, C.QUICK_HASH_BYTES, b => { done += Math.min(b, C.QUICK_HASH_BYTES); report(); });
      for (const [, maybe] of quick) {
        if (dupeCancelled) break;
        if (maybe.length < 2) continue;
        if (maybe[0].size <= C.QUICK_HASH_BYTES) {
          confirmed.set(maybe[0].path + ':' + maybe[0].size, maybe);   // already compared in full
          continue;
        }
        const full = await groupByHash(maybe, 0, b => { done += b; report(); });
        for (const [key, same] of full) if (same.length > 1) confirmed.set(key, same);
      }
    }

    state.dupeSets = C.duplicateSets(confirmed);
    dupeRunning = false;
    el.dupeRun.disabled = false;
    el.dupeStop.hidden = true;
    renderDuplicates(dupeCancelled);
  }

  function renderDuplicates(partial) {
    const sets = state.dupeSets;
    const wasted = C.totalWasted(sets);
    el.dupeStatus.textContent = sets.length
      ? `${C.formatCount(sets.length)} sets of identical files${partial ? ' so far' : ''}. Deleting all but one of each would free ${fmt(wasted)}.`
      : (partial ? 'Stopped. No identical files found before stopping.' : 'No identical files found.');

    el.dupes.innerHTML = '';
    for (const set of sets.slice(0, 200)) {
      const box = document.createElement('div');
      box.className = 'da-dupe';
      const h = document.createElement('h3');
      h.textContent = `${C.formatCount(set.count)} copies · ${fmt(set.size)} each · ${fmt(set.wasted)} could be freed`;
      box.append(h);
      const ul = document.createElement('ul');
      set.files.forEach((f, i) => {
        const li = document.createElement('li');
        if (state.canRemove) {
          const label = document.createElement('label');
          const cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.checked = state.selected.has(f.path);
          cb.addEventListener('change', () => {
            if (cb.checked) state.selected.add(f.path); else state.selected.delete(f.path);
            updateSelection();
          });
          const path = document.createElement('span');
          path.className = 'path';
          path.textContent = f.path;
          label.append(cb, path);
          li.append(label);
        } else {
          const path = document.createElement('span');
          path.className = 'path';
          path.textContent = f.path;
          li.append(path);
        }
        if (i === 0) {
          const keep = document.createElement('span');
          keep.className = 'keep';
          keep.textContent = 'first copy';
          li.append(keep);
        }
        ul.append(li);
      });
      box.append(ul);
      el.dupes.append(box);
    }
    if (sets.length > 200) {
      const p = document.createElement('p');
      p.className = 'da-hint';
      p.textContent = `Showing the 200 sets that would free the most space, out of ${C.formatCount(sets.length)}.`;
      el.dupes.append(p);
    }
  }

  // ---------- removing ----------
  function updateSelection() {
    const paths = Array.from(state.selected);
    const bytes = paths.reduce((a, p) => {
      const f = state.files.find(x => x.path === p);
      return a + (f ? f.size : 0);
    }, 0);
    el.selected.textContent = paths.length
      ? `${C.formatCount(paths.length)} files selected, ${fmt(bytes)}.`
      : 'Nothing selected.';
    el.remove.disabled = !paths.length;
  }

  /**
   * Removes one file only when the thing on disk still matches what was scanned.
   * Exported for tests, which run it against the origin private file system.
   */
  async function removeVerified(entry, record) {
    if (!entry || typeof entry.remove !== 'function') return { ok: false, reason: 'no-access' };
    let file;
    try {
      file = await entry.getFile();
    } catch {
      return { ok: false, reason: 'missing' };
    }
    if (file.size !== record.size) return { ok: false, reason: 'size-changed' };
    if (record.mtime && Math.abs(file.lastModified - record.mtime) > 1000) {
      return { ok: false, reason: 'changed-since-scan' };
    }
    try {
      await entry.remove();
    } catch (err) {
      return { ok: false, reason: err && err.name === 'NotAllowedError' ? 'not-allowed' : 'failed' };
    }
    return { ok: true };
  }

  async function removeSelected() {
    const paths = Array.from(state.selected);
    if (!paths.length) return;
    const bytes = paths.reduce((a, p) => {
      const f = state.files.find(x => x.path === p);
      return a + (f ? f.size : 0);
    }, 0);
    const ok = window.confirm(
      `Remove ${paths.length} file${paths.length === 1 ? '' : 's'} (${fmt(bytes)}) from ${state.rootName}?\n\n` +
      'This cannot be undone and nothing goes to a recycle bin.');
    if (!ok) return;

    el.remove.disabled = true;
    let removed = 0, freed = 0;
    const refused = [];
    for (const path of paths) {
      const record = state.files.find(x => x.path === path);
      if (!record) continue;
      const result = await removeVerified(state.access.get(path), record);
      if (result.ok) {
        removed++;
        freed += record.size;
        state.files = state.files.filter(x => x.path !== path);
        state.access.delete(path);
      } else {
        refused.push(path + ' (' + result.reason + ')');
      }
      state.selected.delete(path);
    }
    state.tree = C.buildTree(state.files);
    state.dupeSets = state.dupeSets
      .map(s => Object.assign({}, s, { files: s.files.filter(f => state.access.has(f.path)) }))
      .filter(s => s.files.length > 1);
    renderAll();
    renderDuplicates(false);
    el.removeStatus.textContent = refused.length
      ? `Removed ${C.formatCount(removed)} files, freeing ${fmt(freed)}. ${refused.length} were left alone because they had changed since the scan: ${refused.slice(0, 5).join(', ')}`
      : `Removed ${C.formatCount(removed)} files, freeing ${fmt(freed)}.`;
  }

  // ---------- export ----------
  function exportCsv() {
    const esc = v => {
      const s = String(v == null ? '' : v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = ['path,bytes,size,category,last modified'];
    for (const f of C.largestFiles(state.files, state.files.length)) {
      lines.push([esc(f.path), f.size, esc(fmt(f.size)), esc(C.categoryOf(f.path)),
        esc(f.mtime ? new Date(f.mtime).toISOString() : '')].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (state.rootName || 'folder').replace(/[^\w.-]+/g, '-') + '-disk-usage.csv';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // ---------- sample ----------
  function sampleFiles() {
    const now = Date.now();
    const DAY = 86400000;
    const out = [];
    const add = (path, size, ageDays) => out.push({ path, size, mtime: now - ageDays * DAY });
    add('Photos/2023/Italy/DSC_0041.jpg', 6.2e6, 700);
    add('Photos/2023/Italy/DSC_0042.jpg', 6.4e6, 700);
    add('Photos/2023/Italy/DSC_0043.jpg', 5.9e6, 700);
    add('Photos/2024/Phone backup/IMG_2201.heic', 3.1e6, 300);
    add('Photos/2024/Phone backup/IMG_2202.heic', 3.3e6, 300);
    add('Photos/Duplicates/DSC_0041.jpg', 6.2e6, 120);
    add('Video/holiday-final.mov', 2.4e9, 400);
    add('Video/holiday-final-v2.mov', 2.4e9, 380);
    add('Video/screen-recording.mp4', 380e6, 30);
    add('Downloads/ubuntu-24.04.iso', 5.7e9, 900);
    add('Downloads/node-installer.pkg', 78e6, 500);
    add('Downloads/statement.pdf', 240e3, 60);
    add('Documents/Tax/2023 return.pdf', 1.1e6, 620);
    add('Documents/Tax/receipts.zip', 44e6, 620);
    add('Documents/notes.md', 18e3, 2);
    add('Projects/site/node_modules-cache.tar.gz', 890e6, 200);
    add('Projects/site/app.js', 92e3, 5);
    return out;
  }

  /**
   * Backing blobs for the sample, so "Find duplicates" genuinely finds the two pairs
   * rather than silently reporting none. The contents are tiny; the sizes shown are the
   * made up ones, which the page says plainly.
   */
  function sampleAccess(files) {
    const identical = {
      'Photos/2023/Italy/DSC_0041.jpg': 'italy-0041',
      'Photos/Duplicates/DSC_0041.jpg': 'italy-0041',
      'Video/holiday-final.mov': 'holiday-master',
      'Video/holiday-final-v2.mov': 'holiday-master',
    };
    for (const f of files) {
      const body = identical[f.path] || 'unique:' + f.path;
      const blob = new Blob([body], { type: 'application/octet-stream' });
      state.access.set(f.path, {
        getFile: () => Promise.resolve(new File([blob], C.baseName(f.path), { lastModified: f.mtime })),
        remove: null,
      });
    }
  }

  // ---------- wiring ----------
  if (HAS_FS_ACCESS) {
    el.open.hidden = false;
    el.inputLabel.hidden = true;
    el.modeNote.textContent = 'Your browser can also remove files from the folder you pick, once you allow it.';
  } else {
    el.modeNote.textContent = 'Your browser can read a folder but cannot delete from it. The scan and every report work; removing files is a Chromium desktop feature. You will get a list you can act on yourself.';
  }

  el.open.addEventListener('click', scanWithAccess);
  el.input.addEventListener('change', () => { scanFromInput(el.input.files); el.input.value = ''; });
  el.cancel.addEventListener('click', () => { state.cancelled = true; setStatus('Stopping…'); });
  el.demo.addEventListener('click', () => {
    const files = sampleFiles();
    beginScan('Sample folder');
    finishScan(files, false);
    sampleAccess(files);
    setStatus('This is a made up folder so you can see what the reports look like. Nothing on your device was read.');
  });
  el.reset.addEventListener('click', () => {
    el.results.hidden = true;
    state.files = [];
    state.access = new Map();
    state.selected = new Set();
    setStatus('');
    el.pick.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  el.csv.addEventListener('click', exportCsv);
  el.dupeRun.addEventListener('click', findDuplicates);
  el.dupeStop.addEventListener('click', () => { dupeCancelled = true; });
  el.staleAge.addEventListener('change', renderStale);
  el.staleMin.addEventListener('change', renderStale);
  el.remove.addEventListener('click', removeSelected);
  el.clearSel.addEventListener('click', () => { state.selected = new Set(); renderDuplicates(false); updateSelection(); });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (el.results.hidden) return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(renderMap, 150);
  });

  // Hook for the browser tests.
  window.__diskAnalyser = {
    state, removeVerified, sampleFiles,
    loadSample: () => {
      const files = sampleFiles();
      beginScan('Sample folder');
      finishScan(files, false);
      sampleAccess(files);
    },
    loadFiles: (files, canRemove) => { beginScan('Test folder'); finishScan(files, canRemove); },
    setAccess: (path, entry) => state.access.set(path, entry),
    renderMap,
  };
})();
