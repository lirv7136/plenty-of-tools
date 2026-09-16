// Dependency-free Chrome smoke test. Start the built site on localhost:8765 first.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'qr-browser-'));
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
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r,50)); }
  throw new Error('Condition timed out: ' + expression);
}
const click = id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
const input=async(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const generate=()=>evaluate("document.getElementById('qr-form').requestSubmit()");
const decodeCanvas=()=>evaluate("(()=>{const c=document.getElementById('qr-canvas');return jsQR(c.getContext('2d').getImageData(0,0,c.width,c.height).data,c.width,c.height)?.data;})()");
async function decodeFile(file,type){
  const data='data:'+type+';base64,'+fs.readFileSync(file).toString('base64');
  return evaluate(`(async()=>{const image=new Image();image.src=${JSON.stringify(data)};await image.decode();const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');ctx.drawImage(image,0,0,1024,1024);return jsQR(ctx.getImageData(0,0,1024,1024).data,1024,1024)?.data;})()`);
}
(async()=>{
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:process.env.TEST_URL||'http://127.0.0.1:8765/tools/qr-codes/'});
  await until("document.readyState==='complete' && typeof qrcode==='function'");
  await evaluate(fs.readFileSync(path.join(__dirname,'vendor/jsQR.js'),'utf8'));
  const networkBefore=requests.filter(u=>/^https?:/.test(u)).length;
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await click('qr-example');
  assert.ok(await evaluate("document.getElementById('qr-error').hidden"));
  assert.equal(await decodeCanvas(),'https://example.com/');
  assert.equal(await evaluate('document.activeElement.id'),'qr-preview-title');
  await input('qr-url','https://example.com/menu?table=4&lang=en'); await generate();
  assert.equal(await decodeCanvas(),'https://example.com/menu?table=4&lang=en');
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
  await click('qr-png');await click('qr-svg');
  for(let i=0;i<100&&(!fs.existsSync(path.join(directory,'qr-code.png'))||!fs.existsSync(path.join(directory,'qr-code.svg')));i++)await new Promise(r=>setTimeout(r,50));
  const png=fs.readFileSync(path.join(directory,'qr-code.png'));assert.equal(png.readUInt32BE(16),1024);assert.equal(png.readUInt32BE(20),1024);
  assert.equal(await decodeFile(path.join(directory,'qr-code.png'),'image/png'),'https://example.com/menu?table=4&lang=en');
  assert.equal(await decodeFile(path.join(directory,'qr-code.svg'),'image/svg+xml'),'https://example.com/menu?table=4&lang=en');
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(directory,'desktop.png'),Buffer.from(screenshot.data,'base64'));
  await input('qr-url','https://example.com/changed');
  assert.ok(await evaluate("document.getElementById('qr-png').disabled && document.getElementById('qr-svg').disabled && document.getElementById('qr-canvas').hidden"),'Old code remains downloadable after editing');
  await input('qr-colour','#ffffff');await generate();
  assert.ok(await evaluate("!document.getElementById('qr-error').hidden && document.getElementById('qr-png').disabled"));
  await input('qr-colour','#0b7a5a');await input('qr-type','text');
  await input('qr-text','Café ☕\nこんにちは 👋 <img src=x onerror=alert(1)>');await generate();
  assert.equal(await decodeCanvas(),'Café ☕\nこんにちは 👋 <img src=x onerror=alert(1)>');
  assert.equal(await evaluate("document.querySelectorAll('.qr img').length"),0);
  await input('qr-type','wifi');await input('qr-ssid','Cafe;Main');await input('qr-password','p:a,s"s\\word');await click('qr-hidden');await generate();
  assert.equal(await decodeCanvas(),'WIFI:T:WPA;S:Cafe\\;Main;P:p\\:a\\,s\\"s\\\\word;H:true;;');
  await input('qr-security','nopass');assert.ok(await evaluate("document.getElementById('qr-password').disabled"));await generate();
  assert.equal(await decodeCanvas(),'WIFI:T:nopass;S:Cafe\\;Main;H:true;;');
  await click('qr-clear');
  assert.ok(await evaluate("!document.getElementById('qr-password').value && !document.getElementById('qr-text').value && !document.getElementById('qr-payload').textContent && document.getElementById('qr-canvas').width===1"));
  await click('qr-example');
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth<=390'),'Mobile overflow');
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(directory,'mobile.png'),Buffer.from(mobile.data,'base64'));
  assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);
  assert.equal(requests.filter(u=>/^https?:/.test(u)).length,networkBefore,'Generation made a network request');
  assert.deepEqual(errors,[]);
  console.log('PASS: decoded canvas + downloaded PNG/SVG, full UTF-8, Wi-Fi escaping, open Wi-Fi, stale-export prevention, contrast validation, clear, mobile layout and offline generation without network/storage writes.');
  console.log('Screenshots and exported codes: '+directory);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{chrome.kill();for(const p of pending.values())clearTimeout(p.timer);});
