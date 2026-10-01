import { api } from "../../../../services/api.js";
import { fmt } from "../../../../core/format.js";
import { toast, taskPanel } from "../../../../core/ui.js";
import { parallelWorkFooter } from "../../../../modules/active-work.js";
import { bindClose } from "../ui/reception-shell.js";

export function openSubdialog(host,{title,body,confirmLabel,onConfirm}){
  return taskPanel(host,{title,body,confirmLabel,kicker:"Confirmación de Recepción",onConfirm:async(_panel,button)=>onConfirm(button)});
}

export function openPurchaseArrival(order,{refreshLists}={}){
  const host=document.querySelector("#modal-root");
  const status=String(order.arrivalStatus||"").toUpperCase();
  const waiting=status==="WAITING";
  const arrived=status==="ARRIVED";
  host.innerHTML=`<div class="modal-overlay simple-process-overlay">
    <section class="modal simple-process-modal wide reception-process-modal purchase-shadow-modal" data-order-id="${fmt.escape(order.id)}">
      <header class="modal-head simple-process-head reception-process-head"><div><span class="wizard-kicker">Recepción · seguimiento de Compras</span><h3>${fmt.escape(order.orderNumber)}</h3><p>${fmt.escape(order.clientName)} · PVE</p></div><button class="icon-btn" data-close aria-label="Cerrar">×</button></header>
      <div class="modal-body simple-process-body reception-process-body">
        <section class="purchase-shadow-banner"><span>EN PARALELO CON COMPRAS</span><div><strong>${arrived?"Mercancía recibida":waiting?"Esperando llegada a la sede":"Confirma el estado físico de la mercancía"}</strong><p>Este seguimiento no duplica el pedido ni interfiere con la gestión de Compras.</p></div></section>
        <section class="purchase-shadow-status">
          <div><small>Etapa principal</small><strong>${fmt.escape(fmt.step(order.currentStep))}</strong></div>
          <div><small>Estado de llegada</small><strong>${arrived?"Mercancía OK":waiting?"En espera":"Sin marcar"}</strong></div>
          <div><small>Destino posterior</small><strong>Recepción de pedidos</strong></div>
        </section>
        <div class="purchase-shadow-actions">
          ${arrived?`<button class="btn btn-success btn-large" disabled>✓ Mercancía OK</button><p>${order.currentStep==="COMPRAS"?"La mercancía ya está registrada. Cuando Compras libere el pedido, Recepción quedará habilitada automáticamente.":"El pedido ya puede continuar en Recepción."}</p>`:waiting?`<button class="btn btn-success btn-large" data-arrival="ARRIVED">Mercancía OK</button><p>Úsalo cuando la mercancía ya esté físicamente en la sede.</p>`:`<button class="btn btn-warning btn-large" data-arrival="WAITING">Marcar espera</button><p>Indica que Recepción está esperando la llegada física del PVE.</p>`}
        </div>
      </div>
      ${parallelWorkFooter(order.currentStep||"COMPRAS")}
    </section>
  </div>`;
  bindClose(host);
  host.querySelector("[data-arrival]")?.addEventListener("click",async event=>{
    const button=event.currentTarget;button.disabled=true;
    try{
      const result=await api.setPurchaseArrival(order.id,button.dataset.arrival);
      toast(button.dataset.arrival==="WAITING"?"Pedido marcado en espera de mercancía.":"Mercancía OK registrada.","success",6000);
      refreshLists?.();window.__erpQueueRefresh?.();
      host.replaceChildren();
    }catch(error){toast(error.message,"error",7000);button.disabled=false}
  });
}
