import { fmt } from "../../../core/format.js";

export function orderDetails(data){
  const order=data.order;
  const items=data.items||[];
  return `<div class="simple-detail-sections"><section><h4>Información principal</h4><div class="detail-grid">${info("Cliente",order.client_name)}${info("Tipo",fmt.label(order.order_type_code))}${info("Pago",fmt.payment(order.payment_condition_code))}${info("Entrega",fmt.route(order.delivery_route_code))}${info("Prioridad",fmt.label(order.priority))}</div></section><section><h4>Materiales</h4>${items.length?`<div class="table-wrap mobile-card-table"><table><thead><tr><th>Material</th><th>Cantidad</th><th>Corte</th></tr></thead><tbody>${items.map(item=>`<tr><td data-label="Material">${fmt.escape(item.sku||item.description)}</td><td data-label="Cantidad">${fmt.number(item.quantity,3)} ${fmt.escape(item.unit)}</td><td data-label="Corte">${item.requires_cut?"Sí":"No"}</td></tr>`).join("")}</tbody></table></div>`:"<p>Sin materiales registrados.</p>"}</section></div>`;
}

export function info(label,value){return `<div class="info-box"><label>${fmt.escape(label)}</label><strong>${fmt.escape(value??"—")}</strong></div>`}
