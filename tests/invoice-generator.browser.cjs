// Dependency-free Chrome smoke test. Start the built site on localhost:8765 first.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'invoice-browser-'));
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
const {execFileSync}=require('node:child_process');
const core=require('../tools/invoice-generator/static/core.js');
const input=(id,value)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
async function pdf(name){const r=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});const file=path.join(directory,name+'.pdf');fs.writeFileSync(file,Buffer.from(r.data,'base64'));return {file,text:execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8'})};}
(async()=>{
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:process.env.TEST_URL||'http://127.0.0.1:8765/tools/invoice-generator/'});
  await until("document.readyState==='complete' && typeof InvoiceCore==='object'");
  const initialRequests=requests.length;
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await evaluate('window.printCalls=0;window.print=()=>{window.printCalls++;}');
  await click('inv-print');assert.equal(await evaluate('window.printCalls'),0);assert.ok(await evaluate("!document.getElementById('inv-errors').hidden"));
  const invalid=await pdf('incomplete');assert.ok(invalid.text.includes('This document is incomplete'));assert.ok(!invalid.text.includes('Your business'));
  await click('inv-example');
  assert.equal(await evaluate("document.getElementById('inv-validation').textContent"),'Ready to print');
  assert.ok(await evaluate("document.getElementById('inv-paper').textContent.includes('$950.00')"));
  await input('inv-gstMode','exclusive');await click('inv-print');assert.equal(await evaluate('window.printCalls'),0);
  await input('inv-sellerAbn','51 824 753 556');
  assert.ok(await evaluate("document.getElementById('inv-paper').textContent.includes('$1,065.00')"));
  await click('inv-print');assert.equal(await evaluate('window.printCalls'),1);
  const invoice=await pdf('tax-invoice');
  for(const value of ['Tax Invoice','51 824 753 556','Website design services','$115.00','$1,265.00','$1,065.00'])assert.ok(invoice.text.includes(value),value+' missing from PDF');
  assert.ok(!invoice.text.includes('GST registration and pricing'));assert.ok(!invoice.text.includes('Plenty of Tools'));
  const info=execFileSync('pdfinfo',[invoice.file],{encoding:'utf8'});assert.match(info,/Pages:\s+1/);assert.ok(info.includes('A4'));
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory});
  await click('inv-save');
  for(let i=0;i<100&&!fs.existsSync(path.join(directory,'EXAMPLE-001.json'));i++)await new Promise(r=>setTimeout(r,50));
  const draftPath=path.join(directory,'EXAMPLE-001.json'),saved=JSON.parse(fs.readFileSync(draftPath,'utf8'));
  assert.equal(saved.data.items.length,2);assert.equal(saved.data.gstMode,'exclusive');
  const screen=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(directory,'desktop.png'),Buffer.from(screen.data,'base64'));
  await input('inv-gstMode','inclusive');assert.ok(await evaluate("document.getElementById('inv-paper').textContent.includes('$104.55')"));
  await input('inv-kind','quote');assert.ok(await evaluate("document.getElementById('inv-paid').disabled"));
  const quote=await pdf('quote');assert.ok(quote.text.includes('Quote'));assert.ok(quote.text.includes('Valid until:'));assert.ok(!quote.text.includes('Amount due'));assert.ok(!quote.text.includes('Already paid'));
  await click('inv-clear');assert.equal(await evaluate("document.getElementById('inv-sellerName').value"),'');
  const {root}=await send('DOM.getDocument');const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#inv-load'});
  await send('DOM.setFileInputFiles',{nodeId,files:[draftPath]});await until("document.getElementById('inv-sellerName').value==='Example Studio (sample)'");
  assert.ok(await evaluate("document.getElementById('inv-paper').textContent.includes('$1,065.00')"));
  await click('inv-add');assert.equal(await evaluate("document.querySelectorAll('.inv-line').length"),3);
  await evaluate("document.querySelector('[data-remove=\"2\"]').click()");assert.equal(await evaluate("document.querySelectorAll('.inv-line').length"),2);
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  assert.ok(await evaluate('document.documentElement.scrollWidth<=390'),'Mobile page overflow');
  const mobile=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(directory,'mobile.png'),Buffer.from(mobile.data,'base64'));
  const long={...saved.data,number:'LONG-TEST-001',paid:'0',notes:'<img src=x onerror=alert(1)>\nEnd of the long invoice.',items:Array.from({length:65},(_,i)=>({description:`Work item ${String(i+1).padStart(2,'0')} — detailed service description for the project`,quantity:'1.5',price:'125.25',tax:i%2?'none':'gst'}))};
  const longPath=path.join(directory,'long.json');fs.writeFileSync(longPath,core.serialize(long));await send('DOM.setFileInputFiles',{nodeId,files:[longPath]});await until("document.getElementById('inv-number').value==='LONG-TEST-001'");
  assert.equal(await evaluate("document.querySelectorAll('#inv-paper img').length"),0);
  const multi=await pdf('long-invoice'),multiInfo=execFileSync('pdfinfo',[multi.file],{encoding:'utf8'});
  assert.ok(Number(/Pages:\s+(\d+)/.exec(multiInfo)[1])>=3,'Long invoice did not paginate');
  for(let i=1;i<=65;i++)assert.ok(multi.text.includes('Work item '+String(i).padStart(2,'0')),'Missing item '+i);
  const totals=core.calculate(long);assert.ok(multi.text.includes((totals.total/100).toLocaleString('en-AU',{style:'currency',currency:'AUD'})));
  assert.ok((multi.text.match(/Description\s+Qty/g)||[]).length>=3,'Table headers did not repeat across pages');
  assert.ok(multi.text.includes('End of the long invoice.'));
  const badPath=path.join(directory,'invalid.json');fs.writeFileSync(badPath,'{"hello":true}');await send('DOM.setFileInputFiles',{nodeId,files:[badPath]});await until("!document.getElementById('inv-errors').hidden");
  assert.equal(await evaluate("document.getElementById('inv-number').value"),'LONG-TEST-001');
  assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);assert.equal(requests.length,initialRequests,'Editor made a network request');assert.deepEqual(errors,[]);
  console.log('PASS: validation, GST modes, calculations, actual single/multipage PDFs with all rows and repeated headings, quotes, draft download/reopen, add/remove, malformed draft preservation, HTML escaping, mobile layout and offline/no-storage use.');
  console.log('PDFs, screenshots and saved drafts: '+directory);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{chrome.kill();for(const p of pending.values())clearTimeout(p.timer);});
