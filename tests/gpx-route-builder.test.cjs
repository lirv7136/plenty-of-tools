const {test} = require('node:test');
const assert = require('node:assert/strict');
const C = require('../tools/gpx-route-builder/static/core.js');
test('known equatorial distance and identical points',()=>{
  assert.ok(Math.abs(C.distance(C.point(0,0),C.point(0,1))-111195.08)<.01);
  assert.equal(C.distance(C.point(-33,151),C.point(-33,151)),0);
});
test('track gaps do not contribute to total distance',()=>{
  const segments = [[C.point(0,0),C.point(0,1)],[C.point(40,100),C.point(40,101)]];
  assert.ok(C.length(segments)>190000 && C.length(segments)<200000);
  assert.equal(C.length([[C.point(0,0)],[C.point(40,100)]]),0);
  assert.equal(C.count(segments),4);
});
test('antimeridian uses the short distance and adjacent displayed longitudes',()=>{
  const a=C.point(0,179.9),b=C.point(0,-179.9);
  assert.ok(C.distance(a,b)>22000 && C.distance(a,b)<23000);
  assert.deepEqual(C.unwrap([a,b]),[[0,179.9],[0,180.1]]);
});
test('invalid coordinates and nonfinite elevation are rejected',()=>{
  for(const args of [[90,0],[0,181],[NaN,0],[0,Infinity],[0,0,'n/a']]) assert.throws(()=>C.point(...args));
  assert.deepEqual(C.point('-33','151','12.5'),{lat:-33,lon:151,ele:12.5});
});
test('GPX export escapes names and preserves segments and elevations',()=>{
  const out=C.exportGPX('A & <B> "C"',[[C.point(1,2,0)],[C.point(3,4,-5.2)]]);
  assert.ok(out.includes('A &amp; &lt;B&gt; &quot;C&quot;'));
  assert.equal((out.match(/<trkseg>/g)||[]).length,2);
  assert.ok(out.includes('<ele>0</ele>') && out.includes('<ele>-5.2</ele>'));
  assert.ok(!out.includes('<time>'));
});
test('empty segments are omitted and insufficient points cannot export',()=>{
  assert.equal((C.exportGPX('Route',[[],[C.point(0,0),C.point(0,1)],[]]).match(/<trkseg>/g)||[]).length,1);
  assert.throws(()=>C.exportGPX('Route',[[C.point(0,0)]]));
});
test('export uses schema decimals and removes XML-invalid control characters',()=>{
  const xml=C.exportGPX('A\u0000\u0001B 🚲',[[C.point(1e-8,-1e-7,1e21),C.point(0,0)]]);
  assert.ok(xml.includes('lat="0.00000001" lon="-0.0000001"'));
  assert.ok(xml.includes('<ele>1000000000000000000000</ele>'));
  assert.ok(xml.includes('<name>AB 🚲</name>'));
});
