let registrationScheduled=false;

export function registerServiceWorker(){
  if(registrationScheduled||!("serviceWorker" in navigator))return;
  registrationScheduled=true;
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("./service-worker.js")
      .catch(error=>console.warn("Service Worker no disponible",error));
  },{once:true});
}
