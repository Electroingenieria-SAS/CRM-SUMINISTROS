import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { loading,empty,modal,toast } from "../../../../core/ui.js";
import { LOCAL_DISPATCH_TARIFFS,currencyCOP } from "./tariffs.js";

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
    <article><small>No entregados</small><strong>${fmt.number(metrics.notDeliveredCount||0)}</strong><span>No suman al costo cerrado</span></article>
    <article class="total"><small>Costo cerrado</small><strong>${currencyCOP(metrics.closedTotal||0)}</strong><span>Solo viajes entregados</span></article>
  </div>`;
}
function rowHtml(row,canUpdate){
  return `<tr>
    <td><strong>${fmt.escape(row.orderNumber||"\u2014")}</strong><small>${fmt.escape(row.clientName||"")}</small></td>
    <td>${fmt.date(row.fecha)}</td><td>${fmt.escape(row.numeroFactura||"\u2014")}</td><td>${fmt.escape(row.sucursal||"\u2014")}</td>
    <td><strong>${fmt.escape(row.ciudadDestino||"\u2014")}</strong><small>${fmt.escape(row.vehiculoPlaca||"")} \u00b7 ${fmt.escape(row.conductor||"")}</small></td>
    <td class="num">${fmt.number(Number(row.pesoKg||0),3)} kg</td>
    <td class="num">${currencyCOP(row.tarifaBase||0)}</td>
    <td class="num">${fmt.number(Number(row.kilosExtra||0),3)} kg<br><small>${currencyCOP(row.costoKilosExtra||0)}</small></td>
    <td class="num">${currencyCOP(Number(row.costoDescargue||0)+Number(row.costoDesvio||0))}</td>
    <td class="num total">${currencyCOP(row.totalViaje||0)}</td>
    <td>${statusChip(row.estadoEntrega)}</td>
    <td>${canUpdate?`<button type="button" class="btn btn-ghost btn-compact" data-local-return="${fmt.escape(row.id)}">Registrar retorno</button>`:"\u2014"}</td>
  </tr>`;
}
function tableHtml(rows,canUpdate){
  if(!rows.length)return empty("Sin viajes locales","No existen salidas locales para los filtros seleccionados.");
  return `<div class="local-dispatch-table-wrap-v1145"><table class="local-dispatch-table-v1145"><thead><tr>
    <th>Pedido</th><th>Fecha</th><th>Factura</th><th>Sucursal</th><th>Destino / veh\u00edculo</th><th class="num">Peso</th><th class="num">Base</th><th class="num">Extra</th><th class="num">Extras viaje</th><th class="num">Total</th><th>Estado</th><th>Retorno</th>
  </tr></thead><tbody>${rows.map(row=>rowHtml(row,canUpdate)).join("")}</tbody></table></div>`;
}
async function exportRows(){
  const data=await api.localDispatchTrips({dateFrom:state.date||null,dateTo:state.date||null,destination:state.destination||null,page:1,pageSize:500});
  return data.items||[];
}
function exportMatrix(rows){
  return rows.map(row=>({
    "Pedido":row.orderNumber||"","Cliente":row.clientName||"","Fecha":row.fecha||"","Factura":row.numeroFactura||"",
    "Sucursal":row.sucursal||"","Destino":row.ciudadDestino||"","Placa":row.vehiculoPlaca||"","Conductor":row.conductor||"",
    "Peso kg":Number(row.pesoKg||0),"Tarifa base":Number(row.tarifaBase||0),"Kilos extra":Number(row.kilosExtra||0),
    "Costo kilos extra":Number(row.costoKilosExtra||0),"Descargue":Number(row.costoDescargue||0),"Desv\u00edo":Number(row.costoDesvio||0),
    "Total viaje":Number(row.totalViaje||0),"Estado":row.estadoEntrega||"","Observaciones":row.observaciones||""
  }));
}
async function exportExcel(){
  if(!window.XLSX)throw new Error("El exportador Excel no est\u00e1 disponible.");
  const rows=await exportRows();if(!rows.length)throw new Error("No hay viajes para exportar.");
  const wb=window.XLSX.utils.book_new(),ws=window.XLSX.utils.json_to_sheet(exportMatrix(rows));
  window.XLSX.utils.book_append_sheet(wb,ws,"Despachos locales");
  window.XLSX.writeFile(wb,`despachos-locales-${state.date||"historico"}.xlsx`);
}
async function exportPdf(){
  const rows=await exportRows();if(!rows.length)throw new Error("No hay viajes para exportar.");
  const JsPDF=window.jspdf?.jsPDF;if(!JsPDF)throw new Error("El exportador PDF no est\u00e1 disponible.");
  const doc=new JsPDF({orientation:"landscape",unit:"mm",format:"a4"});
  doc.setFontSize(14);doc.text("CRM Suministros \u00b7 Cierre de despachos locales",14,14);
  doc.setFontSize(9);doc.text(`Fecha: ${state.date||"Todas"} \u00b7 Destino: ${state.destination||"Todos"}`,14,20);
  doc.autoTable({startY:25,head:[["Pedido","Factura","Destino","Veh\u00edculo","Peso kg","Base","Extra","Extras","Total","Estado"]],body:rows.map(r=>[
    r.orderNumber||"",r.numeroFactura||"",r.ciudadDestino||"",r.vehiculoPlaca||"",Number(r.pesoKg||0).toLocaleString("es-CO"),
    currencyCOP(r.tarifaBase),currencyCOP(r.costoKilosExtra),currencyCOP(Number(r.costoDescargue||0)+Number(r.costoDesvio||0)),currencyCOP(r.totalViaje),r.estadoEntrega||""
  ]),styles:{fontSize:7}});
  doc.save(`despachos-locales-${state.date||"historico"}.pdf`);
}
function openReturn(row,onSaved){
  modal({title:"Novedades al retorno del veh\u00edculo",confirmLabel:"Guardar retorno",size:"wide",body:`
    <div class="local-dispatch-return-head-v1145"><strong>${fmt.escape(row.orderNumber||"Pedido")}</strong><span>${fmt.escape(row.numeroFactura||"")} \u00b7 ${fmt.escape(row.ciudadDestino||"")}</span><small>${fmt.escape(row.vehiculoPlaca||"")} \u00b7 ${fmt.escape(row.conductor||"")}</small></div>
    <div class="form-grid">
      <div class="field"><label>Estado de entrega *</label><select class="control" name="deliveryStatus" required><option value="ENTREGADO" ${row.estadoEntrega==="ENTREGADO"?"selected":""}>ENTREGADO</option><option value="NO ENTREGADO" ${row.estadoEntrega==="NO ENTREGADO"?"selected":""}>NO ENTREGADO</option></select></div>
      <div class="field"><label>Ayudante / descargue</label><input class="control" type="number" min="0" step="1" name="unloadingCost" value="${Number(row.costoDescargue||0)}"></div>
      <div class="field"><label>Destino adicional / desv\u00edo</label><input class="control" type="number" min="0" step="1" name="diversionCost" value="${Number(row.costoDesvio||0)}"></div>
      <div class="field full-width"><label>Observaciones del retorno</label><textarea class="control" name="observations" rows="3" maxlength="1000">${fmt.escape(row.observaciones||"")}</textarea></div>
    </div>
    <div class="local-dispatch-return-note-v1145">Los viajes <strong>NO ENTREGADOS</strong> quedan trazados, pero su valor monetario no se suma al cierre.</div>`,
    onConfirm:async dialog=>{
      const value=name=>dialog.querySelector(`[name="${name}"]`)?.value?.trim?.()||"";
      await api.localDispatchReturn(row.id,{estadoEntrega:value("deliveryStatus"),costoDescargue:Number(value("unloadingCost")||0),costoDesvio:Number(value("diversionCost")||0),observaciones:value("observations")});
      toast("Retorno del veh\u00edculo actualizado.","success",5500);await onSaved();
    }
  });
}
export async function renderLocalDispatchLedger(target,{date=today(),destination=""}={}){
  state.date=date;state.destination=destination;state.page=1;
  target.innerHTML=`<section class="local-dispatch-ledger-v1145">
    <header><div><span>Control operativo</span><h3>Cargues y despachos locales</h3><p>Consulta salidas, costos liquidados y novedades de retorno sin salir del m\u00f3dulo de Despachos.</p></div><div class="local-dispatch-export-v1145"><button class="btn btn-ghost btn-compact" data-local-excel>Excel</button><button class="btn btn-ghost btn-compact" data-local-pdf>PDF</button></div></header>
    <div class="local-dispatch-filters-v1145"><label>Fecha<input class="control" type="date" data-local-date value="${fmt.escape(state.date)}"></label><label>Destino<select class="control" data-local-destination>${destinationOptions(state.destination)}</select></label><button class="btn btn-primary" data-local-filter>Consultar</button></div>
    <div data-local-ledger-result>${loading("Consultando despachos locales\u2026")}</div>
  </section>`;
  const result=target.querySelector("[data-local-ledger-result]");
  const load=async()=>{
    result.innerHTML=loading("Consultando despachos locales\u2026");
    try{
      const data=await api.localDispatchTrips({dateFrom:state.date||null,dateTo:state.date||null,destination:state.destination||null,page:state.page,pageSize:100});
      state.data=data;const rows=data.items||[];
      result.innerHTML=`${metricsHtml(data.metrics)}${tableHtml(rows,Boolean(data.canUpdate))}`;
      result.querySelectorAll("[data-local-return]").forEach(button=>button.onclick=()=>{const row=rows.find(item=>item.id===button.dataset.localReturn);if(row)openReturn(row,load)});
    }catch(error){result.innerHTML=`<div class="module-error"><strong>No fue posible consultar los despachos locales</strong><p>${fmt.escape(error.message)}</p></div>`}
  };
  target.querySelector("[data-local-filter]").onclick=()=>{state.date=target.querySelector("[data-local-date]").value;state.destination=target.querySelector("[data-local-destination]").value;load()};
  target.querySelector("[data-local-excel]").onclick=async()=>{try{await exportExcel()}catch(error){toast(error.message,"error",6500)}};
  target.querySelector("[data-local-pdf]").onclick=async()=>{try{await exportPdf()}catch(error){toast(error.message,"error",6500)}};
  await load();
}
