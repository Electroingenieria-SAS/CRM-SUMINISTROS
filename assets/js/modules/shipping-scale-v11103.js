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
  if(!modal.classList.contains("shipping-scale-v11103"))modal.classList.add("shipping-scale-v11103");
  applyMainDimensions(modal);
  moveDuplicateAddress(modal);
  simplifyFooter(modal);
  moveCancellationToSecondary(modal);
  modal.querySelectorAll(".modal-task-panel").forEach(panel=>{
    if(!panel.classList.contains("shipping-task-panel-v11103"))panel.classList.add("shipping-task-panel-v11103");
  });
}

function setImportantStyle(node,prop,value){
  if(node.style.getPropertyValue(prop)===value&&node.style.getPropertyPriority(prop)==="important")return;
  node.style.setProperty(prop,value,"important");
}

function applyMainDimensions(modal){
  if(desktop.matches){
    setImportantStyle(modal,"width","min(1400px, calc(100vw - 56px))");
    setImportantStyle(modal,"max-width","1400px");
    setImportantStyle(modal,"height","min(900px, calc(100dvh - 28px))");
    setImportantStyle(modal,"max-height","calc(100dvh - 28px)");
  }else{
    ["width","max-width","height","max-height"].forEach(prop=>{
      if(modal.style.getPropertyValue(prop))modal.style.removeProperty(prop);
    });
  }
}

function moveDuplicateAddress(modal){
  const primary=modal.querySelector(".shipping-primary-task-v11102");
  const address=primary?.querySelector(":scope > .shipping-sales-address");
  if(!address)return;
  const secondary=modal.querySelector(".shipping-secondary-body-v11102");
  if(!secondary)return;
  if(!address.classList.contains("shipping-address-detail-v11103"))address.classList.add("shipping-address-detail-v11103");
  if(address.parentElement!==secondary)secondary.prepend(address);
}

function setText(node,value){
  if(node&&node.textContent!==value)node.textContent=value;
}

function simplifyFooter(modal){
  const note=modal.querySelector(".parallel-work-note");
  if(!note)return;
  setText(note.querySelector("strong"),"Trabajo en paralelo");
  setText(note.querySelector("small"),"El pedido permanece asignado mientras continúas.");
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
  if(!cancel.classList.contains("shipping-cancellation-secondary-v11102"))cancel.classList.add("shipping-cancellation-secondary-v11102");
  if(cancel.parentElement!==row)row.append(cancel);
}

function enhanceGuideModal(modal){
  if(!modal.classList.contains("shipping-subdialog-v11103"))modal.classList.add("shipping-subdialog-v11103");
  applySubdialogDimensions(modal,true);
}

function enhanceShippingSubdialog(modal){
  if(modal.classList.contains("shipping-process-modal"))return;
  const title=(modal.querySelector(".modal-head h3")?.textContent||"").trim();
  if(!title)return;
  if(/Agregar guía|Reportar no entrega|Solicitar cancelación|Registrar novedad|Registrar reporte|Agregar nota|Enviar solicitud de aprobación|Solucionar y cerrar/i.test(title)){
    if(!modal.classList.contains("shipping-subdialog-v11103"))modal.classList.add("shipping-subdialog-v11103");
    applySubdialogDimensions(modal,/Agregar guía/i.test(title)||modal.classList.contains("shipping-guide-reader-v11101"));
  }
}

function applySubdialogDimensions(modal,isGuide=false){
  if(desktop.matches){
    const width=isGuide?"1100px":"920px";
    setImportantStyle(modal,"width",`min(${width}, calc(100vw - 54px))`);
    setImportantStyle(modal,"max-width",width);
    setImportantStyle(modal,"max-height","calc(100dvh - 38px)");
  }else{
    ["width","max-width","height","max-height"].forEach(prop=>{
      if(modal.style.getPropertyValue(prop))modal.style.removeProperty(prop);
    });
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
