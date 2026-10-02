export function billingAction(modal,action){
  return modal?.querySelector?.(`[data-cash-action="${action}"], [data-billing-action="${action}"]`)||null;
}

export function billingStage(modal){
  const accept=billingAction(modal,"accept");
  const cash=modal?.querySelector?.('[data-billing-action="cash"]');
  const invoice=billingAction(modal,"invoice");
  const annex=billingAction(modal,"annex");
  const send=billingAction(modal,"send");
  if(visible(accept)&&visible(cash))return "ROUTE_CHOICE";
  if(visible(accept))return "TAKE";
  if(visible(invoice)||visible(annex))return "DOCUMENT";
  if(visible(send))return "SEND";
  if(modal?.querySelector?.(".cash-invoice-steps"))return "WAIT";
  return "TAKE";
}

export function enhanceBillingExperience(host){
  const modal=host?.querySelector?.(".billing-process-modal");
  if(!modal)return null;
  modal.classList.add("billing-focus-v1198");
  const stage=billingStage(modal);
  modal.dataset.billingStageV1198=stage;
  simplifySecondary(modal);
  enhanceTake(modal,stage);
  enhanceSteps(modal,stage);
  adaptBillingFooter(modal);
  syncBillingNext(modal,stage);
  bindBillingNext(modal);
  bindFocusCta(modal);
  return modal;
}

export function continueBilling(modal){
  const stage=billingStage(modal);
  if(stage==="ROUTE_CHOICE"){
    focusTarget(modal.querySelector(".billing-entry-actions"));
    return "ROUTE_CHOICE";
  }
  if(stage==="TAKE"){
    const target=billingAction(modal,"accept");
    if(visible(target))target.click();
    return "TAKE";
  }
  if(stage==="DOCUMENT"){
    const annex=billingAction(modal,"annex");
    const target=visible(annex)?annex:billingAction(modal,"invoice");
    if(visible(target))target.click();
    return "DOCUMENT";
  }
  if(stage==="SEND"){
    const target=billingAction(modal,"send");
    if(visible(target))target.click();
    return "SEND";
  }
  focusTarget(modal.querySelector(".billing-task-focus-v1198"));
  return "WAIT";
}

export function syncBillingNext(modal,stage=billingStage(modal)){
  const button=modal?.querySelector?.("[data-billing-next-v1198]");
  if(!button)return false;
  const blocked=modal.classList.contains("order-blocked-by-issue");
  let enabled=false;
  if(!blocked){
    if(stage==="ROUTE_CHOICE")enabled=Boolean(visible(billingAction(modal,"accept"))||visible(modal.querySelector('[data-billing-action="cash"]')));
    else if(stage==="TAKE")enabled=visible(billingAction(modal,"accept"));
    else if(stage==="DOCUMENT")enabled=Boolean(visible(billingAction(modal,"invoice"))||visible(billingAction(modal,"annex")));
    else if(stage==="SEND")enabled=visible(billingAction(modal,"send"));
  }
  button.disabled=!enabled;
  button.setAttribute("aria-disabled",enabled?"false":"true");
  button.title=blocked?"Resuelve la novedad pendiente antes de continuar":enabled?"Continuar con el paso actual de Facturación":"No hay una acción disponible en este momento";
  return enabled;
}

export function adaptBillingFooter(modal){
  const footer=modal?.querySelector?.(".parallel-work-footer");
  const actions=footer?.querySelector?.(".parallel-work-actions");
  const closeButton=actions?.querySelector?.("[data-close], .billing-close-other");
  const nextButton=actions?.querySelector?.("[data-take-another]:not(.billing-close-other), [data-billing-next-v1198]");
  if(!footer||!closeButton||!nextButton)return;
  footer.dataset.billingFooterV1198="1";

  const step=nextButton.dataset.takeAnother||"FACTURACION";
  closeButton.removeAttribute("data-close");
  closeButton.dataset.takeAnother=step;
  closeButton.classList.add("billing-close-other","btn-ghost");
  closeButton.classList.remove("btn-primary");
  closeButton.textContent="Cerrar y tomar otro";

  nextButton.removeAttribute("data-take-another");
  nextButton.dataset.billingNextV1198="1";
  nextButton.classList.add("btn-primary");
  nextButton.classList.remove("btn-ghost");
  nextButton.textContent="Siguiente";
}

function simplifySecondary(modal){
  const body=modal.querySelector(".simple-process-body");
  if(!body)return;
  let details=body.querySelector(":scope > .billing-secondary-v1198");
  if(!details){
    details=document.createElement("details");
    details.className="billing-secondary-v1198";
    details.innerHTML='<summary><span>Más información y novedades</span></summary><div class="billing-secondary-content-v1198"><div data-order-support-slot></div></div>';
    body.append(details);
  }
  const content=details.querySelector(".billing-secondary-content-v1198");
  const full=[...body.querySelectorAll(":scope > .simple-details")].find(node=>node!==details);
  if(full&&!content.contains(full))content.append(full);
  const blocked=modal.classList.contains("order-blocked-by-issue");
  details.classList.toggle("attention",blocked);
  const label=details.querySelector("summary span");
  if(label)label.textContent=blocked?"Hay una novedad pendiente · abre para resolver":"Más información y novedades";
  if(blocked)details.open=true;
}

function enhanceTake(modal,stage){
  if(!["TAKE","ROUTE_CHOICE"].includes(stage))return;
  const intro=modal.querySelector(".billing-process-intro, .cash-invoice-intro");
  if(!intro)return;
  intro.classList.add("billing-take-v1198");
  const facts=headerFacts(modal);
  const cash=Boolean(modal.querySelector('[data-cash-action="accept"]'));
  const title=stage==="ROUTE_CHOICE"?"Define quién debe facturar este pedido":cash?"Pedido listo para facturar en Caja":"Pedido listo para facturar";
  const description=stage==="ROUTE_CHOICE"?"Este pedido requiere elegir la ruta correcta de facturación. Selecciona una opción para continuar.":"Toma el pedido. Después solo tendrás que adjuntar el documento requerido y continuar.";
  intro.innerHTML=`<span class="billing-take-kicker-v1198">Antes de comenzar</span><h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p><div class="billing-start-facts-v1198">${fact("Cliente",facts.client)}${fact("Tipo",facts.type)}${fact("Documento",facts.document)}${fact("Siguiente ruta",facts.route)}</div>`;
  const accept=billingAction(modal,"accept");
  const routeCash=modal.querySelector('[data-billing-action="cash"]');
  setText(accept?.querySelector("strong"),stage==="ROUTE_CHOICE"?"Facturar en Logística":"Tomar pedido");
  setText(accept?.querySelector("small"),stage==="ROUTE_CHOICE"?"Continúa la facturación desde este módulo.":"Inicia la gestión y habilita la carga del documento.");
  setText(routeCash?.querySelector("strong"),"Enviar a Caja");
  setText(routeCash?.querySelector("small"),"Mueve el pedido a Caja para realizar la facturación allí.");
}

function enhanceSteps(modal,stage){
  const stepper=modal.querySelector(".cash-invoice-steps");
  if(!stepper)return;
  stepper.classList.add("billing-stepper-v1198");
  stepper.querySelectorAll(".cash-invoice-step").forEach(step=>{
    const action=step.dataset.cashAction||step.dataset.billingAction||"";
    const strong=step.querySelector("strong");
    if(action==="accept")setText(strong,step.classList.contains("done")?"Tomado":"Tomar");
    if(action==="invoice"||action==="annex")setText(strong,"Documento");
    if(action==="send")setText(strong,"Enviar");
  });
  let focus=modal.querySelector(".billing-task-focus-v1198");
  if(!focus){
    focus=document.createElement("section");
    focus.className="billing-task-focus-v1198";
    stepper.after(focus);
  }
  renderTaskFocus(modal,focus,stage);
}

function renderTaskFocus(modal,focus,stage){
  const facts=headerFacts(modal);
  const invoice=billingAction(modal,"invoice");
  const annex=billingAction(modal,"annex");
  const send=billingAction(modal,"send");
  const accept=billingAction(modal,"accept");
  let action="",title="Revisa el estado de facturación",description="El CRM habilitará la siguiente acción cuando el pedido esté listo.",cta="",icon="document";
  if(stage==="TAKE"&&accept){action="accept";title="Toma el pedido";description="Inicia la gestión. Después adjuntarás el documento requerido.";cta="Tomar pedido";icon="take"}
  else if(stage==="DOCUMENT"&&visible(annex)){action="annex";title="Adjunta el Anexo PVP";description="Selecciona el archivo comercial requerido. El CRM lo asociará automáticamente al pedido.";cta="Subir Anexo PVP";icon="upload"}
  else if(stage==="DOCUMENT"&&visible(invoice)){action="invoice";title="Adjunta la factura";description="Selecciona el documento. El CRM registra y lee los datos antes de guardar.";cta="Subir factura";icon="upload"}
  else if(stage==="SEND"&&visible(send)){action="send";title="Documento listo";description=`El soporte requerido ya está registrado. Continúa hacia ${facts.route}.`;cta="Enviar a despacho";icon="check"}
  focus.innerHTML=`<span class="billing-task-icon-v1198" aria-hidden="true">${iconSvg(icon)}</span><div class="billing-task-copy-v1198"><span>Paso actual</span><h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p></div>${action?`<button type="button" class="btn btn-primary billing-task-cta-v1198" data-billing-focus-action="${action}">${escapeHtml(cta)}</button>`:""}`;
  const summary=[...modal.querySelectorAll(".invoice-confirmed")].find(node=>!focus.contains(node));
  if(summary)focus.append(summary);
  const exception=[...modal.querySelectorAll(".billing-approved-exception")].find(node=>!focus.contains(node));
  if(exception)focus.append(exception);
}

function bindBillingNext(modal){
  const button=modal.querySelector("[data-billing-next-v1198]");
  if(!button)return;
  button.onclick=event=>{event.preventDefault();if(!button.disabled)continueBilling(modal)};
}

function bindFocusCta(modal){
  modal.querySelectorAll("[data-billing-focus-action]").forEach(button=>{
    button.onclick=()=>{
      const original=billingAction(modal,button.dataset.billingFocusAction);
      if(visible(original))original.click();
    };
  });
}

function headerFacts(modal){
  const raw=modal.querySelector(".simple-process-head p")?.textContent?.trim()||"";
  const parts=raw.split("·").map(value=>value.trim()).filter(Boolean);
  const pvp=Boolean(modal.querySelector('[data-cash-action="annex"]'))||/Anexo PVP/i.test(modal.textContent||"");
  return {
    client:parts[0]||"Cliente del pedido",
    type:parts.length>=2?parts[1]:"Pedido",
    route:parts.length>=3?parts.at(-1):"Ruta definida por el CRM",
    document:pvp?"Anexo PVP":"Factura"
  };
}

function fact(label,value){return `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value||"—")}</strong></div>`}
function setText(node,value){if(node&&node.textContent!==value)node.textContent=value}
function visible(element){return Boolean(element&&!element.disabled&&(element.offsetParent!==null||element.dataset?.testVisible==="1"))}
function focusTarget(element){if(!element)return;element.scrollIntoView?.({behavior:"smooth",block:"center",inline:"nearest"});requestAnimationFrame(()=>element.querySelector?.("button:not(:disabled)")?.focus?.({preventScroll:true}))}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}
function iconSvg(kind){
  if(kind==="upload")return '<svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4"/><path d="M5 15v4h14v-4"/></svg>';
  if(kind==="check")return '<svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/><rect x="3.5" y="3.5" width="17" height="17" rx="4"/></svg>';
  if(kind==="take")return '<svg viewBox="0 0 24 24"><path d="M7 4h10l2 3v13H5V7l2-3Z"/><path d="M9 10h6m-3-3v6"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H5V3h2Z"/><path d="M15 3v5h4M8 12h8M8 16h6"/></svg>';
}
