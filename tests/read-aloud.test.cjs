const {test}=require('node:test');
const assert=require('node:assert/strict');
const C=require('../tools/read-aloud/static/core.js'),{Player}=require('../tools/read-aloud/static/player.js');
test('sentence offsets preserve Unicode, paragraphs, quotes and final punctuation absence',()=>{
  const text='Hello world! “A second sentence.”\n\n日本語です。次です！\n\nLast part without punctuation',s=C.split(text);
  assert.ok(s.length>=5);for(const item of s)assert.equal(text.slice(item.start,item.end),item.text);
  assert.equal(s.at(-1).paragraph,2);assert.equal(C.indexAt(s,text.length),s.length);
  assert.equal(C.split('   ').length,0);assert.throws(()=>C.split('a'.repeat(C.MAX_TEXT+1)));
  assert.equal(C.split('a'.repeat(C.MAX_TEXT)).length,1);
  assert.equal(C.split('A. '.repeat(10000),null).length,10000);assert.throws(()=>C.split('A. '.repeat(10001),null),/10,000/);
});
test('fallback recognises common abbreviations, decimals and punctuation without dropping text',()=>{
  const s=C.split('Dr. Smith paid 3.50 today. Really? Yes!\n\n最後。次！',null);
  assert.equal(s[0].text,'Dr. Smith paid 3.50 today.');assert.equal(s[1].text,'Really?');assert.equal(s.at(-1).text,'次！');
});
test('chunks are bounded, lossless and do not split a surrogate pair',()=>{
  for(const text of ['word '.repeat(200),'👩'.repeat(250),'界'.repeat(500),'a'.repeat(500)]){
    const parts=C.chunks(text);assert.equal(parts.map(p=>p.text).join(''),text);assert.ok(parts.every(p=>p.text.length<=200));
    assert.ok(parts.every(p=>!/[\uD800-\uDBFF]$/.test(p.text)));
  }
});
test('skip handles both endpoints and paragraph starts',()=>{
  const s=C.split('One. Two.\n\nThree. Four.\n\nFive.');assert.equal(C.skip(s,0,-1),0);assert.equal(C.skip(s,s.length-1,1),s.length-1);assert.equal(C.skip(s,0,1,true),2);assert.equal(C.skip(s,3,-1,true),0);assert.equal(C.skip(s,4,-1,true),2);
});
test('position storage validates hostile JSON and bounds, keeps documents separate and evicts old entries',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)},store=new C.PositionStore(storage),id=n=>n.toString(16).padStart(64,'0');
  store.save(id(1),0,0);store.save(id(2),C.MAX_TEXT,1);assert.equal(store.read(id(1)),0);assert.equal(store.read(id(2)),C.MAX_TEXT);
  assert.throws(()=>store.save(id(2),C.MAX_TEXT+1));assert.throws(()=>store.save(id(2),-1));
  for(const raw of ['{','null','[]','{"__proto__":{"offset":1,"updated":0}}',JSON.stringify({[id(1)]:{offset:'5',updated:0}})]){data.set(C.KEY,raw);assert.equal(store.read(id(1)),0);}
  for(let i=1;i<=101;i++)store.save(id(i),i,i);assert.equal(Object.keys(C.positions(data.get(C.KEY))).length,100);assert.equal(store.read(id(1)),0);assert.equal(store.read(id(101)),101);store.clear();assert.equal(data.size,0);
});
test('5000 words run through one short utterance at a time and finish exactly once',async()=>{
  const text=Array.from({length:500},()=> 'One two three four five six seven eight nine ten.').join(' '),items=C.split(text);let spoken='',lastOffset=0,finished=0;
  const synth={cancel(){},pause(){},resume(){},speak(u){assert.ok(u.text.length<=200);spoken+=u.text+' ';queueMicrotask(()=>u.onend());}};
  await new Promise((resolve,reject)=>{const p=new Player(synth,class{constructor(text){this.text=text;}},(_,offset)=>lastOffset=offset,state=>{if(state==='finished'){finished++;resolve();}if(state==='error')reject(new Error('Stalled'));});p.set(items);p.play({rate:3,pitch:1});});
  assert.equal(spoken.trim(),text);assert.equal(lastOffset,text.length);assert.equal(finished,1);
});
test('late cancelled events and an end event while paused cannot skip or stall the reader',()=>{
  let active;const synth={cancel(){},pause(){},resume(){},speak(u){active=u;}},p=new Player(synth,class{constructor(text){this.text=text;}},()=>{},()=>{});
  p.set(C.split('One. Two. Three.'));p.play({rate:1,pitch:1});const stale=active;p.seek(1,true);stale.onend();assert.equal(p.index,1);
  p.pause();active.onend();assert.equal(p.index,2);assert.equal(p.state,'paused');p.play({rate:1,pitch:1});assert.equal(active.text,'Three.');active.onend();assert.equal(p.state,'finished');p.stop();
});
