import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { loading,empty,modal,toast } from "../../../core/ui.js";
import { LOCAL_DISPATCH_TARIFFS,currencyCOP } from "./tariffs.js";
import { openLocalDispatchCostManager as localDispatchCostManager,costItemsSummary } from "./cost-adjustments.js";

const state={date:"",destination:"",page:1,data:null};
function today(){return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date())}
function statusChip(status){
  const value=String(status||"PENDIENTE").toUpperCase();
  return `<span class="local-dispatch-status-v1145 ${value==="ENTREGADO"?"success":value==="NO ENTREGADO"?"danger":"pending"}">${fmt.escape(value)}</span>`;
}
function destinationOptions(current=""){
  return `<option value="">Todos los destinos</option>${LOCAL_DISPATCH_TARIFFS.map(row=>`<option value="${fmt.escape(row.code)}" ${row.code===current?"selected":""}>${fmt.escape(row.code)}</option>`).join("")}`;
}
function metricsHtml(metrics={}){
  return `<div class="local-dispatch-kpis-v1145">
    <article><small>Viajes</small><strong>${fmt.number(metrics.tripCount||0)}</strong><span>Salidas registradas</span></article>
    <article><small>Entregados</small><strong>${fmt.number(metrics.deliveredCount||0)}</strong><span>Liquidados en cierre</span></article>
    <article><small>Ajustes</small><strong>${currencyCOP(metrics.adjustmentTotal||0)}</strong><span>Costos posteriores registrados</span></article>
    <article class="total"><small>Costo cerrado</small><strong>${currencyCOP(metrics.closedTotal||0)}</strong><span>Solo viajes entregados</span></article>
  </div>`;
}
function actionsHtml(row,canUpdate){
  return `<div class="local-dispatch-actions-v1146">
    <button type="button" class="btn btn-ghost btn-compact" data-local-cost="${fmt.escape(row.id)}">${canUpdate?"Gestionar costos":"Ver costos"}</button>
    ${canUpdate?`<button type="button" class="btn btn-ghost btn-compact" data-local-return="${fmt.escape(row.id)}">Registrar retorno</button>`:""}
  </div>`;
}
function rowHtml(row,canUpdate){
  return `<tr>
    <td><strong>${fmt.escape(row.orderNumber||"—")}</strong><small>${fmt.escape(row.clientName||"")}</small></td>
    <td><strong>${fmt.escape(row.numeroFactura||"—")}</strong><small>${fmt.date(row.fecha)}</small></td>
    <td><strong>${fmt.escape(row.ciudadDestino||"—")}</strong><small>${fmt.escape(row.vehiculoPlaca||"")} · ${fmt.escape(row.conductor||"")}</small></td>
    <td class="num">${currencyCOP(row.costoOriginal??row.totalViaje??0)}</td>
    <td class="num"><strong>${currencyCOP(row.costoAjustes||0)}</strong><small>${Number(row.revisionesCosto||0)} de 3 revisiones</small></td>
    <td class="num total">${currencyCOP(row.totalViaje||0)}</td>
    <td>${statusChip(row.estadoEntrega)}</td>
    <td>${actionsHtml(row,canUpdate)}</td>
  </tr>`;
}
function cardHtml(row,canUpdate){
  return `<article class="local-dispatch-card-v1146">
    <header><div><strong>${fmt.escape(row.orderNumber||"—")}</strong><span>${fmt.escape(row.clientName||"")}</span></div>${statusChip(row.estadoEntrega)}</header>
    <div class="local-dispatch-card-meta-v1146"><span>${fmt.escape(row.numeroFactura||"Sin factura")}</span><span>${fmt.escape(row.ciudadDestino||"—")}</span><span>${fmt.escape(row.vehiculoPlaca||"—")}</span></div>
    <div class="local-dispatch-card-costs-v1146">
      <div><small>Costo original</small><strong>${currencyCOP(row.costoOriginal??row.totalViaje??0)}</strong></div>
      <div><small>Ajustes</small><strong>${currencyCOP(row.costoAjustes||0)}</strong><span>${Number(row.revisionesCosto||0)} / 3</span></div>
      <div class="total"><small>Total definitivo</small><strong>${currencyCOP(row.totalViaje||0)}</strong></div>
    </div>
    ${actionsHtml(row,canUpdate)}
  </article>`;
}
function tableHtml(rows,canUpdate){
  if(!rows.length)return empty("Sin viajes locales","No existen salidas locales para los filtros seleccionados.");
  return `<div class="local-dispatch-table-wrap-v1145"><table class="local-dispatch-table-v1145"><thead><tr>
    <th>Pedido / cliente</th><th>Factura / fecha</th><th>Destino / vehículo</th><th class="num">Costo original</th><th class="num">Ajustes</th><th class="num">Total definitivo</th><th>Estado</th><th>Acciones</th>
  </tr></thead><tbody>${rows.map(row=>rowHtml(row,canUpdate)).join("")}</tbody></table></div>
  <div class="local-dispatch-cards-v1146">${rows.map(row=>cardHtml(row,canUpdate)).join("")}</div>`;
}
async function exportRows(){
  const data=await api.localDispatchTrips({dateFrom:state.date||null,dateTo:state.date||null,destination:state.destination||null,page:1,pageSize:500});
  return data.items||[];
}
function exportMatrix(rows){
  return rows.map(row=>({
    "Pedido":row.orderNumber||"",
    "Cliente":row.clientName||"",
    "Fecha":row.fecha||"",
    "Factura":row.numeroFactura||"",
    "Sucursal":row.sucursal||"",
    "Destino":row.ciudadDestino||"",
    "Placa":row.vehiculoPlaca||"",
    "Conductor":row.conductor||"",
    "Peso kg":Number(row.pesoKg||0),
    "Costo original":Number(row.costoOriginal??row.totalViaje??0),
    "Ajustes posteriores":Number(row.costoAjustes||0),
    "Conceptos adicionales":costItemsSummary(row.ajustesCosto||[]),
    "Revisiones utilizadas":Number(row.revisionesCosto||0),
    "Total definitivo":Number(row.totalViaje||0),
    "Estado":row.estadoEntrega||"",
    "Observaciones":row.observaciones||""
  }));
}
async function exportExcel(){
  if(!window.XLSX)throw new Error("El exportador Excel no está disponible.");
  const rows=await exportRows();if(!rows.length)throw new Error("No hay viajes para exportar.");
  const wb=window.XLSX.utils.book_new(),ws=window.XLSX.utils.json_to_sheet(exportMatrix(rows));
  window.XLSX.utils.book_append_sheet(wb,ws,"Despachos locales");
  window.XLSX.writeFile(wb,`despachos-locales-${state.date||"historico"}.xlsx`);
}
async function exportPdf(){
  const rows=await exportRows();if(!rows.length)throw new Error("No hay viajes para exportar.");
  const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)throw new Error("El exportador PDF no está disponible.");
  const doc=new JsPDF({orientation:"landscape",unit:"mm",format:"a4"});
  doc.setFontSize(14);doc.text("CRM Suministros · Cierre de despachos locales",14,14);
  doc.setFontSize(9);doc.text(`Fecha: ${state.date||"Todas"} · Destino: ${state.destination||"Todos"}`,14,20);
  doc.autoTable({startY:25,head:[["Pedido","Factura","Destino","Vehículo","Original","Ajustes","Total","Rev.","Estado"]],body:rows.map(r=>[
    r.orderNumber||"",r.numeroFactura||"",r.ciudadDestino||"",r.vehiculoPlaca||"",
    currencyCOP(r.costoOriginal??r.totalViaje??0),currencyCOP(r.costoAjustes||0),currencyCOP(r.totalViaje||0),
    `${Number(r.revisionesCosto||0)}/3`,r.estadoEntrega||""
  ]),styles:{fontSize:7}});
  doc.save(`despachos-locales-${state.date||"historico"}.pdf`);
}
function openReturn(row,onSaved){
  modal({title:"Novedades al retorno del vehículo",confirmLabel:"Guardar retorno",size:"wide",body:`
    <div class="local-dispatch-return-head-v1145"><strong>${fmt.escape(row.orderNumber||"Pedido")}</strong><span>${fmt.escape(row.numeroFactura||"")} · ${fmt.escape(row.ciudadDestino||"")}</span><small>${fmt.escape(row.vehiculoPlaca||"")} · ${fmt.escape(row.conductor||"")}</small></div>
    <div class="form-grid">
      <div class="field"><label>Estado de entrega *</label><select class="control" name="deliveryStatus" required><option value="ENTREGADO" ${row.estadoEntrega==="ENTREGADO"?"selected":""}>ENTREGADO</option><option value="NO ENTREGADO" ${row.estadoEntrega==="NO ENTREGADO"?"selected":""}>NO ENTREGADO</option></select></div>
      <div class="field full-width"><label>Observaciones del retorno</label><textarea class="control" name="observations" rows="3" maxlength="1000">${fmt.escape(row.observaciones||"")}</textarea></div>
    </div>
    <div class="local-dispatch-return-note-v1145">Los cambios monetarios se administran únicamente desde <strong>Gestionar costos</strong>. Los viajes <strong>NO ENTREGADOS</strong> quedan trazados, pero no suman al costo cerrado.</div>`,
    onConfirm:async dialog=>{
      const value=name=>dialog.querySelector(`[name="${name}"]`)?.value?.trim?.()||"";
      await api.localDispatchReturn(row.id,{estadoEntrega:value("deliveryStatus"),observaciones:value("observations")});
      toast("Retorno del vehículo actualizado.","success",5500);await onSaved();
    }
  });
}
export async function renderLocalDispatchLedger(target,{date=today(),destination=""}={}){
  state.date=date;state.destination=destination;state.page=1;
  target.innerHTML=`<section class="local-dispatch-ledger-v1145">
    <header><div><span>Control operativo y financiero</span><h3>Cargues y despachos locales</h3><p>Consulta el costo original, los ajustes auditados y el total definitivo de cada flete sin perder la trazabilidad del despacho.</p></div><div class="local-dispatch-export-v1145"><button class="btn btn-ghost btn-compact" data-local-excel>Excel</button><button class="btn btn-ghost btn-compact" data-local-pdf>PDF</button></div></header>
    <div class="local-dispatch-filters-v1145"><label>Fecha<input class="control" type="date" data-local-date value="${fmt.escape(state.date)}"></label><label>Destino<select class="control" data-local-destination>${destinationOptions(state.destination)}</select></label><button class="btn btn-primary" data-local-filter>Consultar</button></div>
    <div data-local-ledger-result>${loading("Consultando despachos locales…")}</div>
  </section>`;
  const result=target.querySelector("[data-local-ledger-result]");
  const load=async()=>{
    result.innerHTML=loading("Consultando despachos locales…");
    try{
      const data=await api.localDispatchTrips({dateFrom:state.date||null,dateTo:state.date||null,destination:state.destination||null,page:state.page,pageSize:100});
      state.data=data;const rows=data.items||[];
      result.innerHTML=`${metricsHtml(data.metrics)}${tableHtml(rows,Boolean(data.canUpdate))}`;
      result.querySelectorAll("[data-local-return]").forEach(button=>button.onclick=()=>{const row=rows.find(item=>item.id===button.dataset.localReturn);if(row)openReturn(row,load)});
      result.querySelectorAll("[data-local-cost]").forEach(button=>button.onclick=async()=>{const row=rows.find(item=>item.id===button.dataset.localCost);if(!row)return;try{await localDispatchCostManager(row,load)}catch(error){toast(error.message||"No fue posible consultar los costos del flete.","error",6500)}});
    }catch(error){result.innerHTML=`<div class="module-error"><strong>No fue posible consultar los despachos locales</strong><p>${fmt.escape(error.message)}</p></div>`}
  };
  target.querySelector("[data-local-filter]").onclick=()=>{state.date=target.querySelector("[data-local-date]").value;state.destination=target.querySelector("[data-local-destination]").value;load()};
  target.querySelector("[data-local-excel]").onclick=async()=>{try{await exportExcel()}catch(error){toast(error.message,"error",6500)}};
  target.querySelector("[data-local-pdf]").onclick=async()=>{try{await exportPdf()}catch(error){toast(error.message,"error",6500)}};
  await load();
}
