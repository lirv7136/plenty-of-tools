// Dependency-free Chrome regression test; serves dist on an ephemeral loopback port.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'measurement-browser-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${directory}/profile`], {stdio:['ignore','ignore','pipe','pipe','pipe']});
let buffer = '', sequence = 0, session, stderr = '';
const pending = new Map(), errors = [], requests = [];
chrome.stderr.on('data', chunk => { stderr += chunk; });
chrome.stdio[4].on('data', chunk => {
  buffer += chunk.toString(); let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
    if (message.id && pending.has(message.id)) {
      const {resolve, reject, timer} = pending.get(message.id); clearTimeout(timer); pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
  }
});
function send(method, params = {}, target = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out. ${stderr.slice(-1500)}`)); }, 15000);
    pending.set(id, {resolve, reject, timer});
    chrome.stdio[3].write(JSON.stringify({id, method, params, ...(target ? {sessionId:target} : {})}) + '\0');
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', {expression, returnByValue:true, awaitPromise:true});
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails)); return r.result.value;
}
async function until(expression) {
  for (let i = 0; i < 400; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r,50)); }
  throw new Error('Condition timed out: ' + expression);
}
const click = id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
const input=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const http=require('node:http');
const root=path.resolve(__dirname,'../dist');
const server=http.createServer((req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,body)=>{if(error){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.txt':'text/plain'})[path.extname(file)]||'application/octet-stream');res.end(body);});
});
const getDoc=()=>evaluate('window.__measurement.document');
const apply=()=>evaluate("document.getElementById('mn-inspector').requestSubmit()");
async function mouse(x,y,type='mousePressed'){await send('Input.dispatchMouseEvent',{type,x,y,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});}
async function tap(x,y){await mouse(x,y);await mouse(x,y,'mouseReleased');}
async function point(x,y){return evaluate(`(()=>{const d=__measurement.document,b=document.getElementById('mn-stage').getBoundingClientRect(),v=MeasurementCore.view(d.width,d.height,b.width,b.height,__measurement.camera),p=MeasurementCore.toView({x:${x},y:${y}},v,d.width,d.height);return {x:p.x+b.left,y:p.y+b.top};})()`);}
async function scrollStage(){await evaluate("document.getElementById('mn-stage').scrollIntoView({block:'center'})");}
async function fileInput(file){const {root}=await send('DOM.getDocument'),{nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#mn-file'});await send('DOM.setFileInputFiles',{nodeId,files:[file]});}
async function fileReady(file){for(let i=0;i<200;i++){if(fs.existsSync(file)&&!fs.existsSync(file+'.crdownload'))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Download missing: '+file);}
async function screenshot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(directory,name),Buffer.from(r.data,'base64'));}
(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:base+'/tools/measurement-notebook/'});
  await until("document.readyState==='complete' && !!window.__measurement && !__measurement.busy && !!window.PDFLib");
  assert.equal(await evaluate("document.querySelector('meta[name=robots]').content"),'noindex,nofollow');
  assert.equal(await evaluate("document.getElementById('mn-workspace').hidden"),true);
  await click('mn-example');await until('__measurement.document!==null && !__measurement.busy');
  await scrollStage();let p=await point(.27,.16),q=await point(.74,.16);await tap(p.x,p.y);await tap(q.x,q.y);
  assert.ok(await evaluate('__measurement.draft!==null'));
  await input('mn-value','1200');await input('mn-text','Inside recess');await apply();assert.equal((await getDoc()).annotations.length,1);
  for(let i=1;i<10;i++){
    await click('mn-add-centre');await input('mn-value',String(100+i*10));
    await evaluate(`document.querySelector('[data-coord="start.y"]').value=${(.25+i*.065)*100};document.querySelector('[data-coord="end.y"]').value=${(.25+i*.065)*100};`);
    await apply();
  }
  const ten=await getDoc();assert.equal(ten.annotations.length,10);
  await click('mn-zoom-in');await click('mn-zoom-in');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.deepEqual((await getDoc()).annotations,ten.annotations,'Resize or zoom moved annotations');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=390'),'Mobile horizontal overflow');
  await screenshot('mobile.png');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await click('mn-fit');await scrollStage();
  // Select and move the first endpoint through genuine pointer input, then undo/redo.
  await evaluate("document.querySelector('#mn-list button').click()");
  p=await point(.27,.16);q=await point(.32,.2);await mouse(p.x,p.y);await mouse(q.x,q.y,'mouseMoved');await mouse(q.x,q.y,'mouseReleased');
  let moved=await getDoc();assert.ok(Math.abs(moved.annotations[0].start.x-.32)<.004);
  await click('mn-undo');assert.deepEqual((await getDoc()).annotations,ten.annotations);
  await click('mn-redo');assert.deepEqual((await getDoc()).annotations,moved.annotations);
  // Cancel a second drag without committing it.
  p=await point(moved.annotations[0].start.x,moved.annotations[0].start.y);q=await point(.4,.25);await mouse(p.x,p.y);await mouse(q.x,q.y,'mouseMoved');
  await evaluate("document.getElementById('mn-stage').dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true}))");await mouse(q.x,q.y,'mouseReleased');
  assert.deepEqual((await getDoc()).annotations,moved.annotations,'Cancelled drag changed annotations');
  // Invalid manual measurement must not update the saved annotation or be downloadable.
  await input('mn-value','3/0');await input('mn-unit','in');await apply();
  assert.equal(await evaluate("document.getElementById('mn-form-error').hidden"),false);
  assert.equal(await evaluate("document.getElementById('mn-pdf').disabled"),true);
  assert.deepEqual((await getDoc()).annotations,moved.annotations);
  await input('mn-value','3 1/2');await input('mn-text','Étage ½ ° — こんにちは <img src=x onerror=alert(1)>');await apply();
  assert.equal((await getDoc()).annotations[0].valueText,'3 1/2');
  assert.equal(await evaluate('document.querySelectorAll(".mn img").length'),0);
  await evaluate("document.querySelector('[data-mode=note]').click()");await scrollStage();p=await point(.15,.85);await tap(p.x,p.y);
  await input('mn-text','Check depth\nBring a tape measure');await apply();assert.equal((await getDoc()).annotations.length,11);
  await click('mn-delete');assert.equal((await getDoc()).annotations.length,10);await click('mn-undo');assert.equal((await getDoc()).annotations.length,11);
  // Moving two touch pointers zooms without creating an annotation.
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});await send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});await click('mn-fit');await scrollStage();
  const rect=await evaluate("(()=>{const b=document.getElementById('mn-stage').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};})()");
  const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
  await send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:cx-40,y:cy,id:1},{x:cx+40,y:cy,id:2}]});
  await send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:cx-75,y:cy,id:1},{x:cx+75,y:cy,id:2}]});
  await send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  assert.ok(await evaluate('__measurement.camera.zoom>1.4'));assert.equal((await getDoc()).annotations.length,11);
  await send('Emulation.setTouchEmulationEnabled',{enabled:false});await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});await click('mn-fit');
  await input('mn-title','Kitchen window');await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
  const networkBefore=requests.filter(u=>/^https?:/.test(u)).length;
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await click('mn-png');await until('!__measurement.busy');const pngPath=path.join(directory,'Kitchen window.png');await fileReady(pngPath);
  const bytes=fs.readFileSync(pngPath);assert.equal(bytes.readUInt32BE(16),1440);assert.equal(bytes.readUInt32BE(20),1080);
  // Decode the downloaded output and check colour at a real annotation endpoint.
  const uri='data:image/png;base64,'+bytes.toString('base64'),exportDoc=await getDoc();
  const count=await evaluate(`(async()=>{const im=new Image();im.src=${JSON.stringify(uri)};await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const x=c.getContext('2d');x.drawImage(im,0,0);const p=${JSON.stringify(exportDoc.annotations[1].start)},data=x.getImageData(Math.round(p.x*im.width)-5,Math.round(p.y*im.height)-5,11,11).data;let count=0;for(let i=0;i<data.length;i+=4)if(data[i]<60&&data[i+1]>60&&data[i+1]<150&&data[i+2]>150)count++;return count;})()`);
  assert.ok(count>5,'Exported annotation is missing or misplaced');
  await click('mn-pdf');await until('!__measurement.busy');const pdfPath=path.join(directory,'Kitchen window.pdf');await fileReady(pdfPath);
  const PDFLib=require('../tools/measurement-notebook/vendor/pdf-lib.min.js'),pdf=await PDFLib.PDFDocument.load(fs.readFileSync(pdfPath));assert.equal(pdf.getPageCount(),1);assert.ok(Math.abs(pdf.getPage(0).getWidth()-595.28)<.01);
  assert.equal(requests.filter(u=>/^https?:/.test(u)).length,networkBefore,'Editing/export made a network request');
  await screenshot('desktop.png');
  // Importing a file remains local and preserves old work on unsupported input.
  await evaluate('window.confirm=()=>true');
  const invalid=path.join(directory,'unsupported.heic');fs.writeFileSync(invalid,'not an image');await fileInput(invalid);await until('!__measurement.busy');assert.deepEqual((await getDoc()).annotations,exportDoc.annotations);
  assert.ok(await evaluate("document.getElementById('mn-status').textContent.includes('HEIC')"));
  // Camera-orientation fixture: real encoded JPEG plus EXIF orientation 6.
  const jpeg=Buffer.from(await evaluate("(()=>{const c=document.createElement('canvas');c.width=400;c.height=300;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,200,300);x.fillStyle='blue';x.fillRect(200,0,200,300);return c.toDataURL('image/jpeg').split(',')[1];})()"),'base64');
  const exif=Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000','hex');
  const oriented=path.join(directory,'orientation.jpg');fs.writeFileSync(oriented,Buffer.concat([jpeg.subarray(0,2),exif,jpeg.subarray(2)]));await fileInput(oriented);await until('!__measurement.busy');
  assert.equal((await getDoc()).width,300);assert.equal((await getDoc()).height,400);
  await input('mn-title','Orientation');await click('mn-png');await until('!__measurement.busy');await fileReady(path.join(directory,'Orientation.png'));
  const rotated=fs.readFileSync(path.join(directory,'Orientation.png'));assert.equal(rotated.readUInt32BE(16),300);assert.equal(rotated.readUInt32BE(20),400);
  const real=process.env.TEST_PHOTO||'/usr/share/backgrounds/Monument_valley_by_orbitelambda.jpg';
  if(fs.existsSync(real)){
    await fileInput(real);await until('!__measurement.busy');assert.equal((await getDoc()).annotations.length,0);assert.ok((await getDoc()).width>1000);
    for(let i=0;i<10;i++){await click('mn-add-centre');await input('mn-value',String(450+i));await evaluate(`document.querySelector('[data-coord="start.y"]').value=${12+i*8};document.querySelector('[data-coord="end.y"]').value=${12+i*8};`);await apply();}
    const annotations=(await getDoc()).annotations;await click('mn-zoom-in');await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.deepEqual((await getDoc()).annotations,annotations);await click('mn-fit');
    await input('mn-title','Real photo');await click('mn-png');await until('!__measurement.busy');await fileReady(path.join(directory,'Real photo.png'));await click('mn-pdf');await until('!__measurement.busy');await fileReady(path.join(directory,'Real photo.pdf'));
    console.log('PASS: real photo import, ten annotations, zoom/resize invariance and PNG/PDF export ('+real+').');
  }else console.log('SKIP real-photo fixture: set TEST_PHOTO to a local JPG/PNG/WebP under 24 MP.');
  // A 12-megapixel image with ten labels exercises the stated prototype workload.
  const large=Buffer.from(await evaluate("(()=>{const c=document.createElement('canvas');c.width=4000;c.height=3000;const x=c.getContext('2d');x.fillStyle='#b9cfbb';x.fillRect(0,0,4000,3000);x.fillStyle='#4c6574';x.fillRect(500,500,3000,2000);return c.toDataURL('image/jpeg').split(',')[1];})()"),'base64');
  const largePath=path.join(directory,'12mp.jpg');fs.writeFileSync(largePath,large);await fileInput(largePath);await until('!__measurement.busy');assert.equal((await getDoc()).width,4000);
  for(let i=0;i<10;i++){await click('mn-add-centre');await input('mn-value',String(i+1));await apply();}await input('mn-title','12mp');await click('mn-png');await until('!__measurement.busy');await fileReady(path.join(directory,'12mp.png'));
  const big=fs.readFileSync(path.join(directory,'12mp.png'));assert.equal(big.readUInt32BE(16),4000);assert.equal(big.readUInt32BE(20),3000);
  assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);assert.deepEqual(errors,[]);
  console.log('PASS: ten dimensions, real pointer drag/cancel/undo, fractions, safe Unicode notes, deletion, mobile layout, pinch zoom, offline PNG/PDF downloads, pixel alignment, bad-file recovery, EXIF orientation and 12 MP export.');
  console.log('Screenshots and exported files: '+directory);
})().catch(async e=>{console.error(e);if(session){try{console.error('Browser state:',await evaluate("({status:document.getElementById('mn-status')?.textContent,busy:window.__measurement?.busy})"));await screenshot('failure.png');console.error('Artifacts:',directory);}catch{}}process.exitCode=1;}).finally(()=>{server.close();chrome.kill();for(const p of pending.values())clearTimeout(p.timer);});
