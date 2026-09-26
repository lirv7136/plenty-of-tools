// Dependency-free Chrome smoke test. Start the built site on localhost:8765 first.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'background-browser-'));
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
        if(blockModel) await send('Network.setBlockedURLs',{urls:['*u2netp.onnx']},child);
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
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Target.setAutoAttach',{autoAttach:true,waitForDebuggerOnStart:true,flatten:true});
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:process.env.TEST_URL||'http://127.0.0.1:8765/tools/background-remover/'});
  await until("document.readyState==='complete' && !!document.getElementById('br-example')");
  assert.ok(!requests.some(r=>/\.onnx|\.wasm/.test(r.url)), 'Heavy assets loaded before use');
  await click('br-example'); await until("!document.getElementById('br-editor').hidden");
  await click('br-remove');
  console.log('Running real U2NETP inference in Chrome…');
  await until("!document.getElementById('br-result').hidden || !document.getElementById('br-error').hidden");
  assert.ok(await evaluate("document.getElementById('br-error').hidden"), await evaluate("document.getElementById('br-error').textContent"));
  assert.deepEqual(await evaluate("[document.getElementById('br-result').width,document.getElementById('br-result').height]"),[512,512]);
  const stats=await evaluate(`(()=>{const c=document.getElementById('br-result'),d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let transparent=0,opaque=0;for(let i=3;i<d.length;i+=4){if(d[i]<20)transparent++;if(d[i]>235)opaque++;}return{transparent,opaque};})()`);
  assert.ok(stats.transparent>20000, JSON.stringify(stats)); assert.ok(stats.opaque>20000,JSON.stringify(stats));
  assert.ok(requests.some(r=>r.url.endsWith('/u2netp.onnx')), 'Did not observe worker model request');
  assert.ok(requests.some(r=>r.url.endsWith('.wasm')), 'Did not observe WASM request');
  // the site's page view counter (declared on /privacy/) is shell, not the tool reaching out
  assert.ok(requests.filter(r=>!/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(r.url)).every(r=>(r.url.startsWith('http://127.0.0.1:8765/')||r.url.startsWith('data:')||r.url.startsWith('blob:'))&&r.method==='GET'&&!r.hasPostData),JSON.stringify(requests));
  assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
  await click('br-download');
  for(let i=0;i<100&&!fs.existsSync(path.join(directory,'nasa-astronaut-cutout.png'));i++) await new Promise(r=>setTimeout(r,50));
  const png=fs.readFileSync(path.join(directory,'nasa-astronaut-cutout.png'));
  assert.equal(png.readUInt32BE(16),512); assert.equal(png.readUInt32BE(20),512);
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true}); fs.writeFileSync(path.join(directory,'desktop.png'),Buffer.from(screenshot.data,'base64'));
  await evaluate(`document.querySelector('input[name="br-background"][value="#ffffff"]').click()`);
  const corner=await evaluate("Array.from(document.getElementById('br-result').getContext('2d').getImageData(0,0,1,1).data)");
  assert.ok(corner[3]===255 && corner[0]>240 && corner[1]>240 && corner[2]>240,JSON.stringify(corner));
  await evaluate(`document.querySelector('input[name="br-background"][value="transparent"]').click()`);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth<=390'),'Mobile overflow');
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(directory,'mobile.png'),Buffer.from(mobile.data,'base64'));
  await click('br-remove'); await click('br-cancel');
  assert.ok(await evaluate("document.getElementById('br-cancel').hidden && !document.getElementById('br-remove').disabled && document.getElementById('br-status').textContent.startsWith('Cancelled')"));
  await click('br-clear');
  assert.ok(await evaluate("document.getElementById('br-editor').hidden && document.getElementById('br-original').width===1 && document.getElementById('br-result').width===1 && !document.getElementById('br-file').value"));
  const {root}=await send('DOM.getDocument'); const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#br-file'});
  const invalid=path.join(directory,'fake.png'); fs.writeFileSync(invalid,'<svg><script>alert(1)</script></svg>');
  await send('DOM.setFileInputFiles',{nodeId,files:[invalid]}); await until("!document.getElementById('br-error').hidden");
  assert.ok(await evaluate("document.getElementById('br-editor').hidden"));
  await click('br-clear');
  const fixture=path.resolve('tools/background-remover/static/example-astronaut.png');
  await send('DOM.setFileInputFiles',{nodeId,files:[fixture]}); await until("!document.getElementById('br-editor').hidden");
  assert.ok(await evaluate("document.getElementById('br-error').hidden"));
  blockModel=true; await click('br-remove');
  await until("!document.getElementById('br-error').hidden");
  assert.ok(await evaluate("!document.getElementById('br-remove').disabled && document.getElementById('br-cancel').hidden"),'Failed model download did not allow retry');
  blockModel=false; await click('br-remove');
  await until("!document.getElementById('br-result').hidden || !document.getElementById('br-error').hidden");
  assert.ok(await evaluate("document.getElementById('br-error').hidden"),await evaluate("document.getElementById('br-error').textContent"));
  assert.deepEqual(errors,[]);
  console.log('PASS: real inference, meaningful alpha, original dimensions, PNG download, white background, cancellation, mobile width, clear, file import, invalid format, lazy assets, failed model download and retry, same-origin GET-only processing.');
  console.log('Alpha pixels: '+JSON.stringify(stats));
  console.log('Screenshots and output PNG: '+directory);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{chrome.kill();for(const p of pending.values())clearTimeout(p.timer);});
