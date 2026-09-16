(function (root) {
  'use strict';
  const LIMIT = 50000, EDIT_LIMIT = 500, LAT_LIMIT = 85.05112878;
  function point(lat, lon, ele) {
    lat = Number(lat); lon = Number(lon);
    if (!Number.isFinite(lat) || Math.abs(lat) > LAT_LIMIT || !Number.isFinite(lon) || Math.abs(lon) > 180) throw new Error('Coordinates must be within ±85.05112878° latitude and ±180° longitude.');
    const p = {lat, lon};
    if (ele !== undefined && ele !== null && ele !== '') {
      ele = Number(ele); if (!Number.isFinite(ele)) throw new Error('Elevation must be a finite number.'); p.ele = ele;
    }
    return p;
  }
  function distance(a, b) {
    const rad = Math.PI / 180, dlat = (b.lat-a.lat)*rad, dlon = (b.lon-a.lon)*rad;
    const h = Math.sin(dlat/2)**2 + Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
    return 6371008.8 * 2 * Math.atan2(Math.sqrt(Math.min(1,h)), Math.sqrt(Math.max(0,1-h)));
  }
  function length(segments) { return segments.reduce((total, s) => total + s.reduce((sum, p, i) => sum + (i ? distance(s[i-1],p) : 0),0),0); }
  const count = segments => segments.reduce((n,s) => n+s.length,0);
  function unwrap(segment, anchor = segment[0]?.lon || 0) {
    return segment.map(p => { const lon = p.lon + 360 * Math.round((anchor-p.lon)/360); anchor = lon; return [p.lat,lon]; });
  }
  function parse(xml, fallback = 'Imported track') {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('GPX files containing DTDs or entities are not supported.');
    const doc = new DOMParser().parseFromString(xml,'application/xml');
    const root = doc.documentElement;
    if (!root || root.localName !== 'gpx' || doc.getElementsByTagNameNS('*','parsererror').length) throw new Error('This is not a valid GPX XML file.');
    if (root.namespaceURI && !['http://www.topografix.com/GPX/1/1','http://www.topografix.com/GPX/1/0'].includes(root.namespaceURI)) throw new Error('Unsupported GPX namespace.');
    const children = (node, tag) => Array.from(node.children).filter(c => c.localName === tag && c.namespaceURI === root.namespaceURI);
    const segments = []; let total = 0;
    const read = (parent, tag) => {
      const segment = children(parent,tag).map(el => {
        if (++total > LIMIT) throw new Error('A GPX file can contain at most 50,000 track or route points.');
        if (!el.hasAttribute('lat') || !el.hasAttribute('lon') || !el.getAttribute('lat').trim() || !el.getAttribute('lon').trim()) throw new Error('A GPX point is missing its latitude or longitude.');
        return point(el.getAttribute('lat'),el.getAttribute('lon'),children(el,'ele')[0]?.textContent.trim());
      });
      if (segment.length) segments.push(segment);
    };
    for (const trk of children(root,'trk')) for (const seg of children(trk,'trkseg')) read(seg,'trkpt');
    for (const route of children(root,'rte')) read(route,'rtept');
    if (!total) throw new Error('No track or route points found. Waypoint-only files are not supported.');
    const name = children(children(root,'metadata')[0] || root,'name')[0]?.textContent || children(children(root,'trk')[0] || children(root,'rte')[0] || root,'name')[0]?.textContent || fallback;
    return {name:name.trim().slice(0,160) || fallback, segments};
  }
  const escapeXML = value => String(value).replace(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,'').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));
  // GPX uses XML Schema decimals, which cannot contain exponent notation.
  function decimal(value) {
    const text = String(value); if (!/e/i.test(text)) return text;
    const [mantissa, exponent] = text.toLowerCase().split('e'), sign = value < 0 ? '-' : '';
    const parts = mantissa.replace('-','').split('.'), digits = parts.join('');
    const position = parts[0].length + Number(exponent);
    return sign + (position <= 0 ? '0.' + '0'.repeat(-position) + digits : position >= digits.length ? digits + '0'.repeat(position-digits.length) : digits.slice(0,position) + '.' + digits.slice(position));
  }
  function exportGPX(name, segments) {
    if (count(segments) < 2) throw new Error('Add at least two points before downloading a route.');
    return '<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Plenty of Tools" xmlns="http://www.topografix.com/GPX/1/1">\n<trk><name>' + escapeXML(name || 'My route') + '</name>\n' + segments.filter(s=>s.length).map(s => '<trkseg>\n' + s.map(raw => { const p = point(raw.lat,raw.lon,raw.ele); return `<trkpt lat="${decimal(p.lat)}" lon="${decimal(p.lon)}">${p.ele === undefined ? '' : `<ele>${decimal(p.ele)}</ele>`}</trkpt>`; }).join('\n') + '\n</trkseg>').join('\n') + '\n</trk></gpx>\n';
  }
  const api = {LIMIT,EDIT_LIMIT,LAT_LIMIT,point,distance,length,count,unwrap,parse,exportGPX};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GPXCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
