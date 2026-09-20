/* PDF Tools core: page selections, ranges, rotation and ordering.
   Pure functions over plain page descriptors, so none of this needs a PDF to test.
   A page is { id, fileIndex, pageIndex, rotation } where rotation is 0, 90, 180 or 270.
   UMD so node tests can require() it and the page can use PdfToolsCore. */
(function (root) {
  'use strict';

  const MAX_FILES = 30;
  const MAX_PAGES = 2000;

  // ---------- rotation ----------
  /** Always one of 0, 90, 180, 270, whatever arithmetic or stored value arrives. */
  function normaliseRotation(value) {
    const n = Math.round(Number(value) || 0);
    return ((n % 360) + 360) % 360 === 0 ? 0 : (((n % 360) + 360) % 360);
  }
  function rotateBy(current, delta) {
    const step = Math.round(Number(delta) || 0);
    return normaliseRotation(normaliseRotation(current) + step);
  }

  // ---------- page ranges ----------
  /**
   * "1-3, 5, 8-10" becomes zero based indexes, clamped to the document and de-duplicated.
   * A reversed range is read the way it was obviously meant: 5-3 is 3, 4, 5.
   * Returns { pages, bad } so the page can say which bits it could not read.
   */
  function parsePageRange(text, pageCount) {
    const total = Math.max(0, Math.floor(Number(pageCount) || 0));
    const out = [];
    const bad = [];
    const seen = new Set();
    const raw = String(text == null ? '' : text).trim();
    if (!raw) return { pages: [], bad: [] };

    for (const chunk of raw.split(/[,;]+/)) {
      const part = chunk.trim();
      if (!part) continue;
      let from, to;
      const range = /^(\d+)\s*(?:-|–|to)\s*(\d+)$/.exec(part);
      const single = /^(\d+)$/.exec(part);
      if (range) { from = Number(range[1]); to = Number(range[2]); }
      else if (single) { from = to = Number(single[1]); }
      else if (/^(all|every)$/i.test(part)) { from = 1; to = total; }
      else { bad.push(part); continue; }

      if (from > to) { const t = from; from = to; to = t; }
      if (from < 1 || to > total || total === 0) { bad.push(part); continue; }
      for (let n = from; n <= to; n++) {
        if (!seen.has(n)) { seen.add(n); out.push(n - 1); }
      }
    }
    return { pages: out, bad };
  }

  /** The inverse: [0,1,2,4,7,8] reads back as "1-3, 5, 8-9". */
  function formatPageRange(indexes) {
    const list = Array.from(new Set((indexes || []).map(n => Math.floor(Number(n)))))
      .filter(n => Number.isFinite(n) && n >= 0)
      .sort((a, b) => a - b);
    if (!list.length) return '';
    const parts = [];
    let start = list[0];
    let prev = list[0];
    for (let i = 1; i <= list.length; i++) {
      const n = list[i];
      if (n === prev + 1) { prev = n; continue; }
      parts.push(start === prev ? String(start + 1) : `${start + 1}-${prev + 1}`);
      start = prev = n;
    }
    return parts.join(', ');
  }

  // ---------- ordering ----------
  /** Moves one item to a new position, without losing or duplicating anything. */
  function moveItem(list, from, to) {
    const out = (list || []).slice();
    if (!out.length) return out;
    const a = Math.max(0, Math.min(out.length - 1, Math.floor(from)));
    const b = Math.max(0, Math.min(out.length - 1, Math.floor(to)));
    if (a === b) return out;
    const [item] = out.splice(a, 1);
    out.splice(b, 0, item);
    return out;
  }

  /** Reverses the whole order, which is what a back to front scan needs. */
  function reverse(list) {
    return (list || []).slice().reverse();
  }

  // ---------- selections ----------
  function toggle(selection, id) {
    const set = new Set(selection || []);
    if (set.has(id)) set.delete(id); else set.add(id);
    return Array.from(set);
  }

  function selectedPages(pages, selection) {
    const set = new Set(selection || []);
    return (pages || []).filter(p => set.has(p.id));
  }

  /** Everything except the selection, in the order it is already in. */
  function withoutSelection(pages, selection) {
    const set = new Set(selection || []);
    return (pages || []).filter(p => !set.has(p.id));
  }

  /** Odd and even are counted as a person counts them, from page one. */
  function everyOther(pages, which) {
    return (pages || []).filter((_, i) => (which === 'even' ? i % 2 === 1 : i % 2 === 0)).map(p => p.id);
  }

  // ---------- names ----------
  function baseName(fileName) {
    return String(fileName || 'document')
      .replace(/\.[Pp][Dd][Ff]$/, '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-+|-+$/g, '')          // never leave a name starting or ending in a dash
      .slice(0, 80) || 'document';
  }

  function outputName(files, pages, allPages) {
    const names = Array.from(new Set((pages || []).map(p => baseName((files[p.fileIndex] || {}).name))));
    if (names.length > 1) return 'merged.pdf';
    const base = names[0] || 'document';
    if (pages.length === (allPages || []).length) return `${base}-edited.pdf`;
    return `${base}-pages-${formatPageRange(pages.map(p => p.pageIndex)).replace(/[,\s]+/g, '_') || 'selected'}.pdf`;
  }

  // ---------- summary ----------
  function summarise(files, pages, selection) {
    const selected = selectedPages(pages, selection).length;
    return {
      files: (files || []).length,
      pages: (pages || []).length,
      selected,
      rotated: (pages || []).filter(p => normaliseRotation(p.rotation) !== normaliseRotation(p.originalRotation || 0)).length,
    };
  }

  const api = {
    MAX_FILES, MAX_PAGES,
    normaliseRotation, rotateBy,
    parsePageRange, formatPageRange,
    moveItem, reverse,
    toggle, selectedPages, withoutSelection, everyOther,
    baseName, outputName, summarise,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PdfToolsCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
