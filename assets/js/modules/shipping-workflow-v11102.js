import {api} from "../services/api.js";

let observer=null;
let scheduled=false;
const deliveryCache=new Map();

const PROFILES={
  CLIENT_POINT:{
    label:"Entrega en punto",
    takeTitle:"Preparar entrega en punto",
    takeTask:"Confirma el punto y toma el pedido",
    takeCopy:"La información del destino ya viene de Ventas. Revísala, toma el pedido y continúa con el soporte de la entrega.",
    takeCta:"Tomar entrega y continuar",
    guideTitle:"Registrar guía o soporte de entrega",
    guideCopy:"Carga PDF, imagen o CSV, o completa los datos manualmente. El CRM intentará leer transportadora, guía, factura y flete.",
    closureTitle:"Cerrar entrega en punto",
    closureCopy:"Adjunta la evidencia final. Al registrarla, el CRM finalizará el pedido automáticamente.",
    destinationLabel:"Punto de entrega"
  },
  CLIENT_PICKUP:{
    label:"Cliente recoge",
    takeTitle:"Preparar retiro del cliente",
    takeTask:"Confirma el retiro y toma el pedido",
    takeCopy:"Toma el pedido para dejar trazado el retiro. Después registra el soporte correspondiente y continúa al cierre.",
    takeCta:"Tomar retiro y continuar",
    guideTitle:"Registrar guía o soporte del retiro",
    guideCopy:"Carga PDF, imagen o CSV, o completa los datos manualmente. El soporte queda asociado al pedido y puede corregirse antes de guardar.",
    closureTitle:"Cerrar retiro del cliente",
    closureCopy:"Adjunta la evidencia final del retiro. El pedido se cerrará automáticamente cuando el registro termine correctamente.",
    destinationLabel:"Referencia de retiro"
  },
  LOCAL_DISPATCH:{
    label:"Despacho local",
    takeTitle:"Preparar despacho local",
    takeTask:"Confirma el destino y toma el pedido",
    takeCopy:"La dirección ya fue registrada por Ventas. Toma el pedido y continúa con la guía del envío local.",
    takeCta:"Tomar despacho y continuar",
    guideTitle:"Registrar guía del despacho local",
    guideCopy:"Carga PDF, imagen o CSV, o completa manualmente transportadora, guía, factura del transportador y costo del flete.",
    closureTitle:"Cerrar despacho local",
    closureCopy:"Adjunta la evidencia final del vehículo o de la entrega. El CRM cerrará el pedido automáticamente al terminar.",
    destinationLabel:"Destino"
  },
  NATIONAL_DISPATCH:{
    label:"Despacho nacional",
    takeTitle:"Preparar despacho nacional",
    takeTask:"Confirma el destino y toma el pedido",
    takeCopy:"La dirección ya fue registrada por Ventas. Toma el pedido y continúa con la guía del envío nacional.",
    takeCta:"Tomar despacho y continuar",
    guideTitle:"Registrar guía del despacho nacional",
    guideCopy:"Carga PDF, imagen o CSV, o completa manualmente transportadora, guía, factura del transportador y costo del flete.",
    closureTitle:"Cerrar despacho nacional",
    closureCopy:"Adjunta la evidencia final del despacho. El CRM cerrará el pedido automáticamente cuando el registro termine correctamente.",
    destinationLabel:"Destino"
  },
  GENERIC:{
    label:"Despacho",
    takeTitle:"Preparar despacho",
    takeTask:"Confirma la información y toma el pedido",
    takeCopy:"Revisa los datos esenciales, toma el pedido y continúa con el soporte del envío.",
    takeCta:"Tomar pedido y continuar",
    guideTitle:"Registrar guía o soporte",
    guideCopy:"Carga PDF, imagen o CSV, o completa los datos manualmente antes de guardar.",
    closureTitle:"Cerrar despacho",
    closureCopy:"Adjunta la evidencia final para completar el proceso.",
    destinationLabel:"Destino"
  }
};

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
  document.querySelectorAll("#modal-root .shipping-process-modal").forEach(enhanceShippingModal);
  document.querySelectorAll("#modal-root .shipping-guide-reader-v11101").forEach(enhanceGuideDialog);
}

function enhanceShippingModal(modal){
  const body=modal.querySelector(".shipping-process-body");
  if(!body)return;

  modal.classList.add("shipping-workflow-v11102");
  const route=routeOf(modal);
  const profile=PROFILES[route]||PROFILES.GENERIC;
  const stage=stageOf(modal);
  modal.dataset.shippingRouteV11102=route;
  modal.dataset.shippingStageV11102=stage;

  const facts=extractFacts(modal,profile);
  buildWorkflowHeader(modal,profile,stage,facts);
  decorateStepper(modal,profile,stage);
  if(stage==="TAKE")decorateTake(modal,profile,facts);
  if(stage==="GUIDE"||stage==="READY")decorateGuide(modal,profile,stage);
  if(stage==="CLOSURE")decorateClosure(modal,profile);
  organizeSecondary(modal,stage);
  adaptFooter(modal,stage);
  syncFooter(modal,stage);

  if(stage!=="TAKE")loadDelivery(modal).then(delivery=>{
    if(!delivery||!modal.isConnected)return;
    const latestStage=stageOf(modal);
    buildWorkflowHeader(modal,profile,latestStage,extractFacts(modal,profile),delivery);
    enrichGuideData(modal,delivery);
    syncFooter(modal,latestStage);
  }).catch(()=>{});
}

function routeOf(modal){
  const raw=[modal.querySelector(".shipping-process-head p")?.textContent,modal.querySelector(".shipping-route-chip")?.textContent].filter(Boolean).join(" ");
  const text=normalize(raw);
  if(text.includes("CLIENTE RECOGE")||text.includes("RECOGE"))return "CLIENT_PICKUP";
  if(text.includes("ENTREGA EN PUNTO")||text.includes("PUNTO CLIENTE")||text.includes("ENTREGA PUNTO"))return "CLIENT_POINT";
  if(text.includes("DESPACHO LOCAL")||text.includes(" LOCAL"))return "LOCAL_DISPATCH";
  if(text.includes("DESPACHO NACIONAL")||text.includes("NACIONAL"))return "NATIONAL_DISPATCH";
  return "GENERIC";
}

function stageOf(modal){
  if(modal.querySelector("[data-attach-closure-photo],.shipping-photo-only"))return "CLOSURE";
  if(modal.querySelector("[data-take-shipping]"))return "TAKE";
  const guideCard=modal.querySelector(".shipping-step-card,.shipping-guide-task-v11101");
  if(guideCard?.classList.contains("completed"))return "READY";
  if(modal.querySelector("[data-add-guide],.shipping-action-stack"))return "GUIDE";
  return "GUIDE";
}

function extractFacts(modal,profile){
  const header=modal.querySelector(".shipping-process-head");
  const order=header?.querySelector("h3")?.textContent?.trim()||"Pedido";
  const parts=(header?.querySelector("p")?.textContent||"").split("·").map(value=>value.trim()).filter(Boolean);
  const client=parts[0]||"Cliente";
  const route=parts.at(-1)||profile.label;
  const address=modal.querySelector(".shipping-sales-address");
  const city=address?.querySelector("header strong")?.textContent?.trim()||"";
  const line=address?.querySelector(":scope > p")?.textContent?.trim()||"";
  return {order,client,route,city,line};
}

function buildWorkflowHeader(modal,profile,stage,facts,delivery=null){
  const body=modal.querySelector(".shipping-process-body");
  if(!body)return;
  let section=body.querySelector(":scope > .shipping-workflow-head-v11102");
  if(!section){
    section=document.createElement("section");
    section.className="shipping-workflow-head-v11102";
    body.prepend(section);
  }

  const copy=stageCopy(profile,stage);
  const stageNumber=stage==="TAKE"?1:stage==="CLOSURE"?3:2;
  const routeIcon=iconSvg(stage==="CLOSURE"?"check":routeIconKind(modal.dataset.shippingRouteV11102));
  const deliveryFacts=delivery&&stage!=="TAKE"?deliverySummaryFacts(delivery):null;
  const factList=deliveryFacts||[
    ["Pedido",facts.order],
    ["Cliente",facts.client],
    ["Modalidad",profile.label],
    [profile.destinationLabel,facts.city||facts.line||"Registrado por Ventas"]
  ];
  const signature=JSON.stringify([profile.label,stage,copy.title,copy.description,factList]);
  if(section.dataset.signature===signature)return;
  section.dataset.signature=signature;
  section.innerHTML=`
    <div class="shipping-workflow-top-v11102">
      <span class="shipping-route-icon-v11102" aria-hidden="true">${routeIcon}</span>
      <span class="shipping-route-name-v11102">${escapeHtml(profile.label)}</span>
      <span class="shipping-step-count-v11102">Paso ${stageNumber} de 3</span>
    </div>
    <h4>${escapeHtml(copy.title)}</h4>
    <p>${escapeHtml(copy.description)}</p>
    <div class="shipping-essential-facts-v11102">
      ${factList.map(([label,value])=>`<div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value||"—")}</strong></div>`).join("")}
    </div>`;
}

function stageCopy(profile,stage){
  if(stage==="TAKE")return {title:profile.takeTitle,description:"Empieza con lo esencial. Los datos detallados y las novedades quedan disponibles abajo sin ocupar el área de trabajo."};
  if(stage==="GUIDE")return {title:profile.guideTitle,description:profile.guideCopy};
  if(stage==="READY")return {title:"Soporte listo para continuar",description:"Revisa los datos guardados y continúa al cierre. Si necesitas corregirlos, puedes volver a abrir la guía."};
  return {title:profile.closureTitle,description:profile.closureCopy};
}

function decorateStepper(modal,profile,stage){
  const progress=modal.querySelector(".shipping-progress");
  if(!progress)return;
  progress.classList.add("shipping-stepper-v11102");
  const labels=progress.querySelectorAll(".shipping-progress-item strong");
  if(labels[0])labels[0].textContent="Tomar";
  if(labels[1])labels[1].textContent=modal.dataset.shippingRouteV11102==="CLIENT_PICKUP"?"Soporte":"Guía";
  if(labels[2])labels[2].textContent="Cierre";
}

function decorateTake(modal,profile,facts){
  const card=modal.querySelector(".shipping-take-card");
  if(!card)return;
  card.classList.add("shipping-primary-task-v11102","shipping-take-task-v11102");
  card.querySelector(".shipping-route-chip")?.classList.add("shipping-legacy-hidden-v11102");
  card.querySelector(".shipping-take-icon")?.classList.add("shipping-legacy-hidden-v11102");
  const title=card.querySelector("h4");
  const copy=card.querySelector(":scope > p");
  if(title)title.textContent=profile.takeTask;
  if(copy)copy.textContent=profile.takeCopy;

  let destination=card.querySelector(".shipping-destination-compact-v11102");
  if(!destination){
    destination=document.createElement("div");
    destination.className="shipping-destination-compact-v11102";
    const button=card.querySelector("[data-take-shipping]");
    if(button)card.insertBefore(destination,button);else card.append(destination);
  }
  destination.innerHTML=`<span>${escapeHtml(profile.destinationLabel)}</span><strong>${escapeHtml(facts.city||"Registrado por Ventas")}</strong><small>${escapeHtml(facts.line||"Consulta los datos completos en Más información y novedades")}</small>`;

  const button=card.querySelector("[data-take-shipping]");
  if(button){button.textContent=profile.takeCta;button.classList.add("shipping-primary-cta-v11102")}
  card.querySelectorAll(":scope > small").forEach(node=>node.classList.add("shipping-inline-help-v11102"));
}

function decorateGuide(modal,profile,stage){
  const stack=modal.querySelector(".shipping-action-stack");
  stack?.classList.add("shipping-primary-stack-v11102");
  const card=modal.querySelector(".shipping-step-card,.shipping-guide-task-v11101");
  if(!card)return;
  card.classList.add("shipping-primary-task-v11102","shipping-guide-task-v11102");
  const title=card.querySelector("h4");
  const copy=card.querySelector("p");
  if(title)title.textContent=stage==="READY"?"Guía o soporte registrado":profile.guideTitle;
  if(copy)copy.textContent=stage==="READY"?"Los datos quedaron guardados. Puedes revisarlos o continuar directamente al cierre.":profile.guideCopy;
  card.querySelectorAll("[data-add-guide]").forEach(button=>{
    button.textContent=stage==="READY"?"Revisar o editar datos":"Cargar archivo o registrar manualmente";
    button.classList.add("shipping-primary-cta-v11102");
  });
}

function decorateClosure(modal,profile){
  const card=modal.querySelector(".shipping-photo-only");
  if(!card)return;
  card.classList.add("shipping-primary-task-v11102","shipping-closure-task-v11102");
  card.querySelector(".shipping-route-chip")?.classList.add("shipping-legacy-hidden-v11102");
  card.querySelector(".shipping-take-icon")?.classList.add("shipping-legacy-hidden-v11102");
  const title=card.querySelector("h4");
  const copy=card.querySelector(":scope > p");
  if(title)title.textContent="Adjunta la evidencia final";
  if(copy)copy.textContent=profile.closureCopy;
  const button=card.querySelector("[data-attach-closure-photo]");
  if(button){button.textContent="Adjuntar evidencia y finalizar";button.classList.add("shipping-primary-cta-v11102")}
}

function organizeSecondary(modal,stage){
  const body=modal.querySelector(".shipping-process-body");
  if(!body)return;
  let details=body.querySelector(":scope > .shipping-secondary-v11102");
  if(!details){
    details=document.createElement("details");
    details.className="shipping-secondary-v11102";
    details.innerHTML='<summary><span>Más información y novedades</span><small>Destino, trazabilidad y acciones excepcionales</small></summary><div class="shipping-secondary-body-v11102"></div>';
    body.append(details);
  }
  const target=details.querySelector(".shipping-secondary-body-v11102");
  if(!target)return;

  const legacy=body.querySelector(":scope > .shipping-secondary-v11101");
  if(legacy){
    const legacyBody=legacy.querySelector(".shipping-secondary-body-v11101");
    [...(legacyBody?.children||[])].forEach(node=>target.append(node));
    legacy.remove();
  }

  const selectors=[".order-support-zone",".shipping-overview-grid",".shipping-sales-address",".dispatch-recap",".simple-details"];
  selectors.forEach(selector=>{
    body.querySelectorAll(selector).forEach(node=>{
      if(details.contains(node)||node.closest(".shipping-primary-task-v11102"))return;
      target.append(node);
    });
  });

  const callout=body.querySelector(".shipping-closure-callout");
  if(callout&&!details.contains(callout)){
    callout.classList.add("shipping-system-action-v11102");
    target.append(callout);
  }

  const footer=modal.querySelector(".parallel-work-footer");
  const cancel=footer?.querySelector("[data-request-order-cancellation]");
  if(cancel&&!target.contains(cancel)){
    let row=target.querySelector(".shipping-secondary-actions-v11102");
    if(!row){row=document.createElement("div");row.className="shipping-secondary-actions-v11102";target.prepend(row)}
    const marker=document.createElement("span");
    marker.hidden=true;
    marker.dataset.requestOrderCancellation=cancel.dataset.requestOrderCancellation||"1";
    footer.append(marker);
    cancel.classList.add("shipping-cancellation-secondary-v11102");
    row.append(cancel);
  }

  if(modal.classList.contains("order-blocked-by-issue"))details.open=true;
}

function adaptFooter(modal,stage){
  const footer=modal.querySelector(".parallel-work-footer");
  const actions=footer?.querySelector(".parallel-work-actions");
  if(!footer||!actions)return;
  footer.classList.add("shipping-footer-v11102");

  let next=actions.querySelector("[data-shipping-next-v11102]");
  if(!next){
    const legacyNext=actions.querySelector("[data-shipping-next],.shipping-next-v11101");
    const close=actions.querySelector("[data-close]");
    const source=legacyNext||close;
    if(source){
      next=source.cloneNode(true);
      source.replaceWith(next);
      next.removeAttribute("data-close");
      next.removeAttribute("data-shipping-next");
      next.dataset.shippingNextV11102="1";
      next.textContent="Siguiente";
      next.className="btn btn-primary shipping-next-v11102";
      next.addEventListener("click",event=>{
        event.preventDefault();
        continueShipping(modal);
      });
    }
  }

  const takeAnother=actions.querySelector("[data-take-another]");
  if(takeAnother){
    takeAnother.textContent="Cerrar y tomar otro";
    takeAnother.classList.remove("btn-primary");
    takeAnother.classList.add("btn-ghost","shipping-take-another-v11102");
  }
  if(takeAnother&&next)actions.append(takeAnother,next);
}

function syncFooter(modal,stage){
  const next=modal.querySelector("[data-shipping-next-v11102]");
  if(!next)return;
  const target=targetForStage(modal,stage);
  const enabled=Boolean(target&&!target.disabled&&!modal.classList.contains("order-blocked-by-issue"));
  next.disabled=!enabled;
  next.setAttribute("aria-disabled",enabled?"false":"true");
  next.title=enabled?"Continuar con el paso actual":"Completa o resuelve la condición pendiente antes de continuar";
}

function continueShipping(modal){
  const stage=stageOf(modal);
  const target=targetForStage(modal,stage);
  if(target&&!target.disabled){target.click();return}
  const focus=modal.querySelector(".shipping-primary-task-v11102");
  if(focus){
    focus.scrollIntoView({behavior:"smooth",block:"center"});
    focus.classList.remove("shipping-next-highlight-v11102");
    void focus.offsetWidth;
    focus.classList.add("shipping-next-highlight-v11102");
    setTimeout(()=>focus.classList.remove("shipping-next-highlight-v11102"),850);
  }
}

function targetForStage(modal,stage){
  if(stage==="TAKE")return modal.querySelector("[data-take-shipping]");
  if(stage==="GUIDE")return modal.querySelector("[data-add-guide]");
  if(stage==="READY")return modal.querySelector("[data-send-closure]");
  if(stage==="CLOSURE")return modal.querySelector("[data-attach-closure-photo]");
  return null;
}

function enhanceGuideDialog(modal){
  if(modal.dataset.shippingGuideV11102==="1")return;
  modal.dataset.shippingGuideV11102="1";
  modal.classList.add("shipping-guide-v11102");

  const required=["carrier","trackingNumber","carrierInvoiceNumberV11101","carrierCostV11101"];
  required.forEach(name=>{
    const input=modal.querySelector(`[name="${name}"]`);
    if(!input)return;
    input.required=true;
    input.setAttribute("aria-required","true");
    const label=input.closest("label")?.querySelector(":scope > span");
    if(label&&!label.querySelector("em"))label.insertAdjacentHTML("beforeend",' <em>*</em>');
  });

  const hero=modal.querySelector(".guide-reader-hero-v11101 p");
  if(hero)hero.textContent="Puedes subir PDF, imagen o CSV, o llenar todo manualmente. Antes de guardar deben quedar completos transportadora, guía, factura del transportador y costo del flete.";
  const help=modal.querySelector(".guide-reader-help-v11101");
  if(help&&!help.querySelector("[data-shipping-required-v11102]"))help.insertAdjacentHTML("beforeend",'<span data-shipping-required-v11102><b>Obligatorio:</b> los cuatro datos del transporte deben quedar completos.</span>');
}

async function loadDelivery(modal){
  const orderId=modal.dataset.orderId;
  if(!orderId)return null;
  const cached=deliveryCache.get(orderId);
  if(cached&&Date.now()-cached.time<15000)return cached.delivery;
  const data=await api.getOrder(orderId);
  const deliveries=[...(data?.deliveries||[])].sort((a,b)=>new Date(b.updated_at||b.created_at||0)-new Date(a.updated_at||a.created_at||0));
  const delivery=deliveries[0]||null;
  deliveryCache.set(orderId,{time:Date.now(),delivery});
  return delivery;
}

function enrichGuideData(modal,delivery){
  const card=modal.querySelector(".shipping-data-card");
  if(!card)return;
  let extra=card.querySelector(".shipping-guide-extra-v11102");
  if(!extra){extra=document.createElement("div");extra.className="shipping-guide-extra-v11102";card.append(extra)}
  extra.innerHTML=`
    <div><small>Factura transportadora</small><strong>${escapeHtml(carrierInvoice(delivery)||"—")}</strong></div>
    <div><small>Costo del flete</small><strong>${escapeHtml(formatCurrency(carrierCost(delivery)))}</strong></div>`;
}

function deliverySummaryFacts(delivery){
  return [
    ["Guía",delivery?.tracking_number||delivery?.trackingNumber||"—"],
    ["Transportadora",delivery?.carrier||"—"],
    ["Factura transporte",carrierInvoice(delivery)||"—"],
    ["Flete",formatCurrency(carrierCost(delivery))]
  ];
}

function carrierInvoice(delivery){return delivery?.carrier_invoice_number||delivery?.carrierInvoiceNumber||delivery?.metadata?.carrierInvoiceNumber||""}
function carrierCost(delivery){return delivery?.carrier_cost??delivery?.carrierCost??delivery?.metadata?.carrierCost??null}
function formatCurrency(value){const n=Number(value);return Number.isFinite(n)?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n):"—"}

function routeIconKind(route){
  if(route==="CLIENT_POINT")return "pin";
  if(route==="CLIENT_PICKUP")return "pickup";
  return "truck";
}

function iconSvg(kind){
  if(kind==="pin")return '<svg viewBox="0 0 24 24"><path d="M12 21s6-5.2 6-11a6 6 0 1 0-12 0c0 5.8 6 11 6 11Z"/><circle cx="12" cy="10" r="2.2"/></svg>';
  if(kind==="pickup")return '<svg viewBox="0 0 24 24"><path d="M4 8h16v11H4z"/><path d="M8 8V5h8v3M8 13h8M12 10v6"/></svg>';
  if(kind==="check")return '<svg viewBox="0 0 24 24"><path d="m5 12 4 4 10-10"/><path d="M12 22a10 10 0 1 0-9-6"/></svg>';
  return '<svg viewBox="0 0 24 24"><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>';
}

function normalize(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase()}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}

function install(){
  enhanceAll();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  observer=new MutationObserver(schedule);
  observe();
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
