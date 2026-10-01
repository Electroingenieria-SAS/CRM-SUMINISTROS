import { fmt } from "../../../../core/format.js";
import { profileFor, destination } from "../routes/shipping-routes.js";
import { carrierInvoice, carrierCost, formatCurrency } from "./delivery-summary.js";

export function workflowHeader(data,stage,delivery=null){
  const profile=profileFor(data.order);
  const place=destination(delivery,data.order);
  const title=stage==="TAKE"?`Preparar ${profile.label.toLowerCase()}`:stage==="GUIDE"?profile.guideTitle:profile.closureTitle;
  const copy=stage==="TAKE"?"Empieza con lo esencial. La información detallada y las novedades quedan abajo, fuera del área principal.":stage==="GUIDE"?profile.guideCopy:"Adjunta la evidencia final requerida para completar el proceso.";
  const facts=stage==="GUIDE"&&delivery?[
    ["Guía",delivery.tracking_number||"Pendiente"],["Transportadora",delivery.carrier||"Pendiente"],["Factura transporte",carrierInvoice(delivery)||"Pendiente"],["Flete",formatCurrency(carrierCost(delivery))]
  ]:[
    ["Pedido",data.order.order_number],["Cliente",data.order.client_name],["Modalidad",profile.label],[profile.destination,place.municipality||place.address||"Registrado por Ventas"]
  ];
  return `<section class="shipping-core-summary-v11107">
    <div class="shipping-core-summary-main-v11107"><div class="shipping-core-route-icon-v11107" aria-hidden="true">${fmt.escape(profile.icon)}</div><div class="shipping-core-summary-copy-v11107"><span>${fmt.escape(profile.label)}</span><h4>${fmt.escape(title)}</h4><p>${fmt.escape(copy)}</p></div></div>
    <div class="shipping-core-facts-v11107">${facts.map(([label,value])=>`<div><small>${fmt.escape(label)}</small><strong title="${fmt.escape(value||"—")}">${fmt.escape(value||"—")}</strong></div>`).join("")}</div>
  </section>`;
}

export function progress(stage){
  const active=stage==="TAKE"?1:stage==="GUIDE"?2:3;
  const rows=[[1,"Tomar"],[2,"Guía / soporte"],[3,"Cierre"]];
  return `<div class="shipping-core-progress-v11107">${rows.map(([n,label])=>`<div class="${n<active?"done":n===active?"active":""}"><span>${n<active?"✓":n}</span><strong>${label}</strong></div>`).join("")}</div>`;
}
