import { fmt } from "../../../core/format.js";
import { rounds } from "../shared/picking-status.js";

export function partialBanner(data){
  const roundCount=rounds(data).length;
  if(!roundCount)return "";
  return `<section class="picking-resume-banner"><span class="picking-partial-badge">RETOMADO</span><div><strong>Continuación del mismo pedido</strong><p>Las líneas ya enviadas no vuelven a aparecer. Esta es la ronda ${roundCount+1}.</p></div></section>`;
}

export function pendingPreview(items){return `<div class="picking-pending-preview"><h5>Mercancía pendiente</h5>${items.map(item=>`<article><div><strong>${fmt.escape(item.reference||item.sku||item.description)}</strong><span>${fmt.escape(item.description)}</span></div><b>${fmt.number(item.quantity,3)} ${fmt.escape(item.unit)}</b></article>`).join("")}</div>`}

export function roundHistory(data){
  const rows=rounds(data);
  if(!rows.length)return "";
  return `<details class="picking-round-history"><summary>Ver rondas anteriores (${rows.length})</summary><div>${rows.map(row=>`<article><span>Ronda ${row.round_no}</span><strong class="${row.status==="PARTIAL"?"warning":"success"}">${row.status==="PARTIAL"?"Parcial":"Completa"}</strong><small>${row.found_lines} encontrada(s) · ${row.missing_lines} pendiente(s) · ${fmt.number(Number(row.business_seconds||0)/3600,2)} h productivas</small></article>`).join("")}</div></details>`;
}

export function details(data){
  return `<div class="picking-details-grid"><div><small>Cliente</small><strong>${fmt.escape(data.order.client_name)}</strong></div><div><small>Tipo</small><strong>${fmt.escape(fmt.label(data.order.order_type_code))}</strong></div><div><small>Pago</small><strong>${fmt.escape(fmt.payment(data.order.payment_condition_code))}</strong></div><div><small>Ruta</small><strong>${fmt.escape(fmt.route(data.order.delivery_route_code))}</strong></div></div>${pendingPreview(data.items||[])}`;
}
