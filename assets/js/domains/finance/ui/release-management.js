import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { parallelWorkFooter } from "../../../modules/active-work.js";
import { activeTask, actionCodes, latestValidation, statusLabel } from "../shared/financial-status.js";
import { closeHost, refresh, guarded } from "../shared/flow-callbacks.js";
import { begin } from "../actions/start-financial-task.js";
import { openStateDialog } from "./status-dialog.js";
import { releaseToReception } from "../actions/release-to-reception.js";
import { orderDetails } from "./order-financial-details.js";

export function renderReleaseManagement(host,data,{reload,refreshLists}){
  const order=data.order;
  const task=activeTask(data);
  const actions=actionCodes(data);
  const validation=latestValidation(data,order.current_step_code);
  const closed=validation?.decision==="APPROVED";
  const status=statusLabel(task,closed);
  const canStart=actions.has("CLAIM")||actions.has("START")||actions.has("RESUME");
  const started=["IN_PROGRESS","WAITING","BLOCKED"].includes(task?.status)||closed;
  const area=order.current_step_code==="CARTERA"?"Cartera":"Caja";
  const reason=order.current_step_code==="CARTERA"?"El cliente fue marcado con mora en crédito.":"El pedido fue marcado como retenido por Caja.";

  host.innerHTML=`
    <div class="modal-overlay simple-process-overlay">
      <section class="modal simple-process-modal financial-simple-modal" data-order-id="${fmt.escape(data.order.id)}">
        <header class="modal-head simple-process-head">
          <div><span class="wizard-kicker">${area}</span><h3>${fmt.escape(order.order_number)}</h3><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.label(order.order_type_code))}</p></div>
          <button class="icon-btn" data-close aria-label="Cerrar">×</button>
        </header>
        <div class="modal-body simple-process-body">
          <section class="financial-reason"><span>Motivo de ingreso</span><strong>${fmt.escape(reason)}</strong></section>
          <section class="financial-current-state ${status.tone}">
            <div><small>Estado actual</small><strong>${fmt.escape(status.label)}</strong><p>${fmt.escape(status.detail)}</p></div>
            <span class="financial-state-dot"></span>
          </section>
          <section class="financial-action-stack">
            <button class="btn btn-primary financial-main-button" data-financial-start ${canStart?"":"disabled"}>
              <span>1</span><div><strong>${started?"Gestión iniciada":"Iniciar gestión"}</strong><small>${started?"El pedido ya fue tomado por el área.":"Toma el pedido para comenzar."}</small></div>
            </button>
            <button class="btn financial-main-button ${started&&!closed?"btn-primary":"btn-ghost"}" data-financial-status ${started&&!closed?"":"disabled"}>
              <span>2</span><div><strong>Estado</strong><small>Actualiza la situación o marca la gestión como cerrada.</small></div>
            </button>
            <button class="btn financial-main-button ${closed?"btn-success":"btn-ghost"}" data-financial-release ${closed?"":"disabled"}>
              <span>3</span><div><strong>Liberar pedido</strong><small>Envía el pedido directamente a Recepción de pedidos.</small></div>
            </button>
          </section>
          ${validation?`<section class="financial-last-update"><small>Última actualización</small><strong>${fmt.escape(validation.notes||"Gestión actualizada")}</strong><span>${fmt.date(validation.created_at)}</span></section>`:""}
          <details class="simple-details"><summary>Ver información completa del pedido</summary>${orderDetails(data)}</details>
        </div>
        ${parallelWorkFooter(order.current_step_code)}
      </section>
    </div>`;

  host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>closeHost(host));
  host.querySelector("[data-financial-start]")?.addEventListener("click",()=>guarded(async()=>{
    if(started)return;
    await begin(data);
    toast("Gestión iniciada.","success");refresh(refreshLists);await reload();
  }));
  host.querySelector("[data-financial-status]")?.addEventListener("click",()=>openStateDialog(data,{reload,refreshLists}));
  host.querySelector("[data-financial-release]")?.addEventListener("click",()=>guarded(async()=>{
    await releaseToReception(data);
    toast("Pedido liberado y enviado a Recepción de pedidos.","success",6000);refresh(refreshLists);closeHost(host);
  }));
}
