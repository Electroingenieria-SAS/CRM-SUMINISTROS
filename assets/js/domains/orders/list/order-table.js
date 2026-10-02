import { fmt } from "../../../core/format.js";
import { customerSegmentBadgeFromPriority, orderStageBadge } from "../shared/order-status.js";

export function ordersTable(rows){
  return `<div class="erp-work-list orders-master-list">${rows.map(order=>{
    const status=String(order.status||"").toUpperCase();
    const action=status==="IN_PROGRESS"?"Continuar":status==="ASSIGNED"||status==="QUEUED"?"Abrir / iniciar":"Abrir";
    return `<article class="erp-work-row orders-master-row"><div class="erp-work-main"><span class="erp-work-eyebrow">${fmt.escape(fmt.step(order.stepName||order.currentStep))}</span><strong>${fmt.escape(order.orderNumber)}</strong><small>${fmt.escape(order.clientName)} · ${fmt.escape(fmt.label(order.orderType))} · ${fmt.escape(fmt.payment(order.paymentCondition))}</small>${order.fulfillmentStatus==="PARTIAL"||order.partialLabel?`<em class="order-partial-tag">Pedido parcial · ${fmt.number(order.pendingItemCount||0)} pendiente(s)</em>`:""}</div><div class="erp-work-meta"><span><small>Estado</small><b>${orderStageBadge(order)}</b></span><span><small>Responsable</small><b>${fmt.escape(order.assigneeName||(String(order.status||"").toUpperCase()==="CLOSED"?"—":"En cola"))}</b></span><span><small>Vendedor</small><b>${fmt.escape(order.sellerName||"—")}</b></span><span><small>Tiempo</small><b>${fmt.hours(order.ageBusinessSeconds)}</b></span><span><small>Ruta</small><b>${fmt.escape(fmt.route(order.route))}</b></span><span><small>Actualizado</small><b>${fmt.date(order.updatedAt)}</b></span></div><div class="erp-work-status">${customerSegmentBadgeFromPriority(order.priority)}${order.slaExceeded?'<small class="danger">Plazo excedido</small>':""}</div><button type="button" class="btn btn-primary erp-work-action" data-order="${fmt.escape(order.id)}">${action}</button></article>`;
  }).join("")}</div>`;
}
