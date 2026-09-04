const CACHE="crm-suministros-v11-9-4-20260904";
const ASSETS=[
  "./","./index.html","./manifest.webmanifest","./templates/historical_orders.csv",
  "./assets/css/app.css","./assets/css/operational-v112.css","./assets/css/guides-v113.css","./assets/css/workforce-taxonomy-v113.css","./assets/css/receiving-v115.css","./assets/css/receiving-guide-v115.css","./assets/css/inventory-scan-v116.css","./assets/css/v118.css","./assets/css/audit-v1182.css","./assets/css/audit-v1183.css","./assets/css/ui-v1184.css","./assets/css/dashboard-v1185.css","./assets/css/commercial-v1187.css","./assets/css/commercial-v1188.css","./assets/css/operational-lists-v1189.css","./assets/css/popup-ux-v1190.css","./assets/css/order-create-v1191.css","./assets/css/receiving-order-v1192.css","./assets/css/receiving-focus-v1193.css","./assets/css/receiving-polish-v1194.css",
  "./assets/img/logo-electroingenieria.png","./assets/img/iso-electroingenieria.png",
  "./assets/js/main.js","./assets/js/config.js","./assets/js/core/icons.js","./assets/js/core/layout.js","./assets/js/core/format.js","./assets/js/core/ui.js",
  "./assets/js/modules/active-work.js","./assets/js/modules/work-clock.js","./assets/js/modules/workforce.js","./assets/js/modules/dashboard.js",
  "./assets/js/modules/operational-v112.js","./assets/js/modules/operational-resolve-guard-v112.js",
  "./assets/js/modules/guides-v113.js","./assets/js/modules/activity-browser-v113.js","./assets/js/modules/workforce-taxonomy-v113.js","./assets/js/modules/bootstrap-v113.js",
  "./assets/js/modules/accessibility-v114.js","./assets/js/modules/receiving-hub-v115.js","./assets/js/modules/receiving-guide-v115.js","./assets/js/modules/inventory-scan-v116.js","./assets/js/modules/inventory-scan-bootstrap-v116.js","./assets/js/modules/order-priority-v117.js","./assets/js/modules/pagination-v1184.js","./assets/js/modules/commercial-v1187.js","./assets/js/modules/commercial-records-v1188.js","./assets/js/modules/popup-ux-v1190.js","./assets/js/modules/order-create-v1191.js","./assets/js/modules/receiving-order-v1192.js","./assets/js/modules/receiving-focus-v1193.js","./assets/js/modules/receiving-polish-v1194.js",
  "./assets/js/modules/order-cancellation.js","./assets/js/modules/support-flow.js",
  "./assets/js/modules/receiving-order.js","./assets/js/modules/financial-flow.js","./assets/js/modules/picking-flow.js",
  "./assets/js/modules/cutting-flow.js","./assets/js/modules/shipping-flow.js","./assets/js/modules/queue.js",
  "./assets/js/modules/orders.js","./assets/js/modules/credit.js","./assets/js/modules/inventory.js","./assets/js/modules/audit.js","./assets/js/services/api.js",
  "./assets/js/services/supabase.js","./assets/js/services/materials.js","./assets/js/services/drive.js",
  "./assets/js/services/location.js","./assets/js/services/pdf-order-reader.js"
];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET"||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{const clone=response.clone();caches.open(CACHE).then(c=>c.put(event.request,clone));return response}).catch(async()=>{const cached=await caches.match(event.request);if(cached)return cached;if(event.request.mode==="navigate")return caches.match("./index.html");return Response.error();}));
});