/* Scan to PDF — UI over ScanCore. Photos and pages live only in memory for this tab. */
(() => {
'use strict';
const S = window.ScanCore;
const $ = id => document.getElementById(id);
const els = { files: $('files'), status: $('status'), editor: $('editor'), queue: $('queue'), photo: $('photo'), overlay: $('overlay'),
  mode: $('mode'), rotate: $('btn-rotate'), reset: $('btn-reset'), skip: $('btn-skip'), page: $('btn-page'), count: $('count'),
  name: $('name'), pdf: $('btn-pdf'), clear: $('btn-clear'), empty: $('empty'), thumbs: $('thumbs') };
if (!S) { els.status.textContent = 'The page did not load completely. Reload and try again.'; return; }

const MAX_SOURCE = 4000; // photos are scaled to at most this long edge before warping
let queue = [];          // Files waiting
let current = null;      // { image: ImageData, corners, rotation }
let pages = [];          // { jpeg: Uint8Array, width, height, url }
let drag = -1;
const say = t => { els.status.textContent = t; };

async function decode(file) {
  // createImageBitmap applies the photo's camera orientation where supported.
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SOURCE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.drawImage(bitmap, 0, 0, w, h);
  bitmap.close && bitmap.close();
  return g.getImageData(0, 0, w, h);
}

async function next() {
  current = null;
  while (queue.length && !current) {
    const file = queue.shift();
    try {
      const image = await decode(file);
      current = { image, corners: S.defaultCorners(image.width, image.height), rotation: 0 };
    } catch { say(`Couldn’t open ${file.name}. Try a JPEG or PNG.`); }
  }
  els.editor.hidden = !current;
  els.queue.textContent = queue.length ? `(${queue.length} more waiting)` : '';
  if (current) { draw(); els.editor.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
}

function draw() {
  const { image, corners } = current;
  els.photo.width = els.overlay.width = image.width;
  els.photo.height = els.overlay.height = image.height;
  els.photo.getContext('2d').putImageData(image, 0, 0);
  drawOverlay();
}

function drawOverlay() {
  const g = els.overlay.getContext('2d');
  const { corners, image } = current;
  const r = Math.max(10, Math.round(Math.max(image.width, image.height) / 60));
  g.clearRect(0, 0, image.width, image.height);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath(); g.rect(0, 0, image.width, image.height);
  g.moveTo(corners[0].x, corners[0].y); corners.slice(1).forEach(p => g.lineTo(p.x, p.y)); g.closePath();
  g.fill('evenodd');
  g.strokeStyle = '#2f8f5b'; g.lineWidth = Math.max(2, r / 4);
  g.beginPath(); g.moveTo(corners[0].x, corners[0].y); corners.slice(1).forEach(p => g.lineTo(p.x, p.y)); g.closePath(); g.stroke();
  for (const p of corners) { g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fillStyle = '#2f8f5b'; g.fill(); g.lineWidth = Math.max(2, r / 5); g.strokeStyle = '#fff'; g.stroke(); }
}

function toImage(e) {
  const rect = els.overlay.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * (els.overlay.width / rect.width), y: (e.clientY - rect.top) * (els.overlay.height / rect.height) };
}
els.overlay.addEventListener('pointerdown', e => {
  if (!current) return;
  const p = toImage(e);
  const dists = current.corners.map(c => Math.hypot(c.x - p.x, c.y - p.y));
  const best = dists.indexOf(Math.min(...dists));
  const reach = Math.max(current.image.width, current.image.height) / 12;
  if (dists[best] <= reach) { drag = best; els.overlay.setPointerCapture(e.pointerId); }
});
els.overlay.addEventListener('pointermove', e => {
  if (drag < 0 || !current) return;
  const p = toImage(e);
  current.corners[drag] = { x: Math.max(0, Math.min(current.image.width - 1, p.x)), y: Math.max(0, Math.min(current.image.height - 1, p.y)) };
  drawOverlay();
});
['pointerup', 'pointercancel'].forEach(t => els.overlay.addEventListener(t, () => { drag = -1; }));

function rotated(img, quarter) {
  const turns = ((quarter % 4) + 4) % 4;
  const c = document.createElement('canvas');
  const src = document.createElement('canvas'); src.width = img.width; src.height = img.height;
  src.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0);
  c.width = turns % 2 ? img.height : img.width; c.height = turns % 2 ? img.width : img.height;
  const g = c.getContext('2d');
  g.translate(c.width / 2, c.height / 2); g.rotate(turns * Math.PI / 2); g.drawImage(src, -img.width / 2, -img.height / 2);
  return c;
}

async function addPage() {
  if (!current) return;
  say('Straightening...');
  await new Promise(r => setTimeout(r, 20));
  const { width, height } = S.outputSize(current.corners);
  let out = S.warp(current.image, current.corners, width, height);
  if (els.mode.value === 'document') out = S.documentMode(out);
  const canvas = rotated(out, current.rotation);
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.85));
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  pages.push({ jpeg, width: canvas.width, height: canvas.height, url: URL.createObjectURL(blob) });
  renderPages();
  say(`Page ${pages.length} added.`);
  await next();
}

function renderPages() {
  els.thumbs.textContent = '';
  els.empty.hidden = pages.length > 0;
  els.pdf.disabled = pages.length === 0;
  els.count.textContent = pages.length ? `(${pages.length})` : '';
  pages.forEach((p, i) => {
    const li = document.createElement('li');
    const img = document.createElement('img'); img.src = p.url; img.alt = `Page ${i + 1}`;
    const label = document.createElement('span'); label.className = 'hint'; label.textContent = `Page ${i + 1}`;
    const row = document.createElement('div'); row.className = 'row';
    const mk = (text, aria, fn, disabled) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.setAttribute('aria-label', aria); b.disabled = !!disabled; b.addEventListener('click', fn); row.append(b); };
    mk('←', `Move page ${i + 1} earlier`, () => { [pages[i - 1], pages[i]] = [pages[i], pages[i - 1]]; renderPages(); }, i === 0);
    mk('→', `Move page ${i + 1} later`, () => { [pages[i + 1], pages[i]] = [pages[i], pages[i + 1]]; renderPages(); }, i === pages.length - 1);
    mk('Remove', `Remove page ${i + 1}`, () => { URL.revokeObjectURL(p.url); pages.splice(i, 1); renderPages(); });
    li.append(img, label, row);
    els.thumbs.append(li);
  });
}

function pdfBytes() { return S.buildPdf(pages, els.name.value.trim() || 'scan'); }

els.files.addEventListener('change', () => {
  queue.push(...[...els.files.files].filter(f => f.type.startsWith('image/')));
  els.files.value = '';
  if (!current) next();
  else els.queue.textContent = `(${queue.length} more waiting)`;
});
els.rotate.addEventListener('click', () => { if (current) { current.rotation += 1; say(`The page will be turned ${(current.rotation % 4) * 90}°.`); } });
els.reset.addEventListener('click', () => { if (current) { current.corners = S.defaultCorners(current.image.width, current.image.height); drawOverlay(); } });
els.skip.addEventListener('click', () => next());
els.page.addEventListener('click', () => addPage());
els.pdf.addEventListener('click', () => {
  const blob = new Blob([pdfBytes()], { type: 'application/pdf' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${(els.name.value.trim() || 'scan').replace(/[^\w\- ]+/g, '').slice(0, 60) || 'scan'}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
let armed = false;
els.clear.addEventListener('click', () => {
  if (!armed) { armed = true; els.clear.textContent = 'Click again to clear'; setTimeout(() => { armed = false; els.clear.textContent = 'Clear'; }, 4000); return; }
  pages.forEach(p => URL.revokeObjectURL(p.url)); pages = []; queue = []; current = null; els.editor.hidden = true;
  armed = false; els.clear.textContent = 'Clear'; renderPages(); say('Cleared.');
});

renderPages();
// Hooks for the browser test only; harmless otherwise.
window.__scan = { setCorners: c => { if (current) { current.corners = c; drawOverlay(); } }, get current() { return current; }, pdfBytes, get pages() { return pages; } };
})();
