import {state} from "../core/state.js";
import {fmt} from "../core/format.js";
import {icon} from "../core/icons.js";

const ORDER_TYPES=new Set(["PVC","PVN","PVE","PVP"]);
const EXTRA_FIELDS=["clientDocument","clientPhone","externalReference","requestedDeliveryDate"];
let scheduled=false;
let observer=null;

function installOrderTypeLabels(){
  if(!fmt.__orderTypeLabelsV1191){
    const previous=fmt.label.bind(fmt);
    fmt.label=value=>{
      const key=String(value??"").trim().toUpperCase();
      return ORDER_TYPES.has(key)?key:previous(value);
    };
    Object.defineProperty(fmt,"__orderTypeLabelsV1191",{value:true,configurable:false});
  }
  (state.catalogs?.orderTypes||[]).forEach(item=>{
    const code=String(item?.code||"").toUpperCase();
    if(ORDER_TYPES.has(code))item.name=code;
  });
}

function normalizeRenderedOrderTypes(root=document){
  root.querySelectorAll("select option").forEach(option=>{
    const code=String(option.value||"").toUpperCase();
    if(ORDER_TYPES.has(code)&&option.textContent!==code)option.textContent=code;
  });
  const legacy=new Map([
    ["Pedido de venta crédito","PVC"],
    ["Pedido de venta a crédito","PVC"],
    ["Pedido de venta nacional","PVN"],
    ["Perdido de venta nacional","PVN"],
    ["Pedido de venta especial","PVE"],
    ["Pedido de venta proyecto","PVP"]
  ]);
  root.querySelectorAll("span,strong,small,label,b").forEach(node=>{
    const value=(node.textContent||"").trim();
    if(legacy.has(value)&&node.children.length===0)node.textContent=legacy.get(value);
  });
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    installOrderTypeLabels();
    normalizeRenderedOrderTypes();
    enhanceCreateOrder();
  });
}

function createOrderModal(){
  return [...document.querySelectorAll("#modal-root .wizard-modal")].find(modal=>/crear pedido/i.test(modal.querySelector(".wizard-head h3")?.textContent||""))||null;
}

function ensureHidden(form,name,value=""){
  let input=form.querySelector(`input[type="hidden"][name="${name}"]`);
  if(!input){
    input=document.createElement("input");
    input.type="hidden";
    input.name=name;
    form.append(input);
  }
  if(value&&!input.value)input.value=value;
  return input;
}

function extractAdditionalFields(modal){
  const form=modal.querySelector(".wizard-form");
  if(!form)return;
  const details=[...modal.querySelectorAll("details.simple-details")].find(item=>/datos adicionales del cliente/i.test(item.querySelector("summary")?.textContent||""));
  EXTRA_FIELDS.forEach(name=>{
    const source=details?.querySelector(`[name="${name}"]`);
    ensureHidden(form,name,source?.value||"");
  });
  details?.remove();
}

function enhanceCreateOrder(){
  const modal=createOrderModal();
  if(!modal||modal.dataset.createOrderV1191)return;
  modal.dataset.createOrderV1191="1";
  modal.classList.add("create-order-v1191");
  extractAdditionalFields(modal);
  normalizeRenderedOrderTypes(modal);

  const subtitle=modal.querySelector(".wizard-head p");
  if(subtitle)subtitle.textContent="Crea el pedido paso a paso. El CRM conserva automáticamente la ruta, la trazabilidad y los datos que ya conoce.";
  const guide=modal.querySelector(".popup-process-guide-v1190");
  if(guide){
    const title=guide.querySelector(".popup-guide-copy-v1190 strong");
    const copy=guide.querySelector(".popup-guide-copy-v1190 p");
    const meta=guide.querySelector("[data-popup-guide-meta]");
    if(title)title.textContent="Crear pedido sin complicaciones";
    if(copy)copy.textContent="Primero registra pedido, cliente y entrega. Después eliges si necesitas guardar datos opcionales del cliente y continúas con los materiales.";
    if(meta)meta.textContent="3 pasos · guiado";
  }
  const first=modal.querySelector('[data-wizard-panel="0"] .wizard-step-intro');
  if(first&&!first.querySelector(".create-order-step-mark-v1191")){
    const mark=document.createElement("div");
    mark.className="create-order-step-mark-v1191";
    mark.innerHTML=`<span>${icon("orders")}</span><div><strong>Registra solo lo esencial</strong><small>Los datos adicionales del cliente son opcionales y se preguntarán al continuar.</small></div>`;
    first.after(mark);
  }
}

function validateFirstStep(modal){
  const panel=modal.querySelector('[data-wizard-panel="0"]');
  if(!panel)return false;
  const controls=[...panel.querySelectorAll("input,select,textarea")].filter(control=>!control.disabled&&control.type!=="hidden");
  for(const control of controls){
    if(!control.checkValidity()){
      control.reportValidity();
      control.focus({preventScroll:true});
      return false;
    }
  }
  const address=panel.querySelector('[name="clientAddress"]');
  if(address&&address.value.trim().length<5){
    address.setCustomValidity("Escribe una dirección de entrega completa.");
    address.reportValidity();
    address.focus({preventScroll:true});
    address.addEventListener("input",()=>address.setCustomValidity(""),{once:true});
    return false;
  }
  return true;
}

function extraValues(modal){
  const form=modal.querySelector(".wizard-form");
  return Object.fromEntries(EXTRA_FIELDS.map(name=>[name,form?.querySelector(`input[type="hidden"][name="${name}"]`)?.value||""]));
}

function saveExtraValues(modal,panel){
  const form=modal.querySelector(".wizard-form");
  if(!form)return;
  EXTRA_FIELDS.forEach(name=>{
    ensureHidden(form,name).value=panel.querySelector(`[name="extra_${name}"]`)?.value?.trim?.()||panel.querySelector(`[name="extra_${name}"]`)?.value||"";
  });
}

function clearExtraValues(modal){
  const form=modal.querySelector(".wizard-form");
  EXTRA_FIELDS.forEach(name=>{const input=form?.querySelector(`input[type="hidden"][name="${name}"]`);if(input)input.value=""});
}

function continueWizard(next){
  next.dataset.clientExtraBypass="1";
  next.click();
}

function openClientExtraDecision(modal,next){
  if(modal.querySelector(".client-extra-shell-v1191"))return;
  const values=extraValues(modal);
  const context=[...modal.children];
  const shell=document.createElement("div");
  shell.className="client-extra-shell-v1191";
  shell.innerHTML=`
    <div class="client-extra-scrim-v1191" aria-hidden="true"></div>
    <section class="client-extra-dialog-v1191" role="region" aria-label="Datos adicionales del cliente" tabindex="-1">
      <button type="button" class="client-extra-close-v1191" data-extra-close aria-label="Cerrar">×</button>
      <div class="client-extra-question-v1191" data-extra-question>
        <span class="client-extra-figure-v1191">${icon("sales")}</span>
        <div class="client-extra-kicker-v1191">DATOS OPCIONALES</div>
        <h4>¿Quiere agregar más datos del cliente?</h4>
        <p>No son necesarios para crear el pedido. Úselos únicamente cuando quiera dejar información comercial adicional para consulta posterior.</p>
        <div class="client-extra-benefits-v1191">
          <span>NIT o documento</span><span>Teléfono</span><span>Referencia externa</span><span>Fecha solicitada</span>
        </div>
        <div class="client-extra-choice-grid-v1191">
          <button type="button" class="client-extra-choice-v1191 secondary" data-extra-no><strong>No hay necesidad</strong><small>Continuar directamente a Materiales</small></button>
          <button type="button" class="client-extra-choice-v1191 primary" data-extra-yes><strong>Sí</strong><small>Agregar los datos opcionales</small></button>
        </div>
      </div>
      <form class="client-extra-form-v1191" data-extra-form hidden>
        <header><span>${icon("sales")}</span><div><strong>Datos adicionales del cliente</strong><small>Complete únicamente lo que tenga disponible. Ningún campo es obligatorio.</small></div></header>
        <div class="client-extra-fields-v1191">
          <label><span>NIT o documento</span><input class="control" name="extra_clientDocument" value="${fmt.escape(values.clientDocument)}" autocomplete="off"></label>
          <label><span>Teléfono</span><input class="control" name="extra_clientPhone" value="${fmt.escape(values.clientPhone)}" inputmode="tel" autocomplete="tel"></label>
          <label><span>Referencia externa</span><input class="control" name="extra_externalReference" value="${fmt.escape(values.externalReference)}"></label>
          <label><span>Fecha solicitada</span><input class="control" name="extra_requestedDeliveryDate" type="date" value="${fmt.escape(values.requestedDeliveryDate)}"></label>
        </div>
        <footer><button type="button" class="btn btn-ghost" data-extra-back>Volver</button><button type="submit" class="btn btn-primary">Guardar y continuar</button></footer>
      </form>
    </section>`;

  context.forEach(node=>{node.setAttribute("inert","");node.setAttribute("aria-hidden","true")});
  modal.append(shell);
  const dialog=shell.querySelector(".client-extra-dialog-v1191");
  const question=shell.querySelector("[data-extra-question]");
  const form=shell.querySelector("[data-extra-form]");
  const close=()=>{
    context.forEach(node=>{node.removeAttribute("inert");node.removeAttribute("aria-hidden")});
    shell.remove();
    requestAnimationFrame(()=>next.focus({preventScroll:true}));
  };
  const goNo=()=>{clearExtraValues(modal);close();continueWizard(next)};
  shell.querySelector("[data-extra-close]").onclick=close;
  shell.querySelector(".client-extra-scrim-v1191").onclick=close;
  shell.querySelector("[data-extra-no]").onclick=goNo;
  shell.querySelector("[data-extra-yes]").onclick=()=>{
    question.hidden=true;form.hidden=false;
    requestAnimationFrame(()=>form.querySelector("input")?.focus({preventScroll:true}));
  };
  shell.querySelector("[data-extra-back]").onclick=()=>{form.hidden=true;question.hidden=false;requestAnimationFrame(()=>shell.querySelector("[data-extra-yes]")?.focus({preventScroll:true}))};
  form.addEventListener("submit",event=>{event.preventDefault();saveExtraValues(modal,form);close();continueWizard(next)});
  requestAnimationFrame(()=>{dialog.focus({preventScroll:true});shell.querySelector("[data-extra-no]")?.focus({preventScroll:true})});
}

function onCaptureClick(event){
  const next=event.target.closest?.("#modal-root .create-order-v1191 [data-next]");
  if(!next)return;
  if(next.dataset.clientExtraBypass==="1"){delete next.dataset.clientExtraBypass;return}
  const modal=next.closest(".create-order-v1191");
  const active=modal?.querySelector(".wizard-panel.active");
  if(!modal||active?.dataset.wizardPanel!=="0")return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if(!validateFirstStep(modal))return;
  openClientExtraDecision(modal,next);
}

function install(){
  installOrderTypeLabels();
  normalizeRenderedOrderTypes();
  enhanceCreateOrder();
  document.addEventListener("click",onCaptureClick,true);
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true});
  window.addEventListener("hashchange",schedule);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
