// previous-cache: crm-suministros-v11-46-1-20261016-41
const CACHE="crm-suministros-v11-46-3-20261016-43";
const STATIC_REVISION="0f89fc300bccf2b6";
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
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==ASSET_CACHE).map(key=>cac