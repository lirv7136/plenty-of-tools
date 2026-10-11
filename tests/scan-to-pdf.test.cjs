const { test } = require('node:test');
const assert = require('node:assert/strict');
const S = require('../tools/scan-to-pdf/static/core.js');

const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test('the homography maps each corner exactly, and refuses a degenerate quad', () => {
  const from = [{ x: 0, y: 0 }, { x: 99, y: 0 }, { x: 99, y: 149 }, { x: 0, y: 149 }];
  const to = [{ x: 30, y: 20 }, { x: 410, y: 60 }, { x: 380, y: 520 }, { x: 10, y: 470 }];
  const H = S.homography(from, to);
  from.forEach((p, i) => { const q = S.apply(H, p.x, p.y); near(q.x, to[i].x, 1e-6); near(q.y, to[i].y, 1e-6); });
  assert.equal(S.homography(from, [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }]), null);
});

test('output size follows the longer edges, capped', () => {
  assert.deepEqual(S.outputSize([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 600 }, { x: 0, y: 600 }]), { width: 400, height: 600 });
  const big = S.outputSize([{ x: 0, y: 0 }, { x: 4000, y: 0 }, { x: 4000, y: 6000 }, { x: 0, y: 6000 }]);
  assert.equal(Math.max(big.width, big.height), S.MAX_EDGE);
});

/** A dark photo with a white page whose corners are given, and a black square on the page. */
function photo(w, h, page) {
  const data = new Uint8ClampedArray(w * h * 4);

  const inv = S.homography(page, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const u = S.apply(inv, x, y);
    const inPage = u.x >= 0 && u.x <= 1 && u.y >= 0 && u.y <= 1;
    const inMark = u.x > 0.4 && u.x < 0.6 && u.y > 0.4 && u.y < 0.6;
    const v = inPage ? (inMark ? 0 : 245) : 40;
    const o = (y * w + x) * 4; data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
  }
  return { width: w, height: h, data };
}

test('warping a tilted page gives an upright page with its mark in the middle', () => {
  const corners = [{ x: 60, y: 40 }, { x: 330, y: 70 }, { x: 300, y: 380 }, { x: 40, y: 350 }];
  const src = photo(400, 420, corners);
  const out = S.warp(src, corners, 200, 260);
  const at = (x, y) => out.data[(y * out.width + x) * 4];
  assert.ok(at(100, 130) < 40, 'centre is the black mark');
  for (const [x, y] of [[10, 10], [190, 10], [190, 250], [10, 250], [100, 30], [30, 130]]) assert.ok(at(x, y) > 200, `page white at ${x},${y}`);
});

test('document mode turns shading into clean black and white', () => {
  const w = 120, h = 80, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const shade = 120 + x; // light falling off across the page
    const ink = x > 50 && x < 70 && y > 30 && y < 50;
    const v = ink ? shade - 90 : shade;
    const o = (y * w + x) * 4; data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
  }
  const out = S.documentMode({ width: w, height: h, data });
  const at = (x, y) => out.data[(y * w + x) * 4];
  assert.equal(at(60, 40), 0, 'ink is black');
  assert.equal(at(10, 40), 255, 'the dark side of the page is still white');
  assert.equal(at(110, 10), 255);
  assert.ok([...out.data].every(v => v === 0 || v === 255));
});

test('pages fit A4 in the right orientation', () => {
  const p = S.pagePlacement(1000, 1414);
  assert.equal(p.pw, 595); assert.equal(p.ph, 842);
  assert.ok(p.x >= 24 - 1e-9 && p.y >= 24 - 1e-9);
  assert.equal(S.pagePlacement(1414, 1000).pw, 842);
});

test('the PDF is well formed: every xref offset points at its object', () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 0xff, 0xd9]);
  const pdf = S.buildPdf([{ jpeg, width: 10, height: 14 }, { jpeg, width: 14, height: 10 }], 'Tax (2026) \\ receipts');
  const text = Buffer.from(pdf).toString('latin1');
  assert.ok(text.startsWith('%PDF-1.4'));
  assert.ok(text.trimEnd().endsWith('%%EOF'));
  assert.match(text, /\/Type \/Pages \/Count 2/);
  const startxref = Number(text.match(/startxref\n(\d+)/)[1]);
  assert.equal(text.slice(startxref, startxref + 4), 'xref');
  const entries = text.slice(startxref).split('\n').slice(3).filter(l => / 00000 n $/.test(l));
  entries.forEach((line, i) => {
    const offset = Number(line.slice(0, 10));
    assert.equal(text.slice(offset, offset + `${i + 1} 0 obj`.length), `${i + 1} 0 obj`);
  });
  assert.equal(entries.length, 3 + 2 * 3);
  assert.match(text, /\/Title \(Tax 2026  receipts\)/, 'title parentheses and backslashes are stripped');
  assert.ok(text.includes(Buffer.from(jpeg).toString('latin1')), 'JPEG bytes embedded unchanged');
});

test('document mode keeps a large solid dark area solid, not hollow', () => {
  const w = 200, h = 200, data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = x > 60 && x < 140 && y > 60 && y < 140 ? 10 : 240;
    const o = (y * w + x) * 4; data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255;
  }
  const out = S.documentMode({ width: w, height: h, data });
  assert.equal(out.data[(100 * w + 100) * 4], 0, 'the middle of the block is black');
  assert.equal(out.data[(20 * w + 20) * 4], 255);
});
