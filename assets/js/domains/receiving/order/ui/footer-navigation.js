function actionable(element){return Boolean(element&&!element.disabled&&!element.hidden)}

function pulse(element){
  if(!element)return;
  element.classList?.remove("reception-next-highlight");
  void element.offsetWidth;
  element.classList?.add("reception-next-highlight");
  setTimeout(()=>element.classList?.remove("reception-next-highlight"),900);
}

function focusTarget(element){
  if(!element)return;
  element.scrollIntoView?.({behavior:"smooth",block:"center",inline:"nearest"});
  element.focus?.({preventScroll:true});
  pulse(element);
}

export function continueReception(host,stage){
  if(stage==="TAKE"){
    const target=host.querySelector("[data-take-order]");
    if(actionable(target))target.click();
    return;
  }
  if(stage==="REVIEW"){
    const choices=host.querySelector(".reception-decision-grid");
    focusTarget(choices?.querySelector?.("button:not([disabled])")||choices);
    return;
  }
  if(stage==="PDF"){
    const drive=host.querySelector("[data-read-drive-pdf]");
    if(actionable(drive)){drive.click();return}
    const local=host.querySelector("[data-local-pdf]");
    if(local&&!local.disabled){local.click();return}
    focusTarget(host.querySelector(".reception-pdf-panel"));
    return;
  }
  if(stage==="EDIT"){
    const confirm=host.querySelector("[data-confirm-lines]");
    if(actionable(confirm))confirm.click();else focusTarget(host.querySelector("[data-lines-editor]"));
    return;
  }
  if(stage==="ASSIGN"){
    const confirm=host.querySelector("[data-confirm-reception]");
    if(actionable(confirm))confirm.click();else focusTarget(host.querySelector(".reception-assignment-grid"));
  }
}

export function bindFooterNavigation(host,stage){
  const button=host.querySelector("[data-reception-next]");
  if(!button)return;
  const enabled=stage!=="STATUS";
  button.disabled=!enabled;
  button.setAttribute?.("aria-disabled",enabled?"false":"true");
  button.title=enabled?"Continuar con el paso actual":"No hay una acción disponible en este estado";
  button.onclick=enabled?event=>{event.preventDefault?.();continueReception(host,stage)}:null;
}
