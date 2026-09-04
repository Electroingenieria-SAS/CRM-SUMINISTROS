let observer=null;
let scheduled=false;

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    observer?.disconnect();
    enhanceAll();
    observe();
  });
}

function observe(){
  const root=document.querySelector("#modal-root");
  if(root&&observer)observer.observe(root,{childList:true,subtree:true});
}

function enhanceAll(){
  document.querySelectorAll("#modal-root .shipping-process-modal.shipping-workflow-v11102").forEach(enhanceShippingModal);
  document.querySelectorAll("#modal-root .shipping-guide-reader-v11101").forEach(enhanceGuideModal);
  document.querySelectorAll("#modal-root .modal").forEach(enhanceShippingSubdialog);
}

function enhanceShippingModal(modal){
  modal.classList.add("shipping-scale-v11103");
  moveDuplicateAddress(modal);
  modal.querySelectorAll(".modal-task-panel").forEach(panel=>panel.classList.add("shipping-task-panel-v11103"));
}

function moveDuplicateAddress(modal){
  const primary=modal.querySelector(".shipping-primary-task-v11102");
  const address=primary?.querySelector(":scope > .shipping-sales-address");
  if(!address)return;
  const secondary=modal.querySelector(".shipping-secondary-body-v11102");
  if(!secondary)return;
  address.classList.add("shipping-address-detail-v11103");
  secondary.prepend(address);
}

function enhanceGuideModal(modal){
  modal.classList.add("shipping-subdialog-v11103");
}

function enhanceShippingSubdialog(modal){
  if(modal.classList.contains("shipping-process-modal"))return;
  const title=(modal.querySelector(".modal-head h3")?.textContent||"").trim();
  if(!title)return;
  if(/Agregar guía|Reportar no entrega|Solicitar cancelación|Registrar novedad|Registrar reporte|Agregar nota|Enviar solicitud de aprobación|Solucionar y cerrar/i.test(title)){
    modal.classList.add("shipping-subdialog-v11103");
  }
}

function install(){
  enhanceAll();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  observer=new MutationObserver(schedule);
  observe();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
