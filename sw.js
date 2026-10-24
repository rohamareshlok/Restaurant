/* Opens the app instantly from the copy on the phone, then quietly fetches the newest version for next time.
   The Firebase code and fonts are kept on the phone too, so nothing waits for slow internet. */
const C='rest-v4';
const SHELL=['./','index.html','config.js','shim-classic.js','shim-firebase.js','manifest.json','icon-192-v2.png','icon-512-v2.png','favicon-32-v2.png','apple-touch-icon-v2.png'];
const KEEP_HOSTS=['www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com','cdnjs.cloudflare.com'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
async function tell(msg){(await self.clients.matchAll({type:'window'})).forEach(c=>c.postMessage(msg))}
async function refresh(req,key){
  try{const r=await fetch(req,{cache:'no-cache'});if(!r||!r.ok)return;const c=await caches.open(C);
    if(key==='index.html'){const old=await c.match(key);const nt=await r.clone().text();const ot=old?await old.text():null;await c.put(key,r);if(ot!==null&&ot!==nt)tell('updated')}
    else await c.put(key||req,r)}catch(e){}
}
self.addEventListener('fetch',e=>{
  const req=e.request;if(req.method!=='GET')return;const u=new URL(req.url);
  if(u.origin===location.origin){
    const isPage=req.mode==='navigate'||u.pathname.endsWith('/')||u.pathname.endsWith('/index.html');
    const key=isPage?'index.html':req;
    e.respondWith(caches.open(C).then(c=>c.match(key,{ignoreSearch:isPage})).then(hit=>{
      const upd=refresh(isPage?new Request('index.html'):req,key);
      if(hit){e.waitUntil(upd);return hit}
      return fetch(req).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(key,cp));return r}).catch(()=>caches.match('index.html'))}));
    return;
  }
  if(KEEP_HOSTS.includes(u.hostname)){
    e.respondWith(caches.open(C).then(c=>c.match(req).then(hit=>hit||fetch(req).then(r=>{if(r&&(r.ok||r.type==='opaque'))c.put(req,r.clone());return r}))));
  }
});
