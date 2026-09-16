/* Sign a PDF — everything runs in the browser. pdf.js renders the pages, pdf-lib writes the result.
   Items are stored in PDF points relative to the displayed page's top left corner (pdf.js viewport at
   scale 1), which already accounts for the page's own rotation; at save time every anchor is mapped
   back into PDF user space with viewport.convertToPdfPoint, so rotated pages come out right. */
(() => {
'use strict';
const $ = id => document.getElementById(id);
const els = {
  open: $('open'), drop: $('drop'), file: $('file'), sample: $('btn-sample'), openErr: $('open-error'),
  work: $('work'), pages: $('pages'), docInfo: $('doc-info'), armHint: $('arm-hint'), save: $('btn-save'), restart: $('btn-restart'),
  toolSign: $('tool-sign'), toolSignChange: $('tool-sign-change'),
  modal: $('sig-modal'), sigClose: $('sig-close'), pad: $('pad'), padClear: $('pad-clear'), typeInput: $('type-input'),
  typePreview: $('type-preview'), sigFile: $('sig-file'), uploadPreview: $('upload-preview'), sigRemember: $('sig-remember'),
  sigForget: $('sig-forget'), sigUse: $('sig-use'), sigErr: $('sig-error')
};

if (!window.pdfjsLib || !window.PDFLib) {
  els.openErr.textContent = 'The PDF libraries did not load. Reload the page and try again.';
  els.openErr.hidden = false;
  return;
}
pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf-sign/pdf.worker.min.js';

const SIG_KEY = 'pot:pdf-sign:signature';
const INK = '#111';
const TEXT_FONT = 'Helvetica, Arial, sans-serif';
const S = { bytes: null, name: '', doc: null, pages: [], items: [], armed: null, selected: null, sig: null, writable: null, saved: true, uid: 0 };
let observer = null, lastW = 0;

// ---------- small helpers ----------
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmtBytes = n => n < 1048576 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`;
const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const isEditing = () => !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains('ed'));
const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode, quota */ } };
const lsDel = k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } };
function showOpenError(msg) { els.openErr.textContent = msg || ''; els.openErr.hidden = !msg; }
function sigError(msg) { els.sigErr.textContent = msg || ''; els.sigErr.hidden = !msg; }

// Where the baseline sits inside a 1.2 line height box for the on screen text font, as a fraction of
// the font size. Measured rather than assumed because Helvetica, Arial and Liberation Sans differ.
const BASELINE = (() => {
  try {
    const box = document.createElement('div');
    box.style.cssText = `position:absolute;visibility:hidden;left:-9999px;font:100px/1.2 ${TEXT_FONT};white-space:pre`;
    const probe = document.createElement('span');
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
    box.append(probe, document.createTextNode('Hg'));
    document.body.appendChild(box);
    const r = probe.getBoundingClientRect().top - box.getBoundingClientRect().top;
    box.remove();
    return r > 50 && r < 120 ? r / 100 : 0.9;
  } catch (e) { return 0.9; }
})();

// ---------- opening a document ----------
els.file.addEventListener('change', () => { const f = els.file.files[0]; if (f) openFile(f); els.file.value = ''; });
['dragenter', 'dragover'].forEach(t => els.drop.addEventListener(t, e => { e.preventDefault(); els.drop.classList.add('dragging'); }));
['dragleave', 'drop'].forEach(t => els.drop.addEventListener(t, e => { e.preventDefault(); els.drop.classList.remove('dragging'); }));
els.drop.addEventListener('drop', e => { const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) openFile(f); });
els.sample.addEventListener('click', async () => {
  els.sample.disabled = true;
  try { await openBytes(await makeSample(), 'sample-agreement.pdf'); }
  catch (e) { showOpenError('Could not build the sample: ' + (e.message || e)); }
  finally { els.sample.disabled = false; }
});

async function openFile(file) {
  showOpenError('');
  if (file.size > 80 * 1048576) return showOpenError('That file is over 80 MB. Everything here stays in memory, so this works best on ordinary documents.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const head = String.fromCharCode.apply(null, bytes.subarray(0, Math.min(1024, bytes.length)));
  if (!head.includes('%PDF')) return showOpenError('That file is not a PDF. If it is a photo or a Word document, export it as a PDF first and try again.');
  await openBytes(bytes, file.name || 'document.pdf');
}

async function openBytes(bytes, name) {
  showOpenError('');
  els.docInfo.textContent = 'Opening…';
  let doc;
  try {
    // pdf.js transfers the buffer to its worker, so hand it a copy and keep the original for pdf-lib.
    doc = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
  } catch (e) {
    const pw = e && e.name === 'PasswordException';
    showOpenError(pw
      ? 'This PDF needs a password to open. Remove the password in the app that made it, then try again.'
      : 'That file could not be read as a PDF' + (e && e.message ? ` (${e.message}).` : '.'));
    els.docInfo.textContent = '';
    return;
  }
  resetState();
  S.bytes = bytes; S.name = name; S.doc = doc; S.saved = true;
  els.open.hidden = true; els.work.hidden = false;
  els.docInfo.textContent = `${name} · ${doc.numPages} page${doc.numPages === 1 ? '' : 's'} · ${fmtBytes(bytes.length)}`;
  await buildPages();
  probeWritable();
}

function resetState() {
  for (const p of S.pages) freePage(p);
  if (observer) { observer.disconnect(); observer = null; }
  els.pages.replaceChildren();
  S.pages = []; S.items = []; S.selected = null; S.doc = null; S.bytes = null; S.writable = null;
  arm(null);
}

async function probeWritable() {
  // pdf-lib refuses encrypted files and chokes on a few odd ones. Find out now so the save button can
  // fall back to a flattened copy without surprising anyone.
  const bytes = S.bytes;
  let ok = false;
  try {
    const d = await PDFLib.PDFDocument.load(bytes, { updateMetadata: false });
    ok = d.getPageCount() === S.pages.length;
  } catch (e) { ok = false; }
  if (S.bytes !== bytes) return;
  S.writable = ok;
  if (!ok) els.docInfo.textContent += ' · This PDF is protected or unusual, so the signed copy will be saved as a flattened image PDF and its original text will no longer be selectable.';
}

// ---------- pages ----------
const targetWidth = () => Math.min(els.pages.clientWidth || 800, 820);

async function buildPages() {
  const doc = S.doc;
  observer = new IntersectionObserver(onIntersect, { rootMargin: '900px 0px' });
  lastW = targetWidth();
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    if (S.doc !== doc) return;
    const vp1 = page.getViewport({ scale: 1 });
    const wrap = document.createElement('div'); wrap.className = 'page-wrap'; wrap.dataset.index = String(i - 1);
    const num = document.createElement('span'); num.className = 'page-num'; num.textContent = `Page ${i} of ${doc.numPages}`;
    const canvas = document.createElement('canvas');
    const overlay = document.createElement('div'); overlay.className = 'overlay';
    wrap.append(num, canvas, overlay);
    els.pages.appendChild(wrap);
    const p = { index: i - 1, page, vp1, rotation: page.rotate || 0, wrap, canvas, overlay, scale: 1, rendered: false, task: null };
    overlay.addEventListener('click', e => onOverlayClick(e, p));
    S.pages.push(p);
    sizePage(p);
    observer.observe(wrap);
  }
}

function sizePage(p) {
  p.scale = targetWidth() / p.vp1.width;
  const w = Math.round(p.vp1.width * p.scale), h = Math.round(p.vp1.height * p.scale);
  p.wrap.style.width = w + 'px'; p.wrap.style.height = h + 'px';
  p.canvas.style.width = w + 'px'; p.canvas.style.height = h + 'px';
}

function onIntersect(entries) {
  for (const en of entries) {
    const p = S.pages[+en.target.dataset.index];
    if (!p) continue;
    if (en.isIntersecting) renderPage(p); else freePage(p);
  }
}

async function renderPage(p) {
  if (p.rendered || p.task) return;
  const vp = p.page.getViewport({ scale: p.scale * dpr() });
  p.canvas.width = Math.floor(vp.width); p.canvas.height = Math.floor(vp.height);
  const ctx = p.canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, p.canvas.width, p.canvas.height);
  const task = p.page.render({ canvasContext: ctx, viewport: vp });
  p.task = task;
  try { await task.promise; p.rendered = true; }
  catch (e) { if (!(e && e.name === 'RenderingCancelledException')) console.warn('Page render failed', e); }
  finally { if (p.task === task) p.task = null; }
}

function freePage(p) {
  if (p.task) { try { p.task.cancel(); } catch (e) { /* ignore */ } p.task = null; }
  if (p.rendered) { p.canvas.width = 0; p.canvas.height = 0; p.rendered = false; }
}

let resizeTimer = null;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(relayout, 150); });
function relayout() {
  if (!S.pages.length || !observer) return;
  const w = targetWidth();
  if (w === lastW) return;
  lastW = w;
  for (const p of S.pages) { freePage(p); sizePage(p); observer.unobserve(p.wrap); observer.observe(p.wrap); }
  for (const it of S.items) place(it);
}

// ---------- tools and placement ----------
const HINTS = {
  sign: 'Click on the page where your signature should go.',
  text: 'Click where the text should go, then type.',
  date: 'Click where today’s date should go.',
  tick: 'Click on the box you want to tick.',
  cross: 'Click where the cross should go.'
};
function arm(tool) {
  S.armed = tool;
  for (const b of document.querySelectorAll('.toolbar [data-tool], #tool-sign')) {
    const t = b.dataset.tool || 'sign';
    b.classList.toggle('armed', t === tool);
    b.setAttribute('aria-pressed', String(t === tool));
  }
  for (const p of S.pages) p.overlay.classList.toggle('armed', !!tool);
  els.armHint.textContent = tool ? HINTS[tool] + ' Esc cancels.' : '';
  if (tool) select(null);
}
document.querySelectorAll('.toolbar [data-tool]').forEach(b => b.addEventListener('click', () => arm(S.armed === b.dataset.tool ? null : b.dataset.tool)));
els.toolSign.addEventListener('click', () => {
  if (S.armed === 'sign') return arm(null);
  if (S.sig) arm('sign'); else openModal();
});
els.toolSignChange.addEventListener('click', openModal);

function onOverlayClick(e, p) {
  if (e.target !== p.overlay) return;
  if (!S.armed) { select(null); return; }
  const rect = p.overlay.getBoundingClientRect();
  addItem(S.armed, p, (e.clientX - rect.left) / p.scale, (e.clientY - rect.top) / p.scale);
  arm(null);
}

function addItem(tool, p, cx, cy) {
  const vp = p.vp1;
  let it;
  if (tool === 'sign') {
    if (!S.sig) return openModal();
    const aspect = S.sig.w / S.sig.h;
    let w = Math.min(150, vp.width * 0.4), h = w / aspect;
    if (h > 60) { h = 60; w = h * aspect; }
    it = { type: 'image', dataUrl: S.sig.dataUrl, aspect, w, h };
  } else if (tool === 'text' || tool === 'date') {
    it = { type: 'text', text: tool === 'date' ? new Date().toLocaleDateString() : '', size: 12, w: 0, h: 12 * 1.2 };
  } else {
    it = { type: 'mark', mark: tool, w: 14, h: 14 };
  }
  it.id = ++S.uid; it.page = p.index;
  it.x = clamp(cx - it.w / 2, 0, Math.max(0, vp.width - it.w));
  it.y = clamp(cy - it.h / 2, 0, Math.max(0, vp.height - it.h));
  S.items.push(it); S.saved = false;
  mount(it);
  select(it);
  if (it.type === 'text') focusEditor(it);
  return it;
}

const SVG = {
  tick: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="16,54 40,78 86,22" fill="none" stroke="#111" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cross: '<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M20 20L80 80M80 20L20 80" fill="none" stroke="#111" stroke-width="11" stroke-linecap="round"/></svg>'
};

function mount(it) {
  const p = S.pages[it.page];
  const el = document.createElement('div');
  el.className = 'item ' + it.type; el.dataset.id = String(it.id);
  if (it.type === 'image') {
    const img = new Image(); img.src = it.dataUrl; img.alt = 'Signature'; img.draggable = false; el.appendChild(img);
  } else if (it.type === 'text') {
    const ed = document.createElement('span');
    ed.className = 'ed'; ed.contentEditable = 'true'; ed.spellcheck = false; ed.dataset.placeholder = 'Type here'; ed.textContent = it.text;
    el.appendChild(ed); wireEditor(it, ed);
  } else {
    el.classList.add('mark'); el.innerHTML = SVG[it.mark];
  }
  const del = document.createElement('button');
  del.className = 'del'; del.type = 'button'; del.title = 'Remove'; del.setAttribute('aria-label', 'Remove'); del.textContent = '×';
  del.addEventListener('pointerdown', e => e.stopPropagation());
  del.addEventListener('click', e => { e.stopPropagation(); removeItem(it); });
  const rs = document.createElement('div'); rs.className = 'rs'; rs.title = 'Resize';
  rs.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); startResize(e, it); });
  el.append(del, rs);
  el.addEventListener('pointerdown', e => onItemDown(e, it));
  el.addEventListener('click', e => e.stopPropagation());
  p.overlay.appendChild(el);
  it.el = el;
  place(it);
}

function place(it) {
  const p = S.pages[it.page], s = p.scale, el = it.el;
  if (!el) return;
  el.style.left = (it.x * s) + 'px'; el.style.top = (it.y * s) + 'px';
  if (it.type === 'text') {
    el.style.fontSize = (it.size * s) + 'px';
    it.h = it.size * 1.2; el.style.height = (it.h * s) + 'px'; el.style.width = '';
    it.w = el.offsetWidth / s;
  } else {
    el.style.width = (it.w * s) + 'px'; el.style.height = (it.h * s) + 'px';
  }
}

function select(it) {
  if (S.selected && S.selected.el) S.selected.el.classList.remove('selected');
  S.selected = it || null;
  if (it && it.el) it.el.classList.add('selected');
}

function removeItem(it) {
  const i = S.items.indexOf(it);
  if (i >= 0) S.items.splice(i, 1);
  if (it.el) { it.el.remove(); it.el = null; }
  if (S.selected === it) S.selected = null;
  if (!S.items.length) S.saved = true;
}

function drag(e, el, onMove, onEnd) {
  const id = e.pointerId, sx = e.clientX, sy = e.clientY;
  let moved = false;
  try { el.setPointerCapture(id); } catch (err) { /* ignore */ }
  const mv = ev => {
    if (ev.pointerId !== id) return;
    const dx = ev.clientX - sx, dy = ev.clientY - sy;
    if (!moved && Math.hypot(dx, dy) < 3) return;
    moved = true; onMove(dx, dy, ev);
  };
  const up = ev => {
    if (ev.pointerId !== id) return;
    el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
    try { el.releasePointerCapture(id); } catch (err) { /* ignore */ }
    if (onEnd) onEnd(moved, ev);
  };
  el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}

function onItemDown(e, it) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const ed = it.el.querySelector('.ed');
  if (ed && e.target === ed && document.activeElement === ed) return; // already editing: let the caret and text selection work
  e.preventDefault();
  select(it);
  const p = S.pages[it.page], x0 = it.x, y0 = it.y;
  drag(e, it.el, (dx, dy) => {
    it.x = clamp(x0 + dx / p.scale, 0, Math.max(0, p.vp1.width - it.w));
    it.y = clamp(y0 + dy / p.scale, 0, Math.max(0, p.vp1.height - it.h));
    place(it); S.saved = false;
  }, moved => { if (!moved && ed) focusEditor(it); });
}

function startResize(e, it) {
  select(it);
  const p = S.pages[it.page], w0 = it.w, s0 = it.size;
  drag(e, e.currentTarget, (dx, dy) => {
    if (it.type === 'image') { it.w = Math.max(20, w0 + dx / p.scale); it.h = it.w / it.aspect; }
    else if (it.type === 'mark') { const s = Math.max(6, w0 + Math.max(dx, dy) / p.scale); it.w = it.h = s; }
    else { it.size = clamp(s0 + dy / p.scale / 1.2, 6, 72); }
    place(it); S.saved = false;
  });
}

function wireEditor(it, ed) {
  ed.addEventListener('input', () => { it.text = ed.textContent; S.saved = false; place(it); });
  ed.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); ed.blur(); } e.stopPropagation(); });
  ed.addEventListener('paste', e => {
    e.preventDefault();
    const t = ((e.clipboardData && e.clipboardData.getData('text/plain')) || '').replace(/\s+/g, ' ');
    document.execCommand('insertText', false, t);
  });
  ed.addEventListener('blur', () => {
    it.text = ed.textContent.replace(/[\r\n]+/g, ' ');
    if (!it.text.trim()) removeItem(it); else place(it);
  });
}

function focusEditor(it) {
  const ed = it.el && it.el.querySelector('.ed');
  if (!ed) return;
  ed.focus();
  try {
    const r = document.createRange(); r.selectNodeContents(ed); r.collapse(false);
    const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
  } catch (e) { /* ignore */ }
}

document.addEventListener('keydown', e => {
  if (!els.modal.hidden) { if (e.key === 'Escape') closeModal(); return; }
  const tag = document.activeElement && document.activeElement.tagName;
  if (isEditing() || /^(INPUT|TEXTAREA|SELECT)$/.test(tag || '')) return;
  if (e.key === 'Escape') { if (S.armed) arm(null); else select(null); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && S.selected) { e.preventDefault(); removeItem(S.selected); }
});

els.restart.addEventListener('click', () => {
  if (S.items.length && !confirm('Start over? Everything you placed on this document will be discarded.')) return;
  if (S.doc) { try { S.doc.destroy(); } catch (e) { /* ignore */ } }
  resetState();
  els.work.hidden = true; els.open.hidden = false; els.docInfo.textContent = '';
});
window.addEventListener('beforeunload', e => { if (!S.saved && S.items.length) { e.preventDefault(); e.returnValue = ''; } });

// ---------- signature modal ----------
let tab = 'draw';
function openModal() {
  sigError('');
  const saved = !!lsGet(SIG_KEY);
  els.sigForget.hidden = !saved; els.sigRemember.checked = saved;
  els.modal.hidden = false;
  setTab(tab);
}
function closeModal() { els.modal.hidden = true; }
els.sigClose.addEventListener('click', closeModal);
els.modal.addEventListener('click', e => { if (e.target === els.modal) closeModal(); });
document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
function setTab(t) {
  tab = t; sigError('');
  for (const b of document.querySelectorAll('.tab')) { const on = b.dataset.tab === t; b.classList.toggle('active', on); b.setAttribute('aria-selected', String(on)); }
  $('pane-draw').hidden = t !== 'draw'; $('pane-type').hidden = t !== 'type'; $('pane-upload').hidden = t !== 'upload';
  if (t === 'type') { renderTyped(); els.typeInput.focus(); }
}

// Draw pad: quadratic smoothing through midpoints, line width eased by pen speed.
const pad = els.pad, pctx = pad.getContext('2d');
let padInk = false, pts = [];
pctx.lineCap = 'round'; pctx.lineJoin = 'round'; pctx.strokeStyle = INK; pctx.fillStyle = INK;
function padPoint(e) {
  const r = pad.getBoundingClientRect();
  return { x: (e.clientX - r.left) * pad.width / r.width, y: (e.clientY - r.top) * pad.height / r.height, t: e.timeStamp };
}
pad.addEventListener('pointerdown', e => {
  if (pts.length) return; // a second finger or the palm; ignore
  e.preventDefault();
  try { pad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  const p = padPoint(e); pts = [p];
  pctx.lineWidth = 5;
  pctx.beginPath(); pctx.arc(p.x, p.y, 2.4, 0, Math.PI * 2); pctx.fill();
  padInk = true;
});
pad.addEventListener('pointermove', e => {
  if (!pts.length || !pad.hasPointerCapture(e.pointerId)) return;
  const p = padPoint(e), prev = pts[pts.length - 1];
  const d = Math.hypot(p.x - prev.x, p.y - prev.y);
  if (d < 1.5) return;
  const speed = d / Math.max(1, p.t - prev.t);
  pctx.lineWidth = pctx.lineWidth * 0.7 + clamp(7 - speed * 1.6, 2.2, 7) * 0.3;
  pts.push(p);
  pctx.beginPath();
  if (pts.length >= 3) {
    const [a, b, c] = pts.slice(-3);
    pctx.moveTo((a.x + b.x) / 2, (a.y + b.y) / 2); pctx.quadraticCurveTo(b.x, b.y, (b.x + c.x) / 2, (b.y + c.y) / 2);
  } else { pctx.moveTo(prev.x, prev.y); pctx.lineTo(p.x, p.y); }
  pctx.stroke();
});
const padEnd = e => {
  if (!pts.length) return;
  if (pts.length >= 2) {
    const b = pts[pts.length - 2], c = pts[pts.length - 1];
    pctx.beginPath(); pctx.moveTo((b.x + c.x) / 2, (b.y + c.y) / 2); pctx.lineTo(c.x, c.y); pctx.stroke();
  }
  pts = [];
};
pad.addEventListener('pointerup', padEnd); pad.addEventListener('pointercancel', padEnd);
els.padClear.addEventListener('click', () => { pctx.clearRect(0, 0, pad.width, pad.height); padInk = false; });

// Typed signature in the Caveat handwriting face, rendered to a canvas so it is placed as an image.
const fontReady = (document.fonts && document.fonts.load) ? document.fonts.load('150px Caveat').catch(() => {}) : Promise.resolve();
els.typeInput.addEventListener('input', renderTyped);
async function renderTyped() {
  await fontReady;
  const c = els.typePreview, ctx = c.getContext('2d');
  ctx.clearRect(0, 0, c.width, c.height);
  const t = els.typeInput.value.trim();
  if (!t) return;
  let size = 150;
  ctx.font = `${size}px Caveat, cursive`;
  const w = ctx.measureText(t).width;
  if (w > c.width - 60) { size = Math.max(30, Math.floor(size * (c.width - 60) / w)); ctx.font = `${size}px Caveat, cursive`; }
  ctx.fillStyle = INK; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
  ctx.fillText(t, c.width / 2, c.height / 2);
}

// Uploaded signature: paper goes transparent, ink stays.
let uploadCanvas = null;
els.sigFile.addEventListener('change', async () => {
  const f = els.sigFile.files[0];
  els.sigFile.value = '';
  if (!f) return;
  try {
    const bmp = await createImageBitmap(f);
    const k = Math.min(1, 1400 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const ctx = c.getContext('2d');
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    if (bmp.close) bmp.close();
    const im = ctx.getImageData(0, 0, c.width, c.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const a = lum >= 215 ? 0 : lum <= 120 ? 255 : Math.round((215 - lum) / 95 * 255);
      d[i + 3] = Math.min(d[i + 3], a);
    }
    ctx.putImageData(im, 0, 0);
    uploadCanvas = c;
    els.uploadPreview.src = c.toDataURL('image/png'); els.uploadPreview.hidden = false;
    sigError('');
  } catch (e) { sigError('That image could not be read. Try a PNG or JPEG.'); }
});

function trim(c) {
  const W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) return null;
  const padPx = 8;
  x0 = Math.max(0, x0 - padPx); y0 = Math.max(0, y0 - padPx); x1 = Math.min(W - 1, x1 + padPx); y1 = Math.min(H - 1, y1 + padPx);
  const out = document.createElement('canvas');
  out.width = x1 - x0 + 1; out.height = y1 - y0 + 1;
  out.getContext('2d').drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
  return out;
}

els.sigUse.addEventListener('click', async () => {
  let src;
  if (tab === 'draw') { if (!padInk) return sigError('Draw your signature first.'); src = pad; }
  else if (tab === 'type') { await renderTyped(); if (!els.typeInput.value.trim()) return sigError('Type your name first.'); src = els.typePreview; }
  else { if (!uploadCanvas) return sigError('Choose an image first.'); src = uploadCanvas; }
  const t = trim(src);
  if (!t) return sigError('Nothing to use yet.');
  S.sig = { dataUrl: t.toDataURL('image/png'), w: t.width, h: t.height };
  if (els.sigRemember.checked) lsSet(SIG_KEY, S.sig.dataUrl);
  closeModal(); showSigState();
  if (S.doc) arm('sign');
});
els.sigForget.addEventListener('click', () => { lsDel(SIG_KEY); els.sigForget.hidden = true; els.sigRemember.checked = false; });
function showSigState() { els.toolSignChange.hidden = !S.sig; }
(function loadSavedSig() {
  const url = lsGet(SIG_KEY);
  if (!url) return;
  const img = new Image();
  img.onload = () => { S.sig = { dataUrl: url, w: img.naturalWidth, h: img.naturalHeight }; showSigState(); };
  img.src = url;
})();

// ---------- saving ----------
els.save.addEventListener('click', save);
async function save() {
  if (!S.doc) return;
  if (isEditing()) document.activeElement.blur();
  const live = S.items.filter(it => it.type !== 'text' || it.text.trim());
  els.save.disabled = true;
  const label = els.save.textContent; els.save.textContent = 'Preparing…';
  try {
    let bytes = null;
    if (S.writable !== false) {
      try { bytes = await stamp(live); }
      catch (e) { console.warn('pdf-lib could not modify this file, saving a flattened copy instead', e); }
    }
    if (!bytes) bytes = await flattenAndStamp(live);
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = S.name.replace(/\.pdf$/i, '') + '-signed.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    S.saved = true;
  } catch (e) {
    console.error(e);
    alert('Could not write the PDF: ' + (e && e.message ? e.message : e));
  } finally { els.save.disabled = false; els.save.textContent = label; }
}

async function stamp(items) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const pdf = await PDFDocument.load(S.bytes, { updateMetadata: false });
  const pages = pdf.getPages();
  if (pages.length !== S.pages.length) throw new Error('page count mismatch');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const imgs = new Map();
  for (const it of items) {
    const p = S.pages[it.page];
    await drawItem(pdf, pages[it.page], it, (vx, vy) => p.vp1.convertToPdfPoint(vx, vy), p.rotation, font, imgs);
  }
  return pdf.save();
}

// Fallback for files pdf-lib cannot open: render every page with pdf.js and build a fresh PDF of images.
async function flattenAndStamp(items) {
  const { PDFDocument, StandardFonts } = PDFLib;
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const imgs = new Map();
  for (const p of S.pages) {
    const vp1 = p.vp1;
    const k = Math.min(2, 2400 / Math.max(vp1.width, vp1.height));
    const vp = p.page.getViewport({ scale: k });
    const c = document.createElement('canvas');
    c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
    const ctx = c.getContext('2d', { alpha: false });
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await p.page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88));
    const img = await pdf.embedJpg(await blob.arrayBuffer());
    const page = pdf.addPage([vp1.width, vp1.height]);
    page.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
    for (const it of items) if (it.page === p.index) await drawItem(pdf, page, it, (vx, vy) => [vx, vp1.height - vy], 0, font, imgs);
    c.width = 0; c.height = 0;
  }
  return pdf.save();
}

async function drawItem(pdf, page, it, conv, rot, font, imgs) {
  const { rgb, degrees, LineCapStyle } = PDFLib;
  const ink = rgb(0.07, 0.07, 0.07);
  if (it.type === 'image') {
    let img = imgs.get(it.dataUrl);
    if (!img) { img = await pdf.embedPng(it.dataUrl); imgs.set(it.dataUrl, img); }
    const [x, y] = conv(it.x, it.y + it.h); // pdf-lib anchors an image at its own bottom left corner
    page.drawImage(img, { x, y, width: it.w, height: it.h, rotate: degrees(rot) });
  } else if (it.type === 'text') {
    const [x, y] = conv(it.x, it.y + BASELINE * it.size); // baseline left
    page.drawText(safeText(font, it.text), { x, y, size: it.size, font, color: ink, rotate: degrees(rot) });
  } else {
    const segs = it.mark === 'tick'
      ? [[0.16, 0.54, 0.40, 0.78], [0.40, 0.78, 0.86, 0.22]]
      : [[0.2, 0.2, 0.8, 0.8], [0.8, 0.2, 0.2, 0.8]];
    const thickness = Math.max(0.8, 0.11 * it.w);
    for (const [ax, ay, bx, by] of segs) {
      const [sx, sy] = conv(it.x + ax * it.w, it.y + ay * it.h);
      const [ex, ey] = conv(it.x + bx * it.w, it.y + by * it.h);
      page.drawLine({ start: { x: sx, y: sy }, end: { x: ex, y: ey }, thickness, color: ink, lineCap: LineCapStyle.Round });
    }
  }
}

// Helvetica only knows WinAnsi; anything else becomes a question mark rather than an exception.
function safeText(font, s) {
  let out = '';
  for (const ch of String(s).replace(/ /g, ' ').replace(/[\r\n\t]+/g, ' ')) {
    try { font.encodeText(ch); out += ch; } catch (e) { out += '?'; }
  }
  return out;
}

// ---------- sample document ----------
async function makeSample() {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const pdf = await PDFDocument.create();
  pdf.setTitle('Equipment Loan Agreement (sample)');
  pdf.setProducer('Plenty of Tools'); pdf.setCreator('Plenty of Tools');
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const W = 595.28, H = 841.89, M = 56, ink = rgb(0.1, 0.1, 0.1), grey = rgb(0.45, 0.45, 0.45);
  let page, y;
  const newPage = footer => {
    page = pdf.addPage([W, H]); y = H - M;
    page.drawText(footer + ' · Sample document generated by Plenty of Tools for trying the signing tool. It is not a real agreement.', { x: M, y: 30, size: 8, font, color: grey });
  };
  const wrap = (t, f, size, width) => {
    const lines = []; let line = '';
    for (const w of t.split(' ')) {
      const cand = line ? line + ' ' + w : w;
      if (line && f.widthOfTextAtSize(cand, size) > width) { lines.push(line); line = w; } else line = cand;
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (t, o = {}) => {
    const f = o.f || font, size = o.size || 10.5, gap = o.gap == null ? 4 : o.gap;
    for (const ln of wrap(t, f, size, W - 2 * M)) { y -= size; page.drawText(ln, { x: M, y, size, font: f, color: o.color || ink }); y -= gap; }
  };
  const field = (label, x, right) => {
    page.drawText(label, { x, y, size: 10.5, font, color: ink });
    const lx = x + font.widthOfTextAtSize(label, 10.5) + 6;
    page.drawLine({ start: { x: lx, y: y - 3 }, end: { x: right, y: y - 3 }, thickness: 0.8, color: grey });
  };
  const box = (label, x) => {
    page.drawRectangle({ x, y: y - 2, width: 11, height: 11, borderWidth: 0.9, borderColor: ink });
    page.drawText(label, { x: x + 17, y, size: 10.5, font, color: ink });
  };

  newPage('Page 1 of 2');
  text('EQUIPMENT LOAN AGREEMENT', { f: bold, size: 18, gap: 6 });
  text('Harbourside Community Garden Inc. · Tool library', { color: grey, gap: 14 });
  text('This agreement is between Harbourside Community Garden Inc. (the Lender) and the person named below (the Borrower). It covers the loan of the equipment ticked below for the period shown.', { gap: 14 });
  text('1. Borrower', { f: bold, size: 12, gap: 8 });
  y -= 10; field('Full name:', M, 330); field('Member number:', 360, W - M); y -= 24;
  field('Phone:', M, 330); field('Email:', 360, W - M); y -= 24;
  field('Address:', M, W - M); y -= 22;
  text('2. Equipment on loan (tick all that apply)', { f: bold, size: 12, gap: 8 });
  y -= 8; box('Rotary hoe', M); box('Pressure washer', 200); box('Extension ladder, 6 m', 360); y -= 20;
  box('Box trailer 7 × 4 (driver licence required)', M); box('Chainsaw', 360); y -= 24;
  text('3. Loan period', { f: bold, size: 12, gap: 8 });
  y -= 10; field('From (date):', M, 280); field('To (date):', 320, W - M); y -= 24;
  text('4. Terms', { f: bold, size: 12, gap: 8 });
  [
    'The Borrower will return the equipment clean, fuelled where relevant, and in the condition it was lent, by 5 pm on the return date.',
    'The Borrower will use the equipment only for domestic, non commercial purposes and will not lend it to anyone else.',
    'The Borrower is responsible for loss, theft or damage during the loan period, except fair wear and tear.',
    'Late returns are charged at $10 per day and may lead to suspension of borrowing rights.',
    'The Lender may recall equipment at any time with 24 hours notice for safety reasons.',
    'Powered equipment must be operated by an adult who has read the manufacturer’s safety instructions supplied with it.'
  ].forEach((t, i) => text(`4.${i + 1}  ${t}`, { gap: 5 }));

  newPage('Page 2 of 2');
  text('5. Declaration', { f: bold, size: 12, gap: 8 });
  text('I have read and agree to the terms of this agreement. I confirm the details in section 1 are correct.', { gap: 12 });
  box('I hold a current driver licence (required to borrow the trailer)', M); y -= 20;
  box('I have been shown how to operate the equipment safely', M); y -= 20;
  box('I would like reminder emails before the return date', M); y -= 34;
  text('Borrower', { f: bold, size: 12, gap: 8 });
  y -= 44; field('Signature:', M, 350); field('Date:', 380, W - M); y -= 26;
  field('Name (print):', M, 350); y -= 44;
  text('Lender representative', { f: bold, size: 12, gap: 8 });
  y -= 44; field('Signature:', M, 350); field('Date:', 380, W - M); y -= 26;
  field('Name (print):', M, 350);
  return pdf.save();
}

// Small hook for automated checks; not used by the page itself.
window.__pdfsign = { S, openBytes, stamp, flattenAndStamp, addItem, place };
})();
