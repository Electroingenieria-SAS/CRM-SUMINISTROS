// previous-cache: crm-suministros-v11-25-3-20260909-08
const CACHE="crm-suministros-v11-26-0-20260910-01";

const APP_SHELL=[
  "./","./index.html","./404.html","./manifest.webmanifest","./templates/historical_orders.csv",
  "./assets/js/app-entry.js","./assets/js/main.js","./assets/js/config.js",
  "./assets/css/core-shell.css","./assets/css/operations.css","./assets/css/analytics.css","./assets/css/experience.css",
  "./assets/img/logo-electroingenieria.png","./assets/img/iso-electroingenieria.png","./assets/img/ui/crm-psp-waves-v11180.webp",
  "./assets/img/paco/paco-idle-v11183.svg","./assets/img/paco/paco-listening-v11183.svg","./assets/img/paco/paco-thinking-v11183.svg",
  "./assets/img/paco/paco-wink-v11183.svg","./assets/img/paco/paco-talking-v11183.svg","./assets/img/paco/paco-success-v11183.svg"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);if(url.origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone)).catch(()=>{})}return response}).catch(async()=>{const cached=await caches.match(event.request,{ignoreSearch:true});if(cached)return cached;if(event.request.mode==="navigate")return caches.match("./index.html",{ignoreSearch:true});return Response.error()}));
});