import {api} from "../services/api.js";
import {fmt,priorityBadge} from "../core/format.js";
import {loading,empty,paginationHtml} from "../core/ui.js";
import {openNoDeliveryReport,openSatisfactionConfirmation} from "./shipping-flow.js";

const DELIVERED_STATUSES=new Set(["DELIVERED","CLOSED","COMPLETED"]);
const TRANSIT_STATUSES=new Set(["DISPATCHED","IN_TRANSIT","REPROGRAMMED"]);

function normalize(value){return String(value||"").trim().toUpperCase()}

function followupFor(row){
  const deliveryStatus=normalize(row.deliveryStatus);
  const orderStatus=normalize(row.status);
  if(row.hasNoDelivery){
    return {tone:"danger",label:"Novedad reportada",detail:"Logística debe resolver la no entrega antes de cerrar el caso.",pending:"Pendiente: resolución de Logística"};
  }
  if(row.satisfactionConfirmedAt||normalize(row.satisfactionStatus)==="SATISFIED"){
    return {tone:"success",label:"Entregado con satisfacción",detail:deliveryMetricsText(row),pending:"Seguimiento comercial cerrado"};
  }
  if(row.deliveredAt||DELIVERED_STATUSES.has(deliveryStatus)||orderStatus==="CLOSED"){
    return {tone:"attention",label:"Entregado · falta satisfacción",detail:"La entrega logística ya ocurrió. Falta confirmar el resultado con el cliente.",pending:"Pendiente: satisfacción del cliente"};
  }
  if(row.canReportNoDelivery||TRANSIT_STATUSES.has(deliveryStatus)){
    return {tone:"attention",label:"Pendiente de confirmar entrega",detail:"El envío sigue abierto. Reporta únicamente si el cliente informa que no recibió.",pending:"Pendiente: resultado de entrega"};
  }
  return {tone:"neutral",label:"Seguimiento en curso",detail:"Consulta el pedido para revisar su último movimiento registrado.",pending:"Pendiente: seguimiento comercial"};
}

function routeLabel(row){return fmt.route(row.route)||"Modalidad no registrada"}
function distanceText(row){const km=Number(row.distanceKm);return Number.isFinite(km)?`${new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(km)} km`:"Distancia pendiente"}
function durationText(seconds){const n=Number(seconds);return Number.isFinite(n)&&n>=0?fmt.hours(n):"—"}
function deliveryMetricsText(row){
  const parts=[];
  if(row.transitElapsedSeconds!=null)parts.push(`Tránsito: ${durationText(row.transitElapsedSeconds)}`);
  if(row.satisfactionElapsedSeconds!=null)parts.push(`Hasta satisfacción: ${durationText(row.satisfactionElapsedSeconds)}`);
  if(row.distanceKm!=null)parts.push(`Recorrido: ${distanceText(row)}`);
  return parts.join(" · ")||"Entrega confirmada por el cliente.";
}

function metric(label,value,detail,tone){
  return `<article class="sent-orders-metric-v11108 ${tone}"><span aria-hidden="true"></span><div><strong>${fmt.number(value)}</strong><b>${fmt.escape(label)}</b><small>${fmt.escape(detail)}</small></div></article>`;
}

function summary(rows,pagination){
  const total=Number(pagination?.totalItems||rows.length||0);
  const satisfied=rows.filter(row=>Boolean(row.satisfactionConfirmedAt)||normalize(row.satisfactionStatus)==="SATISFIED").length;
  const transit=rows.filter(row=>followupFor(row).tone==="attention").length;
  const novelty=rows.filter(row=>row.hasNoDelivery).length;
  const confirmedKm=rows.reduce((sum,row)=>sum+(Number.isFinite(Number(row.distanceKm))?Number(row.distanceKm):0),0);
  return `<section class="sent-orders-overview-v11108" aria-label="Resumen de pedidos enviados">
    ${metric("Total enviados",total,"Total encontrado con los filtros actuales","total")}
    ${metric("En seguimiento",transit,"Incluye entregas pendientes de satisfacción","transit")}
    ${metric("Con satisfacción",satisfied,`${new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(confirmedKm)} km confirmados en esta página`,"success")}
    ${metric("Con novedad",novelty,"Visibles en esta página","danger")}
  </section>`;
}

function orderRow(row){
  const followup=followupFor(row);
  const guide=row.trackingNumber||"Sin guía registrada";
  const municipality=row.municipality||"Municipio no registrado";
  const responsible=row.assigneeName||"Sin responsable";
  const missingGuide=!row.trackingNumber;
  return `<article class="sent-order-row-v11108 ${followup.tone}" data-sent-order="${fmt.escape(row.id)}">
    <div class="sent-order-identity-v11108">
      <div class="sent-order-number-v11108"><strong>${fmt.escape(row.orderNumber||"Pedido")}</strong>${priorityBadge(row.priority)}</div>
      <span>${fmt.escape(row.clientName||"Cliente no registrado")}</span>
    </div>
    <div class="sent-order-delivery-v11108">
      <span class="sent-order-route-chip-v11108">${fmt.escape(routeLabel(row))}</span>
      <strong>${fmt.escape(municipality)}</strong>
      <small>${fmt.escape(row.address||"Dirección disponible dentro del pedido")}</small>
      <small><b>Recorrido:</b> ${fmt.escape(distanceText(row))}</small>
    </div>
    <div class="sent-order-guide-v11108 ${missingGuide?"missing":""}">
      <small>Guía</small>
      <strong>${fmt.escape(guide)}</strong>
      <span>${row.dispatchedAt?`Enviado ${fmt.date(row.dispatchedAt)}`:"Fecha de envío no registrada"}</span>
      <span>${row.deliveredAt?`Entregado ${fmt.date(row.deliveredAt)} · ${durationText(row.transitElapsedSeconds)}`:"Entrega pendiente"}</span>
    </div>
    <div class="sent-order-owner-v11108">
      <small>Responsable</small>
      <strong>${fmt.escape(responsible)}</strong>
      <span>${row.carrier?fmt.escape(row.carrier):"Transportadora no indicada"}</span>
    </div>
    <div class="sent-order-followup-v11108 ${followup.tone}">
      <span class="sent-order-state-dot-v11108" aria-hidden="true"></span>
      <div><strong>${fmt.escape(followup.label)}</strong><small>${fmt.escape(followup.detail)}</small><b>${fmt.escape(followup.pending)}</b></div>
    </div>
    <div class="sent-order-actions-v11108">
      ${row.canConfirmSatisfaction?`<button type="button" class="btn btn-success btn-compact" data-satisfaction="${fmt.escape(row.id)}">Entregado con satisfacción</button>`:""}
      ${row.canReportNoDelivery&&!row.hasNoDelivery?`<button type="button" class="btn btn-danger btn-compact" data-no-delivery="${fmt.escape(row.id)}">Reportar no entrega</button>`:""}
      <button type="button" class="btn btn-primary btn-compact" data-open-sent="${fmt.escape(row.id)}">Ver pedido</button>
    </div>
  </article>`;
}

function list(rows){
  return `<section class="sent-orders-workspace-v11108">
    <header class="sent-orders-list-head-v11108"><div>Pedido y cliente</div><div>Entrega</div><div>Guía y salida</div><div>Responsable</div><div>Seguimiento</div><div>Acciones</div></header>
    <div class="sent-orders-list-v11108">${rows.map(orderRow).join("")}</div>
  </section>`;
}

export async function renderSentOrdersPanel(target,{search="",page=1,onOpen}={}){
  target.innerHTML=loading("Consultando pedidos enviados…");
  try{
    const data=await api.shippingSentOrders(search,page,30);
    const rows=data.items||[];
    if(!rows.length){target.innerHTML=empty("No hay pedidos enviados","Los pedidos aparecerán aquí cuando Logística registre su salida o entrega.");return;}
    target.innerHTML=`${summary(rows,data.pagination)}${list(rows)}<footer class="sent-orders-pagination-v11108"><span>${fmt.number(data.pagination?.totalItems||rows.length)} pedido(s) encontrados</span>${paginationHtml(data.pagination)}</footer>`;
    target.querySelectorAll("[data-no-delivery]").forEach(button=>button.onclick=()=>{
      const row=rows.find(item=>item.id===button.dataset.noDelivery);
      if(row)openNoDeliveryReport(row,{onSaved:()=>renderSentOrdersPanel(target,{search,page,onOpen})});
    });
    target.querySelectorAll("[data-satisfaction]").forEach(button=>button.onclick=()=>{
      const row=rows.find(item=>item.id===button.dataset.satisfaction);
      if(row)openSatisfactionConfirmation(row,{onSaved:()=>renderSentOrdersPanel(target,{search,page,onOpen})});
    });
    target.querySelectorAll("[data-open-sent]").forEach(button=>button.onclick=()=>onOpen?.(button.dataset.openSent));
    target.querySelectorAll("[data-page]").forEach(button=>button.onclick=()=>renderSentOrdersPanel(target,{search,page:Number(button.dataset.page),onOpen}));
  }catch(error){
    target.innerHTML=`<div class="module-error"><strong>No fue posible consultar los pedidos enviados</strong><p>${fmt.escape(error.message)}</p></div>`;
  }
}
