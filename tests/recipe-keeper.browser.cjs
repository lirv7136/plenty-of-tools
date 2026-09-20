/* Recipe Keeper in a real browser. Run after a build:
     node tests/recipe-keeper.browser.cjs
   The parsing and the arithmetic are covered by tests/recipe-keeper.test.cjs. This covers
   the page: the sample, scaling, pasting a recipe, the week plan driving the shopping list,
   persistence across a reload, and the phone layout. */
const { spawn } = require('node:child_process');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const DIST = path.join(__dirname, '..', 'dist');
const PORT = 8774;
const BASE = `http://127.0.0.1:${PORT}`;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.ico': 'image/vnd.microsoft.icon', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, BASE).pathname);
  let file = pathname === '/offline' ? path.join(DIST, 'offline.html')
    : pathname.endsWith('/') ? path.join(DIST, pathname, 'index.html') : path.join(DIST, pathname);
  const ok = file.startsWith(DIST) && fs.existsSync(file) && fs.statSync(file).isFile();
  if (!ok) file = path.join(DIST, '404.html');
  res.writeHead(ok ? 200 : 404, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pot-recipes-'));
const chrome = spawn(process.env.CHROME_BIN || 'google-chrome',
  ['--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-first-run',
    '--no-default-browser-check', '--remote-debugging-pipe', `--user-data-dir=${profile}/p`],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });

let buffer = '', sequence = 0, session, stderr = '';
const pending = new Map(), exceptions = [];
chrome.stderr.on('data', c => { stderr += c; });
chrome.stdio[4].on('data', chunk => {
  buffer += chunk.toString();
  let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end));
    buffer = buffer.slice(end + 1);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject, timer } = pending.get(message.id);
      clearTimeout(timer); pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') exceptions.push(message.params.exceptionDetails);
    if (message.method === 'Page.javascriptDialogOpening') {
      send('Page.handleJavaScriptDialog', { accept: dialogAccept }).catch(() => {});
    }
  }
});
let dialogAccept = true;
function send(method, params = {}, target = session) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} timed out. ${stderr.slice(-600)}`)); }, 20000);
    pending.set(id, { resolve, reject, timer });
    chrome.stdio[3].write(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }) + '\0');
  });
}
async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
  return r.result.value;
}
async function until(expression, label) {
  for (let i = 0; i < 200; i++) { if (await evaluate(expression)) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('Timed out waiting for ' + (label || expression));
}
const metrics = (width, height, mobile) => send('Emulation.setDeviceMetricsOverride',
  { width, height, deviceScaleFactor: 1, mobile: !!mobile });
async function go(url) { await send('Page.navigate', { url }); await until("document.readyState==='complete'"); }
const ok = m => console.log('  ok  ' + m);

(async () => {
  assert.ok(fs.existsSync(path.join(DIST, 'tools', 'recipe-keeper', 'index.html')), 'run python3 build.py first');
  await new Promise(r => server.listen(PORT, '127.0.0.1', r));
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' }, null);
  session = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
  await send('Page.enable'); await send('Runtime.enable');

  await metrics(1280, 900, false);
  await go(`${BASE}/tools/recipe-keeper/`);
  await until('!!window.RecipeCore && !!window.__recipes', 'the tool to start');
  assert.equal(await evaluate("document.getElementById('rk-summary').textContent"), 'No recipes yet.');
  assert.equal(await evaluate("document.getElementById('rk-detail').hidden"), true);
  ok('loads empty');

  // ---- the sample ----
  await evaluate("document.getElementById('rk-sample').click()");
  await until("document.querySelectorAll('#rk-list li').length === 3");
  assert.match(await evaluate("document.getElementById('rk-summary').textContent"), /^3 recipes/);
  assert.equal(await evaluate("document.getElementById('rk-detail-title').textContent"), 'Weekend pancakes');
  ok('the sample loads three recipes and opens one');

  const ings = await evaluate("Array.from(document.querySelectorAll('#rk-ings li')).map(l=>l.textContent)");
  assert.ok(ings.includes('2 cups plain flour'), `expected plain flour, got ${JSON.stringify(ings)}`);
  assert.ok(ings.some(i => /1 1\/2 cups milk/.test(i)), 'a mixed fraction reads as a fraction');
  assert.ok(ings.some(i => /1 pinch salt/.test(i)), 'a pinch of salt is one pinch');
  assert.ok(ings.some(i => /50 g butter, melted/.test(i)), 'the note survives');
  ok('ingredients read the way a cook writes them');

  // ---- scaling ----
  await evaluate("(() => { const s = document.getElementById('rk-servings'); s.value = '2'; s.dispatchEvent(new Event('input')); })()");
  const halved = await evaluate("Array.from(document.querySelectorAll('#rk-ings li')).map(l=>l.textContent)");
  assert.ok(halved.includes('1 cup plain flour'), `halving two cups gives one, got ${JSON.stringify(halved)}`);
  assert.ok(halved.some(i => /3\/4 cups? milk/.test(i)), 'one and a half cups halves to three quarters');
  assert.ok(halved.some(i => /25 g butter/.test(i)));
  assert.ok(halved.includes('1 egg'), `halving two eggs should read "1 egg", got ${JSON.stringify(halved)}`);
  assert.equal(await evaluate("document.getElementById('rk-servings-unit').textContent"), 'servings');

  await evaluate("(() => { const s = document.getElementById('rk-servings'); s.value = '8'; s.dispatchEvent(new Event('input')); })()");
  const doubled = await evaluate("Array.from(document.querySelectorAll('#rk-ings li')).map(l=>l.textContent)");
  assert.ok(doubled.includes('4 cups plain flour'));
  assert.ok(doubled.some(i => /3 cups milk/.test(i)));
  ok('scaling the servings rescales every quantity');

  // ---- the week plan drives the shopping list ----
  const shop = await evaluate("Array.from(document.querySelectorAll('#rk-shop-list .text')).map(t=>t.childNodes[0].textContent)");
  assert.ok(shop.length > 5, `the sample plan should fill a list, got ${JSON.stringify(shop)}`);
  assert.ok(shop.some(s => /^4 pinches salt$/.test(s)),
    `salt from three planned meals should add up, got ${JSON.stringify(shop)}`);
  assert.ok(shop.some(s => /spaghetti/.test(s)));
  assert.ok(shop.some(s => /tomatoes/.test(s)));
  const sorted = shop.slice().sort((a, b) => a.localeCompare(b));
  ok('the week plan adds up into a shopping list');

  const from = await evaluate("Array.from(document.querySelectorAll('#rk-shop-list .from')).map(t=>t.textContent).filter(Boolean)");
  assert.ok(from.some(f => f.includes(',')), 'an ingredient wanted by two recipes names both');
  ok('the list says which recipes wanted each thing');

  // planning another meal changes the list
  const before = await evaluate("document.querySelectorAll('#rk-shop-list li').length");
  await evaluate(`(() => {
    const sel = document.querySelector('#rk-plan tbody tr:nth-child(2) td:nth-child(4) select');
    sel.value = Array.from(sel.options).find(o => o.textContent === 'Roast tomato soup').value;
    sel.dispatchEvent(new Event('change'));
  })()`);
  const soupTwice = await evaluate("Array.from(document.querySelectorAll('#rk-shop-list .text')).map(t=>t.childNodes[0].textContent)");
  assert.ok(soupTwice.some(s => /^2 kg tomatoes/.test(s)), `planning the soup twice should double the tomatoes, got ${JSON.stringify(soupTwice)}`);
  ok('planning a meal twice doubles its ingredients');

  // ---- ticking survives a reload ----
  await evaluate("document.querySelector('#rk-shop-list input[type=checkbox]').click()");
  await go(`${BASE}/tools/recipe-keeper/`);
  await until('!!window.__recipes');
  await until("document.querySelectorAll('#rk-list li').length === 3", 'the recipes to come back');
  assert.equal(await evaluate("document.querySelectorAll('#rk-shop-list input:checked').length"), 1,
    'a ticked item stays ticked after a reload');
  ok('recipes, the plan and the ticks all survive a reload');

  // ---- pasting a recipe ----
  await evaluate("document.getElementById('rk-paste-open').click()");
  await evaluate(`(() => {
    document.getElementById('rk-paste-text').value = [
      'Lemon drizzle loaf',
      'Ingredients',
      '225 g butter, softened',
      '4 eggs',
      '1 1/2 cups caster sugar',
      'Method',
      '1. Cream the butter and sugar together until it is pale and holds a ribbon.',
      '2. Beat in the eggs one at a time, then fold in the flour and bake for fifty minutes.'
    ].join(String.fromCharCode(10));
    document.getElementById('rk-paste-go').click();
  })()`);
  await until("document.getElementById('rk-editor').hidden === false", 'the editor to open');
  assert.equal(await evaluate("document.getElementById('rk-title').value"), 'Lemon drizzle loaf');
  const pastedIngredients = await evaluate("document.getElementById('rk-ingredients').value");
  assert.match(pastedIngredients, /225 g butter, softened/);
  assert.equal(pastedIngredients.split('\n').length, 3, 'three ingredients, and no method lines among them');
  const pastedSteps = await evaluate("document.getElementById('rk-steps-input').value");
  assert.match(pastedSteps, /^Cream the butter/, 'the step number is stripped');
  assert.equal(pastedSteps.split('\n').length, 2);
  ok('pasting a recipe separates the ingredients from the method');

  await evaluate("document.getElementById('rk-form').requestSubmit()");
  await until("document.querySelectorAll('#rk-list li').length === 4", 'the pasted recipe to be saved');
  assert.equal(await evaluate("document.getElementById('rk-detail-title').textContent"), 'Lemon drizzle loaf');
  ok('the pasted recipe saves and opens');

  // ---- a recipe that will not validate is refused ----
  await evaluate("document.getElementById('rk-new').click()");
  await evaluate("document.getElementById('rk-form').requestSubmit()");
  assert.equal(await evaluate("document.getElementById('rk-error').hidden"), false);
  assert.match(await evaluate("document.getElementById('rk-error').textContent"), /name/);
  assert.equal(await evaluate("document.querySelectorAll('#rk-list li').length"), 4, 'nothing was added');
  await evaluate("document.getElementById('rk-cancel').click()");
  ok('an incomplete recipe is refused and adds nothing');

  // ---- search ----
  await evaluate("(() => { const s = document.getElementById('rk-search'); s.value = 'garlic'; s.dispatchEvent(new Event('input')); })()");
  await until("document.querySelectorAll('#rk-list li').length === 2", 'search to narrow the list');
  const found = await evaluate("Array.from(document.querySelectorAll('#rk-list .name')).map(n=>n.textContent)");
  assert.ok(found.some(n => /pasta/i.test(n)), 'the recipe with garlic in its name');
  assert.ok(found.some(n => /soup/i.test(n)),
    'and the soup, whose name says nothing about garlic but whose ingredients do');
  await evaluate("(() => { const s = document.getElementById('rk-search'); s.value = ''; s.dispatchEvent(new Event('input')); })()");
  await until("document.querySelectorAll('#rk-list li').length === 4");
  ok('search matches on ingredients, not just names');

  // ---- export and import round trip ----
  const roundTrip = await evaluate(`(() => {
    const json = RecipeCore.exportJson(window.__recipes.state);
    const back = RecipeCore.importJson(json);
    return { count: back.recipes.length, error: back.error || null,
             planned: RecipeCore.planEntries(back.plan).length };
  })()`);
  assert.equal(roundTrip.error, null);
  assert.equal(roundTrip.count, 4);
  assert.ok(roundTrip.planned >= 3, 'the week plan comes back with the recipes');
  ok('a file round trip keeps the recipes and the plan');

  // ---- phone layout ----
  await metrics(390, 844, true);
  await go(`${BASE}/tools/recipe-keeper/`);
  await until('!!window.__recipes');
  await until("document.querySelectorAll('#rk-list li').length === 4");
  const scrolledBy = await evaluate("(() => { window.scrollTo(9999, 0); const x = window.scrollX; window.scrollTo(0,0); return x; })()");
  assert.equal(scrolledBy, 0, `the page moved sideways by ${scrolledBy}px at 390 px`);
  const planScrolls = await evaluate("(() => { const s = document.querySelector('.rk-scroll'); return s.scrollWidth > s.clientWidth; })()");
  assert.equal(planScrolls, true, 'the week table scrolls inside itself rather than widening the page');
  const columns = await evaluate("getComputedStyle(document.querySelector('.rk-grid')).gridTemplateColumns.split(' ').length");
  assert.equal(columns, 1, 'the layout stacks to one column');
  ok('no sideways scroll at 390 px, the week table scrolls inside itself, the layout stacks');

  assert.deepEqual(exceptions.map(e => e.text), [], 'the console must be clean');
  ok('no uncaught exceptions');

  console.log('\nAll recipe keeper browser checks passed.');
})().catch(e => {
  console.error('\nFAIL:', e && e.message ? e.message : e);
  if (exceptions.length) console.error(exceptions);
  process.exitCode = 1;
}).finally(async () => {
  server.close();
  chrome.kill();
  for (const p of pending.values()) clearTimeout(p.timer);
  for (let i = 0; i < 25; i++) {
    try { fs.rmSync(profile, { recursive: true, force: true }); break; }
    catch (e) { await new Promise(r => setTimeout(r, 100)); }
  }
});
