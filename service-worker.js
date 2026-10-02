// previous-cache: crm-suministros-v11-44-0-20261002-38
const CACHE="crm-suministros-v11-45-0-20261002-39";
const STATIC_REVISION="b892bad4c9c2bd75";
const ASSET_CACHE=CACHE+"-"+STATIC_REVISION;
const PRECACHE_MANIFEST="./assets/precache-manifest.json";

const APP_SHELL=[
  "./","./index.html","./404.html","./manifest.webmanifest","./templates/historical_orders.csv",
  PRECACHE_MANIFEST,
  "./assets/img/logo-electroingenieria.png","./assets/img/iso-electroingenieria.png","./assets/img/ui/crm-psp-waves-v11180.webp",
  "./assets/img/paco/paco-idle-v11183.svg","./assets/img/paco/paco-listening-v11183.svg","./assets/img/paco/paco-thinking-v11183.svg",
  "./assets/img/paco/paco-wink-v11183.svg","./assets/img/paco/paco-talking-v11183.svg","./assets/img/paco/paco-success-v11183.svg"
];

self.addEventListener("install",event=>{
  event.waitUntil(fetch(PRECACHE_MANIFEST,{cache:"no-store"}).then(response=>{
    if(!response.ok)throw new Error("PWA manifest unavailable");
    return response.json();
  }).then(manifest=>{
    if(manifest.revision!==STATIC_REVISION)throw new Error("PWA asset revision mismatch");
    return caches.open(ASSET_CACHE).then(cache=>cache.addAll([...APP_SHELL,...manifest.assets]));
  }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==ASSET_CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);if(url.origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();caches.open(ASSET_CACHE).then(cache=>cache.put(event.request,clone)).catch(()=>{})}return response}).catch(async()=>{const cached=await caches.match(event.request,{ignoreSearch:true});if(cached)return cached;if(event.request.mode==="navigate")return caches.match("./index.html",{ignoreSearch:true});return Response.error()}));
});
