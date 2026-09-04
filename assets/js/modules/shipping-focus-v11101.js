let observer=null;
let scheduled=false;

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;observer?.disconnect();enhanceAll();observe()});
}
function observe(){
  const root=document.querySelector("#modal-root");
  if(root&&observer)observer.observe(root,{childList:true,subtree:true});
}
function enhanceAll(){document.querySelectorAll("#modal-root .shipping-process-modal").forEach(enhanceShipping)}

function enhanceShipping(modal){
  if(modal.dataset.shippingFocusV11101==="1")return;
  modal.dataset.shippingFocusV11101="1";
  modal.classList.add("shipping-focus-v11101");
  const body=modal.querySelector(".shipping-process-body");
  if(!body)return;

  const take=body.querySelector("[data-take-shipping]");
  const closurePhoto=body.querySelector("[data-attach-closure-photo]");
  const addGuide=body.querySelector("[data-add-guide]");

  if(take)enhanceTakeState(body,take);
  else if(closurePhoto||body.querySelector(".shipping-photo-only"))enhanceClosureState(body);
  else if(addGuide||body.querySelector(".shipping-action-stack"))enhanceWorkingState(body);

  organizeSecondary(body);
  enhanceFooter(modal);
}

function enhanceTakeState(body,take){
  const card=take.closest(".shipping-take-card");
  if(!card)return;
  card.classList.add("shipping-take-focus-v11101");
  const title=card.querySelector("h4");
  const copy=card.querySelector("p");
  if(title)title.textContent="Preparar despacho";
  if(copy)copy.textContent="Confirma el destino, toma el pedido y continúa. Después solo tendrás que registrar la guía del envío.";
  const icon=card.querySelector(".shipping-take-icon");
  if(icon)icon.innerHTML="<span aria-hidden=\"true\">↗</span>";

  const address=body.querySelector(":scope > .shipping-sales-address");
  if(address&&!card.contains(address)){
    address.classList.add("shipping-take-address-v11101");
    card.insertBefore(address,take);
  }
  take.textContent="Tomar pedido y continuar";
}

function enhanceWorkingState(body){
  body.classList.add("shipping-working-v11101");
  const progress=body.querySelector(".shipping-progress");
  progress?.classList.add("shipping-stepper-v11101");

  const card=body.querySelector(".shipping-step-card");
  if(card){
    card.classList.add("shipping-guide-task-v11101");
    const h4=card.querySelector("h4");
    const p=card.querySelector("p");
    if(h4)h4.textContent=card.classList.contains("completed")?"Guía registrada":"Registra la guía del envío";
    if(p)p.textContent=card.classList.contains("completed")?"Revisa los datos detectados y continúa al cierre.":"Sube PDF, imagen o CSV. El CRM intentará leer los datos y podrás corregirlos manualmente.";
    card.querySelectorAll("[data-add-guide]").forEach(button=>{button.textContent=card.classList.contains("completed")?"Revisar o editar guía":"Cargar o registrar guía"});
  }

  const callout=body.querySelector(".shipping-closure-callout");
  if(callout){
    callout.classList.add("shipping-next-card-v11101");
    const h4=callout.querySelector("h4");
    const p=callout.querySelector("p");
    if(h4)h4.textContent="Siguiente paso";
    if(p)p.textContent=callout.classList.contains("ready")?"La guía está lista. Continúa para registrar la evidencia final del despacho.":"Cuando termines la guía, el botón Siguiente se habilitará automáticamente.";
    const internal=callout.querySelector("[data-send-closure]");
    if(internal)internal.classList.add("shipping-internal-next-v11101");
  }
}

function enhanceClosureState(body){
  body.classList.add("shipping-closure-v11101");
  const card=body.querySelector(".shipping-photo-only");
  if(!card)return;
  const title=card.querySelector("h4");
  const copy=card.querySelector("p");
  if(title)title.textContent="Evidencia final del despacho";
  if(copy)copy.textContent="Toma o selecciona una foto del vehículo con la mercancía cargada. Al terminar la carga, el CRM cerrará el pedido automáticamente.";
}

function organizeSecondary(body){
  let details=body.querySelector(".shipping-secondary-v11101");
  if(!details){
    details=document.createElement("details");
    details.className="shipping-secondary-v11101";
    details.innerHTML='<summary><span>Más información y novedades</span><small>Destino, trazabilidad y datos completos</small></summary><div class="shipping-secondary-body-v11101"></div>';
    body.append(details);
  }
  const target=details.querySelector(".shipping-secondary-body-v11101");
  if(!target)return;

  const candidates=[...body.children].filter(el=>{
    if(el===details)return false;
    if(el.matches(".shipping-overview-grid"))return true;
    if(el.matches(".shipping-sales-address")&&!el.closest(".shipping-take-card"))return true;
    if(el.matches(".simple-details"))return true;
    const text=(el.textContent||"").toUpperCase();
    return text.includes("TRAZABILIDAD OPERATIVA")&&text.includes("REGISTRAR SITUACIÓN");
  });
  candidates.forEach(el=>target.append(el));
}

function enhanceFooter(modal){
  const footer=modal.querySelector(".parallel-work-footer");
  const actions=footer?.querySelector(".parallel-work-actions");
  if(!footer||!actions||footer.dataset.shippingFooterV11101==="1")return;
  footer.dataset.shippingFooterV11101="1";

  const oldClose=actions.querySelector("[data-close]");
  const takeAnother=actions.querySelector("[data-take-another]");
  if(takeAnother){
    takeAnother.textContent="Cerrar y tomar otro";
    takeAnother.classList.remove("btn-primary");
    takeAnother.classList.add("btn-ghost","shipping-take-another-v11101");
  }
  if(oldClose){
    oldClose.onclick=null;
    oldClose.removeAttribute("data-close");
    oldClose.dataset.shippingNext="1";
    oldClose.textContent="Siguiente";
    oldClose.classList.remove("btn-ghost");
    oldClose.classList.add("btn-primary","shipping-next-v11101");
    oldClose.addEventListener("click",()=>goNext(modal));
  }
  if(takeAnother&&oldClose){actions.append(takeAnother,oldClose)}
}

function goNext(modal){
  const selectors=[
    "[data-take-shipping]:not(:disabled)",
    ".shipping-guide-task-v11101:not(.completed) [data-add-guide]:not(:disabled)",
    "[data-send-closure]:not(:disabled)",
    "[data-attach-closure-photo]:not(:disabled)",
    ".shipping-guide-task-v11101.completed [data-add-guide]:not(:disabled)"
  ];
  for(const selector of selectors){
    const target=modal.querySelector(selector);
    if(target){target.click();return}
  }
  const active=modal.querySelector(".shipping-guide-task-v11101,.shipping-photo-only,.shipping-take-card");
  active?.scrollIntoView({behavior:"smooth",block:"center"});
}

function install(){
  enhanceAll();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  observer=new MutationObserver(schedule);
  observe();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
