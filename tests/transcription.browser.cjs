// Dependency-free Chrome smoke test. Start the built site on localhost:8765 first.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'transcription-browser-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome', ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run', '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${directory}/profile`], {stdio:['ignore','ignore','pipe','pipe','pipe']});
let buffer = '', sequence = 0, session, stderr = '', blockModel = false;
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
    if (message.method === 'Target.attachedToTarget') {
      const child = message.params.sessionId;
      Promise.all([send('Network.enable', {}, child),send('Runtime.enable', {}, child)]).then(async()=>{
        if(blockModel) await send('Network.setBlockedURLs',{urls:['https://huggingface.co/*']},child);
        await send('Runtime.runIfWaitingForDebugger', {}, child);
      }).catch(e=>errors.push(String(e)));
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request);
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
  for (let i = 0; i < 1800; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r,100)); }
  throw new Error('Condition timed out: ' + expression);
}
const click = id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
(async()=>{
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:process.env.TEST_URL||'http://127.0.0.1:8765/tools/transcription/'});
  await until("document.readyState==='complete'&&!!window.TranscriptionCore");
  assert.ok(!requests.some(r=>/huggingface|\.onnx|\.wasm|transformers.min/.test(r.url)),'Model loaded before use');
  await click('tr-example');await until("!document.getElementById('tr-start').disabled");
  assert.ok(!requests.some(r=>/huggingface|\.onnx|\.wasm|transformers.min/.test(r.url)),'Opening audio loaded the model');
  await click('tr-start');console.log('Running real Whisper inference, including first model download…');
  await until("!document.getElementById('tr-results').hidden||!document.getElementById('tr-error').hidden");
  assert.ok(await evaluate("document.getElementById('tr-error').hidden"),await evaluate("document.getElementById('tr-error').textContent"));
  const transcript=await evaluate("Array.from(document.querySelectorAll('#tr-segments textarea'),x=>x.value).join(' ')");console.log('Recognised:',transcript);assert.match(transcript,/country/i);assert.match(transcript,/ask/i);
  assert.ok(requests.some(r=>r.url.includes('encoder_model_quantized.onnx')));assert.ok(requests.some(r=>r.url.endsWith('.wasm')));
  // the site's page view counter (declared on /privacy/) posts timings only; everything else must be a GET
  assert.ok(requests.filter(r=>!/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(r.url)).every(r=>r.method==='GET'&&!r.hasPostData),'Audio or transcript was posted');
  const keys=await evaluate("caches.open(TranscriptionCore.CACHE_NAME).then(c=>c.keys()).then(keys=>keys.map(k=>k.url))");
  assert.ok(keys.some(k=>k.includes('decoder_model_merged_quantized.onnx')),'Model was not cached');
  assert.ok(keys.every(k=>k.startsWith('https://huggingface.co/Xenova/whisper-tiny.en/resolve/79fb389fc764e7c395bd330e9531d9d32ada7049/')),'Unexpected cache content');
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});await click('tr-txt');await click('tr-srt');
  for(let i=0;i<100&&!fs.existsSync(path.join(directory,'jfk-example.srt'));i++)await new Promise(r=>setTimeout(r,50));
  assert.match(fs.readFileSync(path.join(directory,'jfk-example.txt'),'utf8'),/country/i);
  assert.match(fs.readFileSync(path.join(directory,'jfk-example.srt'),'utf8'),/1\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
  fs.writeFileSync(path.join(directory,'desktop.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
  await evaluate("(()=>{const t=document.querySelector('#tr-segments textarea');t.value='Reviewed <not markup>';t.dispatchEvent(new Event('input'));const end=document.querySelectorAll('#tr-segments input')[1];end.value=0;end.dispatchEvent(new Event('input'));})()");
  assert.ok(await evaluate("document.getElementById('tr-srt').disabled&&!document.getElementById('tr-txt').disabled"));assert.equal(await evaluate("document.querySelectorAll('#tr-segments not').length"),0);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});assert.ok(await evaluate('document.documentElement.scrollWidth<=390'),'Mobile overflow');
  fs.writeFileSync(path.join(directory,'mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
  // Repeat the real speech sample across multiple model windows (33 seconds).
  const source=fs.readFileSync('tools/transcription/static/example-jfk.wav');let offset=12,data;
  while(offset+8<=source.length){const size=source.readUInt32LE(offset+4);if(source.toString('ascii',offset,offset+4)==='data'){data=source.subarray(offset+8,offset+8+size);break;}offset+=8+size+(size%2);}
  assert.ok(data);const repeated=Buffer.alloc(44+data.length*3);repeated.write('RIFF',0);repeated.writeUInt32LE(repeated.length-8,4);repeated.write('WAVEfmt ',8);repeated.writeUInt32LE(16,16);repeated.writeUInt16LE(1,20);repeated.writeUInt16LE(2,22);repeated.writeUInt32LE(44100,24);repeated.writeUInt32LE(176400,28);repeated.writeUInt16LE(4,32);repeated.writeUInt16LE(16,34);repeated.write('data',36);repeated.writeUInt32LE(data.length*3,40);for(let i=0;i<3;i++)data.copy(repeated,44+i*data.length);
  const repeatedPath=path.join(directory,'three-speeches.wav');fs.writeFileSync(repeatedPath,repeated);
  const doc=await send('DOM.getDocument'),fileInput=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#tr-file'});await send('DOM.setFileInputFiles',{nodeId:fileInput.nodeId,files:[repeatedPath]});
  blockModel=true;const before=requests.filter(r=>r.url.startsWith('https://huggingface.co/')).length;
  await click('tr-start');await until("!document.getElementById('tr-results').hidden||!document.getElementById('tr-error').hidden");
  assert.ok(await evaluate("document.getElementById('tr-error').hidden"),await evaluate("document.getElementById('tr-error').textContent"));
  assert.equal(requests.filter(r=>r.url.startsWith('https://huggingface.co/')).length,before,'Cached run requested model files');
  assert.ok(await evaluate("Array.from(document.querySelectorAll('#tr-segments textarea'),t=>t.value).join(' ').match(/country/gi).length>=4"),'Multi-window transcript lost repeated speech');
  assert.ok(await evaluate("Number(Array.from(document.querySelectorAll('#tr-segments input')).at(-1).value)>25"),'Multi-window timestamps lost the end of the recording');
  await click('tr-start');await until("document.getElementById('tr-status').textContent==='Transcribing English on your device…'");await click('tr-cancel');
  assert.ok(await evaluate("document.getElementById('tr-cancel').hidden&&!document.getElementById('tr-start').disabled&&document.getElementById('tr-status').textContent.startsWith('Stopped')"));
  let stopped=false;for(let i=0;i<100;i++){stopped=!(await send('Target.getTargets')).targetInfos.some(t=>t.type==='worker'&&t.url.endsWith('/transcription/worker.js'));if(stopped)break;await new Promise(r=>setTimeout(r,50));}assert.ok(stopped,'Stopped worker remains running');
  await click('tr-cache');await click('tr-start');await until("!document.getElementById('tr-error').hidden");assert.ok(await evaluate("!document.getElementById('tr-start').disabled"));
  await click('tr-forget');await until("document.getElementById('tr-cache-status').textContent.includes('removed')");assert.ok(!(await evaluate('caches.keys()')).includes('pot-transcription-whisper-tiny-en-v1'));
  await click('tr-clear');assert.ok(await evaluate("document.getElementById('tr-results').hidden&&document.getElementById('tr-audio-panel').hidden&&!document.getElementById('tr-audio').getAttribute('src')"));
  const {root}=await send('DOM.getDocument'),{nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#tr-file'});
  const invalid=path.join(directory,'invalid.mp3');fs.writeFileSync(invalid,'not audio');await send('DOM.setFileInputFiles',{nodeId,files:[invalid]});await click('tr-start');await until("!document.getElementById('tr-error').hidden");assert.match(await evaluate("document.getElementById('tr-error').textContent"),/decode/);
  const silent=path.join(directory,'silent.wav'),pcm=Buffer.alloc(44+16000*2);pcm.write('RIFF',0);pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(16000,24);pcm.writeUInt32LE(32000,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(pcm.length-44,40);fs.writeFileSync(silent,pcm);
  await send('DOM.setFileInputFiles',{nodeId,files:[silent]});await click('tr-start');await until("document.getElementById('tr-status').textContent.includes('silent')");assert.ok(await evaluate("document.getElementById('tr-error').hidden&&document.getElementById('tr-results').hidden"));
  const large=path.join(directory,'large.wav');const fd=fs.openSync(large,'w');fs.ftruncateSync(fd,50*1024*1024+1);fs.closeSync(fd);
  await send('DOM.setFileInputFiles',{nodeId,files:[large]});assert.match(await evaluate("document.getElementById('tr-error').textContent"),/50 MB/);
  const long=path.join(directory,'long.wav'),longPCM=Buffer.alloc(44+16000*2*601);pcm.copy(longPCM,0,0,44);longPCM.writeUInt32LE(longPCM.length-8,4);longPCM.writeUInt32LE(longPCM.length-44,40);fs.writeFileSync(long,longPCM);
  await send('DOM.setFileInputFiles',{nodeId,files:[long]});await until("document.getElementById('tr-error').textContent.includes('10 minutes')");assert.ok(await evaluate("document.getElementById('tr-start').disabled"));
  assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);assert.deepEqual(errors,[]);
  console.log('PASS: real inference, timestamped exports, edits, cached inference, cancellation, download/decode errors, silence, cache removal and mobile layout.');console.log('Artifacts: '+directory);
})().catch(e=>{console.error(e);console.error(errors);process.exitCode=1;}).finally(()=>{chrome.kill();for(const p of pending.values())clearTimeout(p.timer);});
