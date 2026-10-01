import { fmt } from "../../../../core/format.js";
import { parallelWorkFooter } from "../../../../modules/active-work.js";
import { fullDetails } from "./order-context.js";
import { assigneeName } from "../actions/start-reception.js";

export function baseShell(data,content,showDetails){
  const order=data.order;
  return `<div class="modal-overlay simple-process-overlay">
    <section class="modal simple-process-modal wide reception-process-modal" data-order-id="${fmt.escape(data.order.id)}">
      <header class="modal-head simple-process-head reception-process-head">
        <div><span class="wizard-kicker">Recepción de pedidos</span><h3>${fmt.escape(order.order_number)}</h3><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.label(order.order_type_code))}</p></div>
        <button class="icon-btn" data-close aria-label="Cerrar">×</button>
      </header>
      <div class="modal-body simple-process-body reception-process-body">
        <section class="reception-order-strip">
          <div><small>Responsable actual</small><strong>${fmt.escape(assigneeName(data))}</strong></div>
          <div><small>Pago</small><strong>${fmt.escape(fmt.payment(order.payment_condition_code))}</strong></div>
          <div><small>Entrega</small><strong>${fmt.escape(fmt.route(order.delivery_route_code))}</strong></div>
          <div><small>Archivos del asesor</small><strong>${(data.files||[]).length}</strong></div>
        </section>
        ${content}
        ${showDetails?`<details class="simple-details reception-full-details"><summary>Ver información completa del pedido</summary>${fullDetails(data)}</details>`:""}
      </div>
      ${parallelWorkFooter(order.current_step_code)}
    </section>
  </div>`;
}

export function bindClose(host){host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>host.replaceChildren())}
