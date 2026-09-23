// previous-cache: crm-suministros-v11-34-5-20260923-09
const CACHE="crm-suministros-v11-35-0-20260923-10";

const APP_SHELL=[
  "./","./index.html","./404.html","./manifest.webmanifest","./templates/historical_orders.csv",
  "./assets/js/app-entry.js","./assets/js/main.js","./assets/js/config.js","./assets/js/platform-observability.js","./assets/js/modules/workforce.js","./assets/js/modules/workforce-planner-v11330.js","./assets/js/modules/workforce-today-v11340.js","./assets/js/modules/workforce-time-review-v11340.js","./assets/js/modules/workforce-catalog-v11343.js","./assets/js/modules/workforce-experience-v11344.js","./assets/js/modules/workforce-timeline-v11350.js",
  "./assets/css/core-shell.css","./assets/css/operations.css","./assets/css/analytics.css","./assets/css/experience.css",
  "./assets/runtime-css/guides-layout-v11291.css","./assets/runtime-css/receiving-workspace-v11290.css","./assets/runtime-css/inventory-dialogs-v11260.css","./assets/runtime-css/inventory-visual-v11270.css","./assets/runtime-css/inventory-ui-v11240.css","./assets/runtime-css/inventory-workspace-v11251.css","./assets/runtime-css/workforce-experience-v11344.css","./assets/runtime-css/workforce-timeline-v11350.css",
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