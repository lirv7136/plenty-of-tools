/* Image Converter — HEIC to JPG, batch resize, EXIF stripping. Everything runs in the browser.
   Native decoding first (createImageBitmap), libheif in a worker for HEIC/HEIF where the browser
   cannot read it. Re-encoding through a canvas drops all metadata by construction. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const els = {
  drop: $('drop'), file: $('file'), sample: $('btn-sample'), err: $('open-error'),
  quality: $('quality'), qualityOut: $('quality-out'), optQuality: $('opt-quality'), optTarget: $('opt-target'),
  resize: $('resize'), resizeCustom: $('resize-custom'), target: $('target'),
  work: $('work'), convert: $('btn-convert'), zip: $('btn-zip'), clear: $('btn-clear'), summary: $('summary'), list: $('list')
};
const WORKER_URL = '/assets/image-converter/heic-worker.js';
const EXT = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const items = [];
let uid = 0, running = false;
const optsKey = () => JSON.stringify(opts());
const isStale = () => items.some(it => it.state === 'done' && it.optsKey !== optsKey());

const fmtBytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function showError(msg) { els.err.textContent = msg || ''; els.err.hidden = !msg; }

// WebP encoding is not available everywhere; grey the option out rather than fail later.
const canWebp = (() => { try { return document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp'); } catch (e) { return false; } })();
if (!canWebp) { const r = document.querySelector('input[name=fmt][value="image/webp"]'); r.disabled = true; r.parentElement.title = 'Your browser cannot save WebP'; }

// ---------- options ----------
function opts() {
  const fmt = document.querySelector('input[name=fmt]:checked').value;
  const max = els.resize.value === 'custom' ? Math.max(0, Math.floor(+els.resizeCustom.value) || 0) : +els.resize.value;
  return { fmt, q: +els.quality.value / 100, max, targetKB: +els.target.value, lossy: fmt !== 'image/png' };
}
function syncOptionUi() {
  const o = opts();
  els.optQuality.hidden = !o.lossy; els.optTarget.hidden = !o.lossy;
  els.resizeCustom.hidden = els.resize.value !== 'custom';
  els.qualityOut.value = els.quality.value;
}
function optionsChanged() {
  syncOptionUi();
  updateButtons(); updateSummary();
}
document.querySelectorAll('#options input, #options select').forEach(el => { el.addEventListener('input', optionsChanged); el.addEventListener('change', optionsChanged); });
els.resize.addEventListener('change', () => { if (els.resize.value === 'custom') els.resizeCustom.focus(); });
syncOptionUi();

// ---------- adding files ----------
els.file.addEventListener('change', () => { addFiles(els.file.files); els.file.value = ''; });
['dragenter', 'dragover'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); els.drop.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(t => document.addEventListener(t, e => { e.preventDefault(); if (t === 'drop' || e.target === document.documentElement) els.drop.classList.remove('dragging'); }));
document.addEventListener('drop', e => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

const looksLikeImage = f => /^image\//.test(f.type) || /\.(heic|heif|hif|jpe?g|jfif|png|gif|webp|bmp|avif|tiff?)$/i.test(f.name);
function kindOf(f) {
  const m = f.name.match(/\.([a-z0-9]+)$/i);
  const ext = (m ? m[1] : (f.type.split('/')[1] || '')).toUpperCase();
  return ext === 'JPEG' || ext === 'JFIF' ? 'JPG' : ext || 'image';
}
function addFiles(files) {
  const skipped = [];
  for (const f of files) {
    if (!f.size) continue;
    if (!looksLikeImage(f)) { skipped.push(f.name); continue; }
    const it = { id: ++uid, file: f, name: f.name, size: f.size, kind: kindOf(f), state: 'queued' };
    items.push(it); mountRow(it);
  }
  showError(skipped.length ? `Skipped ${plural(skipped.length, 'file')} that ${skipped.length === 1 ? 'is' : 'are'} not a picture: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}` : '');
  els.work.hidden = items.length === 0;
  updateButtons();
  if (items.length) run();
}

function mountRow(it) {
  const row = document.createElement('div'); row.className = 'row'; row.dataset.id = String(it.id);
  row.innerHTML = '<img class="thumb" alt=""><div class="meta"><div class="name"></div><div class="hint in"></div><div class="hint out"></div></div>'
    + '<div class="row-actions"><a class="btn small dl" hidden download>Download</a><button class="icon del" type="button" aria-label="Remove">×</button></div>';
  row.querySelector('.name').textContent = it.name;
  row.querySelector('.in').textContent = `${it.kind} · ${fmtBytes(it.size)}`;
  row.querySelector('.del').addEventListener('click', () => removeItem(it));
  els.list.appendChild(row); it.row = row;
  setOut(it, 'Waiting…');
}
function setIn(it) {
  const el = it.row.querySelector('.in');
  el.textContent = `${it.kind} · ${it.width} × ${it.height} · ${fmtBytes(it.size)}`;
  if (it.gps) { const b = document.createElement('span'); b.className = 'badge gps'; b.title = 'The original carries GPS coordinates. The converted file will not.'; b.textContent = 'Location'; el.appendChild(b); }
  else if (it.exif) { const b = document.createElement('span'); b.className = 'badge'; b.title = 'The original carries camera metadata. The converted file will not.'; b.textContent = 'Metadata'; el.appendChild(b); }
}
function setOut(it, text, saved) { const el = it.row.querySelector('.out'); el.textContent = text; el.classList.toggle('saved', !!saved); }
function removeItem(it) {
  const i = items.indexOf(it); if (i >= 0) items.splice(i, 1);
  if (it.url) URL.revokeObjectURL(it.url);
  if (it.row) it.row.remove();
  els.work.hidden = items.length === 0;
  updateButtons(); updateSummary();
}
els.clear.addEventListener('click', () => { for (const it of items.slice()) removeItem(it); showError(''); });
els.convert.addEventListener('click', () => { for (const it of items) if (it.state !== 'working') it.state = 'queued'; run(); });

function updateButtons() {
  const done = items.filter(it => it.state === 'done').length;
  const queued = items.filter(it => it.state === 'queued').length;
  els.convert.disabled = running || items.length === 0;
  const stale = isStale();
  els.convert.textContent = running ? 'Converting…' : queued ? `Convert ${plural(queued, 'photo')}` : stale ? 'Convert again with these options' : 'Convert again';
  els.zip.disabled = running || done === 0;
  els.zip.textContent = done > 1 ? `Download all ${done} as ZIP` : 'Download all as ZIP';
}
function updateSummary(progress) {
  if (progress) { els.summary.textContent = progress; return; }
  const done = items.filter(it => it.state === 'done');
  const stale = isStale();
  if (!done.length) { els.summary.textContent = ''; return; }
  const inB = done.reduce((s, it) => s + it.size, 0), outB = done.reduce((s, it) => s + it.blob.size, 0);
  const gps = done.filter(it => it.gps).length, errs = items.filter(it => it.state === 'error').length;
  const pct = inB ? Math.round((1 - outB / inB) * 100) : 0;
  els.summary.textContent = `${plural(done.length, 'photo')} · ${fmtBytes(inB)} → ${fmtBytes(outB)}${pct > 0 ? ` (${pct}% smaller)` : ''}`
    + (gps ? ` · location data removed from ${gps}` : '') + (errs ? ` · ${plural(errs, 'file')} could not be converted` : '') + (stale ? ' · options changed, convert again to apply' : '');
}

// ---------- the conversion loop ----------
async function run() {
  if (running) return;
  running = true; updateButtons();
  const o = opts();
  try {
    for (;;) {
      const it = items.find(x => x.state === 'queued');
      if (!it) break;
      const idx = items.indexOf(it) + 1;
      updateSummary(`Converting ${idx} of ${items.length}: ${it.name}`);
      await convertItem(it, o);
      await new Promise(r => setTimeout(r, 0)); // let the page paint between files
    }
  } finally {
    running = false; updateButtons(); updateSummary();
  }
}

async function convertItem(it, o) {
  it.state = 'working'; it.row.classList.remove('err');
  if (it.url) { URL.revokeObjectURL(it.url); it.url = null; }
  setOut(it, 'Converting…');
  let src = null;
  try {
    src = await decode(it);
    it.width = src.width; it.height = src.height; it.gps = src.gps; it.exif = src.exif;
    setIn(it);
    const res = await encode(src, o);
    it.blob = res.blob; it.outW = res.width; it.outH = res.height;
    it.outName = outName(it.name, o.fmt); it.optsKey = JSON.stringify(o);
    it.url = URL.createObjectURL(res.blob);
    const thumb = it.row.querySelector('.thumb');
    thumb.src = res.thumb;
    const dl = it.row.querySelector('.dl'); dl.href = it.url; dl.download = it.outName; dl.hidden = false;
    const pct = Math.round((1 - res.blob.size / it.size) * 100);
    const resized = res.width !== src.width || res.height !== src.height;
    setOut(it, `→ ${labelOf(o.fmt)} · ${res.width} × ${res.height}${resized ? '' : ' (same size)'} · ${fmtBytes(res.blob.size)}${pct > 0 ? ` (${pct}% smaller)` : pct < 0 ? ` (${-pct}% larger)` : ''}${res.overLimit ? ` · could not get under ${o.targetKB} KB without going blurry` : ''}`, pct > 0);
    it.state = 'done';
  } catch (e) {
    it.state = 'error'; it.row.classList.add('err');
    setOut(it, friendly(e));
  } finally {
    if (src && src.bitmap && src.bitmap.close) src.bitmap.close();
  }
}
const labelOf = fmt => fmt === 'image/jpeg' ? 'JPG' : fmt === 'image/png' ? 'PNG' : 'WebP';
function outName(name, fmt) {
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const oldExt = dot > 0 ? name.slice(dot).toLowerCase() : '';
  const ext = EXT[fmt];
  const same = oldExt === ext || (ext === '.jpg' && oldExt === '.jpeg');
  return base + (same ? '-converted' : '') + ext;
}
function friendly(e) {
  const m = (e && e.message) || String(e);
  if (/memory|allocation/i.test(m)) return 'Not enough memory to convert this file. Try closing other tabs or a smaller size.';
  return m.length > 140 ? 'Could not convert this file.' : m;
}

// ---------- decoding ----------
async function decode(it) {
  const bytes = new Uint8Array(await it.file.arrayBuffer());
  const meta = scanExif(bytes);
  const heif = isHeif(bytes);
  try {
    let bmp;
    try { bmp = await createImageBitmap(it.file, { imageOrientation: 'from-image' }); }
    catch (e) { if (e && e.name === 'TypeError') bmp = await createImageBitmap(it.file); else throw e; }
    return { bitmap: bmp, width: bmp.width, height: bmp.height, exif: meta.exif, gps: meta.gps };
  } catch (e) {
    if (!heif) throw new Error(`Your browser could not read this ${it.kind} file.`);
  }
  const r = await heicDecode(bytes.buffer);
  return { imageData: new ImageData(new Uint8ClampedArray(r.buf), r.w, r.h), width: r.w, height: r.h, exif: meta.exif, gps: meta.gps };
}
function isHeif(b) {
  if (b.length < 12 || String.fromCharCode(b[4], b[5], b[6], b[7]) !== 'ftyp') return false;
  const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
  return /^(heic|heix|heim|heis|hevc|hevx|hevm|hevs|mif1|msf1|heif)$/.test(brand);
}
let worker = null, wid = 0;
const pending = new Map();
function heicDecode(buf) {
  if (!worker) {
    worker = new Worker(WORKER_URL);
    worker.onmessage = e => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data); };
    worker.onerror = () => { for (const p of pending.values()) p.reject(new Error('The HEIC decoder could not be loaded. Check your connection and reload.')); pending.clear(); worker.terminate(); worker = null; };
  }
  return new Promise((resolve, reject) => { const id = ++wid; pending.set(id, { resolve, reject }); worker.postMessage({ id, buf }, [buf]); });
}

// Does the file carry EXIF, and does that EXIF include GPS coordinates? JPEG by walking segments,
// everything else by finding the Exif header in the first few MB (HEIC stores it as an item).
function scanExif(b) {
  const res = { exif: false, gps: false };
  let off = -1;
  if (b[0] === 0xFF && b[1] === 0xD8) {
    let p = 2;
    while (p + 4 < b.length && b[p] === 0xFF) {
      const marker = b[p + 1], len = (b[p + 2] << 8) | b[p + 3];
      if (marker === 0xE1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) { off = p + 10; break; }
      if (marker === 0xDA) break;
      p += 2 + len;
    }
  } else {
    const lim = Math.min(b.length - 6, 6 << 20);
    for (let i = 0; i < lim; i++) {
      if (b[i] === 0x45 && b[i + 1] === 0x78 && b[i + 2] === 0x69 && b[i + 3] === 0x66 && b[i + 4] === 0 && b[i + 5] === 0) { off = i + 6; break; }
    }
  }
  if (off < 0 || off + 8 > b.length) return res;
  try {
    const dv = new DataView(b.buffer, b.byteOffset + off, b.length - off);
    const bo = dv.getUint16(0);
    if (bo !== 0x4949 && bo !== 0x4D4D) return res;
    const le = bo === 0x4949;
    if (dv.getUint16(2, le) !== 42) return res;
    res.exif = true;
    const ifd0 = dv.getUint32(4, le), n = dv.getUint16(ifd0, le);
    for (let i = 0; i < n; i++) {
      const e = ifd0 + 2 + i * 12;
      if (dv.getUint16(e, le) === 0x8825) {
        const g = dv.getUint32(e + 8, le), gn = dv.getUint16(g, le);
        for (let j = 0; j < gn; j++) { const t = dv.getUint16(g + 2 + j * 12, le); if (t === 2 || t === 4) { res.gps = true; break; } }
      }
    }
  } catch (e) { /* truncated or odd EXIF: report what we know */ }
  return res;
}

// ---------- encoding ----------
async function encode(src, o) {
  let w = src.width, h = src.height;
  const longest = Math.max(w, h);
  let tw = w, th = h;
  if (o.max && longest > o.max) { const k = o.max / longest; tw = Math.max(1, Math.round(w * k)); th = Math.max(1, Math.round(h * k)); }
  let canvas = await draw(src, tw, th, o.fmt);
  let blob = await toBlob(canvas, o.fmt, o.q);
  let overLimit = false;
  if (o.targetKB && o.lossy && blob.size > o.targetKB * 1024) {
    const limit = o.targetKB * 1024;
    let best = null, lo = 0.35, hi = o.q;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2;
      const b = await toBlob(canvas, o.fmt, mid);
      if (b.size <= limit) { best = b; lo = mid; } else hi = mid;
    }
    let tries = 0;
    while (!best && tries < 6 && Math.max(tw, th) > 320) {
      tw = Math.max(1, Math.round(tw * 0.8)); th = Math.max(1, Math.round(th * 0.8));
      canvas.width = 0; canvas.height = 0;
      canvas = await draw(src, tw, th, o.fmt);
      const b = await toBlob(canvas, o.fmt, 0.75);
      if (b.size <= limit) best = b; else if (tries === 5) { best = b; overLimit = true; }
      tries++;
    }
    if (best) blob = best;
  }
  const t = document.createElement('canvas');
  const k = 144 / Math.max(canvas.width, canvas.height);
  t.width = Math.max(1, Math.round(canvas.width * k)); t.height = Math.max(1, Math.round(canvas.height * k));
  const tctx = t.getContext('2d'); tctx.imageSmoothingQuality = 'high'; tctx.drawImage(canvas, 0, 0, t.width, t.height);
  const thumb = t.toDataURL('image/jpeg', 0.8);
  canvas.width = 0; canvas.height = 0;
  return { blob, width: tw, height: th, thumb, overLimit };
}

// Draw the decoded picture at the target size with the best resampling the browser offers.
async function draw(src, tw, th, fmt) {
  const source = src.bitmap || src.imageData;
  const out = document.createElement('canvas'); out.width = tw; out.height = th;
  const ctx = out.getContext('2d');
  if (fmt === 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, tw, th); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  if (tw === src.width && th === src.height) {
    if (src.imageData) ctx.putImageData(src.imageData, 0, 0); else ctx.drawImage(source, 0, 0);
    return out;
  }
  try {
    const small = await createImageBitmap(source, { resizeWidth: tw, resizeHeight: th, resizeQuality: 'high' });
    ctx.drawImage(small, 0, 0); small.close();
    return out;
  } catch (e) { /* fall through to canvas step down */ }
  let cur = source, cw = src.width, ch = src.height;
  if (src.imageData) { const c = document.createElement('canvas'); c.width = cw; c.height = ch; c.getContext('2d').putImageData(src.imageData, 0, 0); cur = c; }
  while (cw / 2 >= tw && ch / 2 >= th) {
    const c = document.createElement('canvas'); c.width = Math.round(cw / 2); c.height = Math.round(ch / 2);
    const cx = c.getContext('2d'); cx.imageSmoothingQuality = 'high'; cx.drawImage(cur, 0, 0, c.width, c.height);
    if (cur instanceof HTMLCanvasElement && cur !== source) { cur.width = 0; cur.height = 0; }
    cur = c; cw = c.width; ch = c.height;
  }
  ctx.drawImage(cur, 0, 0, tw, th);
  return out;
}
function toBlob(canvas, type, q) {
  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error(`Your browser cannot save ${labelOf(type)}. Choose JPG or PNG.`)), type, q));
}

// ---------- zip (store only; photos do not compress further) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
async function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = [];
  const now = new Date();
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  let offset = 0;
  const used = new Set();
  for (const f of files) {
    let name = f.name, k = 2;
    while (used.has(name)) { const d = f.name.lastIndexOf('.'); name = d > 0 ? `${f.name.slice(0, d)} (${k})${f.name.slice(d)}` : `${f.name} (${k})`; k++; }
    used.add(name);
    const data = new Uint8Array(await f.blob.arrayBuffer()), nm = enc.encode(name), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, nm, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nm.length, true);
    ch.setUint16(30, 0, true); ch.setUint16(32, 0, true); ch.setUint16(34, 0, true); ch.setUint16(36, 0, true); ch.setUint32(38, 0, true); ch.setUint32(42, offset, true);
    central.push(ch.buffer, nm);
    offset += 30 + nm.length + data.length;
  }
  const cdSize = central.reduce((s, p) => s + p.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(4, 0, true); end.setUint16(6, 0, true);
  end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, offset, true); end.setUint16(20, 0, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}
els.zip.addEventListener('click', async () => {
  const done = items.filter(it => it.state === 'done');
  if (!done.length) return;
  const total = done.reduce((s, it) => s + it.blob.size, 0);
  if (total > 3.9 * 1024 * 1024 * 1024) { showError('The converted files add up to more than 4 GB, which is too much for one ZIP. Download them individually or in smaller batches.'); return; }
  els.zip.disabled = true; const label = els.zip.textContent; els.zip.textContent = 'Zipping…';
  try {
    const zip = await makeZip(done.map(it => ({ name: it.outName, blob: it.blob })));
    const a = document.createElement('a'); a.href = URL.createObjectURL(zip); a.download = 'converted-photos.zip';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  } catch (e) { showError('Could not build the ZIP: ' + friendly(e)); }
  finally { els.zip.disabled = false; els.zip.textContent = label; }
});

// ---------- sample photo: a generated 3000 × 2000 JPEG carrying real GPS EXIF ----------
els.sample.addEventListener('click', async () => {
  els.sample.disabled = true;
  try {
    const W = 3000, H = 2000, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const sky = g.createLinearGradient(0, 0, 0, H * 0.65); sky.addColorStop(0, '#1d3f73'); sky.addColorStop(0.6, '#e08a5b'); sky.addColorStop(1, '#f6d7a8');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#fff2c2'; g.beginPath(); g.arc(W * 0.68, H * 0.58, 130, 0, Math.PI * 2); g.fill();
    const hill = (yBase, amp, col, seed) => { g.fillStyle = col; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += 20) g.lineTo(x, yBase + Math.sin(x / 420 + seed) * amp + Math.sin(x / 130 + seed * 3) * amp * 0.25); g.lineTo(W, H); g.closePath(); g.fill(); };
    hill(H * 0.64, 60, '#6b7a8f', 1); hill(H * 0.72, 55, '#3e5a4a', 2.5); hill(H * 0.82, 40, '#233a2c', 4);
    const water = g.createLinearGradient(0, H * 0.86, 0, H); water.addColorStop(0, '#2c4a5e'); water.addColorStop(1, '#0f1f2b'); g.fillStyle = water; g.fillRect(0, H * 0.88, W, H * 0.12);
    // grain so it behaves like a photo rather than a flat graphic
    const im = g.getImageData(0, 0, W, H), d = im.data;
    for (let i = 0; i < d.length; i += 4) { const n = (Math.random() - 0.5) * 18; d[i] += n; d[i + 1] += n; d[i + 2] += n; }
    g.putImageData(im, 0, 0);
    const jpeg = new Uint8Array(await (await toBlob(c, 'image/jpeg', 0.94)).arrayBuffer());
    c.width = 0; c.height = 0;
    addFiles([new File([withGps(jpeg)], 'IMG_2041 sample.jpg', { type: 'image/jpeg' })]);
  } catch (e) { showError('Could not build the sample photo: ' + friendly(e)); }
  finally { els.sample.disabled = false; }
});
// Insert an APP1 Exif segment with a GPS IFD (33°52'S 151°12'E, Sydney) after the SOI marker.
function withGps(jpeg) {
  const t = new DataView(new ArrayBuffer(116));
  t.setUint16(0, 0x4949, true); t.setUint16(2, 42, true); t.setUint32(4, 8, true);
  t.setUint16(8, 1, true); t.setUint16(10, 0x8825, true); t.setUint16(12, 4, true); t.setUint32(14, 1, true); t.setUint32(18, 26, true); t.setUint32(22, 0, true);
  t.setUint16(26, 3, true);
  let e = 28;
  t.setUint16(e, 1, true); t.setUint16(e + 2, 2, true); t.setUint32(e + 4, 2, true); t.setUint8(e + 8, 0x53); t.setUint8(e + 9, 0); e += 12;
  t.setUint16(e, 2, true); t.setUint16(e + 2, 5, true); t.setUint32(e + 4, 3, true); t.setUint32(e + 8, 68, true); e += 12;
  t.setUint16(e, 4, true); t.setUint16(e + 2, 5, true); t.setUint32(e + 4, 3, true); t.setUint32(e + 8, 92, true); e += 12;
  t.setUint32(e, 0, true);
  const rat = (o, v) => v.forEach((r, i) => { t.setUint32(o + i * 8, r[0], true); t.setUint32(o + i * 8 + 4, r[1], true); });
  rat(68, [[33, 1], [52, 1], [0, 1]]); rat(92, [[151, 1], [12, 1], [0, 1]]);
  const app1 = new Uint8Array(10 + 116), len = 8 + 116;
  app1[0] = 0xFF; app1[1] = 0xE1; app1[2] = len >> 8; app1[3] = len & 255; app1.set([0x45, 0x78, 0x69, 0x66, 0, 0], 4); app1.set(new Uint8Array(t.buffer), 10);
  const out = new Uint8Array(jpeg.length + app1.length);
  out.set(jpeg.subarray(0, 2), 0); out.set(app1, 2); out.set(jpeg.subarray(2), 2 + app1.length);
  return out;
}

window.__imc = { items, addFiles, scanExif, makeZip, opts };
})();
