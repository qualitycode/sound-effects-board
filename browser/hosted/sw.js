// The scope is /sb/ only. API responses and admin sessions are never cached.
const CACHE = 'soundboard-shell-__RELEASE__';
const ROOT = new URL('./', self.location.href);
const SHELL = ['', 'index.html', 'styles.css', 'renderer.js', 'script-view.js','script-highlights.js', 'browser-api.js', 'hosted.js'];
const URLS = SHELL.map(name => new URL(name, ROOT).href);
self.addEventListener('install', event => {
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(URLS);
    // No skipWaiting: an existing show keeps its installed application.
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
  // Keep older shells: another complete downloaded performance may need them.
});
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET' || !URLS.includes(event.request.url)) return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    return await cache.match(event.request) || fetch(event.request);
  })());
});
