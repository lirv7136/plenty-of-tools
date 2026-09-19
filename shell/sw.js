/* Plenty of Tools service worker. A template: build.py stamps the build id below.

   One cache per build, named pot-app-<build>. build.py also writes dist/offline-manifest.json,
   which lists every tool that opted in with "offline": true in tools.json, each together with
   its own versioned asset URLs. Caching a page and the code it loads as one unit per build is
   what keeps them consistent: Cloudflare Pages ignores the query string when it serves a file,
   so an old /assets/x.js?v=<old hash> URL returns the CURRENT file, and a cache keyed on
   versioned URLs alone would drift out of step with the page that asked for them.

   The build id is a hash of the contents of every precached file, so any change to any of them
   changes this file, which is what makes the browser install a new cache and drop the old one.

   Deliberately NOT cached: anything the manifest does not list. Tool workers, wasm, the Whisper
   model on huggingface.co, its own pot-transcription-* cache and OpenStreetMap tiles all go
   straight to the network, untouched. Keep the precache small; the build prints its size. */
const BUILD = '{{build}}';
const CACHE = 'pot-app-' + BUILD;
const OFFLINE = '/offline'; // Pages redirects /offline.html here, and a redirected response cannot serve a navigation

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    let urls = [OFFLINE];
    try {
      const manifest = await (await fetch('/offline-manifest.json', { cache: 'reload' })).json();
      if (manifest.build === BUILD) {
        for (const group of Object.values(manifest.pages)) urls = urls.concat(group);
      } else {
        console.warn('[pot] offline manifest is build', manifest.build, 'but this worker is', BUILD, '- caching the offline page only');
      }
    } catch (e) {
      console.warn('[pot] offline manifest unavailable, caching the offline page only', e);
    }
    // Added one at a time on purpose: a single missing file must not abort the whole install.
    const failed = [];
    await Promise.all([...new Set(urls)].map(u =>
      cache.add(new Request(u, { cache: 'reload' })).catch(() => failed.push(u))));
    if (failed.length) console.warn('[pot] not precached:', failed);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    // Only our own caches: the transcription tool owns pot-transcription-* and must keep it.
    await Promise.all(keys
      .filter(k => (k.startsWith('pot-app-') || k.startsWith('pot-offline-')) && k !== CACHE)
      .map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== self.location.origin) return; // Hugging Face, OpenStreetMap and friends are untouched

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (e) {
        const cache = await caches.open(CACHE);
        // ignoreSearch so a link carrying a query still finds the page; a hash never reaches here
        const hit = await cache.match(url.pathname, { ignoreSearch: true, ignoreVary: true });
        return hit || await cache.match(OFFLINE, { ignoreVary: true }) ||
          new Response('You are offline.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      }
    })());
    return;
  }

  // Only the versioned asset URLs this build precached are served from the cache. The test is
  // synchronous on purpose: every other request returns without respondWith and is left alone.
  if (!url.pathname.startsWith('/assets/') || !url.search.startsWith('?v=')) return;
  event.respondWith(
    caches.open(CACHE)
      .then(c => c.match(req, { ignoreVary: true }))
      .then(hit => hit || fetch(req))
      .catch(() => fetch(req)));
});
