/* PDF Tools page logic. pdf-lib does every page operation; pdf.js only draws thumbnails.
   The bytes of your file never leave this tab. */
(function () {
  'use strict';
  const C = window.PdfToolsCore;
  if (!C) return;
  if (!window.pdfjsLib || !window.PDFLib) return;

  pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf-tools/pdf.worker.min.js';

  const $ = id => document.getElementById(id);
  const el = {
    drop: $('pt-drop'), file: $('pt-file'), sample: $('pt-sample'),
    status: $('pt-status'), error: $('pt-error'), work: $('pt-work'),
    all: $('pt-all'), none: $('pt-none'), invert: $('pt-invert'), odd: $('pt-odd'), even: $('pt-even'),
    range: $('pt-range'), rangeGo: $('pt-range-go'),
    left: $('pt-left'), right: $('pt-right'), del: $('pt-delete'),
    reverse: $('pt-reverse'), reset: $('pt-reset'),
    summary: $('pt-summary'), save: $('pt-save'), saveEach: $('pt-save-each'),
    grid: $('pt-grid'),
  };

  // files: [{ name, bytes: Uint8Array, doc: pdf.js document }]
  // pages: [{ id, fileIndex, pageIndex, rotation, originalRotation }]
  const state = { files: [], pages: [], selection: [], busy: false };
  let nextId = 0;

  function setStatus(text) { el.status.textContent = text || ''; }
  function showError(text) {
    el.error.textContent = text || '';
    el.error.hidden = !text;
  }

  // ---------- loading ----------
  async function addFiles(list) {
    const incoming = Array.from(list || []).filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!incoming.length) { showError('Those are not PDFs.'); return; }
    if (state.files.length + incoming.length > C.MAX_FILES) {
      showError(`That is more than ${C.MAX_FILES} files at once.`);
      return;
    }
    showError('');
    state.busy = true;
    setStatus('Opening…');

    for (const file of incoming) {
      let bytes;
      try {
        bytes = new Uint8Array(await file.arrayBuffer());
      } catch {
        showError(`"${file.name}" could not be read.`);
        continue;
      }
      let doc;
      try {
        // pdf.js transfers its input to the worker, so hand it a copy and keep the original.
        doc = await pdfjsLib.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
      } catch (err) {
        const locked = err && /password/i.test(String(err.message || err));
        showError(locked
          ? `"${file.name}" is password protected. Remove the password in the app that made it, then try again.`
          : `"${file.name}" is not a PDF this can read.`);
        continue;
      }
      if (state.pages.length + doc.numPages > C.MAX_PAGES) {
        showError(`That is more than ${C.MAX_PAGES} pages in one go.`);
        doc.destroy();
        break;
      }
      const fileIndex = state.files.length;
      state.files.push({ name: file.name, bytes, doc });
      for (let i = 0; i < doc.numPages; i++) {
        state.pages.push({ id: 'pg' + (nextId++), fileIndex, pageIndex: i, rotation: 0, originalRotation: 0 });
      }
    }

    state.busy = false;
    if (!state.pages.length) { setStatus(''); return; }
    state.selection = state.pages.map(p => p.id);
    el.work.hidden = false;
    render();
    setStatus(`${state.files.length} file${state.files.length === 1 ? '' : 's'}, ${state.pages.length} pages.`);
    renderThumbnails();
  }

  // ---------- rendering ----------
  function render() {
    const selected = new Set(state.selection);
    el.grid.innerHTML = '';
    state.pages.forEach((page, position) => {
      const li = document.createElement('li');
      li.className = 'pt-page' + (selected.has(page.id) ? ' selected' : '');
      li.dataset.id = page.id;

      const thumb = document.createElement('div');
      thumb.className = 'pt-thumb';
      const pending = document.createElement('span');
      pending.className = 'pending';
      pending.textContent = '…';
      thumb.append(pending);
      li.append(thumb);

      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = selected.has(page.id);
      const source = state.files[page.fileIndex];
      cb.setAttribute('aria-label',
        `Page ${position + 1}, page ${page.pageIndex + 1} of ${source ? source.name : 'the document'}`);
      cb.addEventListener('change', () => {
        state.selection = C.toggle(state.selection, page.id);
        render();
        renderThumbnails();
      });
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(position + 1);
      label.append(cb, num);

      if (state.files.length > 1 && source) {
        const src = document.createElement('span');
        src.className = 'src';
        src.textContent = source.name;
        src.title = source.name;
        label.append(src);
      }
      if (C.normaliseRotation(page.rotation)) {
        const rot = document.createElement('span');
        rot.className = 'rot';
        rot.textContent = C.normaliseRotation(page.rotation) + '°';
        label.append(rot);
      }
      li.append(label);

      const move = document.createElement('div');
      move.className = 'pt-move';
      const back = document.createElement('button');
      back.type = 'button';
      back.textContent = '←';
      back.setAttribute('aria-label', `Move page ${position + 1} earlier`);
      back.disabled = position === 0;
      back.addEventListener('click', () => {
        state.pages = C.moveItem(state.pages, position, position - 1);
        render();
        renderThumbnails();
      });
      const fwd = document.createElement('button');
      fwd.type = 'button';
      fwd.textContent = '→';
      fwd.setAttribute('aria-label', `Move page ${position + 1} later`);
      fwd.disabled = position === state.pages.length - 1;
      fwd.addEventListener('click', () => {
        state.pages = C.moveItem(state.pages, position, position + 1);
        render();
        renderThumbnails();
      });
      move.append(back, fwd);
      li.append(move);
      el.grid.append(li);
    });

    const s = C.summarise(state.files, state.pages, state.selection);
    el.summary.textContent = s.selected
      ? `${s.selected} of ${s.pages} pages selected${s.rotated ? `, ${s.rotated} rotated` : ''}.`
      : 'No pages selected.';
    el.save.disabled = !s.selected;
    el.saveEach.disabled = !s.selected;
    // Left enabled when everything is selected, so the click can say why it will not do
    // it. A button that is simply dead tells you nothing.
    el.del.disabled = !s.selected;
  }

  /** Draws each thumbnail once, then reuses the canvas and only re-applies the rotation. */
  const thumbCache = new Map();
  async function renderThumbnails() {
    for (const li of el.grid.querySelectorAll('.pt-page')) {
      const page = state.pages.find(p => p.id === li.dataset.id);
      if (!page) continue;
      const holder = li.querySelector('.pt-thumb');
      const key = page.id;
      let canvas = thumbCache.get(key);
      if (!canvas) {
        try {
          const source = state.files[page.fileIndex];
          const pdfPage = await source.doc.getPage(page.pageIndex + 1);
          const base = pdfPage.getViewport({ scale: 1 });
          const scale = Math.min(150 / base.width, 170 / base.height);
          const viewport = pdfPage.getViewport({ scale });
          canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.floor(viewport.width));
          canvas.height = Math.max(1, Math.floor(viewport.height));
          canvas.setAttribute('role', 'presentation');
          await pdfPage.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          thumbCache.set(key, canvas);
        } catch {
          continue;
        }
      }
      const turn = C.normaliseRotation(page.rotation);
      canvas.style.transform = turn ? `rotate(${turn}deg)` : '';
      // A quarter turn needs the box to fit the other way round.
      canvas.style.maxWidth = (turn === 90 || turn === 270) ? '170px' : '100%';
      canvas.style.maxHeight = (turn === 90 || turn === 270) ? '150px' : '100%';
      holder.innerHTML = '';
      holder.append(canvas);
    }
  }

  // ---------- operations ----------
  const allIds = () => state.pages.map(p => p.id);
  function setSelection(ids) { state.selection = ids; render(); renderThumbnails(); }

  el.all.addEventListener('click', () => setSelection(allIds()));
  el.none.addEventListener('click', () => setSelection([]));
  el.invert.addEventListener('click', () => {
    const set = new Set(state.selection);
    setSelection(allIds().filter(id => !set.has(id)));
  });
  el.odd.addEventListener('click', () => setSelection(C.everyOther(state.pages, 'odd')));
  el.even.addEventListener('click', () => setSelection(C.everyOther(state.pages, 'even')));

  el.rangeGo.addEventListener('click', () => {
    const { pages, bad } = C.parsePageRange(el.range.value, state.pages.length);
    if (bad.length) {
      showError(`Could not use: ${bad.join(', ')}. This document has ${state.pages.length} pages.`);
    } else {
      showError('');
    }
    if (pages.length) setSelection(pages.map(i => state.pages[i].id));
  });
  el.range.addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); el.rangeGo.click(); }
  });

  function rotateSelected(delta) {
    const set = new Set(state.selection);
    for (const page of state.pages) if (set.has(page.id)) page.rotation = C.rotateBy(page.rotation, delta);
    render();
    renderThumbnails();
  }
  el.left.addEventListener('click', () => rotateSelected(-90));
  el.right.addEventListener('click', () => rotateSelected(90));

  el.del.addEventListener('click', () => {
    const keep = C.withoutSelection(state.pages, state.selection);
    if (!keep.length) { showError('That would delete every page.'); return; }
    showError('');
    state.pages = keep;
    state.selection = keep.map(p => p.id);
    render();
    renderThumbnails();
  });

  el.reverse.addEventListener('click', () => {
    state.pages = C.reverse(state.pages);
    render();
    renderThumbnails();
  });

  el.reset.addEventListener('click', () => {
    for (const f of state.files) { try { f.doc.destroy(); } catch {} }
    state.files = [];
    state.pages = [];
    state.selection = [];
    thumbCache.clear();
    el.work.hidden = true;
    el.grid.innerHTML = '';
    setStatus('');
    showError('');
  });

  // ---------- saving ----------
  async function buildPdf(pages) {
    const { PDFDocument, degrees } = PDFLib;
    const out = await PDFDocument.create();
    // Each source is loaded once, however many of its pages are used.
    const loaded = new Map();
    for (const page of pages) {
      if (!loaded.has(page.fileIndex)) {
        loaded.set(page.fileIndex, await PDFDocument.load(state.files[page.fileIndex].bytes, { ignoreEncryption: false }));
      }
    }
    for (const page of pages) {
      const [copied] = await out.copyPages(loaded.get(page.fileIndex), [page.pageIndex]);
      const turn = C.normaliseRotation(page.rotation);
      if (turn) {
        // Added to whatever the page already carried, so a page saved sideways stays sideways.
        const existing = C.normaliseRotation(copied.getRotation().angle);
        copied.setRotation(degrees(C.normaliseRotation(existing + turn)));
      }
      out.addPage(copied);
    }
    return out.save();
  }

  function download(bytes, name) {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  el.save.addEventListener('click', async () => {
    const chosen = C.selectedPages(state.pages, state.selection);
    if (!chosen.length) return;
    el.save.disabled = true;
    setStatus('Building the PDF…');
    try {
      const bytes = await buildPdf(chosen);
      download(bytes, C.outputName(state.files, chosen, state.pages));
      setStatus(`Saved ${chosen.length} page${chosen.length === 1 ? '' : 's'}.`);
      showError('');
    } catch (err) {
      showError('That could not be saved: ' + (err && err.message ? err.message : String(err)));
      setStatus('');
    } finally {
      el.save.disabled = false;
    }
  });

  el.saveEach.addEventListener('click', async () => {
    const chosen = C.selectedPages(state.pages, state.selection);
    if (!chosen.length) return;
    el.saveEach.disabled = true;
    try {
      for (let i = 0; i < chosen.length; i++) {
        setStatus(`Saving page ${i + 1} of ${chosen.length}…`);
        const bytes = await buildPdf([chosen[i]]);
        const base = C.baseName(state.files[chosen[i].fileIndex].name);
        download(bytes, `${base}-page-${chosen[i].pageIndex + 1}.pdf`);
        await new Promise(r => setTimeout(r, 120));
      }
      setStatus(`Saved ${chosen.length} file${chosen.length === 1 ? '' : 's'}.`);
    } catch (err) {
      showError('That could not be saved: ' + (err && err.message ? err.message : String(err)));
    } finally {
      el.saveEach.disabled = false;
    }
  });

  // ---------- input ----------
  el.file.addEventListener('change', () => { addFiles(el.file.files); el.file.value = ''; });
  for (const type of ['dragenter', 'dragover']) {
    el.drop.addEventListener(type, event => { event.preventDefault(); el.drop.classList.add('over'); });
  }
  for (const type of ['dragleave', 'drop']) {
    el.drop.addEventListener(type, event => { event.preventDefault(); el.drop.classList.remove('over'); });
  }
  el.drop.addEventListener('drop', event => {
    if (event.dataTransfer && event.dataTransfer.files) addFiles(event.dataTransfer.files);
  });

  // ---------- sample ----------
  async function samplePdf() {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const labels = ['Cover', 'Terms', 'Schedule', 'Signatures'];
    labels.forEach((label, i) => {
      const page = doc.addPage([420, 595]);
      page.drawText(label, { x: 40, y: 500, size: 36, font, color: rgb(0.04, 0.42, 0.31) });
      page.drawText(`Sample page ${i + 1}`, { x: 40, y: 455, size: 14, font, color: rgb(0.36, 0.4, 0.45) });
      page.drawRectangle({ x: 40, y: 80, width: 340, height: 340, borderColor: rgb(0.88, 0.9, 0.92), borderWidth: 1 });
    });
    return doc.save();
  }

  el.sample.addEventListener('click', async () => {
    setStatus('Making a sample…');
    const bytes = await samplePdf();
    const file = new File([bytes], 'Sample contract.pdf', { type: 'application/pdf' });
    await addFiles([file]);
  });

  window.__pdfTools = { state, addFiles, buildPdf, samplePdf, render };
})();
