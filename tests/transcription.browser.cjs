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
