// Dependency-free Chrome smoke test. Start the built site on localhost:8765 first.
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'worth-browser-'));
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
const value = (id,v)=>evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(v)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
async function choose(id){await click('wc-tab-'+id);await until(`document.getElementById('wc-tab-${id}').getAttribute('aria-current')==='page'`);}
async function screenshot(name){fs.writeFileSync(path.join(directory,name+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));}
(async()=>{
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:process.env.TEST_URL||'http://127.0.0.1:8765/tools/worth-it-calculators/'});
  await until("document.readyState==='complete'&&!!document.getElementById('wc-price')");
  assert.ok(await evaluate("document.getElementById('wc-results').hidden"));
  await evaluate("document.getElementById('wc-form').requestSubmit()");
  assert.equal(await evaluate('document.activeElement.id'),'wc-price');
  assert.ok(await evaluate("!document.getElementById('wc-error').hidden"));
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory},undefined);
  const requestCount=requests.length;
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  const examples={vinted:'0.70',etsy:'15.00',ebay:'15.00',uber:'1.00',fasttrack:'7.33',seats:'6.00',bags:'49.67',wifi:'28.00',parking:'60.00'};
  for(const [id,amount] of Object.entries(examples)){
    await choose(id);await click('wc-example');
    assert.ok(await evaluate("!document.getElementById('wc-results').hidden"));
    assert.ok((await evaluate("document.getElementById('wc-net').textContent")).includes(amount),`${id} example result`);
    assert.ok(await evaluate("!document.getElementById('wc-example-note').hidden"));
    assert.equal(await evaluate("document.querySelectorAll('#wc-scenario-rows [data-current=true]').length"),1);
    await click('wc-download');
    const reportPath=path.join(directory,id+'-calculation.txt');
    for(let i=0;i<100&&!fs.existsSync(reportPath);i++)await new Promise(r=>setTimeout(r,50));
    const report=fs.readFileSync(reportPath,'utf8');
    assert.ok(report.includes('illustrative example inputs'));
    assert.ok(report.includes('Alternative scenarios'));
    assert.ok(report.includes(amount));
    const pdf=await send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});
    const pdfPath=path.join(directory,id+'.pdf');fs.writeFileSync(pdfPath,Buffer.from(pdf.data,'base64'));
    const text=execFileSync('pdftotext',[pdfPath,'-'],{encoding:'utf8'});
    assert.ok(text.includes('Inputs')&&text.includes('illustrative example inputs'),`${id} PDF includes assumptions`);
    assert.ok(text.includes('What this calculation assumes'));
    assert.ok(text.includes(amount));
    assert.ok(!text.includes('Try an example')&&!text.includes('Clear this calculator'),'No editor controls in print');
    await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
    assert.ok(await evaluate('document.documentElement.scrollWidth<=390'),`${id} mobile overflow`);
    if(id==='uber')await screenshot('mobile');
    await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false});
  }
  await choose('vinted');
  assert.equal(await evaluate("document.getElementById('wc-price').value"),'25','Switching preserves values');
  await value('wc-after','101');assert.ok(await evaluate("document.getElementById('wc-results').hidden"));
  assert.equal(await evaluate("document.getElementById('wc-after').getAttribute('aria-invalid')"),'true');
  await value('wc-after','35');assert.ok(await evaluate("!document.getElementById('wc-results').hidden"));
  await value('wc-price','');assert.ok(await evaluate("document.getElementById('wc-results').hidden"));
  await value('wc-price','25');
  await value('wc-price','<img src=x onerror=alert(1)>');
  assert.equal(await evaluate("document.querySelectorAll('#wc-fields img').length"),0);
  assert.ok(await evaluate("document.getElementById('wc-results').hidden"));
  await click('wc-example');
  await value('wc-fee','100');assert.ok(await evaluate("document.getElementById('wc-notes').textContent.includes('100%')"));
  await value('wc-currency','GBP');await evaluate("document.getElementById('wc-currency').dispatchEvent(new Event('change'))");
  assert.ok(await evaluate("document.getElementById('wc-net').textContent.includes('GBP')"));
  assert.equal(await evaluate("document.getElementById('wc-fee').value"),'100','Currency must not convert amounts');
  await choose('uber');await value('wc-period','annual');await value('wc-fee','120');
  assert.ok(await evaluate("document.getElementById('wc-metrics').textContent.includes('10.00')"));
  assert.ok(await evaluate("document.getElementById('wc-notes').textContent.includes('upfront')"));
  await screenshot('desktop');
  await value('wc-saving','0');assert.ok(await evaluate("document.getElementById('wc-metrics').textContent.includes('Not available')"));
  await value('wc-orders','1.5');assert.ok(await evaluate("document.getElementById('wc-results').hidden"));
  await click('wc-clear');
  assert.ok(await evaluate("document.getElementById('wc-results').hidden&&document.getElementById('wc-orders').value===''"));
  await choose('etsy');
  assert.equal(await evaluate("document.getElementById('wc-orders').value"),'4','Clear affects only the selected calculator');
  await value('wc-incremental','0');assert.ok((await evaluate("document.getElementById('wc-net').textContent")).includes('-'));
  await choose('fasttrack');await value('wc-fast','40');assert.ok(await evaluate("document.getElementById('wc-notes').textContent.includes('no time')"));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});await screenshot('dark');
  assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);
  assert.equal(requests.length,requestCount,'Calculator operations made a network request');
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await choose('etsy');
  await send('Page.reload');
  await until("document.readyState==='complete'&&document.getElementById('wc-tab-etsy')?.getAttribute('aria-current')==='page'&&document.getElementById('wc-orders')?.value===''");
  assert.equal(await evaluate("document.getElementById('wc-orders').value"),'','Reload clears inputs');
  assert.ok(await evaluate("document.getElementById('wc-results').hidden"));
  assert.deepEqual(errors,[]);
  console.log('PASS: all nine examples, live validation, scenario rows, tab persistence, currency labels, annual billing, impossible thresholds, clear/reload, text reports, printable PDFs, mobile layouts, dark mode, offline operation and no storage/network calls.');
  console.log('Artifacts: '+directory);
})().catch(async e=>{console.error(e);console.error(await evaluate("({url:location.href,ready:document.readyState,title:document.title,value:document.getElementById('wc-orders')?.value,active:document.querySelector('#wc-tabs [aria-current]')?.id,errors:document.getElementById('wc-error')?.textContent})"));console.error(errors);process.exitCode=1;}).finally(()=>{chrome.kill();for(const p of pending.values())clearTimeout(p.timer);});
