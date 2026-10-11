/* Scan to PDF core: perspective correction (homography + bilinear warp), a document mode
   (adaptive threshold), output sizing, and a dependency free PDF writer for JPEG pages.
   Pure functions on plain arrays, no DOM. UMD: node tests require() it; the page uses ScanCore. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const MAX_EDGE = 2200; // output long edge in pixels; about 200 dpi on A4

  /** Solves A x = b (n x n) by Gaussian elimination with partial pivoting. Null if singular. */
  function solve(A, b) {
    const n = b.length;
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      if (Math.abs(M[p][c]) < 1e-12) return null;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((row, i) => row[n] / row[i]);
  }

  /**
   * The 3x3 homography H (row major, h33 = 1) mapping each `from` point to its `to` point.
   * Points are [{x, y}] x 4. Null for degenerate input (three corners in a line).
   */
  function homography(from, to) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const { x, y } = from[i], { x: u, y: v } = to[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b);
    return h ? [...h, 1] : null;
  }

  function apply(H, x, y) {
    const w = H[6] * x + H[7] * y + H[8];
    return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
  }

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  /** Output size for corners [tl, tr, br, bl]: the longer opposite edges, capped at MAX_EDGE. */
  function outputSize(c, maxEdge = MAX_EDGE) {
    let w = Math.max(dist(c[0], c[1]), dist(c[3], c[2]));
    let h = Math.max(dist(c[0], c[3]), dist(c[1], c[2]));
    const scale = Math.min(1, maxEdge / Math.max(w, h));
    w = Math.max(1, Math.round(w * scale)); h = Math.max(1, Math.round(h * scale));
    return { width: w, height: h };
  }

  /**
   * Warps the quad `corners` [tl, tr, br, bl] of an RGBA image ({width, height, data}) into
   * an upright width x height RGBA image, sampling bilinearly. Outside pixels become white.
   */
  function warp(src, corners, width, height) {
    const H = homography([{ x: 0, y: 0 }, { x: width - 1, y: 0 }, { x: width - 1, y: height - 1 }, { x: 0, y: height - 1 }], corners);
    const out = new Uint8ClampedArray(width * height * 4);
    if (!H) return { width, height, data: out.fill(255) };
    const sw = src.width, sh = src.height, s = src.data;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = apply(H, x, y);
        const o = (y * width + x) * 4;
        if (!(p.x >= 0 && p.y >= 0 && p.x <= sw - 1 && p.y <= sh - 1)) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 255; continue; }
        const x0 = Math.floor(p.x), y0 = Math.floor(p.y), x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1);
        const fx = p.x - x0, fy = p.y - y0;
        for (let k = 0; k < 3; k++) {
          const a = s[(y0 * sw + x0) * 4 + k], bb = s[(y0 * sw + x1) * 4 + k];
          const c = s[(y1 * sw + x0) * 4 + k], d = s[(y1 * sw + x1) * 4 + k];
          out[o + k] = (a * (1 - fx) + bb * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
        }
        out[o + 3] = 255;
      }
    }
    return { width, height, data: out };
  }

  /**
   * Document mode: each pixel becomes black or white against the mean brightness around it
   * (an integral image makes that constant time), which evens out shadows and uneven light.
   */
  function documentMode(img, radius = 15, offset = 12) {
    const { width: w, height: h, data } = img;
    const grey = new Float64Array(w * h);
    for (let i = 0; i < w * h; i++) grey[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    const sum = new Float64Array((w + 1) * (h + 1));
    for (let y = 1; y <= h; y++) {
      let row = 0;
      for (let x = 1; x <= w; x++) { row += grey[(y - 1) * w + (x - 1)]; sum[y * (w + 1) + x] = sum[(y - 1) * (w + 1) + x] + row; }
    }
    // Large solid dark areas (logos, redactions) match their own neighbourhood and would come
    // out hollow, so anything darker than a floor stays black regardless.
    let all = 0;
    for (let i = 0; i < w * h; i++) all += grey[i];
    const floor = Math.min(90, (all / (w * h)) * 0.4);
    const out = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - radius), y1 = Math.min(h, y + radius + 1);
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - radius), x1 = Math.min(w, x + radius + 1);
        const area = (x1 - x0) * (y1 - y0);
        const total = sum[y1 * (w + 1) + x1] - sum[y0 * (w + 1) + x1] - sum[y1 * (w + 1) + x0] + sum[y0 * (w + 1) + x0];
        const g = grey[y * w + x];
        const v = g < floor || g < total / area - offset ? 0 : 255;
        const o = (y * w + x) * 4;
        out[o] = out[o + 1] = out[o + 2] = v; out[o + 3] = 255;
      }
    }
    return { width: w, height: h, data: out };
  }

  /** Corners inset from the edges of a width x height photo: the starting guess. */
  function defaultCorners(width, height, inset = 0.04) {
    const dx = width * inset, dy = height * inset;
    return [{ x: dx, y: dy }, { x: width - dx, y: dy }, { x: width - dx, y: height - dy }, { x: dx, y: height - dy }];
  }

  /** A4 portrait or landscape in points, image scaled to fit within a 24 pt margin. */
  function pagePlacement(imgW, imgH) {
    const landscape = imgW > imgH;
    const pw = landscape ? 842 : 595, ph = landscape ? 595 : 842, m = 24;
    const s = Math.min((pw - 2 * m) / imgW, (ph - 2 * m) / imgH);
    const w = imgW * s, h = imgH * s;
    return { pw, ph, x: (pw - w) / 2, y: (ph - h) / 2, w, h };
  }

  const enc = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 255; return b; };
  const n2 = (v) => (Math.round(v * 100) / 100).toString();

  /**
   * A PDF with one JPEG per page: pages [{jpeg: Uint8Array, width, height}]. The JPEG bytes go
   * in unchanged (DCTDecode), so nothing is recompressed. Returns Uint8Array.
   */
  function buildPdf(pages, title = 'Scan') {
    const parts = [], offsets = [];
    let length = 0;
    const push = (bytes) => { parts.push(bytes); length += bytes.length; };
    const obj = (id, body) => { offsets[id] = length; push(enc(`${id} 0 obj\n`)); body(); push(enc('\nendobj\n')); };
    push(enc('%PDF-1.4\n%âãÏÓ\n'));
    const n = pages.length;
    // Objects: 1 catalog, 2 pages, 3 info, then per page: page, contents, image.
    const pageId = (i) => 4 + i * 3;
    obj(1, () => push(enc('<< /Type /Catalog /Pages 2 0 R >>')));
    obj(2, () => push(enc(`<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${pageId(i)} 0 R`).join(' ')}] >>`)));
    const safeTitle = String(title).replace(/[()\\]/g, '').slice(0, 80);
    obj(3, () => push(enc(`<< /Title (${safeTitle}) /Producer (Plenty of Tools Scan to PDF) >>`)));
    pages.forEach((p, i) => {
      const id = pageId(i);
      const pl = pagePlacement(p.width, p.height);
      const content = `q ${n2(pl.w)} 0 0 ${n2(pl.h)} ${n2(pl.x)} ${n2(pl.y)} cm /Im${i} Do Q`;
      obj(id, () => push(enc(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pl.pw} ${pl.ph}] /Contents ${id + 1} 0 R /Resources << /XObject << /Im${i} ${id + 2} 0 R >> >> >>`)));
      obj(id + 1, () => push(enc(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)));
      obj(id + 2, () => {
        push(enc(`<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`));
        push(p.jpeg);
        push(enc('\nendstream'));
      });
    });
    const count = 4 + n * 3;
    const xref = length;
    let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
    for (let id = 1; id < count; id++) table += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`;
    push(enc(table + `trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`));
    const out = new Uint8Array(length);
    let at = 0;
    for (const part of parts) { out.set(part, at); at += part.length; }
    return out;
  }

  const api = { VERSION, MAX_EDGE, solve, homography, apply, outputSize, warp, documentMode, defaultCorners, pagePlacement, buildPdf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.ScanCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
