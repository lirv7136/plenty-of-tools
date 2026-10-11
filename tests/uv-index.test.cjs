const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const U = require('../tools/uv-index/static/core.js');

const FEED = fs.readFileSync(path.join(__dirname, 'fixtures', 'arpansa-uvvalues.xml'), 'utf8');

test('the real feed parses into 16 stations, with friendly names', () => {
  const s = U.parseFeed(FEED);
  assert.equal(s.length, 16);
  const sydney = s.find(x => x.id === 'Sydney');
  assert.ok(sydney && sydney.ok);
  assert.equal(sydney.at, Date.UTC(2026, 9, 7, 11, 31));
  assert.equal(s.find(x => x.id === 'Kingston').name, 'Hobart (Kingston)');
  assert.equal(s.filter(x => x.antarctic).length, 3);
});

test('malformed or impossible readings are skipped, not guessed', () => {
  const bad = FEED.replace(/<index>0\.0<\/index>/, '<index>lots</index>').replace(/<utcdatetime>[^<]*<\/utcdatetime>/, '<utcdatetime>soon</utcdatetime>');
  assert.equal(U.parseFeed(bad).length, 15);
  assert.deepEqual(U.parseFeed(''), []);
  assert.deepEqual(U.parseFeed('<stations><location id="X"><index>99</index><utcdatetime>2026/10/07 11:31</utcdatetime></location></stations>'), []);
});

test('WHO categories, rounding the way the index is reported', () => {
  const label = i => U.category(i).label;
  assert.equal(label(0), 'Low');
  assert.equal(label(2.4), 'Low');
  assert.equal(label(2.5), 'Moderate');
  assert.equal(label(5), 'Moderate');
  assert.equal(label(6), 'High');
  assert.equal(label(8), 'Very high');
  assert.equal(label(10.4), 'Very high');
  assert.equal(label(11), 'Extreme');
  assert.equal(label(16), 'Extreme');
});

test('advice switches to sun protection at 3, as the Cancer Council says', () => {
  assert.match(U.advice(2.4), /isn.t needed/);
  assert.match(U.advice(2.6), /Sun protection needed/);
  assert.match(U.advice(9), /essential/);
  assert.match(U.advice(12), /Avoid the sun/);
  for (const i of [0, 4, 9, 12]) assert.doesNotMatch(U.advice(i), /^(Low|Moderate|High|Very high|Extreme)\b/, 'the category is shown separately');
});

test('readings older than 30 minutes, or not ok, are stale', () => {
  const s = U.parseFeed(FEED).find(x => x.id === 'Perth');
  assert.equal(U.isStale(s, s.at + 10 * 60000), false);
  assert.equal(U.isStale(s, s.at + 31 * 60000), true);
  assert.equal(U.isStale({ ...s, ok: false }, s.at), true);
  assert.equal(U.minutesAgo(s, s.at + 7 * 60000), 7);
});
