let observer=null;
let scheduled=false;

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    enhanceAll();
  });
}

function enhanceAll(){
  document.querySelectorAll("#modal-root .reception-process-modal.receiving-focus-v1193").forEach(modal=>{
    adaptFooter(modal);
    syncNextState(modal);
  });
}

function stageOf(modal){
  if(modal.querySelector("[data-take-order]"))return "TAKE";
  if(modal.querySelector("[data-picking-profile]"))return "ASSIGN";
  if(modal.querySelector("[data-lines-editor]"))return "EDIT";
  if(modal.querySelector("[data-source-pdf],[data-read-drive-pdf],[data-local-pdf]"))return "PDF";
  if(modal.querySelector("[data-info-correct],[data-info-assign]"))return "REVIEW";
  return "STATUS";
}

function adaptFooter(modal){
  const footer=modal.querySelector(".parallel-work-footer");
  if(!footer||footer.dataset.receivingFooterV1194)return;
  const actions=footer.querySelector(".parallel-work-actions");
  if(!actions)return;
  const closeButton=actions.querySelector("[data-close]");
  const takeAnother=actions.querySelector('[data-take-another="RECEPCION_PEDIDO"]');
  if(!closeButton||!takeAnother)return;

  footer.dataset.receivingFooterV1194="1";

  closeButton.removeAttribute("data-close");
  closeButton.dataset.takeAnother="RECEPCION_PEDIDO";
  closeButton.textContent="Cerrar y tomar otro";
  closeButton.classList.remove("btn-primary");
  closeButton.classList.add("btn-ghost");

  takeAnother.removeAttribute("data-take-another");
  takeAnother.dataset.receptionNext="1";
  takeAnother.textContent="Siguiente";
  takeAnother.classList.remove("btn-ghost");
  takeAnother.classList.add("btn-primary");
}

function syncNextState(modal){
  const button=modal.querySelector("[data-reception-next]");
  if(!button)return;
  const stage=stageOf(modal);
  const enabled=stage!=="STATUS";
  button.disabled=!enabled;
  button.setAttribute("aria-disabled",enabled?"false":"true");
  button.title=enabled?"Continuar con el paso actual":"No hay una acción disponible en este estado";
}

function visible(element){
  return Boolean(element&&element.offsetParent!==null&&!element.disabled);
}

function pulse(element){
  if(!element)return;
  element.classList.remove("reception-next-highlight-v1194");
  void element.offsetWidth;
  element.classList.add("reception-next-highlight-v1194");
  setTimeout(()=>element.classList.remove("reception-next-highlight-v1194"),900);
}

function scrollTo(element){
  if(!element)return;
  element.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});
  requestAnimationFrame(()=>element.focus?.({preventScroll:true}));
  pulse(element);
}

function continueReception(modal){
  const stage=stageOf(modal);

  if(stage==="TAKE"){
    const target=modal.querySelector("[data-take-order]");
    if(visible(target))target.click();
    return;
  }

  if(stage==="REVIEW"){
    const choices=modal.querySelector(".reception-decision-grid");
    const first=choices?.querySelector("button:not([disabled])");
    scrollTo(first||choices);
    return;
  }

  if(stage==="PDF"){
    const drive=modal.querySelector("[data-read-drive-pdf]");
    if(visible(drive)){drive.click();return;}
    const file=modal.querySelector("[data-local-pdf]");
    if(file){file.click();return;}
    scrollTo(modal.querySelector(".reception-pdf-panel"));
    return;
  }

  if(stage==="EDIT"){
    const target=modal.querySelector("[data-confirm-lines]");
    if(visible(target))target.click();else scrollTo(modal.querySelector("[data-lines-editor]"));
    return;
  }

  if(stage==="ASSIGN"){
    const target=modal.querySelector("[data-confirm-reception]");
    if(visible(target))target.click();else scrollTo(modal.querySelector(".reception-assignment-grid"));
  }
}

function onClick(event){
  const button=event.target.closest?.("[data-reception-next]");
  if(!button||button.disabled)return;
  const modal=button.closest(".reception-process-modal.receiving-focus-v1193");
  if(!modal)return;
  event.preventDefault();
  continueReception(modal);
}

function install(){
  enhanceAll();
  document.addEventListener("click",onClick);
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
