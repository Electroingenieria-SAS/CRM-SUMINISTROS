import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { navigate } from "../../../../core/router.js";
import { moduleForStep } from "../../../../modules/active-work.js";

export function shell(host,data,body,{nextDisabled=false,nextLabel="Siguiente",showFooter=true}={}){
  const order=data.order;
  host.innerHTML=`<div class="modal-overlay shipping-process-overlay"><section class="modal shipping-process-modal shipping-core-v11107" data-order-id="${fmt.escape(order.id)}">
    <header class="modal-head shipping-process-head"><div><span class="wizard-kicker">Despachos y entregas</span><h3>${fmt.escape(order.order_number)}</h3><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.route(order.delivery_route_code))}</p></div><button type="button" class="icon-btn" data-close aria-label="Cerrar">×</button></header>
    <div class="modal-body shipping-process-body">${body}</div>
    ${showFooter?shippingFooter(order.current_step_code,nextDisabled,nextLabel):""}
  </section></div>`;
  host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>host.replaceChildren());
}

export function shippingFooter(step,nextDisabled=false,nextLabel="Siguiente"){
  return `<footer class="modal-foot shipping-core-footer-v11107">
    <div class="shipping-core-parallel-v11107"><span aria-hidden="true">⇄</span><div><strong>Trabajo en paralelo habilitado</strong><small>El pedido permanece asignado aunque cierres esta ventana.</small></div></div>
    <div class="shipping-core-footer-actions-v11107">
      <button type="button" class="btn btn-ghost" data-shipping-close-another="${fmt.escape(String(step||""))}">Cerrar y tomar otro</button>
      <button type="button" class="btn btn-primary" data-shipping-next-core ${nextDisabled?"disabled":""}>${fmt.escape(nextLabel)}</button>
    </div>
  </footer>`;
}

export function bindFooter(host,data,{onNext,refreshLists}={}){
  const closeAnother=host.querySelector("[data-shipping-close-another]");
  if(closeAnother)closeAnother.onclick=()=>{
    const step=closeAnother.dataset.shippingCloseAnother||data.order.current_step_code||"";
    host.replaceChildren();
    navigate(moduleForStep(step),{step,assignment:"ALL"});
    refreshLists?.();
    toast("El pedido continúa en Mis pedidos activos. Puedes tomar otro sin perder el avance.","success",5500);
  };
  const next=host.querySelector("[data-shipping-next-core]");
  if(next&&onNext)next.onclick=async()=>{
    if(next.disabled)return;
    next.disabled=true;
    const old=next.textContent;
    next.textContent="Procesando…";
    try{await onNext(next)}catch(error){toast(error.message||"No fue posible continuar.","error",7500);if(next.isConnected){next.disabled=false;next.textContent=old}}
  };
}
