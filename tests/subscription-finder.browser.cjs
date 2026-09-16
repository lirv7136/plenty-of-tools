// Dependency-free Chrome smoke test. Start the built site on localhost:8765 first.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'subscription-browser-'));
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
(async () => {
  const {targetId} = await send('Target.createTarget', {url:'about:blank'});
  session = (await send('Target.attachToTarget', {targetId, flatten:true})).sessionId;
  await send('Runtime.enable'); await send('Page.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate', {url:process.env.TEST_URL || 'http://127.0.0.1:8765/tools/subscription-finder/'});
  await until("document.readyState === 'complete' && !!document.getElementById('sf-demo')");
  const requestCount = requests.length;
  await click('sf-demo'); await click('sf-analyse');
  assert.ok(await evaluate("document.getElementById('sf-error').hidden"), 'Analysis displayed an error');
  assert.equal(await evaluate('document.activeElement.id'), 'sf-results-title');
  assert.equal(await evaluate("document.getElementById('sf-count').textContent"), '3');
  assert.equal(await evaluate("document.getElementById('sf-monthly').textContent"), '$35.47');
  assert.equal(await evaluate("document.getElementById('sf-yearly').textContent"), '$425.64');
  assert.equal(await evaluate("document.querySelectorAll('.sf-candidate').length"), 4);
  await evaluate("document.querySelector('details').open = true");
  const desktop = await send('Page.captureScreenshot', {format:'png', captureBeyondViewport:true});
  fs.writeFileSync(path.join(directory, 'desktop.png'), Buffer.from(desktop.data,'base64'));
  await send('Browser.setDownloadBehavior', {behavior:'allow', downloadPath:directory}, undefined);
  await click('sf-export');
  for (let i = 0; i < 100 && !fs.existsSync(path.join(directory, 'subscription-report.csv')); i++) await new Promise(r=>setTimeout(r,50));
  const report = fs.readFileSync(path.join(directory, 'subscription-report.csv'),'utf8');
  assert.ok(report.includes('STREAMBOX')); assert.ok(!report.includes('OLD MEMBERSHIP'));
  await evaluate("document.querySelector('.sf-candidate input:checked').click()");
  assert.equal(await evaluate("document.getElementById('sf-count').textContent"), '2');
  await send('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth <= 390'), 'Mobile page overflows');
  const mobile = await send('Page.captureScreenshot', {format:'png', captureBeyondViewport:true});
  fs.writeFileSync(path.join(directory, 'mobile.png'), Buffer.from(mobile.data,'base64'));
  await click('sf-clear');
  assert.ok(await evaluate("document.getElementById('sf-mapping').hidden && document.getElementById('sf-results').hidden && !document.getElementById('sf-preview').textContent && !document.getElementById('sf-candidates').textContent"));
  const fixture = path.join(directory,'bank.csv');
  fs.writeFileSync(fixture, 'Date,Description,Amount\n01/01/2026,<img src=x onerror=alert(1)>,-10\n01/02/2026,<img src=x onerror=alert(1)>,-10\n01/03/2026,<img src=x onerror=alert(1)>,-10');
  const {root} = await send('DOM.getDocument');
  const {nodeId} = await send('DOM.querySelector', {nodeId:root.nodeId,selector:'#sf-file'});
  await send('DOM.setFileInputFiles', {nodeId, files:[fixture]});
  await until("!document.getElementById('sf-mapping').hidden");
  await click('sf-analyse');
  assert.ok(await evaluate("document.getElementById('sf-error').hidden"));
  assert.equal(await evaluate("document.getElementById('sf-count').textContent"), '1');
  assert.equal(await evaluate("document.querySelectorAll('.sf img').length"), 0);
  assert.equal(await evaluate('localStorage.length + sessionStorage.length'), 0);
  assert.equal(requests.length, requestCount, 'Import or analysis made a network request');
  fs.writeFileSync(fixture,'Date,Description,Amount\n01/01/2026,"Unclosed,-10');
  await click('sf-clear'); await send('DOM.setFileInputFiles', {nodeId,files:[fixture]});
  await until("!document.getElementById('sf-error').hidden");
  assert.ok(await evaluate("document.getElementById('sf-mapping').hidden && document.getElementById('sf-results').hidden"));
  assert.deepEqual(errors, []);
  console.log('PASS: demo totals, evidence, exclusion, download, mobile width, clear, file upload, HTML escaping, malformed CSV, no storage and no transaction network requests.');
  console.log('Screenshots and downloaded report: ' + directory);
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => { chrome.kill(); for (const p of pending.values()) clearTimeout(p.timer); });
