/* UV Index core: parse ARPANSA's live UV feed, categorise readings, sun protection advice,
   staleness. Pure, no DOM. UMD so node tests can require() it; the page uses UvCore.
   Data: ARPANSA, Creative Commons Attribution 2.5 Australia. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const FEED_URL = 'https://uvdata.arpansa.gov.au/xml/uvvalues.xml';

  // Friendlier names where the station id isn't what people call the place.
  const NAMES = { Kingston: 'Hobart (Kingston)', Casey: 'Casey (Antarctica)', Davis: 'Davis (Antarctica)', Mawson: 'Mawson (Antarctica)' };
  const ANTARCTIC = new Set(['Casey', 'Davis', 'Mawson']);

  // WHO UV index categories, as ARPANSA and the Cancer Council use them.
  const CATEGORIES = [
    { max: 2, key: 'low', label: 'Low' },
    { max: 5, key: 'moderate', label: 'Moderate' },
    { max: 7, key: 'high', label: 'High' },
    { max: 10, key: 'very-high', label: 'Very high' },
    { max: Infinity, key: 'extreme', label: 'Extreme' },
  ];

  const tag = (block, name) => {
    const m = block.match(new RegExp('<' + name + '>([^<]*)</' + name + '>'));
    return m ? m[1].trim() : '';
  };

  /** "2026/10/07 11:31" (UTC) -> epoch ms, or null. */
  function parseUtc(s) {
    const m = String(s || '').match(/^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/);
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
  }

  /** The feed as a list of stations. Malformed entries are skipped, never guessed. */
  function parseFeed(xml) {
    const out = [];
    const re = /<location id="([^"]+)">([\s\S]*?)<\/location>/g;
    let m;
    while ((m = re.exec(String(xml || '')))) {
      const id = m[1];
      const index = Number(tag(m[2], 'index'));
      const at = parseUtc(tag(m[2], 'utcdatetime'));
      if (!Number.isFinite(index) || index < 0 || index > 30 || at === null) continue;
      out.push({
        id,
        name: NAMES[id] || id,
        antarctic: ANTARCTIC.has(id),
        index: Math.round(index * 10) / 10,
        localTime: tag(m[2], 'time'),
        at,
        ok: tag(m[2], 'status').toLowerCase() === 'ok',
      });
    }
    return out;
  }

  function category(index) {
    const rounded = Math.round(index);
    return CATEGORIES.find(c => rounded <= c.max);
  }

  /**
   * Plain advice. Sun protection is recommended when the UV index is 3 or above
   * (Cancer Council Australia, ARPANSA).
   */
  function advice(index) {
    const rounded = Math.round(index);
    if (rounded >= 11) return 'Avoid the sun if you can. Slip, slop, slap, seek and slide, and reapply sunscreen every two hours.';
    if (rounded >= 8) return 'Sun protection is essential: shade, a hat, sunscreen, sunglasses and covering clothing.';
    if (rounded >= 3) return 'Sun protection needed: hat, SPF 50+ sunscreen, sunglasses and shade, especially around midday.';
    return 'Sun protection isn’t needed for most people right now.';
  }

  /** A reading older than this is shown as out of date. */
  const STALE_MS = 30 * 60 * 1000;
  const isStale = (station, now) => !station.ok || now - station.at > STALE_MS;

  function minutesAgo(station, now) {
    return Math.max(0, Math.round((now - station.at) / 60000));
  }

  const api = { VERSION, FEED_URL, CATEGORIES, parseFeed, parseUtc, category, advice, isStale, minutesAgo, STALE_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.UvCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
