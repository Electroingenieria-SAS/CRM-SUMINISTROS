// previous-cache: crm-suministros-v11-20-0-20260908-09
const CACHE="crm-suministros-v11-21-0-20260908-10";

// Only the deterministic application shell is precached. JavaScript dependencies are
// cached automatically as the canonical app-entry import graph requests them.
const APP_SHELL=[
  "./","./index.html","./404.html","./manifest.webmanifest","./templates/historical_orders.csv",
  "./assets/js/app-entry.js","./assets/js/main.js","./assets/js/config.js",
  "./assets/css/app.css","./assets/css/operational-v112.css","./assets/css/guides-v113.css","./assets/css/workforce-taxonomy-v113.css",
  "./assets/css/receiving-v115.css","./assets/css/receiving-guide-v115.css","./assets/css/inventory-scan-v116.css","./assets/css/inventory-core-v11110.css",
  "./assets/css/v118.css","./assets/css/audit-v1182.css","./assets/css/audit-v1183.css","./assets/css/ui-v1184.css","./assets/css/dashboard-v1185.css",
  "./assets/css/commercial-v1187.css","./assets/css/commercial-v1188.css","./assets/css/operational-lists-v1189.css","./assets/css/popup-ux-v1190.css",
  "./assets/css/order-create-v1191.css","./assets/css/receiving-order-v1192.css","./assets/css/receiving-focus-v1193.css","./assets/css/receiving-polish-v1194.css",
  "./assets/css/picking-focus-v1195.css","./assets/css/picking-legibility-v1196.css","./assets/css/picking-review-v1197.css",
  "./assets/css/billing-focus-v1198.css","./assets/css/billing-upload-v1199.css","./assets/css/billing-invoice-reader-v1199.css","./assets/css/global-progress-v11100.css",
  "./assets/css/shipping-guide-reader-v11101.css","./assets/css/shipping-core-v11107.css","./assets/css/sent-orders-v11108.css",
  "./assets/css/flow-times-core-v11120.css","./assets/css/flow-performance-v11130.css","./assets/css/reports-enterprise-v11140.css",
  "./assets/css/history-center-v11150.css","./assets/css/admin-center-v11160.css","./assets/css/cutting-center-v11170.css",
  "./assets/css/workspace-atmosphere-v11200.css","./assets/css/responsive-foundation-v11190.css","./assets/css/paco-assistant-v11200.css",
  "./assets/img/logo-electroingenieria.png","./assets/img/iso-electroingenieria.png","./assets/img/ui/crm-psp-waves-v11180.webp",
  "./assets/img/paco/paco-idle-v11183.svg","./assets/img/paco/paco-listening-v11183.svg","./assets/img/paco/paco-thinking-v11183.svg",
  "./assets/img/paco/paco-wink-v11183.svg","./assets/img/paco/paco-talking-v11183.svg","./assets/img/paco/paco-success-v11183.svg"
];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting()));
});

self.addEventListener("activate",event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;

  event.respondWith(
    fetch(event.request)
      .then(response=>{
        if(response.ok){
          const clone=response.clone();
          caches.open(CACHE).then(cache=>cache.put(event.request,clone)).catch(()=>{});
        }
        return response;
      })
      .catch(async()=>{
        const cached=await caches.match(event.request,{ignoreSearch:true});
        if(cached)return cached;
        if(event.request.mode==="navigate")return caches.match("./index.html",{ignoreSearch:true});
        return Response.error();
      })
  );
});
