/* Keeps the app opening fast and when the internet is weak; always tries the newest version first. */
const C='rest-v3';const FILES=['./','index.html','config.js','shim-classic.js','shim-firebase.js','manifest.json','icon-192-v2.png','icon-512-v2.png','favicon-32-v2.png','apple-touch-icon-v2.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(FILES)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
  e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request)))});
