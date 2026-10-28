let registrationScheduled=false;
const VERSION_KEY="crm-suministros-web-revision";
const CHECK_INTERVAL_MS=180000;
let checkPromise=null;
let updateVisible=false;

export async function fetchPublishedRevision(){
  const response=await fetch("./assets/precache-manifest.json?updateCheck="+Date.now(),{cache:"no-store"});
  if(!response.ok)throw new Error("No se pudo consultar la versión publicada");
  const manifest=await response.json();
  if(typeof manifest.revision!=="string"||!/^[a-f0-9]{12,64}$/i.test(manifest.revision))throw new Error("Versión inválida");
  return manifest.revision;
}

export async function reloadWithFreshAssets(revision){
  const serviceWorker=navigator.serviceWorker;
  if(serviceWorker?.getRegistrations){
    const regs=await serviceWorker.getRegistrations();
    // Desregistrar antes de recargar impide que un SW obsoleto responda con contenido antiguo.
    await Promise.allSettled(regs.map(reg=>reg.unregister()));
  }
  if(typeof caches!=="undefined"){
    const keys=await caches.keys();
    await Promise.allSettled(keys.filter(k=>k.startsWith("crm-suministros-")).map(k=>caches.delete(k)));
  }
  localStorage.setItem(VERSION_KEY,revision);
  const url=new URL(location.href);
  url.searchParams.set("actualizacion",String(Date.now()));
  location.replace(url.toString());
}

function showUpdateDialog(revision){
  if(updateVisible||typeof document==="undefined")return;
  const shell=document.createElement("dialog");
  shell.className="crm-update-dialog";
  shell.setAttribute("aria-labelledby","crm-update-title");
  shell.innerHTML=`<div class="crm-update-mark" aria-hidden="true">↻</div>
    <h2 id="crm-update-title">Actualización disponible</h2>
    <p>Hay mejoras recientes del CRM, incluidas las vistas móviles. Guarda los cambios que estés realizando antes de actualizar.</p>
    <div class="crm-update-actions"><button type="button" data-crm-update-later>Más tarde</button>
      <button type="button" class="is-primary" data-crm-update-now>Actualizar aplicación</button></div>`;
  document.body.appendChild(shell);
  updateVisible=true;
  const dispose=()=>{updateVisible=false;shell.close();shell.remove();};
  shell.querySelector("[data-crm-update-later]").addEventListener("click",dispose,{once:true});
  shell.addEventListener("cancel",event=>{event.preventDefault();dispose();},{once:true});
  shell.querySelector("[data-crm-update-now]").addEventListener("click",async()=>{
    const btn=shell.querySelector("[data-crm-update-now]");
    btn.disabled=true;btn.textContent="Actualizando…";
    try{await reloadWithFreshAssets(revision);}
    catch(error){
      btn.disabled=false;btn.textContent="Reintentar";
      shell.querySelector("p").textContent="No fue posible limpiar la caché. Comprueba tu conexión e inténtalo nuevamente.";
      console.warn("No se completó la actualización del CRM",error);
    }
  });
  if(typeof shell.showModal==="function")shell.showModal();
  else shell.setAttribute("open","");
}

export function checkForAppUpdates(){
  if(typeof document==="undefined"||document.hidden||checkPromise)return checkPromise||Promise.resolve();
  checkPromise=fetchPublishedRevision().then(revision=>{
    const installed=localStorage.getItem(VERSION_KEY);
    if(!installed){localStorage.setItem(VERSION_KEY,revision);return;}
    if(revision!==installed)showUpdateDialog(revision);
  }).catch(error=>console.warn("Verificación de actualizaciones pendiente",error))
    .finally(()=>{checkPromise=null;});
  return checkPromise;
}

export function registerServiceWorker(){
  if(registrationScheduled||!("serviceWorker" in navigator))return;
  registrationScheduled=true;
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./service-worker.js")
      .catch(error=>console.warn("Service Worker no disponible",error));
    if(typeof document==="undefined")return;
    checkForAppUpdates();
    window.setInterval?.(checkForAppUpdates,CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange",()=>{
      if(!document.hidden)checkForAppUpdates();
    });
    navigator.serviceWorker.addEventListener?.("controllerchange",checkForAppUpdates);
  },{once:true});
}

