// previous-cache: crm-suministros-v11-42-0-20260925-36
const CACHE="crm-suministros-v11-43-0-20260925-37";

const APP_SHELL=[
  "./","./index.html","./404.html","./manifest.webmanifest","./templates/historical_orders.csv",
  "./assets/js/app-entry.js","./assets/js/main.js","./assets/js/modules/freight-intelligence-v11410.js","./assets/js/config.js","./assets/js/platform-observability.js","./assets/js/domains/paco/index.js","./assets/js/domains/paco/language/index.js","./assets/js/modules/workforce.js","./assets/js/domains/workforce/index.js","./assets/js/domains/workforce/planner/index.js","./assets/js/domains/workforce/today/index.js","./assets/js/domains/workforce/analytics/time-review.js","./assets/js/domains/workforce/catalog/index.js","./assets/js/domains/workforce/today/experience-styles.js","./assets/js/domains/workforce/timeline/index.js","./assets/js/domains/workforce/evidence/index.js","./assets/js/domains/workforce/calendar/index.js",
  "./assets/css/core-shell.css","./assets/css/operations.css","./assets/css/analytics.css","./assets/css/experience.css",
  "./assets/runtime-css/paco-operational-v11370.css","./assets/runtime-css/guides-layout-v11291.css","./assets/runtime-css/receiving-workspace-v11290.css","./assets/runtime-css/inventory-dialogs-v11260.css","./assets/runtime-css/inventory-visual-v11270.css","./assets/runtime-css/inventory-ui-v11240.css","./assets/runtime-css/inventory-workspace-v11251.css","./assets/runtime-css/workforce-experience-v11344.css","./assets/runtime-css/workforce-timeline-v11350.css","./assets/runtime-css/workforce-calendar-v11360.css",
  "./assets/img/logo-electroingenieria.png","./assets/img/iso-electroingenieria.png","./assets/img/ui/crm-psp-waves-v11180.webp",
  "./assets/img/paco/paco-idle-v11183.svg","./assets/img/paco/paco-listening-v11183.svg","./assets/img/paco/paco-thinking-v11183.svg",
  "./assets/img/paco/paco-wink-v11183.svg","./assets/img/paco/paco-talking-v11183.svg","./assets/img/paco/paco-success-v11183.svg"
];

const CSS_ENTRIES=[
  "./assets/css/core-shell.css",
  "./assets/css/operations.css",
  "./assets/css/analytics.css",
  "./assets/css/experience.css"
];

async function precacheCssTree(cache,entry,seen=new Set()){
  const url=new URL(entry,self.location.href);
  if(seen.has(url.href))return;
  seen.add(url.href);
  let response=await cache.match(url.href,{ignoreSearch:true});
  if(!response){
    response=await fetch(url.href,{cache:"no-store"});
    if(!response.ok)throw new Error(`CSS precache failed: ${url.pathname}`);
    await cache.put(url.href,response.clone());
  }
  const css=await response.clone().text();
  for(const match of css.matchAll(/@import\s+["']([^"']+)["']\s*;/g)){
    const imported=new URL(match[1],url.href);
    if(imported.origin===self.location.origin)await precacheCssTree(cache,imported.href,seen);
  }
}

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(async cache=>{
    await cache.addAll(APP_SHELL);
    const seen=new Set();
    for(const entry of CSS_ENTRIES)await precacheCssTree(cache,entry,seen);
  }).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);if(url.origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{if(response.ok){const clone=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,clone)).catch(()=>{})}return response}).catch(async()=>{const cached=await caches.match(event.request,{ignoreSearch:true});if(cached)return cached;if(event.request.mode==="navigate")return caches.match("./index.html",{ignoreSearch:true});return Response.error()}));
});