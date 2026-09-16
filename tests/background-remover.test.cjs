const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {validateSize,toTensor,toMask,outputName,imageFormat}=require('../tools/background-remover/static/core.js');
test('image size limits reject excessive memory use without silent downsizing',()=>{
  assert.doesNotThrow(()=>validateSize(4000,4000,20*1024*1024));
  for(const args of [[0,4,10],[4001,4000,10],[9000,10,10],[10,10,21*1024*1024]]) assert.throws(()=>validateSize(...args));
});
test('real file signatures accept JPEG, PNG, WebP and reject disguised SVG',()=>{
  assert.equal(imageFormat([255,216,255]),'jpeg');
  assert.equal(imageFormat([137,80,78,71,13,10,26,10]),'png');
  assert.equal(imageFormat(Buffer.from('RIFF0000WEBP')),'webp');
  assert.throws(()=>imageFormat(Buffer.from('<svg>bad</svg>')));
});
test('preprocessing uses RGB image maximum, ignores alpha and produces planar channels',()=>{
  const t=toTensor(new Uint8ClampedArray([128,64,32,255,0,128,64,255]));
  const expected=[(1-.485)/.229,(0-.485)/.229,(.5-.456)/.224,(1-.456)/.224,(.25-.406)/.225,(.5-.406)/.225];
  t.forEach((n,i)=>assert.ok(Math.abs(n-expected[i])<1e-5));
  assert.ok([...toTensor(new Uint8ClampedArray([0,0,0,255]))].every(Number.isFinite));
});
test('mask normalisation yields a transparent background and opaque subject',()=>{
  assert.deepEqual([...toMask(new Float32Array([2,3,4]))],[255,255,255,0,255,255,255,128,255,255,255,255]);
});
test('flat or non-finite predictions produce a recoverable error',()=>{
  for(const v of [[0,0],[1,NaN],[0,Infinity]]) assert.throws(()=>toMask(v));
});
test('download filenames are safe and always PNG',()=>{
  assert.equal(outputName('../../Holiday photo.JPG'),'Holiday-photo-cutout.png');
  assert.equal(outputName('😀.png'),'image-cutout.png');
});
test('pinned vendor assets match their recorded SHA-256 and upstream model checksum',()=>{
  const root=path.join(__dirname,'../tools/background-remover/static');
  for(const item of JSON.parse(fs.readFileSync(path.join(root,'vendor-manifest.json')))) {
    const data=fs.readFileSync(path.join(root,item.file));
    assert.equal(data.length,item.bytes,item.file);
    assert.equal(crypto.createHash('sha256').update(data).digest('hex'),item.sha256,item.file);
  }
  assert.equal(crypto.createHash('md5').update(fs.readFileSync(path.join(root,'u2netp.onnx'))).digest('hex'),'8e83ca70e441ab06c318d82300c84806');
});
