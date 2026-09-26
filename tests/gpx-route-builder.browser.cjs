// Dependency-free Chrome smoke test. Start the built site on localhost:8765 first.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'gpx-browser-'));
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
    if (message.method === 'Fetch.requestPaused') { send('Fetch.fulfillRequest', {requestId:message.params.requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'image/png'}],body:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5V8AAAAASUVORK5CYII='}).catch(e=>errors.push(e.message)); }
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
const set = (id,value) => evaluate(`document.getElementById(${JSON.stringify(id)}).value=${JSON.stringify(value)}`);
async function upload(files) {
  const {root}=await send('DOM.getDocument');
  const {nodeId}=await send('DOM.querySelector',{nodeId:root.nodeId,selector:'#gp-files'});
  await send('DOM.setFileInputFiles',{nodeId,files});
  await until("!document.getElementById('gp-import').disabled");
}
(async () => {
  const {targetId}=await send('Target.createTarget',{url:'about:blank'});
  session=(await send('Target.attachToTarget',{targetId,flatten:true})).sessionId;
  await send('Runtime.enable');await send('Page.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1050,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:process.env.TEST_URL || 'http://127.0.0.1:8765/tools/gpx-route-builder/'});
  await until("document.readyState==='complete' && !!window.GPXCore && !!document.querySelector('.leaflet-pane')");
  assert.ok(!requests.some(url=>url.startsWith('http')&&!url.startsWith('http://127.0.0.1:8765')&&!/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(url)), 'External request before consent'); // the page view counter is shell, declared on /privacy/
  await click('gp-demo');
  assert.equal(await evaluate("document.querySelectorAll('#gp-list li').length"),3);
  await until("!!document.querySelector('.leaflet-heatmap-layer')");
  assert.ok(await evaluate("(()=>{const c=document.querySelector('.leaflet-heatmap-layer');return c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0)})()"),'Heatmap must contain visible pixels');
  await evaluate("document.querySelector('#gp-list button').click()");
  assert.equal(await evaluate("document.getElementById('gp-points').textContent"),'81 points');
  await click('gp-undo');assert.equal(await evaluate("document.getElementById('gp-points').textContent"),'0 points');
  await click('gp-redo');assert.equal(await evaluate("document.getElementById('gp-points').textContent"),'81 points');
  await evaluate("document.querySelector('#gp-list input').click()");
  assert.ok(await evaluate("document.getElementById('gp-activity-stats').textContent.startsWith('2 of 3')"));
  await new Promise(r=>setTimeout(r,500));
  const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
  fs.writeFileSync(path.join(directory,'desktop.png'),Buffer.from(shot.data,'base64'));
  await click('gp-clear');
  assert.equal(await evaluate("document.querySelectorAll('#gp-list li').length"),0);
  const xml = '<?xml version="1.0"?><gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>&lt;img src=x onerror=alert(1)&gt; &amp; Track</name><trkseg><trkpt lat="0" lon="0"><ele>0</ele></trkpt><trkpt lat="0" lon="0.01"><ele>20</ele></trkpt></trkseg><trkseg><trkpt lat="40" lon="100"/><trkpt lat="40" lon="100.01"/></trkseg></trk></gpx>';
  const fixture=path.join(directory,'track.gpx');fs.writeFileSync(fixture,xml);
  await upload([fixture]);
  assert.equal(await evaluate("document.querySelectorAll('#gp-list li').length"),1);
  assert.equal(await evaluate("document.querySelectorAll('#gp-list img').length"),0);
  assert.ok(await evaluate("document.querySelector('#gp-list strong').textContent.startsWith('<img')"));
  await evaluate("document.querySelector('#gp-list button').click()");
  assert.equal(await evaluate("document.getElementById('gp-distance').textContent"),'1.96 km');
  assert.equal(await evaluate("document.getElementById('gp-points').textContent"),'4 points · 2 segments');
  await set('gp-name','Roundtrip');
  await send('Browser.setDownloadBehavior',{behavior:'allow',downloadPath:directory},undefined);
  await click('gp-export');
  for(let i=0;i<100&&!fs.existsSync(path.join(directory,'Roundtrip.gpx'));i++)await new Promise(r=>setTimeout(r,50));
  const exported=fs.readFileSync(path.join(directory,'Roundtrip.gpx'),'utf8');
  const parsed=await evaluate(`GPXCore.parse(${JSON.stringify(exported)})`);
  assert.equal(parsed.segments.length,2);assert.equal(parsed.segments[0][0].ele,0);assert.equal(parsed.segments[0][1].ele,20);
  assert.equal(parsed.name,'Roundtrip');
  const invalid=path.join(directory,'invalid.gpx');fs.writeFileSync(invalid,'<gpx><trk>');
  await upload([fixture,invalid]);
  assert.equal(await evaluate("document.querySelectorAll('#gp-list li').length"),1,'Batch must be atomic');
  assert.ok(await evaluate("!document.getElementById('gp-error').hidden"));
  const invalidXMLs=['<!DOCTYPE gpx [<!ENTITY x "test">]><gpx/>','<gpx><trk><trkseg><trkpt lat="90" lon="0"/></trkseg></trk></gpx>','<gpx><wpt lat="0" lon="0"/></gpx>','<gpx><rte><rtept lon="0"/></rte></gpx>'];
  for(const x of invalidXMLs) assert.ok(await evaluate(`(()=>{try{GPXCore.parse(${JSON.stringify(x)});return false}catch(e){return true}})()`));
  assert.ok(await evaluate("(()=>{try{GPXCore.parse('<gpx><rte>'+ '<rtept lat=\"0\" lon=\"0\"/>'.repeat(50001)+'</rte></gpx>');return false}catch(e){return e.message.includes('50,000')}})()"));
  const route10='<gpx:gpx xmlns:gpx="http://www.topografix.com/GPX/1/0" version="1.0"><gpx:rte><gpx:name>Dateline</gpx:name><gpx:rtept lat="0" lon="179.9"/><gpx:rtept lat="0" lon="-179.9"/></gpx:rte></gpx:gpx>';
  const one=await evaluate(`GPXCore.parse(${JSON.stringify(route10)})`);assert.equal(one.name,'Dateline');assert.equal(one.segments[0].length,2);
  const big=path.join(directory,'big.gpx');fs.writeFileSync(big,'<gpx><rte>'+'<rtept lat="0" lon="0"/>'.repeat(501)+'</rte></gpx>');
  await upload([big]);
  assert.ok(await evaluate("document.querySelector('#gp-list li:last-child button').disabled"),'Oversized activity must not be editable');
  const huge=path.join(directory,'too-big.gpx');fs.writeFileSync(huge,' '.repeat(10*1024*1024+1));await upload([huge]);
  assert.ok(await evaluate("document.getElementById('gp-error').textContent.includes('10 MB')"));
  await click('gp-clear');
  await pointForLoop();
  async function pointForLoop(){
    await evaluate("document.querySelector('.gpx-editor details').open=true");
    await set('gp-lat',-33.86);await set('gp-lon',151.21);await evaluate("document.getElementById('gp-coordinates').requestSubmit()");
    await set('gp-lat',-33.861);await set('gp-lon',151.212);await evaluate("document.getElementById('gp-coordinates').requestSubmit()");
    await click('gp-loop');assert.equal(await evaluate("document.getElementById('gp-points').textContent"),'3 points');
    await click('gp-clear');
  }
  await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await evaluate("document.querySelector('.gpx-editor details').open=true");
  async function point(lat,lon){await set('gp-lat',lat);await set('gp-lon',lon);await evaluate("document.getElementById('gp-coordinates').requestSubmit()");}
  await point(-33.86,151.21);await point(-33.861,151.211);
  await click('gp-new-segment');await point(-33.865,151.215);await point(-33.866,151.216);
  assert.equal(await evaluate("document.getElementById('gp-points').textContent"),'4 points · 2 segments');
  assert.ok(await evaluate("document.getElementById('gp-loop').disabled"));
  await click('gp-reverse');await click('gp-undo');await click('gp-redo');
  await click('gp-fit');await click('gp-draw');
  await evaluate("document.getElementById('gp-map').scrollIntoView({block:'center'})");
  await new Promise(r=>setTimeout(r,400));
  const box=await evaluate("(()=>{const r=document.getElementById('gp-map').getBoundingClientRect();return {x:r.x+r.width*.55,y:r.y+r.height*.6}})()");
  await send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x,y:box.y,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x,y:box.y,button:'left',clickCount:1});
  assert.equal(await evaluate("document.getElementById('gp-points').textContent"),'5 points · 2 segments');
  await click('gp-draw');
  const before=await evaluate("document.getElementById('gp-distance').textContent");
  const marker=await evaluate("(()=>{const r=document.querySelector('.gp-handle').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()");
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',...marker});
  await send('Input.dispatchMouseEvent',{type:'mousePressed',...marker,button:'left',clickCount:1});
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:marker.x+50,y:marker.y+30,button:'left',buttons:1});
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:marker.x+50,y:marker.y+30,button:'left',clickCount:1});
  assert.notEqual(await evaluate("document.getElementById('gp-distance').textContent"),before,'Dragging should update the distance');
  await set('gp-name','Offline');await click('gp-export');
  for(let i=0;i<100&&!fs.existsSync(path.join(directory,'Offline.gpx'));i++)await new Promise(r=>setTimeout(r,50));
  assert.ok(fs.existsSync(path.join(directory,'Offline.gpx')));
  assert.equal(await evaluate('localStorage.length+sessionStorage.length'),0);
  assert.ok(!requests.some(url=>url.startsWith('http')&&!url.startsWith('http://127.0.0.1:8765')&&!/^https:\/\/(static\.)?cloudflareinsights\.com\//.test(url)),'File operations sent external requests'); // page view counter is shell
  await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  // Stub optional tiles locally; test consent without contacting OSM in automation.
  await send('Fetch.enable',{patterns:[{urlPattern:'https://tile.openstreetmap.org/*'}]});
  await click('gp-streets');
  await until("!!document.querySelector('.leaflet-control-attribution a[href=\"https://www.openstreetmap.org/copyright\"]')");
  await new Promise(r=>setTimeout(r,300));
  assert.ok(requests.some(url=>url.startsWith('https://tile.openstreetmap.org/')));
  await click('gp-streets');
  assert.ok(await evaluate("!document.querySelector('.leaflet-control-attribution a[href=\"https://www.openstreetmap.org/copyright\"]')"));
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate('window.scrollTo(0,0)');
  assert.ok(await evaluate('document.documentElement.scrollWidth<=390'),'Mobile overflow');
  fs.writeFileSync(path.join(directory,'mobile.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-color-scheme',value:'dark'}]});
  fs.writeFileSync(path.join(directory,'dark.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})).data,'base64'));
  assert.deepEqual(errors,[]);
  console.log('PASS: visible heatmap, activity visibility, copy/undo/redo, segment distances, GPX download/roundtrip, safe names, atomic imports, malformed/oversize GPX rejection, GPX 1.0 namespaces, offline coordinate and map drawing, dragging, tile opt-in and attribution, no storage/uploads, mobile layout.');
  console.log('Artifacts: '+directory);
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{chrome.kill();for(const p of pending.values())clearTimeout(p.timer);});
