const {test}=require('node:test');
const assert=require('node:assert/strict');
global.crypto=require('node:crypto').webcrypto;
const P=require('../tools/measurement-notebook/static/projects.js');
const document={schemaVersion:1,title:'<img src=x onerror=alert(1)>',width:1,height:1,annotations:[]};
const project={id:'fixture',name:'窓 " <b>Room</b>',created:10,updated:20,revision:1,document};
const image=new Blob([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK0kAAAAASUVORK5CYII=','base64')],{type:'image/png'});
async function modify(blob,fn){const bytes=new Uint8Array(await blob.arrayBuffer()),n=new DataView(bytes.buffer).getUint32(8),h=JSON.parse(new TextDecoder().decode(bytes.slice(12,12+n)));fn(h);const text=new TextEncoder().encode(JSON.stringify(h));new DataView(bytes.buffer).setUint32(8,text.length);return new Blob([bytes.slice(0,12),text,bytes.slice(12+n)]);}
test('backup round trip preserves document, literal untrusted strings and binary originals',async()=>{
  const backup=await P.pack(project,image,image),r=await P.unpack(backup);
  assert.deepEqual(r.project,project);assert.equal(await P.digest(r.image),await P.digest(image));assert.equal(await P.digest(r.original),await P.digest(image));
});
test('refuses invalid versions, truncated data, appended bytes and corrupt checksums',async()=>{
  const good=await P.pack(project,image),bytes=new Uint8Array(await good.arrayBuffer());
  for(const bad of [new Blob(['MNOTE003',bytes.slice(8)]),good.slice(0,11),good.slice(0,-1),new Blob([good,'x'])])await assert.rejects(P.unpack(bad));
  bytes[bytes.length-2]^=1;await assert.rejects(P.unpack(new Blob([bytes])),/checksum/);
  await assert.rejects(P.unpack(await modify(good,h=>h.project.name='An otherwise valid but altered name')),/checksum/);
});
test('rejects oversized input before reading, and hostile metadata before returning it',async()=>{
  await assert.rejects(P.unpack(new Blob([new Uint8Array(P.LIMITS.file+1)])),/128 MiB/);
  const good=await P.pack(project,image);
  for(const change of [h=>h.project.document.width=2,h=>h.project.document.schemaVersion=99,h=>h.project.name='x'.repeat(101),h=>h.project.id='../etc',h=>h.project.document.annotations=[{}],h=>h.project.created=-1,h=>h.project.updated=Number.MAX_SAFE_INTEGER,h=>h.image.size=-1,h=>Object.defineProperty(h.project,'__proto__',{value:{polluted:true},enumerable:true})])await assert.rejects(P.unpack(await modify(good,change)));
  assert.equal({}.polluted,undefined);
});
test('document validation checks both dimension limits and annotation count',()=>{
  assert.ok(P.document(document));assert.ok(P.document({...document,width:16000,height:1500}));assert.ok(!P.document({...document,width:16001}));assert.ok(!P.document({...document,width:16000,height:1501}));
  const a={id:'a',type:'note',text:'x',position:{x:0,y:1},style:{colour:'#165DCC',size:'small'}};
  assert.ok(P.document({...document,annotations:Array.from({length:1000},(_,i)=>({...a,id:'n'+i}))}));
  assert.ok(!P.document({...document,annotations:Array.from({length:1001},(_,i)=>({...a,id:'n'+i}))}));
  assert.ok(!P.document({...document,annotations:[{...a,position:{x:0,y:1,url:'javascript:x'}}]}));
});
