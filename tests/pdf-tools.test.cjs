const { test } = require('node:test');
const assert = require('node:assert/strict');
const P = require('../tools/pdf-tools/static/core.js');

const page = (id, fileIndex, pageIndex, rotation) =>
  ({ id, fileIndex, pageIndex, rotation: rotation || 0, originalRotation: 0 });
const doc = n => Array.from({ length: n }, (_, i) => page('p' + i, 0, i));

test('rotation is always one of the four right angles', () => {
  assert.equal(P.normaliseRotation(0), 0);
  assert.equal(P.normaliseRotation(90), 90);
  assert.equal(P.normaliseRotation(360), 0);
  assert.equal(P.normaliseRotation(450), 90);
  assert.equal(P.normaliseRotation(-90), 270, 'a negative angle comes back positive');
  assert.equal(P.normaliseRotation(-450), 270);
  assert.equal(P.normaliseRotation('180'), 180);
  assert.equal(P.normaliseRotation(null), 0);
  assert.equal(P.normaliseRotation('sideways'), 0);

  assert.equal(P.rotateBy(0, 90), 90);
  assert.equal(P.rotateBy(270, 90), 0, 'turning past the top comes back to zero');
  assert.equal(P.rotateBy(0, -90), 270);
  assert.equal(P.rotateBy(90, 180), 270);
  // Four quarter turns is where you started, which is worth pinning down.
  let r = 0;
  for (let i = 0; i < 4; i++) r = P.rotateBy(r, 90);
  assert.equal(r, 0);
});

test('a page range is read the way a person writes one', () => {
  assert.deepEqual(P.parsePageRange('1-3, 5, 8-10', 12).pages, [0, 1, 2, 4, 7, 8, 9]);
  assert.deepEqual(P.parsePageRange('4', 10).pages, [3]);
  assert.deepEqual(P.parsePageRange('1 to 3', 10).pages, [0, 1, 2]);
  assert.deepEqual(P.parsePageRange('2–4', 10).pages, [1, 2, 3], 'an en dash is a range too');
  assert.deepEqual(P.parsePageRange('all', 3).pages, [0, 1, 2]);
  assert.deepEqual(P.parsePageRange('5-3', 10).pages, [2, 3, 4], 'a backwards range is read the obvious way');
  assert.deepEqual(P.parsePageRange('1-3, 2-4', 10).pages, [0, 1, 2, 3], 'an overlap is not counted twice');
  assert.deepEqual(P.parsePageRange('', 10), { pages: [], bad: [] });
  assert.deepEqual(P.parsePageRange(null, 10), { pages: [], bad: [] });
});

test('a range that cannot apply is reported rather than guessed at', () => {
  const past = P.parsePageRange('1-3, 20', 10);
  assert.deepEqual(past.pages, [0, 1, 2], 'the readable part still works');
  assert.deepEqual(past.bad, ['20'], 'and the impossible part is named');

  assert.deepEqual(P.parsePageRange('0', 10).bad, ['0'], 'there is no page zero');
  assert.deepEqual(P.parsePageRange('last three', 10).bad, ['last three']);
  assert.deepEqual(P.parsePageRange('1-3', 0).bad, ['1-3'], 'nothing applies to an empty document');
  assert.deepEqual(P.parsePageRange('-5', 10).bad, ['-5']);
});

test('a selection reads back as the range you would have typed', () => {
  assert.equal(P.formatPageRange([0, 1, 2, 4, 7, 8]), '1-3, 5, 8-9');
  assert.equal(P.formatPageRange([0]), '1');
  assert.equal(P.formatPageRange([4, 0, 2, 1]), '1-3, 5', 'out of order input still reads in order');
  assert.equal(P.formatPageRange([2, 2, 2]), '3', 'duplicates collapse');
  assert.equal(P.formatPageRange([]), '');
  assert.equal(P.formatPageRange(null), '');
});

test('a range survives a round trip through its own text', () => {
  for (const pages of [[0], [0, 1, 2], [0, 2, 4, 6], [3, 4, 5, 9], [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]]) {
    const text = P.formatPageRange(pages);
    assert.deepEqual(P.parsePageRange(text, 10).pages, pages, `round trip of "${text}"`);
  }
});

test('moving a page keeps every page exactly once', () => {
  const list = ['a', 'b', 'c', 'd'];
  assert.deepEqual(P.moveItem(list, 0, 2), ['b', 'c', 'a', 'd']);
  assert.deepEqual(P.moveItem(list, 3, 0), ['d', 'a', 'b', 'c']);
  assert.deepEqual(P.moveItem(list, 1, 1), list, 'moving nowhere changes nothing');
  assert.deepEqual(P.moveItem(list, -5, 99), ['b', 'c', 'd', 'a'], 'out of range positions are clamped');
  assert.deepEqual(P.moveItem([], 0, 1), []);
  assert.deepEqual(P.moveItem(list, 0, 2).slice().sort(), list.slice().sort(), 'nothing is lost or duplicated');
  assert.deepEqual(list, ['a', 'b', 'c', 'd'], 'the original is not modified');
});

test('reversing is its own opposite', () => {
  const list = ['a', 'b', 'c'];
  assert.deepEqual(P.reverse(list), ['c', 'b', 'a']);
  assert.deepEqual(P.reverse(P.reverse(list)), list);
  assert.deepEqual(list, ['a', 'b', 'c'], 'the original is not modified');
});

test('selecting, unselecting and inverting a selection', () => {
  let sel = [];
  sel = P.toggle(sel, 'p1');
  assert.deepEqual(sel, ['p1']);
  sel = P.toggle(sel, 'p2');
  assert.deepEqual(sel.sort(), ['p1', 'p2']);
  sel = P.toggle(sel, 'p1');
  assert.deepEqual(sel, ['p2'], 'toggling again removes it');

  const pages = doc(4);
  assert.deepEqual(P.selectedPages(pages, ['p1', 'p3']).map(p => p.id), ['p1', 'p3']);
  assert.deepEqual(P.withoutSelection(pages, ['p1', 'p3']).map(p => p.id), ['p0', 'p2'],
    'deleting pages is keeping the rest');
  assert.deepEqual(P.selectedPages(pages, []), []);
  assert.deepEqual(P.withoutSelection(pages, []).length, 4);
});

test('odd and even are counted the way a person counts pages', () => {
  const pages = doc(5);
  assert.deepEqual(P.everyOther(pages, 'odd'), ['p0', 'p2', 'p4'], 'pages one, three and five');
  assert.deepEqual(P.everyOther(pages, 'even'), ['p1', 'p3'], 'pages two and four');
  assert.deepEqual(P.everyOther([], 'odd'), []);
});

test('the output is named after where it came from', () => {
  const files = [{ name: 'Lease agreement.pdf' }, { name: 'Addendum.pdf' }];
  const all = doc(5);
  assert.equal(P.outputName(files, all, all), 'Lease agreement-edited.pdf',
    'keeping every page is an edit of the original');
  assert.equal(P.outputName(files, [all[0], all[1]], all), 'Lease agreement-pages-1-2.pdf');
  assert.equal(P.outputName(files, [page('x', 0, 0), page('y', 1, 0)], all), 'merged.pdf',
    'pages from two documents make a merge');
  assert.equal(P.baseName('a/b:c*.pdf'), 'a-b-c', 'path characters never reach a file name');
  assert.equal(P.baseName(''), 'document');
  assert.equal(P.baseName('UPPER.PDF'), 'UPPER');
  assert.equal(P.baseName('///.pdf'), 'document', 'a name that is only separators falls back');
  assert.equal(P.baseName('a//b.pdf'), 'a-b', 'a run of separators is one dash');
});

test('the summary counts what is about to happen', () => {
  const pages = doc(4);
  pages[1].rotation = 90;
  const s = P.summarise([{ name: 'a.pdf' }], pages, ['p0', 'p1']);
  assert.deepEqual(s, { files: 1, pages: 4, selected: 2, rotated: 1 });
  assert.deepEqual(P.summarise([], [], []), { files: 0, pages: 0, selected: 0, rotated: 0 });
});
