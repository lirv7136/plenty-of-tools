// Dependency-free Chrome regression test; serves dist on an ephemeral loopback port.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'read-aloud-browser-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--enable-speech-dispatcher', '--autoplay-policy=no-user-gesture-required', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${directory}/profile`], {stdio:['ignore','ignore','pipe','pipe','pipe']});
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
async function fileInput(file){const {root}=await send('DOM.getDocument'),{nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#ra-file'});await send('DOM.setFileInputFiles',{nodeId,files:[file]});}
async function fileReady(file){for(let i=0;i<200;i++){if(fs.existsSync(file)&&!fs.existsSync(file+'.crdownload'))return;await new Promise(r=>setTimeout(r,50));}throw new Error('Download missing: '+file);}
async function screenshot(name){const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(directory,name),Buffer.from(r.data,'base64'));}
(async()=>{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const base=`http://127.0.0.1:${server.address().port}`;
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('DOM.enable');
  await send('Page.navigate',{url:base+'/tools/read-aloud/'});
  await until("document.readyState==='complete'&&window.__readAloud");
  console.log('Voices:',await evaluate('__readAloud.voices'));
  await click('ra-example');await until('__readAloud.count>0&&!__readAloud.loading');
  await click('ra-next');assert.equal(await evaluate('__readAloud.index'),1);
  const exampleText=await evaluate("document.getElementById('ra-text').value");
  await send('Page.reload');await until("document.readyState==='complete'&&window.__readAloud&&__readAloud.count===0");
  await input('ra-text',exampleText);await click('ra-load');await until('__readAloud.count>0&&!__readAloud.loading');assert.equal(await evaluate('__readAloud.index'),1);
  await input('ra-text','<img src=x onerror=alert(1)>. A second sentence.\n\nNew paragraph.');await click('ra-load');await until("!__readAloud.loading&&document.getElementById('ra-reader').textContent.includes('<img')");assert.equal(await evaluate("document.querySelectorAll('#ra-reader img').length"),0);
  await input('ra-skip','paragraph');await click('ra-next');assert.equal(await evaluate('__readAloud.index'),2);
  const txt=path.join(directory,'notes.txt');fs.writeFileSync(txt,'A UTF 8 document. 木材 notes.');await fileInput(txt);await until("!__readAloud.loading&&document.getElementById('ra-text').value.includes('木材 notes')");
  // Extract genuine text from a locally generated PDF through the vendored worker.
  const PDF=require('../tools/pdf-sign/vendor/pdf-lib.min.js'),pdf=await PDF.PDFDocument.create();pdf.addPage().drawText('Hello from a PDF. Second sentence.');
  const file=path.join(directory,'fixture.pdf');fs.writeFileSync(file,await pdf.save());await fileInput(file);await until("!__readAloud.loading&&document.getElementById('ra-text').value.includes('Hello from a PDF')");
  assert.ok(await evaluate('__readAloud.count>=2'));
  const bad=path.join(directory,'bad.pdf');fs.writeFileSync(bad,'not a PDF');await fileInput(bad);await until("!__readAloud.loading&&document.getElementById('ra-status').classList.contains('ra-error')");assert.ok(await evaluate("document.getElementById('ra-reader').textContent.includes('Hello from a PDF')"));
  const blank=await PDF.PDFDocument.create();blank.addPage();const blankPath=path.join(directory,'scan.pdf');fs.writeFileSync(blankPath,await blank.save());await fileInput(blankPath);await until("!__readAloud.loading&&document.getElementById('ra-status').textContent.includes('OCR')");
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate('document.documentElement.scrollWidth<=390'));await screenshot('mobile.png');
  assert.equal(await evaluate(`fetch(${JSON.stringify(base+'/vs/speechify/')}).then(r=>r.status)`),200);
  const voices=await evaluate('__readAloud.voices');
  if(voices.length&&!process.env.SKIP_LONG_SPEECH){
    // A real 5,000 word utterance chain, using the OS voice rather than a speech stub.
    const long=Array.from({length:500},()=> 'One two three four five six seven eight nine ten.').join(' ');
    await input('ra-text',long);await click('ra-load');await until('__readAloud.count===500&&!__readAloud.loading');
    await input('ra-rate','3');await click('ra-play');
    let last=-1,changed=Date.now();
    for(let i=0;i<1500;i++){
      const state=await evaluate('({state:__readAloud.state,index:__readAloud.index,status:document.getElementById("ra-status").textContent})');
      if(state.state==='finished')break;
      if(state.state==='error')throw new Error(state.status);
      if(state.index!==last){last=state.index;changed=Date.now();if(last%50===0)console.log('Real speech progress: '+last+'/500 sentences');}
      if(Date.now()-changed>60000)throw new Error('Real speech stalled at '+last);
      await new Promise(r=>setTimeout(r,500));
    }
    assert.equal(await evaluate('__readAloud.state'),'finished');assert.equal(await evaluate('__readAloud.index'),500);
    console.log('PASS: 5,000 words completed through the actual local operating system speech voice.');
  }else if(!voices.length){
    assert.equal(await evaluate("document.getElementById('ra-play').disabled"),true);
    console.log('UNVERIFIED: this Chrome environment has no local voices. The 5,000 word engine test uses simulated speech events; real listening remains outstanding.');
  }
  assert.ok(requests.filter(u=>u.startsWith('http')).every(u=>u.startsWith(base+'/')),'An external request was made');
  assert.deepEqual(errors,[]);console.log('PASS: text, PDF extraction, invalid/scanned PDF recovery, position restore, literal HTML safety, sentence/paragraph skip, mobile layout, comparison HTTP 200. Artifacts: '+directory);
})().catch(e=>{console.error(e);console.error(errors);process.exitCode=1;}).finally(()=>{chrome.kill();server.close();for(const p of pending.values())clearTimeout(p.timer);});
