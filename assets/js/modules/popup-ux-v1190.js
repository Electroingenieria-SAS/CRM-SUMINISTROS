import {icon} from "../core/icons.js";

let observer=null;
let scheduled=false;

const RULES=[
  {test:/cr[eé]dito|cartera/i,label:"Crédito y cartera",icon:"credit",text:"Registra o decide solo la información financiera necesaria. El responsable, el estado y la decisión quedan trazados automáticamente."},
  {test:/caja/i,label:"Caja",icon:"cash",text:"Confirma únicamente la gestión financiera requerida. Escribe una observación solo cuando exista espera, novedad o una condición especial."},
  {test:/compra|abastecimiento/i,label:"Compras",icon:"purchasing",text:"Registra únicamente la gestión de abastecimiento necesaria para que el pedido pueda continuar. La trazabilidad se guarda automáticamente."},
  {test:/recepci[oó]n/i,label:"Recepción",icon:"receiving",text:"Confirma lo recibido y registra diferencias únicamente cuando existan. Los datos ya conocidos del pedido no deben repetirse."},
  {test:/alistamiento|picking/i,label:"Alistamiento",icon:"picking",text:"Marca el resultado real de los materiales. El CRM calcula y conserva automáticamente el avance del pedido."},
  {test:/corte/i,label:"Corte",icon:"cutting",text:"Registra las medidas o resultados necesarios del corte. El sistema consolida cantidades y mantiene la relación con el pedido."},
  {test:/factur/i,label:"Facturación",icon:"billing",text:"Adjunta o registra únicamente el documento requerido. La siguiente ruta del pedido se determina con la información ya registrada."},
  {test:/despach|entrega|shipping/i,label:"Despachos y entregas",icon:"shipping",text:"Confirma ruta, evidencia y resultado de entrega. Evita repetir datos que ya pertenecen al pedido."},
  {test:/aprob|excepci[oó]n|decisi[oó]n/i,label:"Aprobaciones",icon:"approvals",text:"Revisa el motivo y registra la decisión. La aprobación debe quedar separada de la edición operativa del pedido."},
  {test:/inventar/i,label:"Inventario",icon:"inventory",text:"Registra únicamente el movimiento o validación necesaria. Referencias y datos existentes se conservan desde el maestro del sistema."},
  {test:/jornada|actividad/i,label:"Jornada y actividades",icon:"timer",text:"Registra la actividad necesaria y su resultado. Los tiempos y la trazabilidad se calculan con la información disponible."},
  {test:/usuario|administraci[oó]n|contrase/i,label:"Administración",icon:"admin",text:"Modifica solo el dato administrativo necesario. Los permisos y cambios quedan registrados para auditoría."},
  {test:/pedido|ventas|comercial/i,label:"Pedidos y ventas",icon:"orders",text:"Completa solo los datos comerciales, de entrega o materiales que correspondan. La ruta y la trazabilidad se calculan automáticamente."}
];

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    enhanceAll();
  });
}

function modalContext(modal){
  const head=modal.querySelector(".modal-head,[class*='process-head']");
  const title=head?.querySelector("h2,h3,h4")?.textContent||"";
  const kicker=head?.querySelector(".wizard-kicker,.modal-kicker,span")?.textContent||"";
  return `${kicker} ${title} ${modal.className}`.trim();
}

function ruleFor(modal){
  const context=modalContext(modal);
  return RULES.find(rule=>rule.test.test(context))||{
    label:"Proceso guiado",
    icon:"activity",
    text:"Completa únicamente la información solicitada en esta ventana. Los datos ya registrados se conservan y la trazabilidad se guarda automáticamente."
  };
}

function enhanceAll(){
  document.querySelectorAll(".modal-overlay .modal").forEach(enhanceModal);
}

function enhanceModal(modal){
  if(!modal.classList.contains("popup-ux-v1190")){
    modal.classList.add("popup-ux-v1190");
    modal.dataset.popupUxV1190="1";
    installGuide(modal);
    bindValidation(modal);
    bindAutomation(modal);
    modal.querySelector(".commercial-wizard-assist")?.remove();
  }
  decorateFields(modal);
  decorateButtons(modal);
  syncWizard(modal);
  updateGuideMeta(modal);
}

function installGuide(modal){
  const context=modalContext(modal);
  if(/gu[ií]a|ayuda|c[oó]mo gestionar|c[oó]mo usar/i.test(context))return;
  if(modal.querySelector(".popup-process-guide-v1190"))return;
  const head=modal.querySelector(".modal-head,[class*='process-head']");
  if(!head)return;
  const rule=ruleFor(modal);
  const guide=document.createElement("section");
  guide.className="popup-process-guide-v1190";
  guide.setAttribute("aria-label",`Guía breve de ${rule.label}`);
  guide.innerHTML=`<span class="popup-guide-icon-v1190" aria-hidden="true">${icon(rule.icon)}</span><div class="popup-guide-copy-v1190"><strong>${rule.label}</strong><p>${rule.text}</p></div><span class="popup-guide-meta-v1190" data-popup-guide-meta>Solo lo necesario</span>`;
  const progress=modal.querySelector(".wizard-progress");
  if(progress)progress.before(guide);else head.after(guide);
}

function decorateFields(modal){
  modal.querySelectorAll(".field").forEach(field=>{
    field.classList.add("popup-field-v1190");
    const controls=[...field.querySelectorAll("input,select,textarea")].filter(control=>control.type!=="hidden");
    const control=controls[0];
    if(!control)return;
    const label=field.querySelector("label");
    if(control.required&&label&&!/\*/.test(label.textContent||""))label.append(" *");
    if(control.readOnly&&label&&!field.querySelector(".popup-auto-badge-v1190")){
      const badge=document.createElement("span");
      badge.className="popup-auto-badge-v1190";
      badge.textContent="Automático";
      label.append(badge);
    }
    setInputHints(control);
  });
}

function setInputHints(control){
  if(control.dataset.popupInputHints)return;
  control.dataset.popupInputHints="1";
  const name=String(control.name||control.id||"").toLowerCase();
  if(control.tagName==="INPUT"){
    const type=String(control.type||"text").toLowerCase();
    if(/phone|telefono|tel[eé]fono/.test(name)){
      control.inputMode="tel";
      if(!control.autocomplete)control.autocomplete="tel";
    }else if(type==="number"||/amount|monto|valor|quantity|cantidad|qty|medida|peso/.test(name)){
      control.inputMode="decimal";
    }
    if(/address|direcci[oó]n/.test(name)&&!control.autocomplete)control.autocomplete="street-address";
    if(/city|municipio|ciudad/.test(name)&&!control.autocomplete)control.autocomplete="address-level2";
    if(/department|departamento/.test(name)&&!control.autocomplete)control.autocomplete="address-level1";
    if(/country|pa[ií]s/.test(name)&&!control.autocomplete)control.autocomplete="country-name";
    if(["text","search","tel","email","url"].includes(type)&&!control.readOnly){
      control.addEventListener("blur",()=>{control.value=control.value.trim()});
    }
  }
}

function decorateButtons(modal){
  modal.querySelectorAll("[data-next],[data-confirm],[data-task-panel-confirm]").forEach(button=>button.classList.add("popup-primary-action-v1190"));
  modal.querySelectorAll("[data-prev]").forEach(button=>button.classList.add("popup-secondary-action-v1190"));
}

function bindValidation(modal){
  if(modal.dataset.popupValidationBound)return;
  modal.dataset.popupValidationBound="1";
  modal.addEventListener("invalid",event=>{
    const control=event.target;
    if(!(control instanceof HTMLInputElement||control instanceof HTMLSelectElement||control instanceof HTMLTextAreaElement))return;
    event.preventDefault();
    showValidation(modal,control);
  },true);
  modal.addEventListener("input",event=>clearValidation(event.target),true);
  modal.addEventListener("change",event=>clearValidation(event.target),true);
}

function validationMessage(control){
  if(control.validity.valueMissing)return "Completa este dato para continuar.";
  if(control.validity.typeMismatch)return "Revisa el formato de este dato.";
  if(control.validity.rangeUnderflow)return `El valor debe ser igual o mayor a ${control.min}.`;
  if(control.validity.rangeOverflow)return `El valor debe ser igual o menor a ${control.max}.`;
  if(control.validity.stepMismatch)return "Revisa el valor ingresado.";
  if(control.validity.patternMismatch)return "El formato ingresado no es válido.";
  return "Revisa este dato antes de continuar.";
}

function fieldName(control){
  const field=control.closest(".field");
  const label=field?.querySelector("label")?.textContent?.replace(/Automático/g,"").replace(/\*/g,"").trim();
  return label||control.getAttribute("aria-label")||control.name||"Dato requerido";
}

function showValidation(modal,control){
  modal.querySelectorAll(".popup-validation-v1190").forEach(node=>node.remove());
  modal.querySelectorAll(".popup-invalid-v1190").forEach(node=>{
    node.classList.remove("popup-invalid-v1190");
    node.removeAttribute("aria-invalid");
  });
  control.classList.add("popup-invalid-v1190");
  control.setAttribute("aria-invalid","true");
  const container=control.closest(".wizard-panel.active")?.querySelector(".wizard-step-content")||control.closest(".modal-task-panel-body,.modal-body")||modal;
  const alert=document.createElement("div");
  alert.className="popup-validation-v1190";
  alert.setAttribute("role","alert");
  alert.innerHTML=`<strong>Falta revisar un dato</strong><span>${fieldName(control)}: ${validationMessage(control)}</span>`;
  container.prepend(alert);
  requestAnimationFrame(()=>{
    alert.scrollIntoView({block:"nearest",behavior:"smooth"});
    control.focus({preventScroll:true});
  });
}

function clearValidation(target){
  if(!(target instanceof HTMLElement)||!target.classList.contains("popup-invalid-v1190"))return;
  if(typeof target.checkValidity==="function"&&target.checkValidity()){
    target.classList.remove("popup-invalid-v1190");
    target.removeAttribute("aria-invalid");
    target.closest(".wizard-panel,.modal-body,.modal-task-panel-body")?.querySelector(".popup-validation-v1190")?.remove();
  }
}

function bindAutomation(modal){
  if(modal.dataset.popupAutomationBound)return;
  modal.dataset.popupAutomationBound="1";
  modal.addEventListener("keydown",event=>{
    if(event.key!=="Enter"||event.shiftKey||event.ctrlKey||event.altKey)return;
    const target=event.target;
    if(target instanceof HTMLTextAreaElement)return;
    if(target instanceof HTMLInputElement&&["checkbox","radio","file","button","submit"].includes(target.type))return;
    if(modal.classList.contains("wizard-modal"))return;
    const confirm=modal.querySelector("[data-confirm]:not(:disabled),[data-task-panel-confirm]:not(:disabled)");
    if(confirm){event.preventDefault();confirm.click()}
  });
}

function syncWizard(modal){
  if(!modal.classList.contains("wizard-modal"))return;
  const active=modal.querySelector(".wizard-panel.active");
  if(!active)return;
  const index=active.dataset.wizardPanel||"0";
  if(modal.dataset.popupActiveStep!==index){
    modal.dataset.popupActiveStep=index;
    const body=modal.querySelector(".wizard-body");
    if(body)body.scrollTop=0;
    modal.querySelectorAll(".popup-validation-v1190").forEach(node=>node.remove());
    modal.querySelectorAll(".popup-invalid-v1190").forEach(node=>{
      node.classList.remove("popup-invalid-v1190");
      node.removeAttribute("aria-invalid");
    });
  }
}

function updateGuideMeta(modal){
  const meta=modal.querySelector("[data-popup-guide-meta]");
  if(!meta)return;
  const scope=modal.querySelector(".wizard-panel.active")||modal.querySelector(".modal-task-panel-body")||modal.querySelector(".modal-body")||modal;
  const controls=[...scope.querySelectorAll("input,select,textarea")].filter(control=>control.type!=="hidden"&&!control.disabled);
  const required=controls.filter(control=>control.required).length;
  const automatic=controls.filter(control=>control.readOnly).length;
  const parts=[];
  if(required)parts.push(`${required} obligatorio${required===1?"":"s"}`);
  if(automatic)parts.push(`${automatic} automático${automatic===1?"":"s"}`);
  meta.textContent=parts.join(" · ")||"Solo lo necesario";
}

function install(){
  enhanceAll();
  if(observer)return;
  observer=new MutationObserver(schedule);
  observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","disabled","readonly","required"]});
  window.addEventListener("hashchange",schedule);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
