let observer=null;
let scheduled=false;
const desktop=window.matchMedia("(min-width:901px)");

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
  if(root&&observer)observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:["class","disabled"]});
}

function enhanceAll(){
  document.querySelectorAll("#modal-root .shipping-process-modal.shipping-workflow-v11102").forEach(enhanceShippingModal);
  document.querySelectorAll("#modal-root .shipping-guide-reader-v11101").forEach(enhanceGuideModal);
  document.querySelectorAll("#modal-root .modal").forEach(enhanceShippingSubdialog);
}

function enhanceShippingModal(modal){
  modal.classList.add("shipping-scale-v11103");
  applyMainDimensions(modal);
  moveDuplicateAddress(modal);
  simplifyFooter(modal);
  moveCancellationToSecondary(modal);
  modal.querySelectorAll(".modal-task-panel").forEach(panel=>panel.classList.add("shipping-task-panel-v11103"));
}

function applyMainDimensions(modal){
  if(desktop.matches){
    modal.style.setProperty("width","min(1400px, calc(100vw - 56px))","important");
    modal.style.setProperty("max-width","1400px","important");
    modal.style.setProperty("height","min(900px, calc(100dvh - 28px))","important");
    modal.style.setProperty("max-height","calc(100dvh - 28px)","important");
  }else{
    ["width","max-width","height","max-height"].forEach(prop=>modal.style.removeProperty(prop));
  }
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

function simplifyFooter(modal){
  const note=modal.querySelector(".parallel-work-note");
  if(!note)return;
  const strong=note.querySelector("strong");
  const small=note.querySelector("small");
  if(strong)strong.textContent="Trabajo en paralelo";
  if(small)small.textContent="El pedido permanece asignado mientras continúas.";
}

function moveCancellationToSecondary(modal){
  const footer=modal.querySelector(".parallel-work-footer");
  const cancel=footer?.querySelector("[data-request-order-cancellation]");
  const target=modal.querySelector(".shipping-secondary-body-v11102");
  if(!cancel||!target)return;
  let row=target.querySelector(".shipping-secondary-actions-v11102");
  if(!row){
    row=document.createElement("div");
    row.className="shipping-secondary-actions-v11102";
    target.prepend(row);
  }
  cancel.classList.add("shipping-cancellation-secondary-v11102");
  row.append(cancel);
}

function enhanceGuideModal(modal){
  modal.classList.add("shipping-subdialog-v11103");
  applySubdialogDimensions(modal,true);
}

function enhanceShippingSubdialog(modal){
  if(modal.classList.contains("shipping-process-modal"))return;
  const title=(modal.querySelector(".modal-head h3")?.textContent||"").trim();
  if(!title)return;
  if(/Agregar guía|Reportar no entrega|Solicitar cancelación|Registrar novedad|Registrar reporte|Agregar nota|Enviar solicitud de aprobación|Solucionar y cerrar/i.test(title)){
    modal.classList.add("shipping-subdialog-v11103");
    applySubdialogDimensions(modal,/Agregar guía/i.test(title)||modal.classList.contains("shipping-guide-reader-v11101"));
  }
}

function applySubdialogDimensions(modal,isGuide=false){
  if(desktop.matches){
    const width=isGuide?"1100px":"920px";
    modal.style.setProperty("width",`min(${width}, calc(100vw - 54px))`,"important");
    modal.style.setProperty("max-width",width,"important");
    modal.style.setProperty("max-height","calc(100dvh - 38px)","important");
  }else{
    ["width","max-width","height","max-height"].forEach(prop=>modal.style.removeProperty(prop));
  }
}

function install(){
  enhanceAll();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  observer=new MutationObserver(schedule);
  observe();
  desktop.addEventListener?.("change",schedule);
  window.addEventListener("resize",schedule,{passive:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});
else install();
