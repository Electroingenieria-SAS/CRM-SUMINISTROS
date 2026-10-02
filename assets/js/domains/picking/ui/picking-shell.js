import { fmt } from "../../../core/format.js";
import { parallelWorkFooter } from "../../../modules/active-work.js";
import { pendingItems, assigneeName } from "../shared/picking-status.js";
import { details } from "../partial/round-history.js";

export function shell(data,content){
  const fulfillment=data.order.metadata?.fulfillment||{};
  return `<div class="modal-overlay simple-process-overlay">
    <section class="modal simple-process-modal wide picking-process-modal" data-order-id="${fmt.escape(data.order.id)}">
      <header class="modal-head simple-process-head picking-process-head">
        <div><span class="wizard-kicker">Alistamiento</span><h3>${fmt.escape(data.order.order_number)}</h3><p>${fmt.escape(data.order.client_name)} · ${fmt.escape(fmt.label(data.order.order_type_code))}</p></div>
        <div class="picking-head-actions">${fulfillment.partialLabel||fulfillment.status==="PARTIAL"?'<span class="picking-partial-badge">PEDIDO PARCIAL</span>':""}<button class="icon-btn" data-close aria-label="Cerrar">×</button></div>
      </header>
      <div class="modal-body simple-process-body picking-process-body">
        <section class="picking-order-strip">
          <div><small>Responsable</small><strong>${fmt.escape(assigneeName(data))}</strong></div>
          <div><small>Entrega</small><strong>${fmt.escape(fmt.route(data.order.delivery_route_code))}</strong></div>
          <div><small>Líneas totales</small><strong>${(data.items||[]).length}</strong></div>
          <div><small>Pendientes</small><strong>${pendingItems(data).length}</strong></div>
        </section>
        ${content}
        <details class="simple-details"><summary>Ver información completa del pedido</summary><div data-order-support-slot></div>${details(data)}</details>
      </div>
      ${parallelWorkFooter(data.order.current_step_code)}
    </section>
  </div>`;
}

export function bindClose(host){host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>host.replaceChildren())}
