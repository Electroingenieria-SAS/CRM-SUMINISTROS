import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { loading } from "../../../core/ui.js";
import { simpleStatus } from "../../../core/guided.js";
import { isOrderReceptionStep, renderOrderReception } from "../../../modules/receiving-order.js";
import { isFinancialFlowStep, renderFinancialFlow } from "../../../modules/financial-flow.js";
import { isPickingFlow, renderPickingFlow } from "../../../modules/picking-flow.js";
import { isCuttingFlow, renderCuttingOrder } from "../../../modules/cutting-flow.js";
import { isShippingFlow, renderShippingFlow } from "../../../modules/shipping-flow.js";
import { parallelWorkFooter } from "../../../modules/active-work.js";
import { mountOrderCancellationAction } from "../../../modules/order-cancellation.js";
import { activeTask, actionCodes, currentAssignee, recommendedAction, stageRequirement } from "./order-stage.js";
import { statusOption, workflowMini } from "./order-status-controls.js";
import { runSimpleIntent } from "./order-actions.js";
import { runSecondary } from "./secondary-actions.js";
import { simpleDetails } from "./order-information.js";
import { refreshLists } from "../shared/refresh-orders.js";

export async function openOrder(orderId){
  const host=document.querySelector("#modal-root");
  host.innerHTML=`<div class="modal-overlay simple-process-overlay"><section class="modal simple-process-modal wide"><div class="modal-body">${loading("Abriendo gestión del pedido…")}</div></section></div>`;
  try{
    const data=await api.getOrder(orderId);
    renderSimpleOrder(host,data);
  }catch(error){
    host.innerHTML=`<div class="modal-overlay"><section class="modal"><header class="modal-head"><h3>No fue posible abrir el pedido</h3><button class="icon-btn" data-close aria-label="Cerrar">×</button></header><div class="modal-body"><p class="danger">${fmt.escape(error.message)}</p></div><footer class="modal-foot"><button class="btn btn-primary" data-close>Cerrar</button></footer></section></div>`;
    host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>host.replaceChildren());
  }
}

export function renderSimpleOrder(host,data){
  const cancellationOptions={reload:()=>openOrder(data.order.id),refresh:refreshLists};
  if(isOrderReceptionStep(data)){renderOrderReception(host,data,{reload:cancellationOptions.reload,refreshLists});mountOrderCancellationAction(host,data,cancellationOptions);return;}
  if(isFinancialFlowStep(data)){renderFinancialFlow(host,data,{reload:cancellationOptions.reload,refreshLists});mountOrderCancellationAction(host,data,cancellationOptions);return;}
  if(isCuttingFlow(data)){renderCuttingOrder(host,data);mountOrderCancellationAction(host,data,cancellationOptions);return;}
  if(isPickingFlow(data)){renderPickingFlow(host,data,{reload:cancellationOptions.reload,refreshLists});mountOrderCancellationAction(host,data,cancellationOptions);return;}
  if(isShippingFlow(data)){renderShippingFlow(host,data,{reload:cancellationOptions.reload,refreshLists});mountOrderCancellationAction(host,data,cancellationOptions);return;}
  const order=data.order;
  const task=activeTask(data);
  const status=simpleStatus(task?.status||order.status);
  const requirement=stageRequirement(data);
  const actions=actionCodes(data);
  const next=recommendedAction(data,requirement);
  host.innerHTML=`
    <div class="modal-overlay simple-process-overlay">
      <section class="modal simple-process-modal wide" data-order-id="${fmt.escape(order.id)}">
        <header class="modal-head simple-process-head">
          <div><span class="wizard-kicker">Gestión rápida</span><h3>${fmt.escape(order.order_number)}</h3><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.step(order.current_step_code))}</p></div>
          <button class="icon-btn" data-close aria-label="Cerrar">×</button>
        </header>
        <div class="modal-body simple-process-body">
          <section class="simple-order-summary">
            <div><small>Etapa actual</small><strong>${fmt.escape(fmt.step(order.current_step_code))}</strong></div>
            <div><small>Estado de etapa</small><strong class="simple-status-title ${status.tone}">${fmt.escape(status.label)}</strong></div>
            <div><small>Responsable</small><strong>${fmt.escape(currentAssignee(data))}</strong></div>
            <div><small>Vendedor</small><strong>${fmt.escape(order.sellerName||"—")}</strong></div>
            <div><small>Condición</small><strong>${fmt.escape(fmt.payment(order.payment_condition_code))}</strong></div>
            <div><small>Entrega</small><strong>${fmt.escape(fmt.route(order.delivery_route_code))}</strong></div>
          </section>

          ${workflowMini(data.tasks,order.current_step_code)}

          <section class="simple-next-action ${next.tone}">
            <div><span>Siguiente paso recomendado</span><h4>${fmt.escape(next.title)}</h4><p>${fmt.escape(next.detail)}</p></div>
            ${next.button?`<button class="btn btn-primary btn-large" data-next-action="${next.button}">${fmt.escape(next.buttonLabel)}</button>`:""}
          </section>

          <section class="simple-status-actions">
            <header><div><h4>Marca la situación del pedido</h4><p>Usa solo el estado que realmente describe el trabajo.</p></div></header>
            <div class="simple-status-grid">
              ${statusOption("PENDING","Pendiente","Aún no se ha iniciado.",status.tone==="pending",actions.has("CLAIM")||actions.has("START"))}
              ${statusOption("WORKING","En gestión","El responsable está trabajando.",status.tone==="working",actions.has("CLAIM")||actions.has("START")||actions.has("RESUME"))}
              ${statusOption("WAITING","En espera","Falta información o una respuesta.",status.tone==="waiting",actions.has("WAIT"))}
              ${statusOption("NOVELTY","Con novedad","Hay un impedimento que debe resolverse.",status.tone==="blocked",actions.has("WAIT"))}
              ${statusOption("DONE","Gestionado","La etapa quedó resuelta.",status.tone==="done",actions.has("COMPLETE"))}
            </div>
          </section>

          <section class="simple-secondary-actions">
            ${actions.has("COMMENT")?'<button class="btn btn-create" data-secondary="COMMENT">Agregar nota</button>':""}
            ${actions.has("ASSIGN")?'<button class="btn btn-ghost" data-secondary="ASSIGN">Asignar responsable</button>':""}
            ${actions.has("REQUEST_APPROVAL")?'<button class="btn btn-ghost" data-secondary="REQUEST_APPROVAL">Solicitar aprobación</button>':""}
            ${(data.actions?.domainActions||[]).some(item=>item.code==="FILE")?'<button class="btn btn-ghost" data-secondary="FILE">Adjuntar soporte</button>':""}
            ${(data.actions?.domainActions||[]).some(item=>item.code==="STICKERS")?'<button class="btn btn-ghost" data-secondary="STICKERS">Imprimir etiquetas</button>':""}
          </section>

          <details class="simple-details">
            <summary>Ver información completa del pedido</summary>
            ${simpleDetails(data)}
          </details>
        </div>
        ${parallelWorkFooter(order.current_step_code)}
      </section>
    </div>`;

  host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>host.replaceChildren());
  mountOrderCancellationAction(host,data,cancellationOptions);
  host.querySelector("[data-next-action]")?.addEventListener("click",()=>runSimpleIntent(data,next.button));
  host.querySelectorAll("[data-status-choice]").forEach(button=>button.onclick=()=>runSimpleIntent(data,button.dataset.statusChoice));
  host.querySelectorAll("[data-secondary]").forEach(button=>button.onclick=()=>runSecondary(data,button.dataset.secondary));
}
