import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal,toast } from "../../../core/ui.js";
import { currencyCOP } from "./tariffs.js";

const CONCEPTS=[
  ["AYUDANTE","Ayudante"],
  ["PARADA_ADICIONAL","Parada adicional"],
  ["PEAJE","Peaje"],
  ["DESCARGUE","Descargue"],
  ["DESVIO","Desvío"],
  ["PARQUEADERO","Parqueadero"],
  ["TIEMPO_ESPERA","Tiempo de espera"],
  ["OTRO","Otro"]
];

const conceptLabel=value=>CONCEPTS.find(([code])=>code===value)?.[1]||value||"Otro";
const number=value=>Number(value||0)||0;
export function costItemsSummary(items=[]){
  if(!Array.isArray(items)||!items.length)return "Sin ajustes";
  return items.map(item=>`${conceptLabel(item.concept)}: ${currencyCOP(number(item.value))}`).join(" | ");
}

function options(current=""){
  return CONCEPTS.map(([code,label])=>`<option value="${code}" ${code===current?"selected":""}>${fmt.escape(label)}</option>`).join("");
}
function historyHtml(history=[]){
  if(!history.length)return '<div class="local-cost-empty-v1146">Todavía no se han registrado modificaciones posteriores al despacho.</div>';
  return `<div class="local-cost-history-v1146">${history.map(item=>`
    <article>
      <header><strong>Revisión ${Number(item.revisionNumber||0)} de 3</strong><span>${fmt.date(item.createdAt)}</span></header>
      <div class="local-cost-history-total-v1146"><span>${currencyCOP(item.previousTotal||0)}</span><b>→</b><strong>${currencyCOP(item.newTotal||0)}</strong></div>
      <p>${fmt.escape(item.justification||"")}</p>
      <small>${fmt.escape(item.createdBy||"Usuario")} · Ajustes vigentes: ${currencyCOP(item.adjustmentTotal||0)}</small>
    </article>`).join("")}</div>`;
}
function initialBreakdownHtml(detail){
  const base=detail.initialBreakdown||{};
  return `<div class="local-cost-breakdown-v1146">
    <div><span>Tarifa base</span><strong>${currencyCOP(base.tariffBase||0)}</strong></div>
    <div><span>Sobrepeso</span><strong>${currencyCOP(base.extraWeightCost||0)}</strong></div>
    <div><span>Ayudante/descargue inicial</span><strong>${currencyCOP(base.unloadingCost||0)}</strong></div>
    <div><span>Desvío inicial</span><strong>${currencyCOP(base.diversionCost||0)}</strong></div>
  </div>`;
}
function staticItemsHtml(items=[]){
  if(!items.length)return '<div class="local-cost-empty-v1146">No hay costos adicionales vigentes.</div>';
  return `<div class="local-cost-static-items-v1146">${items.map(item=>`
    <div><span>${fmt.escape(conceptLabel(item.concept))}${item.description?` · ${fmt.escape(item.description)}`:""}</span><strong>${currencyCOP(item.value||0)}</strong></div>`).join("")}</div>`;
}
function editorRow(item,index){
  const concept=item?.concept||"AYUDANTE";
  return `<div class="local-cost-row-v1146" data-cost-row data-index="${index}">
    <label><span>Concepto</span><select class="control" name="concept">${options(concept)}</select></label>
    <label class="description"><span>Descripción</span><input class="control" name="description" maxlength="160" value="${fmt.escape(item?.description||"")}" placeholder="Detalle opcional"></label>
    <label><span>Valor</span><input class="control" type="number" min="1" max="1000000000" step="1" name="value" value="${number(item?.value)||""}" required></label>
    <button type="button" class="btn btn-ghost btn-compact" data-remove-cost aria-label="Eliminar costo">Eliminar</button>
  </div>`;
}
function readItems(dialog){
  return [...dialog.querySelectorAll("[data-cost-row]")].map(row=>({
    concept:row.querySelector('[name="concept"]')?.value||"",
    description:row.querySelector('[name="description"]')?.value.trim()||"",
    value:Number(row.querySelector('[name="value"]')?.value||0)
  })).filter(item=>item.value>0||item.description||item.concept);
}
function calculateItems(items=[]){return items.reduce((sum,item)=>sum+Math.max(0,number(item.value)),0)}
function updatePreview(root,originalCost){
  const items=readItems(root);
  const adjustment=calculateItems(items);
  root.querySelector("[data-cost-current-adjustments]").textContent=currencyCOP(adjustment);
  root.querySelector("[data-cost-new-total]").textContent=currencyCOP(number(originalCost)+adjustment);
}
function bindEditor(handle,detail){
  const root=handle.root;
  let items=Array.isArray(detail.currentAdjustments)?detail.currentAdjustments.map(item=>({...item})):[];
  const list=root.querySelector("[data-cost-editor-list]");
  if(!list)return;
  const render=()=>{
    list.innerHTML=items.map(editorRow).join("");
    list.querySelectorAll("[data-remove-cost]").forEach((button,index)=>button.onclick=()=>{items.splice(index,1);render()});
    list.querySelectorAll("input,select").forEach(control=>control.addEventListener("input",()=>updatePreview(root,detail.originalCost)));
    updatePreview(root,detail.originalCost);
  };
  root.querySelector("[data-add-cost]")?.addEventListener("click",()=>{items.push({concept:"AYUDANTE",description:"",value:0});render()});
  render();
}
export async function openLocalDispatchCostManager(row,onSaved){
  const detail=await api.localDispatchCostDetail(row.id);
  const editable=Boolean(detail.canUpdate)&&Number(detail.revisionsRemaining||0)>0;
  const body=`
    <section class="local-cost-manager-v1146">
      <div class="local-cost-context-v1146">
        <div><small>Pedido</small><strong>${fmt.escape(row.orderNumber||"—")}</strong><span>${fmt.escape(row.clientName||"")}</span></div>
        <div><small>Factura</small><strong>${fmt.escape(row.numeroFactura||"—")}</strong><span>${fmt.escape(row.ciudadDestino||"")}</span></div>
        <div><small>Vehículo</small><strong>${fmt.escape(row.vehiculoPlaca||"—")}</strong><span>${fmt.escape(row.conductor||"")}</span></div>
        <div class="limit ${editable?"":"locked"}"><small>Modificaciones utilizadas</small><strong>${Number(detail.revisionsUsed||0)} de 3</strong><span>${editable?`${Number(detail.revisionsRemaining||0)} disponibles`:"Límite alcanzado o solo lectura"}</span></div>
      </div>
      <section class="local-cost-section-v1146">
        <header><div><small>LIQUIDACIÓN ORIGINAL</small><h4>Costo registrado al despachar</h4></div><strong>${currencyCOP(detail.originalCost||0)}</strong></header>
        ${initialBreakdownHtml(detail)}
      </section>
      <section class="local-cost-section-v1146">
        <header><div><small>AJUSTES POSTERIORES</small><h4>Costos conocidos después del despacho</h4></div><strong>${currencyCOP(detail.adjustmentTotal||0)}</strong></header>
        ${editable?`<div data-cost-editor-list></div>
          <button type="button" class="btn btn-ghost btn-compact local-cost-add-v1146" data-add-cost>+ Agregar costo</button>
          <label class="local-cost-justification-v1146"><span>Justificación del cambio *</span><textarea class="control" name="costJustification" minlength="15" maxlength="1000" rows="3" required placeholder="Explica por qué se agrega, corrige o elimina este costo."></textarea></label>
          <div class="local-cost-warning-v1146">Guardar consumirá <strong>1 de las 3 modificaciones permitidas</strong>. La revisión anterior no se eliminará.</div>`:staticItemsHtml(detail.currentAdjustments||[])}
      </section>
      <div class="local-cost-total-v1146">
        <div><small>Costo original</small><strong>${currencyCOP(detail.originalCost||0)}</strong></div>
        <span>+</span>
        <div><small>Ajustes vigentes</small><strong data-cost-current-adjustments>${currencyCOP(detail.adjustmentTotal||0)}</strong></div>
        <span>=</span>
        <div class="final"><small>Total definitivo</small><strong data-cost-new-total>${currencyCOP(detail.currentTotal||0)}</strong></div>
      </div>
      <section class="local-cost-section-v1146">
        <header><div><small>TRAZABILIDAD</small><h4>Historial de modificaciones</h4></div></header>
        ${historyHtml(detail.history||[])}
      </section>
    </section>`;
  const handle=modal({
    title:"Ajuste de costo del flete",
    confirmLabel:editable?"Guardar ajuste":"",
    cancelLabel:editable?"Cancelar":"Cerrar",
    size:"wide local-dispatch-cost-modal-v1146",
    body,
    onConfirm:editable?async dialog=>{
      const items=readItems(dialog);
      for(const item of items){
        if(!(item.value>0))throw new Error("Todos los costos deben ser mayores que cero.");
        if(item.concept==="OTRO"&&item.description.length<3)throw new Error("Describe el concepto OTRO.");
      }
      const justification=dialog.querySelector('[name="costJustification"]')?.value.trim()||"";
      if(justification.length<15)throw new Error("La justificación debe tener al menos 15 caracteres.");
      await api.localDispatchCostAdjust(row.id,{items,justification});
      toast("Costo logístico actualizado y revisión auditada.","success",6000);
      await onSaved?.();
    }:undefined
  });
  if(editable)bindEditor(handle,detail);
  return handle;
}
