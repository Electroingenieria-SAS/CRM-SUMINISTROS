import { fmt } from "../../../core/format.js";
import { activeOrdersState } from "./active-orders-state.js";

export function render(slot){
  const count=activeOrdersState.activeOrders.length;
  const visible=activeOrdersState.activeOrders.slice(0,10);
  slot.innerHTML=`<div class="active-work">
    <button type="button" class="active-work-trigger ${count?"has-items":""}" data-active-work-toggle aria-expanded="${activeOrdersState.expanded}">
      <span class="active-work-trigger-icon" aria-hidden="true">⇄</span>
      <span class="active-work-trigger-copy"><strong>Mis pedidos activos</strong><small>${activeOrdersState.loading?"Actualizando…":count?`${count} en gestión simultánea`:`Sin pedidos tomados`}</small></span>
      <b>${count}</b>
    </button>
    ${activeOrdersState.expanded?`<section class="active-work-popover" aria-label="Mis pedidos activos">
      <header><div><strong>Trabajo simultáneo</strong><small>Puedes cambiar de pedido sin liberar los anteriores.</small></div><button type="button" class="icon-btn" data-active-work-refresh title="Actualizar" aria-label="Actualizar pedidos activos">↻</button></header>
      <div class="active-work-list">
        ${activeOrdersState.loading&&!count?`<div class="active-work-loading">Consultando tus pedidos…</div>`:visible.length?visible.map(activeOrderRow).join(""):`<div class="active-work-empty"><strong>No tienes pedidos activos</strong><span>Toma un pedido desde cualquier cola y aparecerá aquí.</span></div>`}
      </div>
      ${count>visible.length?`<footer>Mostrando ${visible.length} de ${count}. Consulta “Mis pedidos” para verlos todos.</footer>`:""}
    </section>`:""}
  </div>`;
}

export function activeOrderRow(order){
  const status=String(order.status||"").toUpperCase();
  const statusText={QUEUED:"Pendiente",ASSIGNED:"Asignado",IN_PROGRESS:"En gestión",WAITING:"En espera",BLOCKED:"Con novedad"}[status]||fmt.label(status);
  return `<button type="button" class="active-work-order priority-${String(order.priority||"MEDIUM").toLowerCase()}" data-active-work-order="${fmt.escape(order.id)}">
    <span class="active-work-order-main"><strong>${fmt.escape(order.orderNumber)}</strong><small>${fmt.escape(order.clientName)} · ${fmt.escape(fmt.step(order.currentStep))}</small></span>
    <span class="active-work-order-meta"><b class="status-${status.toLowerCase()}">${fmt.escape(statusText)}</b><small>${fmt.hours(order.ageBusinessSeconds)}</small></span>
  </button>`;
}
