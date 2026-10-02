import { fmt, statusBadge } from "../../../../core/format.js";
import { latestDelivery } from "../shared/shipping-status.js";
import { destination } from "../routes/shipping-routes.js";

export function guideSummary(delivery,file){
  return `<div class="shipping-core-guide-summary-v11107"><div><small>Número de guía</small><strong>${fmt.escape(delivery?.tracking_number||"—")}</strong></div><div><small>Transportadora</small><strong>${fmt.escape(delivery?.carrier||"—")}</strong></div><div><small>Factura transportadora</small><strong>${fmt.escape(carrierInvoice(delivery)||"—")}</strong></div><div><small>Costo del flete</small><strong>${fmt.escape(formatCurrency(carrierCost(delivery)))}</strong></div></div>${file?`<a class="btn btn-ghost btn-compact" href="${fmt.escape(file.web_view_link||"#")}" target="_blank" rel="noopener">Ver soporte cargado</a>`:""}`;
}

export function locationSummary(place){return `<section class="shipping-sales-address"><header><span>Dirección registrada por Ventas</span><strong>${fmt.escape(place.municipality||"Municipio no registrado")}${place.department?`, ${fmt.escape(place.department)}`:""}</strong></header><p>${fmt.escape(place.address||"Dirección no registrada")}</p><small>En Despachos esta información es de consulta. Cualquier corrección debe realizarse desde Ventas antes del envío.</small></section>`}

export function dispatchRecap(delivery,place){return `<section class="dispatch-recap"><header><div><span>Envío en cierre</span><h4>${fmt.escape(delivery?.tracking_number||"Guía registrada")}</h4></div>${statusBadge(delivery?.status||"IN_TRANSIT")}</header><div class="dispatch-recap-grid"><div><small>Transportadora</small><strong>${fmt.escape(delivery?.carrier||"—")}</strong></div><div><small>Municipio</small><strong>${fmt.escape(place.municipality||"—")}</strong></div><div><small>Dirección</small><strong>${fmt.escape(place.address||"—")}</strong></div><div><small>Salida</small><strong>${fmt.date(delivery?.dispatched_at)}</strong></div></div></section>`}

export function carrierInvoice(delivery){return delivery?.carrier_invoice_number||delivery?.carrierInvoiceNumber||delivery?.metadata?.carrierInvoiceNumber||""}

export function carrierCost(delivery){return delivery?.carrier_cost??delivery?.carrierCost??delivery?.metadata?.carrierCost??null}

export function formatCurrency(value){const n=Number(value);return Number.isFinite(n)&&n>0?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n):"—"}

export function shippingSummary(data){
  const delivery=latestDelivery(data),place=destination(delivery,data.order),trace=data.deliveryTimeTrace||{};
  const rawTransit=secondsBetween(delivery?.dispatched_at,delivery?.delivered_at);
  const rawSatisfied=secondsBetween(delivery?.dispatched_at,delivery?.satisfaction_confirmed_at);
  const postDelivery=secondsBetween(delivery?.delivered_at,delivery?.satisfaction_confirmed_at);
  const traceCards=[
    ["Gestión de despacho",trace.dispatchBusinessSeconds,"Tiempo productivo"],
    ["Tránsito laboral",trace.transitBusinessSeconds,"Salida → entrega logística"],
    ["Cierre de entrega",trace.closureBusinessSeconds,"Validación y evidencia"],
    ["Tiempo muerto",trace.deadBusinessSeconds??trace.deadTimeSeconds,"Tiempo laboral sin gestión"],
    ...(rawTransit!==null?[["Tránsito calendario",rawTransit,"Salida → entrega logística"]]:[]),
    ...(rawSatisfied!==null?[["Hasta satisfacción",rawSatisfied,"Salida → confirmación del cliente"]]:[]),
    ...(postDelivery!==null?[["Confirmación posterior",postDelivery,"Entrega → satisfacción"]]:[])
  ];
  const distance=Number(delivery?.distance_km);
  const satisfied=delivery?.satisfaction_status==="SATISFIED"||Boolean(delivery?.satisfaction_confirmed_at);
  return `<div class="simple-detail-sections"><section><h4>Información del envío</h4><div class="detail-grid"><div class="info-box"><label>Ruta</label><strong>${fmt.escape(fmt.route(data.order.delivery_route_code))}</strong></div><div class="info-box"><label>Guía</label><strong>${fmt.escape(delivery?.tracking_number||"—")}</strong></div><div class="info-box"><label>Transportadora</label><strong>${fmt.escape(delivery?.carrier||"—")}</strong></div><div class="info-box"><label>Factura transporte</label><strong>${fmt.escape(carrierInvoice(delivery)||"—")}</strong></div><div class="info-box"><label>Flete</label><strong>${fmt.escape(formatCurrency(carrierCost(delivery)))}</strong></div><div class="info-box"><label>Municipio</label><strong>${fmt.escape(place.municipality||"—")}</strong></div><div class="info-box"><label>Dirección</label><strong>${fmt.escape(place.address||"—")}</strong></div><div class="info-box"><label>Distancia recorrida</label><strong>${Number.isFinite(distance)?`${new Intl.NumberFormat("es-CO",{maximumFractionDigits:1}).format(distance)} km`:"Pendiente"}</strong></div><div class="info-box"><label>Satisfacción</label><strong>${satisfied?"Entregado con satisfacción":"Pendiente de confirmar"}</strong></div><div class="info-box"><label>Confirmación cliente</label><strong>${delivery?.satisfaction_confirmed_at?fmt.date(delivery.satisfaction_confirmed_at):"—"}</strong></div><div class="info-box"><label>Recibido por</label><strong>${fmt.escape(delivery?.received_by||"—")}</strong></div></div></section><section><h4>Resumen de tiempos</h4><div class="shipping-trace-metrics">${traceCards.map(([label,value,caption])=>`<article><small>${fmt.escape(label)}</small><strong>${fmt.hours(Number(value||0))}</strong><span>${fmt.escape(caption)}</span></article>`).join("")}</div><div class="shipping-time-list">${(data.tasks||[]).map(task=>`<article><span>${fmt.escape(fmt.step(task.step_code))}</span><strong>${fmt.hours(task.business_seconds)}</strong><small>Transcurrido: ${fmt.hours(task.raw_seconds)}</small></article>`).join("")}</div></section></div>`;
}

export function secondsBetween(start,end){
  if(!start||!end)return null;
  const a=new Date(start).getTime(),b=new Date(end).getTime();
  if(!Number.isFinite(a)||!Number.isFinite(b))return null;
  return Math.max(0,Math.round((b-a)/1000));
}
