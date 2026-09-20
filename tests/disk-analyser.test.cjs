const { test } = require('node:test');
const assert = require('node:assert/strict');
const D = require('../tools/disk-analyser/static/core.js');

const file = (path, size, mtime) => ({ path, size, mtime: mtime || 0 });
const DAY = 86400000;

test('sizes read in binary units, and rubbish reads as zero rather than NaN', () => {
  assert.equal(D.formatBytes(0), '0 B');
  assert.equal(D.formatBytes(1023), '1023 B');
  assert.equal(D.formatBytes(1024), '1.0 KB');
  assert.equal(D.formatBytes(1536), '1.5 KB');
  assert.equal(D.formatBytes(10 * 1024), '10 KB', 'ten or more drops the decimal');
  assert.equal(D.formatBytes(1024 ** 2), '1.0 MB');
  assert.equal(D.formatBytes(1024 ** 3), '1.0 GB');
  assert.equal(D.formatBytes(1024 ** 4), '1.0 TB');
  assert.equal(D.formatBytes(1024 ** 5), '1.0 PB');
  assert.equal(D.formatBytes(-5), '0 B');
  assert.equal(D.formatBytes(NaN), '0 B');
  assert.equal(D.formatBytes(undefined), '0 B');
});

test('extensions ignore dotfiles, bare dots and anything that is not an extension', () => {
  assert.equal(D.extensionOf('holiday.JPG'), 'jpg');
  assert.equal(D.extensionOf('a/b/report.final.pdf'), 'pdf');
  assert.equal(D.extensionOf('.bashrc'), '', 'a dotfile is not an extension');
  assert.equal(D.extensionOf('Makefile'), '');
  assert.equal(D.extensionOf('archive.'), '', 'a trailing dot is not an extension');
  assert.equal(D.extensionOf('file.verylongextension'), '', 'nothing plausible is that long');
  assert.equal(D.extensionOf('odd.na me'), '', 'a space is not an extension');
  assert.equal(D.extensionOf(''), '');
});

test('categories group the extensions people actually go looking for', () => {
  assert.equal(D.categoryOf('trip.heic'), 'Photos');
  assert.equal(D.categoryOf('clip.MOV'), 'Video');
  assert.equal(D.categoryOf('song.flac'), 'Audio');
  assert.equal(D.categoryOf('tax.pdf'), 'Documents');
  assert.equal(D.categoryOf('backup.zip'), 'Archives');
  assert.equal(D.categoryOf('app.js'), 'Code');
  assert.equal(D.categoryOf('setup.exe'), 'Apps and installers');
  assert.equal(D.categoryOf('win10.iso'), 'Archives');
  assert.equal(D.categoryOf('box.vmdk'), 'Disk images and backups');
  assert.equal(D.categoryOf('mystery.qqq'), 'Other');
  assert.equal(D.categoryOf('Makefile'), 'Other');
});

test('entries are cleaned before anything trusts them', () => {
  const { files, skipped } = D.cleanEntries([
    file('a/b.txt', 10),
    { path: 'windows\\style\\path.txt', size: 5 },
    { path: '/leading/slash.txt', size: 5 },
    { path: 'bad/size.txt', size: -1 },
    { path: 'missing/size.txt' },
    { path: '', size: 10 },
    null,
    { path: 'nan.txt', size: 'lots' },
    { path: 'ok.txt', size: 1, mtime: -5 },
  ]);
  assert.equal(files.length, 4);
  assert.equal(skipped, 5);
  assert.equal(files[1].path, 'windows/style/path.txt', 'backslashes are normalised');
  assert.equal(files[2].path, 'leading/slash.txt', 'a leading slash is stripped');
  assert.equal(files[3].mtime, 0, 'a negative timestamp becomes no timestamp');
});

test('the tree adds every file to every one of its ancestors exactly once', () => {
  const files = [
    file('Photos/2024/a.jpg', 100),
    file('Photos/2024/b.jpg', 200),
    file('Photos/2025/c.jpg', 50),
    file('Documents/tax.pdf', 400),
    file('loose.txt', 7),
  ];
  const root = D.buildTree(files);
  assert.equal(root.size, 757, 'the root is the sum of everything');
  assert.equal(D.nodeAt(root, 'Photos').size, 350);
  assert.equal(D.nodeAt(root, 'Photos/2024').size, 300);
  assert.equal(D.nodeAt(root, 'Photos/2024').files, 2);
  assert.equal(D.nodeAt(root, 'Documents').size, 400);
  assert.equal(D.nodeAt(root, 'Photos/2026'), null, 'a folder that does not exist is null');

  const top = D.childrenOf(root).map(c => [c.name, c.size]);
  assert.deepEqual(top, [['Documents', 400], ['Photos', 350], ['loose.txt', 7]],
    'folders and loose files sit together, biggest first');
  assert.equal(D.childrenOf(root)[2].isDir, false, 'a loose file is not a folder');
});

test('a deep path does not lose bytes on the way down', () => {
  const root = D.buildTree([file('a/b/c/d/e/f/deep.bin', 1234)]);
  assert.equal(root.size, 1234);
  assert.equal(D.nodeAt(root, 'a/b/c/d/e').size, 1234);
  assert.equal(D.nodeAt(root, 'a/b/c/d/e/f').files, 1);
});

// ---------- treemap geometry ----------
const RECT = { x: 0, y: 0, w: 600, h: 400 };
const area = r => r.w * r.h;
function overlaps(a, b) {
  return a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 &&
         a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
}

test('the treemap fills its rectangle exactly, in proportion, without overlapping', () => {
  const items = [
    { name: 'a', size: 500 }, { name: 'b', size: 250 }, { name: 'c', size: 125 },
    { name: 'd', size: 75 }, { name: 'e', size: 40 }, { name: 'f', size: 10 },
  ];
  const out = D.squarify(items, RECT);
  assert.equal(out.length, 6);

  const covered = out.reduce((a, r) => a + area(r), 0);
  assert.ok(Math.abs(covered - area(RECT)) < 1e-6, 'every pixel of the rectangle is used');

  const total = items.reduce((a, i) => a + i.size, 0);
  for (const r of out) {
    const expected = (r.item.size / total) * area(RECT);
    assert.ok(Math.abs(area(r) - expected) < 1e-6, `${r.item.name} is drawn at its share of the space`);
    assert.ok(r.x >= -1e-6 && r.y >= -1e-6, 'nothing starts outside the rectangle');
    assert.ok(r.x + r.w <= RECT.w + 1e-6 && r.y + r.h <= RECT.h + 1e-6, 'nothing runs past the edge');
    assert.ok(r.w > 0 && r.h > 0);
  }
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      assert.ok(!overlaps(out[i], out[j]), `${out[i].item.name} and ${out[j].item.name} must not overlap`);
    }
  }
});

test('squarifying keeps rectangles roughly square, which is the whole point', () => {
  const items = Array.from({ length: 24 }, (_, i) => ({ name: 'f' + i, size: 1000 - i * 30 }));
  const out = D.squarify(items, RECT);
  const ratios = out.map(r => Math.max(r.w / r.h, r.h / r.w));
  const worst = Math.max(...ratios);
  // A naive slice and dice layout on this input gives ratios in the dozens.
  assert.ok(worst < 8, `worst aspect ratio ${worst.toFixed(2)} should stay readable`);
  const median = ratios.slice().sort((a, b) => a - b)[Math.floor(ratios.length / 2)];
  assert.ok(median < 3, `median aspect ratio ${median.toFixed(2)} should be close to square`);
});

test('the treemap survives the degenerate cases rather than dividing by zero', () => {
  assert.deepEqual(D.squarify([], RECT), []);
  assert.deepEqual(D.squarify([{ name: 'z', size: 0 }], RECT), [], 'empty files have no area');
  assert.deepEqual(D.squarify([{ name: 'a', size: 10 }], { x: 0, y: 0, w: 0, h: 400 }), []);
  assert.deepEqual(D.squarify(null, RECT), []);

  const one = D.squarify([{ name: 'only', size: 42 }], RECT);
  assert.equal(one.length, 1);
  assert.ok(Math.abs(area(one[0]) - area(RECT)) < 1e-6, 'a single item takes the whole rectangle');

  const mixed = D.squarify([{ name: 'a', size: 10 }, { name: 'b', size: 0 }], RECT);
  assert.equal(mixed.length, 1, 'zero sized items are dropped, not drawn as slivers');
});

test('a very lopsided split still covers the rectangle', () => {
  const out = D.squarify([{ name: 'huge', size: 1e9 }, { name: 'tiny', size: 1 }], RECT);
  const covered = out.reduce((a, r) => a + area(r), 0);
  assert.equal(out.length, 2);
  assert.ok(Math.abs(covered - area(RECT)) < 1e-6);
});

// ---------- reports ----------
test('the reports rank by what would actually free space', () => {
  const files = [
    file('a.mov', 900), file('b.jpg', 300), file('c.jpg', 300), file('d.txt', 5),
  ];
  assert.deepEqual(D.largestFiles(files, 2).map(f => f.path), ['a.mov', 'b.jpg']);

  const cats = D.byCategory(files);
  assert.deepEqual(cats.map(c => [c.name, c.size, c.count]),
    [['Video', 900, 1], ['Photos', 600, 2], ['Documents', 5, 1]]);

  const exts = D.byExtension(files);
  assert.deepEqual(exts.map(e => [e.name, e.size]), [['mov', 900], ['jpg', 600], ['txt', 5]]);
});

test('stale files need a real timestamp, and are never guessed at', () => {
  const now = Date.UTC(2026, 8, 20);
  const files = [
    file('old-big.iso', 5000, now - 400 * DAY),
    file('old-small.txt', 10, now - 400 * DAY),
    file('recent.mov', 9000, now - 10 * DAY),
    file('no-date.bin', 9999, 0),
  ];
  const stale = D.staleFiles(files, now - 365 * DAY, 100);
  assert.deepEqual(stale.map(f => f.path), ['old-big.iso'],
    'too small and too recent are both out, and a file with no timestamp is left alone');
});

test('duplicate hunting only considers files that could possibly match', () => {
  const files = [
    file('a/one.jpg', 1000), file('b/one-copy.jpg', 1000), file('c/one-again.jpg', 1000),
    file('a/two.mov', 5000), file('b/two-copy.mov', 5000),
    file('unique.pdf', 77),
    file('empty-a.txt', 0), file('empty-b.txt', 0),
  ];
  const groups = D.sizeGroups(files, 1);
  assert.equal(groups.length, 2, 'only the two size collisions are candidates');
  assert.equal(groups[0][0].size, 5000, 'the group that could free the most comes first');
  assert.ok(!groups.some(g => g[0].size === 0), 'empty files are never duplicate candidates');
  assert.equal(D.sizeGroups(files, 2000).length, 1, 'a minimum size filters the small groups out');

  const work = D.hashWorkload(groups);
  assert.deepEqual(work, { files: 5, bytes: 13000 });
});

test('duplicate sets count only the copies you could delete', () => {
  const trio = [file('a/one.jpg', 1000), file('b/one.jpg', 1000), file('c/one.jpg', 1000)];
  const pair = [file('a/two.mov', 5000), file('b/two.mov', 5000)];
  const sets = D.duplicateSets({ hashA: trio, hashB: pair, hashC: [file('lonely.txt', 9)] });

  assert.equal(sets.length, 2, 'a key with one file is not a duplicate set');
  assert.equal(sets[0].key, 'hashB');
  assert.equal(sets[0].wasted, 5000, 'two copies waste one of them');
  assert.equal(sets[1].wasted, 2000, 'three copies waste two of them');
  assert.equal(D.totalWasted(sets), 7000);
  assert.deepEqual(sets[1].files.map(f => f.path), ['a/one.jpg', 'b/one.jpg', 'c/one.jpg'],
    'copies are listed in a stable order so the keep choice does not jump around');
});

test('a Map of hashes works as well as a plain object', () => {
  const m = new Map([['h1', [file('x', 10), file('y', 10)]]]);
  const sets = D.duplicateSets(m);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].wasted, 10);
});

test('the summary reports what was scanned', () => {
  const now = Date.UTC(2026, 8, 20);
  const s = D.summarise([file('a', 100, now), file('b', 50, now - DAY), file('c', 1, 0)]);
  assert.equal(s.count, 3);
  assert.equal(s.size, 151);
  assert.equal(s.newest, now);
  assert.equal(s.oldest, now - DAY, 'a missing timestamp does not become the oldest file');
  assert.deepEqual(D.summarise([]), { count: 0, size: 0, newest: 0, oldest: 0 });
});
