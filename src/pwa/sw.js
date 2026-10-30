// Network first, so the app always opens with the latest version and its updates; the cached copy is only used offline.
const C="cdesk-v1";
self.addEventListener("install",e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(["./","./manifest.webmanifest","./icon-192.png","./apple-touch-icon.png"])).catch(()=>{}));});
self.addEventListener("activate",e=>{e.waitUntil(self.clients.claim());});
self.addEventListener("fetch",e=>{const r=e.request;if(r.method!=="GET")return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  e.respondWith(fetch(r,{cache:"no-store"}).then(res=>{if(res.ok&&!u.pathname.includes("/data/")){const cp=res.clone();caches.open(C).then(c=>c.put(r,cp));}return res;})
    .catch(()=>caches.match(r,{ignoreSearch:true}).then(m=>m||caches.match("./"))));});
