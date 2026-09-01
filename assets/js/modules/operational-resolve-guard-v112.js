/*
 * V11.2 · Guardia de compatibilidad para acciones RESOLVE.
 *
 * Recepción de mercancía y Facturación conservan el mismo botón y el mismo
 * flujo del pedido. La capa V11.2 atiende ese botón desde delegación global;
 * por ello retiramos únicamente el listener legado del botón cuando el modal
 * corresponde a esas dos etapas. No altera otros procesos ni sus acciones.
 */
let installed=false;

function normalize(value=""){
  return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
}

function guardResolveButton(root=document){
  root.querySelectorAll?.(".simple-process-modal[data-order-id]").forEach(modal=>{
    const context=normalize(modal.querySelector(".simple-process-head p")?.textContent||"");
    const managed=context.includes("recepcion de mercancia")||context.includes("facturacion");
    if(!managed)return;
    const button=modal.querySelector("[data-next-action='RESOLVE']");
    if(!button||button.dataset.v112ResolveGuarded==="1")return;
    const clean=button.cloneNode(true);
    clean.dataset.v112ResolveGuarded="1";
    button.replaceWith(clean);
  });
}

export function installOperationalResolveGuard(){
  if(installed)return;
  installed=true;
  const modalRoot=document.querySelector("#modal-root");
  if(!modalRoot)return;
  const observer=new MutationObserver(()=>guardResolveButton(modalRoot));
  observer.observe(modalRoot,{childList:true,subtree:true});
  guardResolveButton(modalRoot);
}
