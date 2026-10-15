import {icon} from "../core/icons.js";
import {decorateFields,bindValidation} from "./popup-ux-field-behavior.js";
import {bindIntentionalConfirmation} from "./popup-explicit-action-policy.js";

let observer=null;
let scheduled=false;
const pendingModals=new Set();

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
  {test:/usuario|administraci[oó]n/i,label:"Administración",icon:"admin",text:"Modifica solo el dato administrativo necesario. Los permisos y cambios quedan registrados para auditoría."},
  {test:/pedido|ventas|comercial/i,label:"Pedidos y ventas",icon:"orders",text:"Completa solo los datos comerciales, de entrega o materiales que correspondan. La ruta y la trazabilidad se calculan automáticamente."}
];

function queueModal(modal){
  if(!(modal instanceof HTMLElement)||!modal.matches(".modal-overlay .modal")||!modal.isConnected)return;
  pendingModals.add(modal);
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    const batch=[...pendingModals];
    pendingModals.clear();
    batch.forEach(item=>{if(item.isConnected)enhanceModal(item)});
  });
}

function schedule(records){
  if(records instanceof Event){enhanceAll();return}
  for(const record of records||[]){
    const owner=record.target instanceof Element?record.target.closest(".modal-overlay .modal"):null;
    if(owner)queueModal(owner);
    if(record.type!=="childList")continue;
    for(const node of record.addedNodes){
      if(!(node instanceof Element))continue;
      if(node.matches(".modal-overlay .modal"))queueModal(node);
      node.querySelectorAll?.(".modal-overlay .modal").forEach(queueModal);
      const modal=node.closest(".modal-overlay .modal");
      if(modal)queueModal(modal);
    }
  }
}

function modalContext(modal){
  const head=modal.querySelector(".modal-head,[class*='process-head']");
  const title=head?.querySelector("h2,h3,h4")?.textContent||"";
  const kicker=head?.querySelector(".wizard-kicker,.modal-kicker,span")?.textContent||"";
  return `${kicker} ${title} ${modal.className}`.trim();
}

function ruleFor(modal){
  const context=modalContext(modal);
  return RULES.find(rule=>rule.test.test(context))||{label:"Proceso guiado",icon:"activity",text:"Completa únicamente la información solicitada en esta ventana. Los datos ya registrados se conservan y la trazabilidad se guarda automáticamente."};
}

function enhanceAll(){document.querySelectorAll(".modal-overlay .modal").forEach(enhanceModal)}

function enhanceModal(modal){
  if(!modal.classList.contains("popup-ux-v1190")){
    modal.classList.add("popup-ux-v1190");
    modal.dataset.popupUxV1190="1";
    installGuide(modal);
    bindValidation(modal);
    bindIntentionalConfirmation(modal);
  }
  decorateFields(modal);
  decorateButtons(modal);
  syncWizard(modal);
  updateGuideMeta(modal);
}

function installGuide(modal){
  const context=modalContext(modal);
  if(/gu[ií]a|ayuda|c[oó]mo gestionar|c[oó]mo usar/i.test(context)||modal.querySelector(".popup-process-guide-v1190"))return;
  // Existing wizard introductions and operational guides already explain the task.
  if(modal.querySelector(".wizard-step-intro,.shipping-core-task-head-v11107,.commercial-wizard-assist"))return;
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

function decorateButtons(modal){
  modal.querySelectorAll("[data-next],[data-confirm],[data-task-panel-confirm]").forEach(button=>button.classList.add("popup-primary-action-v1190"));
  modal.querySelectorAll("[data-prev]").forEach(button=>button.classList.add("popup-secondary-action-v1190"));
}

function syncWizard(modal){
  if(!modal.classList.contains("wizard-modal"))return;
  const active=modal.querySelector(".wizard-panel.active");if(!active)return;
  const index=active.dataset.wizardPanel||"0";
  if(modal.dataset.popupActiveStep===index)return;
  modal.dataset.popupActiveStep=index;
  const body=modal.querySelector(".wizard-body");if(body)body.scrollTop=0;
  modal.querySelectorAll(".popup-validation-v1190").forEach(node=>node.remove());
  modal.querySelectorAll(".popup-invalid-v1190").forEach(node=>{node.classList.remove("popup-invalid-v1190");node.removeAttribute("aria-invalid")});
}

function updateGuideMeta(modal){
  const meta=modal.querySelector("[data-popup-guide-meta]");if(!meta)return;
  const scope=modal.querySelector(".wizard-panel.active")||modal.querySelector(".modal-task-panel-body")||modal.querySelector(".modal-body")||modal;
  const controls=[...scope.querySelectorAll("input,select,textarea")].filter(control=>control.type!=="hidden"&&!control.disabled);
  const required=controls.filter(control=>control.required).length;
  const automatic=controls.filter(control=>control.readOnly).length;
  const parts=[];if(required)parts.push(`${required} obligatorio${required===1?"":"s"}`);if(automatic)parts.push(`${automatic} automático${automatic===1?"":"s"}`);
  const next=parts.join(" · ")||"Solo lo necesario";if(meta.textContent!==next)meta.textContent=next;
}

function install(){
  enhanceAll();if(observer)return;
  observer=new MutationObserver(schedule);
  observer.observe(document.querySelector("#modal-root")||document.body,{childList:true,subtree:true,attributes:true,attributeFilter:["class","disabled","readonly","required"]});
  window.addEventListener("hashchange",schedule);
}

if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
