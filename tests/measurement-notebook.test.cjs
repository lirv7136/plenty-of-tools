const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../tools/measurement-notebook/static/core.js');
const annotation=()=>({id:'a',type:'dimension',start:{x:.2,y:.3},end:{x:.8,y:.3},labelOffset:{x:0,y:-.04},valueText:'1200',unit:'mm',note:'Inside recess',style:{colour:'#165DCC',size:'normal'}});
test('dimensions accept positive decimals and imperial proper/mixed fractions without coercion',()=>{
  for(const [v,u] of [['1200','mm'],['0.25','m'],['3 1/2','in'],['1/8','ft']])assert.ok(C.measurement(v,u));
  for(const [v,u] of [['0','mm'],['-3','mm'],['3junk','mm'],['3/0','in'],['3/2','in'],['3 1/2','mm'],['3e5','mm'],['Infinity','m'],['3','px']])assert.equal(C.measurement(v,u),false,`${v} ${u}`);
});
test('document validation rejects invalid coordinates, duplicate IDs and unsupported schemas',()=>{
  const d={schemaVersion:1,title:'Window',width:4032,height:3024,annotations:[annotation()]};assert.ok(C.validDocument(d));
  assert.equal(C.validDocument({...d,schemaVersion:2}),false);assert.equal(C.validDocument({...d,annotations:[annotation(),annotation()]}),false);
  const bad=annotation();bad.end.x=NaN;assert.equal(C.validAnnotation(bad),false);bad.end={...bad.start};assert.equal(C.validAnnotation(bad),false);
  assert.equal(C.validDocument({...d,width:100000}),false);
});
test('screen/image transforms round-trip across portrait, mobile, zoom and panning',()=>{
  for(const [vw,vh] of [[900,490],[358,340],[340,800]])for(const zoom of [1,2.7,8]){
    const v=C.view(4032,3024,vw,vh,{zoom,cx:.38,cy:.7});
    for(const p of [{x:.1,y:.7},{x:1,y:0},{x:.5,y:.5}]){const q=C.toImage(C.toView(p,v,4032,3024),v,4032,3024);assert.ok(Math.abs(q.x-p.x)<1e-10);assert.ok(Math.abs(q.y-p.y)<1e-10);}
  }
});
test('zoom stays anchored under the pointer, including when reaching the zoom limit',()=>{
  const p={x:170,y:230},camera={zoom:2,cx:.5,cy:.4};
  const before=C.toImage(p,C.view(1440,1080,800,500,camera),1440,1080);
  const next=C.zoomAt(camera,100,p,1440,1080,800,500);assert.equal(next.zoom,8);
  const after=C.toImage(p,C.view(1440,1080,800,500,next),1440,1080);assert.ok(Math.abs(after.x-before.x)<1e-10);assert.ok(Math.abs(after.y-before.y)<1e-10);
});
test('moving a dimension preserves its shape at image edges and leaves its input untouched',()=>{
  const a=annotation(),b=C.moveAnnotation(a,1,-1);assert.ok(Math.abs(b.end.x-1)<1e-10);assert.equal(b.start.y,0);assert.ok(Math.abs((b.end.x-b.start.x)-.6)<1e-10);assert.deepEqual(a,annotation());
});
test('history treats a drag as one commit, isolates snapshots and clears redo on a new edit',()=>{
  const h=new C.History(),a=annotation();h.commit([a]);a.valueText='999';assert.equal(h.current[0].valueText,'1200');
  h.commit([C.moveAnnotation(h.current[0],.1,0)]);h.undo();assert.equal(h.current[0].start.x,.2);h.redo();assert.ok(Math.abs(h.current[0].start.x-.3)<1e-10);
  h.undo();h.commit([{...h.current[0],valueText:'900'}]);assert.equal(h.redo(),false);
});
test('long Unicode labels wrap completely and stay inside the photo',()=>{
  const a=annotation();a.note='Étage ½ ° — こんにちは '+ 'LongUnbrokenWord'.repeat(10);a.labelOffset={x:1,y:-1};
  const p=C.plan(a,1440,1080,(text,size)=>Array.from(text).length*size*.6);
  assert.ok(p.box.x>=0&&p.box.y>=0&&p.box.x+p.box.w<=1440.00001&&p.box.y+p.box.h<=1080.00001);
  assert.equal(p.lines.join('').replace(/\s/g,''),('1200 mm'+a.note).replace(/\s/g,''));
});
test('draw plan source coordinates do not depend on viewport or selection',()=>{
  const p=C.plan(annotation(),4032,3024,(t,f)=>t.length*f*.5);assert.equal(p.start.x,806.4000000000001);assert.equal(p.end.x,3225.6000000000004);assert.equal(p.start.y,p.end.y);assert.equal(p.arrows.length,2);
});
