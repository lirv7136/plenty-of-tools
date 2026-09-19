// Dependency-free Chrome regression test; serves dist on an ephemeral loopback port.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'measurement-storage-'));
let chrome;
function launch(){
chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${directory}/profile`], {stdio:['ignore','ignore','pipe','pipe','pipe']});
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
}
let buffer = '', sequence = 0, session, stderr = '';
const pending = new Map(), errors = [], requests = [];
launch();
function send(method, params = {}, target = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out. ${stderr.slice(-1500)}`)); }, 15000);
    pending.set(id, {resolve, reject, timer});
    chrome.stdio[3].write(JSON.stringify({id, method, params, ...(target ? {sessionId:target} : {})}) + '\0');
  });
}
async function evaluate(expression) {
  if(expression.startsWith('(await '))expression='(async()=>'+expression+')()';
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
async function fileInput(file,selector='#mn-import-project'){const {root}=await send('DOM.getDocument'),{nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector});await send('DOM.setFileInputFiles',{nodeId,files:[file]});}
async function fileReady(file){for(let i=0;i<200;i++){if(fs.existsSync(file)&&!fs.existsSync(file+'.crdownload'))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Download missing: '+file);}
async function screenshot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(directory,name),Buffer.from(r.data,'base64'));}
(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`,url=base+'/tools/measurement-notebook/';
  async function navigate(){
    const {targetId}=await send('Target.createTarget',{url:'about:blank'},undefined);session=(await send('Target.attachToTarget',{targetId,flatten:true},undefined)).sessionId;
    await send('Runtime.enable');await send('Page.enable');await send('DOM.enable');
    await send('Page.navigate',{url});await until("window.__measurement&&!__measurement.busy");
    await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory},undefined);
  }
  const saved=()=>until("!__measurement.dirty&&document.getElementById('mn-save-state').textContent.includes('Saved')");
  await navigate();await click('mn-example');await until('__measurement.document&&!__measurement.busy');
  await input('mn-project-name','Trial " <img src=x onerror=alert(1)> 窓');
  await input('mn-title','Kitchen window');await click('mn-add-centre');await input('mn-value','3 1/2');await input('mn-unit','in');await input('mn-text','木材 <script>bad()</script>');await apply();await saved();
  const original=await getDoc(),first=await evaluate('__measurement.project.id');
  await click('mn-backup');await until('!__measurement.busy');
  const backup=fs.readdirSync(directory).find(n=>n.endsWith('.mnote'));assert.ok(backup);const backupPath=path.join(directory,backup);await fileReady(backupPath);
  const beforeDigest=await evaluate(`MeasurementStorage.read(${JSON.stringify(first)}).then(async r=>MeasurementProjects.digest(r.image))`);
  await evaluate("window.reloadMarker=true");await send('Page.reload');await until("!window.reloadMarker&&document.readyState==='complete'&&window.__measurement&&!__measurement.busy");
  await input('mn-project-list',first);await click('mn-open-project');await until('__measurement.document&&!__measurement.busy');assert.deepEqual(await getDoc(),original);
  // Actually stop Chrome and launch a new browser process with the same disk profile.
  const exit=new Promise(r=>chrome.once('exit',r));await send('Browser.close',{},undefined);await exit;
  buffer='';session=undefined;launch();await navigate();
  await input('mn-project-list',first);await click('mn-open-project');await until('__measurement.document&&!__measurement.busy');assert.deepEqual(await getDoc(),original);
  await fileInput(backupPath);await until("!__measurement.busy&&document.getElementById('mn-status').textContent.includes('imported')");
  assert.deepEqual(await getDoc(),original);const restored=await evaluate('__measurement.project.id');assert.notEqual(restored,first);
  assert.equal(await evaluate(`MeasurementStorage.read(${JSON.stringify(restored)}).then(async r=>MeasurementProjects.digest(r.image))`),beforeDigest);
  assert.equal(await evaluate("document.querySelectorAll('#mn-project-list img, #mn-list script').length"),0);
  assert.equal(await evaluate('(await MeasurementStorage.list()).rows.length'),2);
  // Import into an empty database to prove the backup does not depend on existing assets.
  const records=await evaluate('(await MeasurementStorage.list()).rows.map(r=>({id:r.project.id,revision:r.project.revision}))');
  await evaluate(`Promise.all(${JSON.stringify(records)}.map(r=>MeasurementStorage.remove(r.id,r.revision)))`);
  await fileInput(backupPath);await until("!__measurement.busy&&__measurement.project.id!=="+JSON.stringify(restored));assert.deepEqual(await getDoc(),original);
  assert.equal(await evaluate('(await MeasurementStorage.list()).rows.length'),1);
  // Corrupt photo bytes: no new record, current project intact, useful error.
  const damaged=Buffer.from(fs.readFileSync(backupPath));damaged[damaged.length-10]^=1;const badPath=path.join(directory,'corrupt.mnote');fs.writeFileSync(badPath,damaged);
  await fileInput(badPath);await until("!__measurement.busy&&document.getElementById('mn-status').classList.contains('error')");
  assert.match(await evaluate("document.getElementById('mn-status').textContent"),/checksum/);assert.deepEqual(await getDoc(),original);assert.equal(await evaluate('(await MeasurementStorage.list()).rows.length'),1);
  await click('mn-duplicate-project');await until("!__measurement.busy&&document.getElementById('mn-status').textContent.includes('duplicated')");
  assert.deepEqual(await getDoc(),original);assert.equal(await evaluate('(await MeasurementStorage.list()).rows.length'),2);
  await input('mn-project-name','Renamed project');await saved();
  // Cancel delete, then confirm it through browser dialogs.
  await evaluate("window.confirm=()=>false");await click('mn-delete-project');await until('!__measurement.busy');assert.equal(await evaluate('(await MeasurementStorage.list()).rows.length'),2);
  await evaluate("window.confirm=()=>true");await click('mn-delete-project');await until('!__measurement.busy&&__measurement.document===null');assert.equal(await evaluate('(await MeasurementStorage.list()).rows.length'),1);
  const id=await evaluate('(await MeasurementStorage.list()).rows[0].project.id');await input('mn-project-list',id);await click('mn-open-project');await until('__measurement.document&&!__measurement.busy');
  // Inject an IndexedDB put failure inside a real transaction. Prior committed data survives.
  await evaluate("window.realPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){throw new DOMException('Storage full','QuotaExceededError');}");
  await input('mn-title','Unsaved quota edit');await click('mn-save');await until("document.getElementById('mn-save-state').classList.contains('mn-error')");
  assert.ok(await evaluate('__measurement.dirty'));assert.equal(await evaluate(`(await MeasurementStorage.read(${JSON.stringify(id)})).project.document.title`),'Kitchen window');
  await click('mn-backup');await until('!__measurement.busy');assert.equal((await getDoc()).title,'Unsaved quota edit');
  await evaluate('IDBObjectStore.prototype.put=window.realPut');await click('mn-save');await saved();
  assert.equal(await evaluate(`(await MeasurementStorage.read(${JSON.stringify(id)})).project.document.title`),'Unsaved quota edit');
  // A newer revision (another tab) must not be silently overwritten.
  await evaluate(`(async()=>{const r=await MeasurementStorage.read(${JSON.stringify(id)});r.project.document.title='Other tab';await MeasurementStorage.write(r.project,r.image,r.original,r.project.revision);})()`);
  await input('mn-title','My conflicting edit');await click('mn-save');await until("document.getElementById('mn-save-state').textContent.includes('another tab')");
  assert.equal(await evaluate(`(await MeasurementStorage.read(${JSON.stringify(id)})).project.document.title`),'Other tab');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth<=390'));
  await screenshot('storage-mobile.png');
  await evaluate('window.confirm=()=>false');await click('mn-close-project');await until('!__measurement.busy');assert.ok(await evaluate('__measurement.dirty'));
  await evaluate('window.confirm=()=>true');await click('mn-close-project');await until('!__measurement.busy&&__measurement.document===null');
  await input('mn-project-list',id);await click('mn-open-project');await until('__measurement.document&&!__measurement.busy');assert.equal((await getDoc()).title,'Other tab');
  // A backup with an actual original image must also restore the original bytes.
  const png=await evaluate("(()=>{const c=document.createElement('canvas');c.width=20;c.height=10;c.getContext('2d').fillRect(0,0,20,10);return c.toDataURL('image/png').split(',')[1];})()");
  const photo=path.join(directory,'original.png');fs.writeFileSync(photo,Buffer.from(png,'base64'));
  await fileInput(photo,'#mn-file');await until('__measurement.document?.width===20&&!__measurement.busy');await saved();
  await click('mn-backup');await until('!__measurement.busy');const originalBackup=path.join(directory,'original.mnote');await fileReady(originalBackup);
  await fileInput(originalBackup);await until("!__measurement.busy&&document.getElementById('mn-status').textContent.includes('imported')");
  const originalHash=await evaluate('(async()=>{const r=await MeasurementStorage.read(__measurement.project.id);return MeasurementProjects.digest(r.original);})()');
  assert.equal(originalHash,require('node:crypto').createHash('sha256').update(Buffer.from(png,'base64')).digest('hex'));
  const estimate=await evaluate('navigator.storage.estimate()');console.log('Storage estimate:',estimate);
  assert.deepEqual(errors,[]);
  console.log('PASS: real browser restart, reload, rename, duplicate, confirm/cancel deletion, byte identical backup restore into empty storage, corrupt import refusal, literal markup safety, transactional failure recovery, conflict protection, mobile layout. Artifacts: '+directory);
})().catch(e=>{console.error(e);console.error(errors);process.exitCode=1;}).finally(()=>{chrome.kill();server.close();for(const p of pending.values())clearTimeout(p.timer);});
