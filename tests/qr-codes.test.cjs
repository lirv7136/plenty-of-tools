const {test}=require('node:test');
const assert=require('node:assert/strict');
const qrLib=require('../tools/qr-codes/vendor/qrcode.js');
const jsQR=require('./vendor/jsQR.js');
const core=require('../tools/qr-codes/app.js');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function decode(qr) {
  const scale=6,n=qr.getModuleCount(),size=(n+8)*scale;
  const pixels=new Uint8ClampedArray(size*size*4).fill(255);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const row=Math.floor(y/scale)-4,col=Math.floor(x/scale)-4;
    if(row>=0&&col>=0&&row<n&&col<n&&qr.isDark(row,col)){const i=(y*size+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=0;}
  }
  return jsQR(pixels,size,size)?.data;
}
test('website links use a direct normalised destination',()=>{
  assert.equal(core.payload('url',{url:'example.com/a?x=1&y=2'}),'https://example.com/a?x=1&y=2');
  for(const url of ['','javascript:alert(1)','file:///tmp/a','https://user:pass@example.com','https://bad host'])assert.throws(()=>core.payload('url',{url}));
});
test('text preserves Unicode, spaces and line breaks; byte limit is enforced',()=>{
  const text='  Café ☕\nこんにちは 👋  ';assert.equal(core.payload('text',{text}),text);
  assert.throws(()=>core.payload('text',{text:' '}));
  assert.throws(()=>core.payload('text',{text:'😀'.repeat(501)}),/too long/);
});
test('Wi-Fi escapes syntax characters, preserves spaces and omits open-network passwords',()=>{
  assert.equal(core.payload('wifi',{ssid:'Cafe; East',security:'WPA',password:'a:b,c"d\\e',hidden:true}),'WIFI:T:WPA;S:Cafe\\; East;P:a\\:b\\,c\\"d\\\\e;H:true;;');
  assert.equal(core.payload('wifi',{ssid:'Guest',security:'nopass',password:'ignored'}),'WIFI:T:nopass;S:Guest;;');
  assert.throws(()=>core.payload('wifi',{ssid:'名'.repeat(11),password:'secret'}));
  assert.throws(()=>core.payload('wifi',{ssid:'Cafe',password:''}));
});
test('email query values cannot introduce extra mail headers',()=>{
  assert.equal(core.payload('email',{email:'hi+test@example.com',subject:'Hello &bcc=other@example.com',body:'Line 1\nLine 2'}),'mailto:hi%2Btest@example.com?subject=Hello%20%26bcc%3Dother%40example.com&body=Line%201%0ALine%202');
  assert.throws(()=>core.payload('email',{email:'hi@example.com?bcc=bad@example.com'}));
});
test('independent decoder round-trips all content types and correction levels',()=>{
  const values=[core.payload('url',{url:'https://example.com/?a=1&b=2'}),core.payload('text',{text:'Café ☕\nこんにちは 👋'}),core.payload('wifi',{ssid:'Cafe;Main',password:'space & colon:secret',security:'WPA',hidden:true}),core.payload('email',{email:'hello@example.com',subject:'Hi & welcome'})];
  for(const level of ['L','M','Q','H'])for(const value of values)assert.equal(decode(core.encode(value,level,qrLib)),value);
});
test('oversize content at high correction fails with a usable message',()=>{
  assert.throws(()=>core.encode('a'.repeat(2000),'H',qrLib),/does not fit/);
});
test('PNG uses integer pixels and preserves at least a four-module border',()=>{
  const qr=core.encode('https://example.com','M',qrLib);
  for(const size of [512,1024,2048]){const l=core.layout(qr,size);assert.ok(l.padding>=l.scale*4);assert.ok(size-l.padding-l.count*l.scale>=l.scale*4);assert.ok(Number.isInteger(l.scale));}
});
test('SVG contains only geometric data and rejects colour injection/low contrast',()=>{
  const qr=core.encode('<script>alert(1)</script>','M',qrLib),svg=core.svg(qr);
  assert.ok(svg.includes('viewBox='));assert.ok(!svg.includes('<script>'));assert.ok(!svg.includes('href='));
  assert.throws(()=>core.svg(qr,'" onload="bad'));
  assert.throws(()=>core.validateColour('#ffffff'),/darker/);
  assert.equal(core.validateColour('#0B7A5A'),'#0b7a5a');
});
test('bundled encoder and test decoder match recorded checksums',()=>{
  const root=path.join(__dirname,'..');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'tools/qr-codes/static/vendor-manifest.json')));
  for(const item of manifest){const bytes=fs.readFileSync(path.join(root,item.file));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256,item.file);}
});
