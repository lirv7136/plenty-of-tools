/* What's Eating My Disk — core.
   Pure functions over a flat list of file records. No DOM, no file system.
   A record is { path, size, mtime } where path uses "/" and starts below the chosen folder.
   UMD so node tests can require() it and the page can use DiskCore. */
(function (root) {
  'use strict';

  const MAX_FILES = 400000;          // beyond this the browser is the wrong tool
  const QUICK_HASH_BYTES = 65536;    // first slice used to rule duplicates out cheaply

  // ---------- formatting ----------
  // Binary units, because every disk tool a person is comparing this against uses them.
  const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  function formatBytes(n, digits) {
    const v = Number(n);
    if (!Number.isFinite(v) || v < 0) return '0 B';
    if (v < 1024) return v + ' B';
    let i = 0;
    let x = v;
    while (x >= 1024 && i < UNITS.length - 1) { x /= 1024; i++; }
    const d = digits == null ? (x < 10 ? 1 : 0) : digits;
    return x.toFixed(d) + ' ' + UNITS[i];
  }

  function formatCount(n) {
    return Number(n).toLocaleString('en-AU');
  }

  // ---------- paths ----------
  function segments(path) {
    return String(path == null ? '' : path).split('/').filter(Boolean);
  }
  function baseName(path) {
    const s = segments(path);
    return s.length ? s[s.length - 1] : '';
  }
  function parentPath(path) {
    const s = segments(path);
    s.pop();
    return s.join('/');
  }
  /** Extension without the dot, lower case. Dotfiles have no extension. */
  function extensionOf(name) {
    const base = baseName(name);
    const dot = base.lastIndexOf('.');
    if (dot <= 0 || dot === base.length - 1) return '';
    const ext = base.slice(dot + 1).toLowerCase();
    return /^[a-z0-9_+-]{1,12}$/.test(ext) ? ext : '';
  }

  const CATEGORIES = [
    ['Photos', ['jpg', 'jpeg', 'png', 'gif', 'heic', 'heif', 'webp', 'bmp', 'tif', 'tiff', 'raw', 'cr2', 'nef', 'arw', 'dng', 'svg', 'avif']],
    ['Video', ['mp4', 'mov', 'mkv', 'avi', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg', '3gp', 'mts']],
    ['Audio', ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg', 'oga', 'opus', 'wma', 'aiff', 'aif', 'mid']],
    ['Documents', ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'txt', 'rtf', 'md', 'csv', 'pages', 'numbers', 'key', 'epub', 'mobi']],
    ['Archives', ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg', 'pkg', 'cab', 'tgz']],
    ['Code', ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'rs', 'java', 'c', 'h', 'cpp', 'cs', 'php', 'html', 'css', 'json', 'xml', 'yml', 'yaml', 'sh', 'sql', 'ipynb']],
    ['Apps and installers', ['exe', 'msi', 'app', 'deb', 'rpm', 'appimage', 'apk', 'jar', 'bin']],
    ['Disk images and backups', ['vmdk', 'vdi', 'qcow2', 'vhd', 'vhdx', 'bak', 'backup', 'sparsebundle']],
  ];
  const CATEGORY_BY_EXT = (() => {
    const map = new Map();
    for (const [label, exts] of CATEGORIES) for (const e of exts) map.set(e, label);
    return map;
  })();
  function categoryOf(nameOrExt) {
    const ext = nameOrExt && nameOrExt.indexOf('.') >= 0 ? extensionOf(nameOrExt) : String(nameOrExt || '').toLowerCase();
    return CATEGORY_BY_EXT.get(ext) || 'Other';
  }

  // ---------- validation ----------
  /** Keeps only records the rest of the code can trust. Returns { files, skipped }. */
  function cleanEntries(list) {
    const files = [];
    let skipped = 0;
    for (const raw of Array.isArray(list) ? list : []) {
      if (files.length >= MAX_FILES) { skipped++; continue; }
      const path = raw && typeof raw.path === 'string' ? raw.path.replace(/\\/g, '/').replace(/^\/+/, '') : '';
      const size = raw ? Number(raw.size) : NaN;
      if (!path || !Number.isFinite(size) || size < 0) { skipped++; continue; }
      const mtime = Number(raw.mtime);
      files.push({ path, size, mtime: Number.isFinite(mtime) && mtime > 0 ? mtime : 0 });
    }
    return { files, skipped };
  }

  // ---------- aggregation ----------
  /**
   * Folder tree with a size on every node. One pass, walking each path's segments and
   * adding the file's size to every ancestor, so a 100k file scan stays linear.
   */
  function buildTree(files) {
    const root = { name: '', path: '', size: 0, files: 0, dirs: new Map(), isDir: true };
    for (const f of files) {
      const parts = segments(f.path);
      const fileName = parts.pop();
      let node = root;
      node.size += f.size;
      let walked = '';
      for (const part of parts) {
        walked = walked ? walked + '/' + part : part;
        let child = node.dirs.get(part);
        if (!child) {
          child = { name: part, path: walked, size: 0, files: 0, dirs: new Map(), isDir: true };
          node.dirs.set(part, child);
        }
        node = child;
        node.size += f.size;
      }
      node.files += 1;
      if (!node.ownFiles) node.ownFiles = [];
      node.ownFiles.push({ name: fileName, path: f.path, size: f.size, mtime: f.mtime, isDir: false });
    }
    return root;
  }

  /** Immediate children of a node, folders and loose files together, biggest first. */
  function childrenOf(node) {
    if (!node) return [];
    const out = [];
    for (const dir of node.dirs.values()) out.push(dir);
    for (const f of node.ownFiles || []) out.push(f);
    out.sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
    return out;
  }

  /** Walks to a folder by path. Returns null when the path is not a folder in the tree. */
  function nodeAt(root, path) {
    let node = root;
    for (const part of segments(path)) {
      node = node.dirs.get(part);
      if (!node) return null;
    }
    return node;
  }

  // ---------- treemap ----------
  // Squarified treemap (Bruls, Huizing and van Wijk). Rows are laid along the shorter
  // side and closed as soon as adding the next item would make the worst aspect ratio
  // worse, which is what keeps the rectangles close to square and readable.
  function worstRatio(row, side) {
    if (!row.length || side <= 0) return Infinity;
    let sum = 0, min = Infinity, max = 0;
    for (const r of row) { sum += r.area; if (r.area < min) min = r.area; if (r.area > max) max = r.area; }
    if (sum <= 0) return Infinity;
    const s2 = sum * sum;
    const side2 = side * side;
    return Math.max((side2 * max) / s2, s2 / (side2 * min));
  }

  function placeRow(row, rect, out) {
    let sum = 0;
    for (const r of row) sum += r.area;
    if (sum <= 0) return rect;
    if (rect.w >= rect.h) {
      const width = sum / rect.h;
      let y = rect.y;
      for (const r of row) {
        const h = r.area / width;
        out.push({ item: r.item, x: rect.x, y, w: width, h });
        y += h;
      }
      return { x: rect.x + width, y: rect.y, w: rect.w - width, h: rect.h };
    }
    const height = sum / rect.w;
    let x = rect.x;
    for (const r of row) {
      const w = r.area / height;
      out.push({ item: r.item, x, y: rect.y, w, h: height });
      x += w;
    }
    return { x: rect.x, y: rect.y + height, w: rect.w, h: rect.h - height };
  }

  /** items: [{ name, size, ... }]. Returns [{ item, x, y, w, h }] filling the rect. */
  function squarify(items, rect) {
    const out = [];
    if (!rect || rect.w <= 0 || rect.h <= 0) return out;
    const usable = (Array.isArray(items) ? items : []).filter(i => i && Number(i.size) > 0);
    let total = 0;
    for (const i of usable) total += Number(i.size);
    if (total <= 0) return out;

    const scale = (rect.w * rect.h) / total;
    const queue = usable
      .slice()
      .sort((a, b) => b.size - a.size)
      .map(item => ({ item, area: Number(item.size) * scale }));

    let free = { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
    let row = [];
    while (queue.length) {
      const side = Math.min(free.w, free.h);
      const next = queue[0];
      if (!row.length || worstRatio(row, side) >= worstRatio(row.concat(next), side)) {
        row.push(queue.shift());
      } else {
        free = placeRow(row, free, out);
        row = [];
      }
    }
    if (row.length) placeRow(row, free, out);
    return out;
  }

  // ---------- reports ----------
  function largestFiles(files, n) {
    return (files || []).slice().sort((a, b) => b.size - a.size || a.path.localeCompare(b.path)).slice(0, n || 50);
  }

  function byCategory(files) {
    const map = new Map();
    for (const f of files || []) {
      const label = categoryOf(f.path);
      const row = map.get(label) || { name: label, size: 0, count: 0 };
      row.size += f.size;
      row.count += 1;
      map.set(label, row);
    }
    return Array.from(map.values()).sort((a, b) => b.size - a.size || a.name.localeCompare(b.name));
  }

  function byExtension(files, n) {
    const map = new Map();
    for (const f of files || []) {
      const ext = extensionOf(f.path) || 'no extension';
      const row = map.get(ext) || { name: ext, size: 0, count: 0 };
      row.size += f.size;
      row.count += 1;
      map.set(ext, row);
    }
    return Array.from(map.values()).sort((a, b) => b.size - a.size || a.name.localeCompare(b.name)).slice(0, n || 20);
  }

  /** Files not modified since `cutoff` (ms). Records with no mtime are not guessed at. */
  function staleFiles(files, cutoff, minSize) {
    const floor = Number(minSize) || 0;
    return (files || [])
      .filter(f => f.mtime > 0 && f.mtime < cutoff && f.size >= floor)
      .sort((a, b) => b.size - a.size)
      .slice(0, 500);
  }

  // ---------- duplicates ----------
  // Two files can only be identical if they are the same size, so the expensive work is
  // confined to size collisions. Empty files are skipped: every one of them matches every
  // other, and deleting them frees nothing.
  function sizeGroups(files, minSize) {
    const floor = Math.max(1, Number(minSize) || 1);
    const bySize = new Map();
    for (const f of files || []) {
      if (f.size < floor) continue;
      const list = bySize.get(f.size);
      if (list) list.push(f); else bySize.set(f.size, [f]);
    }
    const groups = [];
    for (const list of bySize.values()) if (list.length > 1) groups.push(list);
    return groups.sort((a, b) => b[0].size * b.length - a[0].size * a.length);
  }

  /** How much hashing a set of candidate groups implies, so the page can warn first. */
  function hashWorkload(groups) {
    let files = 0, bytes = 0;
    for (const g of groups || []) for (const f of g) { files += 1; bytes += f.size; }
    return { files, bytes };
  }

  /**
   * Turns { key -> [files] } into duplicate sets. "Wasted" counts every copy after the
   * first, which is what you would actually free by keeping one of each.
   */
  function duplicateSets(byKey) {
    const sets = [];
    const entries = byKey instanceof Map ? Array.from(byKey.entries()) : Object.entries(byKey || {});
    for (const [key, list] of entries) {
      if (!list || list.length < 2) continue;
      const copies = list.slice().sort((a, b) => a.path.localeCompare(b.path));
      sets.push({ key, size: copies[0].size, count: copies.length, wasted: copies[0].size * (copies.length - 1), files: copies });
    }
    return sets.sort((a, b) => b.wasted - a.wasted);
  }

  function totalWasted(sets) {
    let n = 0;
    for (const s of sets || []) n += s.wasted;
    return n;
  }

  // ---------- summary ----------
  function summarise(files) {
    let size = 0, newest = 0, oldest = Infinity;
    for (const f of files || []) {
      size += f.size;
      if (f.mtime > newest) newest = f.mtime;
      if (f.mtime > 0 && f.mtime < oldest) oldest = f.mtime;
    }
    return {
      count: (files || []).length,
      size,
      newest: newest || 0,
      oldest: Number.isFinite(oldest) ? oldest : 0,
    };
  }

  const api = {
    MAX_FILES, QUICK_HASH_BYTES, CATEGORIES,
    formatBytes, formatCount,
    segments, baseName, parentPath, extensionOf, categoryOf,
    cleanEntries, buildTree, childrenOf, nodeAt,
    squarify, worstRatio,
    largestFiles, byCategory, byExtension, staleFiles,
    sizeGroups, hashWorkload, duplicateSets, totalWasted,
    summarise,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DiskCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
