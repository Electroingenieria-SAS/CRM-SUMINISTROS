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
  document.querySelectorAll("#modal-root .picking-process-modal").forEach(modal=>{
    modal.classList.add("picking-focus-v1195");
    const stage=stageOf(modal);
    modal.dataset.pickingStageV1195=stage;
    moveInitialFacts(modal,stage);
    adaptFooter(modal);
    syncNextState(modal,stage);
  });
}

function stageOf(modal){
  if(modal.querySelector("[data-picking-take]"))return "TAKE";
  if(modal.querySelector("[data-resume-partial]"))return "RESUME";
  if(modal.querySelector("[data-confirm-cut-pickup], [data-cut-pickup-item]"))return "PICKUP";
  if(modal.querySelector("[data-picking-items], .picking-verification-card"))return "VERIFY";
  if(modal.querySelector(".picking-empty"))return "BLOCKED";
  return "STATUS";
}

function moveInitialFacts(modal,stage){
  if(!["TAKE","RESUME"].includes(stage))return;
  const strip=modal.querySelector(".picking-order-strip");
  if(!strip||strip.classList.contains("picking-take-facts-v1195"))return;
  const card=stage==="TAKE"?modal.querySelector(".picking-take-card"):modal.querySelector(".picking-partial-resume");
  if(!card)return;
  const action=card.querySelector(stage==="TAKE"?"[data-picking-take]":"[data-resume-partial]");
  strip.classList.add("picking-take-facts-v1195");
  if(action)card.insertBefore(strip,action);else card.append(strip);
}

function adaptFooter(modal){
  const footer=modal.querySelector(".parallel-work-footer");
  if(!footer||footer.dataset.pickingFooterV1195)return;
  const actions=footer.querySelector(".parallel-work-actions");
  if(!actions)return;
  const closeButton=actions.querySelector("[data-close]");
  const takeAnother=actions.querySelector("[data-take-another]");
  if(!closeButton||!takeAnother)return;

  footer.dataset.pickingFooterV1195="1";

  closeButton.removeAttribute("data-close");
  closeButton.dataset.takeAnother="ALISTAMIENTO";
  closeButton.textContent="Cerrar y tomar otro";
  closeButton.classList.remove("btn-primary");
  closeButton.classList.add("btn-ghost");

  takeAnother.removeAttribute("data-take-another");
  takeAnother.dataset.pickingNextV1195="1";
  takeAnother.textContent="Siguiente";
  takeAnother.classList.remove("btn-ghost");
  takeAnother.classList.add("btn-primary");
}

function syncNextState(modal,stage=stageOf(modal)){
  const button=modal.querySelector("[data-picking-next-v1195]");
  if(!button)return;
  let enabled=false;
  if(stage==="TAKE")enabled=visible(modal.querySelector("[data-picking-take]"));
  else if(stage==="RESUME")enabled=visible(modal.querySelector("[data-resume-partial]"));
  else if(stage==="PICKUP")enabled=Boolean(modal.querySelector("[data-cut-pickup-item]"));
  else if(stage==="VERIFY")enabled=Boolean(modal.querySelector("[data-picking-item], [data-picking-send]"))&&!modal.querySelector(".picking-waiting-cuts:not(:has([data-picking-send]))");
  button.disabled=!enabled;
  button.setAttribute("aria-disabled",enabled?"false":"true");
  button.title=enabled?"Continuar con el paso actual de Alistamiento":"No hay una acción disponible en este estado";
}

function visible(element){
  return Boolean(element&&element.offsetParent!==null&&!element.disabled);
}

function pulse(element){
  if(!element)return;
  element.classList.remove("picking-next-highlight-v1195");
  void element.offsetWidth;
  element.classList.add("picking-next-highlight-v1195");
  setTimeout(()=>element.classList.remove("picking-next-highlight-v1195"),900);
}

function focusTarget(element){
  if(!element)return;
  element.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});
  requestAnimationFrame(()=>element.focus?.({preventScroll:true}));
  pulse(element);
}

function continuePicking(modal){
  const stage=stageOf(modal);

  if(stage==="TAKE"){
    const target=modal.querySelector("[data-picking-take]");
    if(visible(target))target.click();
    return;
  }

  if(stage==="RESUME"){
    const target=modal.querySelector("[data-resume-partial]");
    if(visible(target))target.click();
    return;
  }

  if(stage==="PICKUP"){
    const confirm=modal.querySelector("[data-confirm-cut-pickup]");
    if(visible(confirm)){confirm.click();return;}
    const firstPending=modal.querySelector("[data-cut-pickup-item]:not(.selected) [data-toggle-cut-pickup]");
    focusTarget(firstPending||modal.querySelector(".cut-pickup-workbench"));
    return;
  }

  if(stage==="VERIFY"){
    const send=modal.querySelector("[data-picking-send]");
    if(visible(send)){send.click();return;}

    const unresolved=[...modal.querySelectorAll("[data-picking-item]")].find(row=>!row.dataset.result);
    if(unresolved){
      focusTarget(unresolved.querySelector("[data-result]")||unresolved);
      return;
    }

    const invalidText=[...modal.querySelectorAll("[data-picking-item] textarea[required]")].find(field=>!field.value.trim());
    if(invalidText){focusTarget(invalidText);return;}

    const originAlert=modal.querySelector(".picking-origin-alert");
    if(originAlert){focusTarget(originAlert);return;}

    const visibleOrigin=[...modal.querySelectorAll(".picking-origin")].find(node=>!node.hidden&&node.offsetParent!==null);
    if(visibleOrigin){focusTarget(visibleOrigin);return;}

    focusTarget(modal.querySelector(".picking-verification-card"));
  }
}

function onClick(event){
  const button=event.target.closest?.("[data-picking-next-v1195]");
  if(!button||button.disabled)return;
  const modal=button.closest(".picking-process-modal.picking-focus-v1195");
  if(!modal)return;
  event.preventDefault();
  continuePicking(modal);
}

function install(){
  enhanceAll();
  document.addEventListener("click",onClick);
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
