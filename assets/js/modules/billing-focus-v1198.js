let observer=null;
let observedRoot=null;
let scheduled=false;

function observe(){
  if(!observer||!observedRoot)return;
  observer.observe(observedRoot,{childList:true,subtree:true,attributes:true,attributeFilter:["class","disabled"]});
}

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

function enhanceAll(){
  document.querySelectorAll("#modal-root .billing-process-modal").forEach(enhanceBillingModal);
  document.querySelectorAll("#modal-root .modal").forEach(enhanceUploadDialog);
}

function enhanceBillingModal(modal){
  modal.classList.add("billing-focus-v1198");
  const stage=stageOf(modal);
  modal.dataset.billingStageV1198=stage;
  simplifySecondary(modal);
  enhanceTake(modal,stage);
  enhanceSteps(modal,stage);
  adaptFooter(modal);
  syncNext(modal,stage);
}

function stageOf(modal){
  const accept=billingAction(modal,"accept");
  const cash=modal.querySelector('[data-billing-action="cash"]');
  const invoice=billingAction(modal,"invoice");
  const annex=billingAction(modal,"annex");
  const send=billingAction(modal,"send");

  if(visible(accept)&&visible(cash))return "ROUTE_CHOICE";
  if(visible(accept))return "TAKE";
  if(visible(invoice)||visible(annex))return "DOCUMENT";
  if(visible(send))return "SEND";
  if(modal.querySelector(".cash-invoice-steps"))return "WAIT";
  return "TAKE";
}

function billingAction(modal,action){
  return modal.querySelector(`[data-cash-action="${action}"], [data-billing-action="${action}"]`);
}

function visible(element){
  return Boolean(element&&element.offsetParent!==null&&!element.disabled);
}

function setText(node,value){
  if(node&&node.textContent!==value)node.textContent=value;
}

function simplifySecondary(modal){
  const body=modal.querySelector(".simple-process-body");
  if(!body)return;

  let details=body.querySelector(":scope > .billing-secondary-v1198");
  if(!details){
    details=document.createElement("details");
    details.className="billing-secondary-v1198";
    details.innerHTML='<summary><span>Más información y novedades</span></summary><div class="billing-secondary-content-v1198"></div>';
    body.append(details);
  }

  const content=details.querySelector(".billing-secondary-content-v1198");
  if(!content)return;

  const support=modal.querySelector(".order-support-zone");
  if(support&&!content.contains(support))content.prepend(support);

  const fullDetails=[...body.querySelectorAll(":scope > .simple-details")].find(node=>node!==details);
  if(fullDetails&&!content.contains(fullDetails))content.append(fullDetails);

  const blocked=modal.classList.contains("order-blocked-by-issue");
  details.classList.toggle("attention",blocked);
  setText(details.querySelector("summary span"),blocked?"Hay una novedad pendiente · abre para resolver":"Más información y novedades");
  if(blocked)details.open=true;
}

function headerFacts(modal){
  const raw=modal.querySelector(".simple-process-head p")?.textContent?.trim()||"";
  const parts=raw.split("·").map(value=>value.trim()).filter(Boolean);
  const client=parts[0]||"Cliente del pedido";
  const type=parts.length>=2?parts[1]:"Pedido";
  const route=parts.length>=3?parts[parts.length-1]:"Ruta definida por el CRM";
  const pvp=Boolean(modal.querySelector('[data-cash-action="annex"]'))||/Anexo PVP/i.test(modal.textContent||"");
  const document=pvp?"Anexo PVP":"Factura PDF";
  return {client,type,route,document,pvp};
}

function enhanceTake(modal,stage){
  if(!["TAKE","ROUTE_CHOICE"].includes(stage))return;
  const intro=modal.querySelector(".billing-process-intro, .cash-invoice-intro");
  if(!intro)return;
  intro.classList.add("billing-take-v1198");
  const facts=headerFacts(modal);
  const isCashInvoice=Boolean(modal.querySelector('[data-cash-action="accept"]'));

  const title=stage==="ROUTE_CHOICE"
    ?"Define quién debe facturar este pedido"
    :isCashInvoice?"Pedido listo para facturar en Caja":"Pedido listo para facturar";
  const description=stage==="ROUTE_CHOICE"
    ?"Este pedido requiere elegir la ruta correcta de facturación. Selecciona una opción para continuar."
    :"Toma el pedido. Después solo tendrás que adjuntar el documento requerido y continuar.";

  const signature=[title,description,facts.client,facts.type,facts.document,facts.route].join("|");
  if(intro.dataset.billingTakeSignature!==signature){
    intro.dataset.billingTakeSignature=signature;
    intro.innerHTML=`
      <span class="billing-take-kicker-v1198">Antes de comenzar</span>
      <h4>${escapeHtml(title)}</h4>
      <p>${escapeHtml(description)}</p>
      <div class="billing-start-facts-v1198">
        ${fact("Cliente",facts.client)}
        ${fact("Tipo",facts.type)}
        ${fact("Documento",facts.document)}
        ${fact("Siguiente ruta",facts.route)}
      </div>`;
  }

  const accept=billingAction(modal,"accept");
  const cash=modal.querySelector('[data-billing-action="cash"]');
  if(accept){
    setText(accept.querySelector("strong"),stage==="ROUTE_CHOICE"?"Facturar en Logística":"Tomar pedido");
    setText(accept.querySelector("small"),stage==="ROUTE_CHOICE"?"Continúa la facturación desde este módulo.":"Inicia la gestión y habilita la carga del documento.");
  }
  if(cash){
    setText(cash.querySelector("strong"),"Enviar a Caja");
    setText(cash.querySelector("small"),"Mueve el pedido a Caja para realizar la facturación allí.");
  }
}

function fact(label,value){
  return `<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value||"—")}</strong></div>`;
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
    if(stepper.parentNode)stepper.parentNode.insertBefore(focus,stepper.nextSibling);
  }
  renderTaskFocus(modal,focus,stage);
}

function renderTaskFocus(modal,focus,stage){
  const facts=headerFacts(modal);
  const invoice=billingAction(modal,"invoice");
  const annex=billingAction(modal,"annex");
  const send=billingAction(modal,"send");
  const accepted=billingAction(modal,"accept");

  let action="";
  let kicker="Paso actual";
  let title="Revisa el estado de facturación";
  let description="El CRM habilitará la siguiente acción cuando el pedido esté listo.";
  let cta="";
  let icon="document";

  if(stage==="TAKE"&&accepted){
    action="accept";title="Toma el pedido";description="Inicia la gestión. Después adjuntarás el documento requerido.";cta="Tomar pedido";icon="take";
  }else if(stage==="DOCUMENT"&&visible(annex)){
    action="annex";title="Adjunta el Anexo PVP";description="Selecciona el archivo comercial requerido. El CRM lo asociará automáticamente al pedido.";cta="Subir Anexo PVP";icon="upload";
  }else if(stage==="DOCUMENT"&&visible(invoice)){
    action="invoice";title="Adjunta la factura";description="Selecciona el PDF. El CRM registra automáticamente el nombre y la fecha de carga.";cta="Subir factura";icon="upload";
  }else if(stage==="SEND"&&visible(send)){
    action="send";title="Documento listo";description=`El soporte requerido ya está registrado. Continúa hacia ${facts.route}.`;cta="Enviar a despacho";icon="check";
  }

  const signature=[stage,action,title,description,cta,icon].join("|");
  if(focus.dataset.billingFocusSignature!==signature){
    focus.dataset.billingFocusSignature=signature;
    focus.innerHTML=`
      <span class="billing-task-icon-v1198" aria-hidden="true">${iconSvg(icon)}</span>
      <div class="billing-task-copy-v1198"><span>${escapeHtml(kicker)}</span><h4>${escapeHtml(title)}</h4><p>${escapeHtml(description)}</p></div>
      ${action?`<button type="button" class="btn btn-primary billing-task-cta-v1198" data-billing-focus-action="${action}">${escapeHtml(cta)}</button>`:""}`;
  }

  const summary=[...modal.querySelectorAll(".invoice-confirmed")].find(node=>!focus.contains(node));
  if(summary)focus.append(summary);
  const exception=[...modal.querySelectorAll(".billing-approved-exception")].find(node=>!focus.contains(node));
  if(exception)focus.append(exception);
}

function iconSvg(kind){
  if(kind==="upload")return '<svg viewBox="0 0 24 24"><path d="M12 16V5m0 0-4 4m4-4 4 4"/><path d="M5 15v4h14v-4"/></svg>';
  if(kind==="check")return '<svg viewBox="0 0 24 24"><path d="m6 12 4 4 8-9"/><rect x="3.5" y="3.5" width="17" height="17" rx="4"/></svg>';
  if(kind==="take")return '<svg viewBox="0 0 24 24"><path d="M7 4h10l2 3v13H5V7l2-3Z"/><path d="M9 10h6m-3-3v6"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M7 3h8l4 4v14H5V3h2Z"/><path d="M15 3v5h4M8 12h8M8 16h6"/></svg>';
}

function adaptFooter(modal){
  const footer=modal.querySelector(".parallel-work-footer");
  if(!footer||footer.dataset.billingFooterV1198)return;
  const actions=footer.querySelector(".parallel-work-actions");
  if(!actions)return;
  const closeButton=actions.querySelector("[data-close]");
  const takeAnother=actions.querySelector("[data-take-another]");
  if(!closeButton||!takeAnother)return;

  footer.dataset.billingFooterV1198="1";
  const step=takeAnother.dataset.takeAnother||"FACTURACION";

  closeButton.removeAttribute("data-close");
  closeButton.dataset.takeAnother=step;
  closeButton.textContent="Cerrar y tomar otro";
  closeButton.classList.remove("btn-primary");
  closeButton.classList.add("btn-ghost");

  takeAnother.removeAttribute("data-take-another");
  takeAnother.dataset.billingNextV1198="1";
  takeAnother.textContent="Siguiente";
  takeAnother.classList.remove("btn-ghost");
  takeAnother.classList.add("btn-primary");
}

function syncNext(modal,stage=stageOf(modal)){
  const button=modal.querySelector("[data-billing-next-v1198]");
  if(!button)return;
  const blocked=modal.classList.contains("order-blocked-by-issue");
  let enabled=false;
  if(!blocked){
    if(stage==="ROUTE_CHOICE")enabled=Boolean(visible(billingAction(modal,"accept"))||visible(modal.querySelector('[data-billing-action="cash"]')));
    else if(stage==="TAKE")enabled=visible(billingAction(modal,"accept"));
    else if(stage==="DOCUMENT")enabled=Boolean(visible(billingAction(modal,"invoice"))||visible(billingAction(modal,"annex")));
    else if(stage==="SEND")enabled=visible(billingAction(modal,"send"));
  }
  if(button.disabled===enabled)button.disabled=!enabled;
  button.setAttribute("aria-disabled",enabled?"false":"true");
  button.title=blocked?"Resuelve la novedad pendiente antes de continuar":enabled?"Continuar con el paso actual de Facturación":"No hay una acción disponible en este momento";
}

function continueBilling(modal){
  const stage=stageOf(modal);
  if(stage==="ROUTE_CHOICE"){
    focusTarget(modal.querySelector(".billing-entry-actions"));
    return;
  }
  if(stage==="TAKE"){
    const target=billingAction(modal,"accept");
    if(visible(target))target.click();
    return;
  }
  if(stage==="DOCUMENT"){
    const target=visible(billingAction(modal,"annex"))?billingAction(modal,"annex"):billingAction(modal,"invoice");
    if(visible(target))target.click();
    return;
  }
  if(stage==="SEND"){
    const target=billingAction(modal,"send");
    if(visible(target))target.click();
    return;
  }
  focusTarget(modal.querySelector(".billing-task-focus-v1198"));
}

function focusTarget(element){
  if(!element)return;
  element.scrollIntoView({behavior:"smooth",block:"center",inline:"nearest"});
  element.classList.remove("billing-next-highlight-v1198");
  void element.offsetWidth;
  element.classList.add("billing-next-highlight-v1198");
  setTimeout(()=>element.classList.remove("billing-next-highlight-v1198"),900);
  requestAnimationFrame(()=>element.querySelector?.("button:not(:disabled)")?.focus?.({preventScroll:true}));
}

function enhanceUploadDialog(modal){
  const note=modal.querySelector(".billing-upload-note");
  if(!note)return;
  modal.classList.add("billing-upload-dialog-v1198");
  const isPvp=/PVP/i.test(modal.querySelector(".modal-head")?.textContent||modal.textContent||"");
  setText(note.querySelector("strong"),isPvp?"Selecciona el Anexo PVP":"Selecciona la factura en PDF");
  setText(note.querySelector("p"),isPvp?"El archivo quedará asociado automáticamente al pedido.":"El CRM registra automáticamente el nombre del archivo y la fecha de carga.");
  setText(modal.querySelector('.field label'),isPvp?"Archivo Anexo PVP *":"Factura PDF *");
}

function onClick(event){
  const next=event.target.closest?.("[data-billing-next-v1198]");
  if(next){
    if(next.disabled)return;
    const modal=next.closest(".billing-process-modal.billing-focus-v1198");
    if(!modal)return;
    event.preventDefault();
    continueBilling(modal);
    return;
  }

  const focusAction=event.target.closest?.("[data-billing-focus-action]");
  if(focusAction){
    const modal=focusAction.closest(".billing-process-modal.billing-focus-v1198");
    if(!modal)return;
    const original=billingAction(modal,focusAction.dataset.billingFocusAction);
    if(visible(original))original.click();
  }
}

function escapeHtml(value){
  return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]));
}

function install(){
  enhanceAll();
  document.addEventListener("click",onClick);
  observedRoot=document.querySelector("#modal-root");
  if(!observedRoot)return;
  observer=new MutationObserver(schedule);
  observe();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
