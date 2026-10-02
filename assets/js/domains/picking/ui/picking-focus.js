export function pickingStage(modal){
  if(modal?.querySelector("[data-picking-take]"))return "TAKE";
  if(modal?.querySelector("[data-resume-partial]"))return "RESUME";
  if(modal?.querySelector("[data-confirm-cut-pickup], [data-cut-pickup-item]"))return "PICKUP";
  if(modal?.querySelector("[data-picking-items], .picking-verification-card"))return "VERIFY";
  if(modal?.querySelector(".picking-empty"))return "BLOCKED";
  return "STATUS";
}

export function enhancePickingExperience(host){
  const modal=host?.querySelector?.(".picking-process-modal");
  if(!modal)return null;
  modal.classList.add("picking-focus-v1195");
  const stage=pickingStage(modal);
  modal.dataset.pickingStageV1195=stage;
  moveInitialFacts(modal,stage);
  simplifyVerification(modal,stage);
  adaptPickingFooter(modal);
  syncPickingNext(modal,stage);
  bindPickingNext(modal);
  return modal;
}

export function continuePicking(modal){
  const stage=pickingStage(modal);
  if(stage==="TAKE"){
    const target=modal.querySelector("[data-picking-take]");
    if(visible(target))target.click();
    return "TAKE";
  }
  if(stage==="RESUME"){
    const target=modal.querySelector("[data-resume-partial]");
    if(visible(target))target.click();
    return "RESUME";
  }
  if(stage==="PICKUP"){
    const confirm=modal.querySelector("[data-confirm-cut-pickup]");
    if(visible(confirm)){confirm.click();return "PICKUP_CONFIRM"}
    const pending=modal.querySelector("[data-cut-pickup-item]:not(.selected) [data-toggle-cut-pickup]");
    focusTarget(pending||modal.querySelector(".cut-pickup-workbench"));
    return "PICKUP_FOCUS";
  }
  if(stage==="VERIFY"){
    const send=modal.querySelector("[data-picking-send]");
    if(send&&!send.disabled){send.click();return "VERIFY_SEND"}
    const unresolved=[...(modal.querySelectorAll("[data-picking-item]")||[])].find(row=>!row.dataset.result);
    if(unresolved){focusTarget(unresolved.querySelector("[data-result]")||unresolved);return "VERIFY_UNRESOLVED"}
    const invalidText=[...(modal.querySelectorAll('[data-picking-item] textarea[required]')||[])].find(field=>!field.value.trim());
    if(invalidText){focusTarget(invalidText);return "VERIFY_NOVELTY"}
    const originAlert=modal.querySelector(".picking-origin-alert");
    if(originAlert){focusTarget(originAlert);return "VERIFY_ORIGIN_ALERT"}
    const visibleOrigin=[...(modal.querySelectorAll(".picking-origin")||[])].find(node=>!node.hidden&&visible(node));
    if(visibleOrigin){focusTarget(visibleOrigin);return "VERIFY_ORIGIN"}
    focusTarget(modal.querySelector(".picking-verification-card"));
    return "VERIFY_FOCUS";
  }
  return stage;
}

export function syncPickingNext(modal,stage=pickingStage(modal)){
  const button=modal?.querySelector?.("[data-picking-next-v1195]");
  if(!button)return false;
  let enabled=false;
  if(stage==="TAKE")enabled=visible(modal.querySelector("[data-picking-take]"));
  else if(stage==="RESUME")enabled=visible(modal.querySelector("[data-resume-partial]"));
  else if(stage==="PICKUP")enabled=Boolean(modal.querySelector("[data-cut-pickup-item]"));
  else if(stage==="VERIFY"){
    enabled=Boolean(modal.querySelector("[data-picking-item], [data-picking-send]"))
      &&!modal.querySelector(".picking-waiting-cuts:not(:has([data-picking-send]))");
  }
  button.disabled=!enabled;
  button.setAttribute("aria-disabled",enabled?"false":"true");
  button.title=enabled?"Continuar con el paso actual de Alistamiento":"No hay una acción disponible en este estado";
  return enabled;
}

export function adaptPickingFooter(modal){
  const footer=modal?.querySelector?.(".parallel-work-footer");
  if(!footer)return;
  const actions=footer.querySelector(".parallel-work-actions");
  const closeButton=actions?.querySelector("[data-close], [data-take-another].picking-close-other");
  const nextButton=actions?.querySelector("[data-take-another]:not(.picking-close-other), [data-picking-next-v1195]");
  if(!closeButton||!nextButton)return;

  footer.dataset.pickingFooterV1195="1";
  closeButton.removeAttribute("data-close");
  closeButton.dataset.takeAnother="ALISTAMIENTO";
  closeButton.classList.add("picking-close-other","btn-ghost");
  closeButton.classList.remove("btn-primary");
  closeButton.textContent="Cerrar y tomar otro";

  nextButton.removeAttribute("data-take-another");
  nextButton.dataset.pickingNextV1195="1";
  nextButton.classList.add("btn-primary");
  nextButton.classList.remove("btn-ghost");
  nextButton.textContent="Siguiente";
}

function bindPickingNext(modal){
  const button=modal.querySelector("[data-picking-next-v1195]");
  if(!button)return;
  button.onclick=event=>{
    event.preventDefault();
    if(button.disabled)return;
    continuePicking(modal);
  };
}

function moveInitialFacts(modal,stage){
  if(!["TAKE","RESUME"].includes(stage))return;
  const strip=modal.querySelector(".picking-order-strip");
  if(!strip)return;
  const card=stage==="TAKE"?modal.querySelector(".picking-take-card"):modal.querySelector(".picking-partial-resume");
  if(!card)return;
  const action=card.querySelector(stage==="TAKE"?"[data-picking-take]":"[data-resume-partial]");
  strip.classList.add("picking-take-facts-v1195");
  if(action)card.insertBefore(strip,action);else if(!card.contains(strip))card.append(strip);
}

function simplifyVerification(modal,stage){
  if(stage!=="VERIFY")return;
  modal.classList.add("picking-review-v1197");
  const head=modal.querySelector(".picking-stage-head");
  const title=head?.querySelector("h4");
  const copy=head?.querySelector("p");
  if(title)title.textContent="Revisa los materiales";
  if(copy)copy.textContent="Marca cada referencia como Encontrado o No encontrado.";
  const counterLabel=modal.querySelector(".picking-counter span");
  if(counterLabel)counterLabel.textContent=`de ${modal.querySelectorAll("[data-picking-item]").length} revisados`;
  const details=modal.querySelector(".simple-details");
  const summary=details?.querySelector(":scope > summary");
  if(summary)summary.textContent="Más información y novedades";
  const strip=modal.querySelector(".picking-order-strip");
  if(details&&strip&&!details.contains(strip)){
    strip.classList.add("picking-secondary-facts-v1197");
    details.append(strip);
  }
}

function visible(element){
  if(!element||element.disabled)return false;
  return element.offsetParent!==null||element.dataset?.testVisible==="1";
}

function focusTarget(element){
  if(!element)return;
  element.scrollIntoView?.({behavior:"smooth",block:"center",inline:"nearest"});
  requestAnimationFrame(()=>element.focus?.({preventScroll:true}));
  element.classList?.remove("picking-next-highlight-v1195");
  void element.offsetWidth;
  element.classList?.add("picking-next-highlight-v1195");
  setTimeout(()=>element.classList?.remove("picking-next-highlight-v1195"),900);
}
