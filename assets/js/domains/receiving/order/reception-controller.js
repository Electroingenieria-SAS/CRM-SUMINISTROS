import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { baseShell, bindClose } from "./ui/reception-shell.js";
import { reviewStage } from "./stages/review.js";
import { pdfStage } from "./stages/pdf.js";
import { editStage } from "./stages/edit-lines.js";
import { assignmentStageLoading } from "./stages/assignment.js";
import { bindStage } from "./stages/stage-bindings.js";
import { progressBar } from "./ui/order-context.js";
import { loadDraft } from "./draft/reception-draft.js";
import { activeTask, actionCodes, assigneeName, beginReception } from "./actions/start-reception.js";

export function isOrderReceptionStep(data){
  return data?.order?.current_step_code==="RECEPCION_PEDIDO";
}

export function renderOrderReception(host,data,{reload,refreshLists}={}){
  const task=activeTask(data);
  const actions=actionCodes(data);
  const canStart=actions.has("CLAIM")||actions.has("START")||actions.has("RESUME");
  const inProgress=task?.status==="IN_PROGRESS";

  if(!task){
    host.innerHTML=baseShell(data,`<div class="reception-empty-state"><strong>El pedido no tiene una tarea activa.</strong><p>Solicita a la jefatura logística revisar el flujo.</p></div>`,false);
    bindClose(host);
    return;
  }

  if(!inProgress){
    const label=task.status==="WAITING"||task.status==="BLOCKED"?"Retomar pedido":"Tomar pedido";
    const detail=task.status==="WAITING"||task.status==="BLOCKED"
      ?"La recepción quedó pausada. Retómala para continuar exactamente donde estaba."
      :"Al tomarlo quedará asignado a tu usuario y nadie podrá procesarlo al mismo tiempo.";
    const blocked=!canStart;
    host.innerHTML=baseShell(data,`
      <section class="reception-take-card">
        <span class="reception-step-tag">Paso 1 de 4</span>
        <h4>${fmt.escape(label)}</h4>
        <p>${fmt.escape(detail)}</p>
        <button type="button" class="btn btn-primary reception-take-button" data-take-order ${blocked?"disabled":""}>${fmt.escape(label)}</button>
        ${blocked?`<div class="reception-assigned-warning">Este pedido está asignado a <strong>${fmt.escape(assigneeName(data))}</strong> y tu usuario no tiene permiso para tomarlo.</div>`:""}
      </section>`,false);
    bindClose(host);
    host.querySelector("[data-take-order]")?.addEventListener("click",async event=>{
      const button=event.currentTarget;
      button.disabled=true;
      try{
        await beginReception(data);
        refreshLists?.();
        await reload?.();
      }catch(error){
        toast(error.message,"error",7000);
        button.disabled=false;
      }
    });
    return;
  }

  if(!actions.has("COMPLETE")){
    host.innerHTML=baseShell(data,`<section class="reception-take-card"><span class="reception-step-tag">Pedido en gestión</span><h4>Este pedido está siendo atendido</h4><p>La recepción permanece bloqueada para evitar que dos usuarios modifiquen las líneas o las asignaciones al mismo tiempo.</p><div class="reception-assigned-warning">Responsable actual: <strong>${fmt.escape(assigneeName(data))}</strong></div></section>`,false);
    bindClose(host);
    return;
  }

  const draft=loadDraft(data);
  renderWorkbench(host,data,draft,{reload,refreshLists});
}

export function renderWorkbench(host,data,draft,callbacks){
  const content=draft.stage==="PDF"?pdfStage(data,draft):draft.stage==="EDIT"?editStage(data,draft):draft.stage==="ASSIGN"?assignmentStageLoading(data,draft):reviewStage(data,draft);
  host.innerHTML=baseShell(data,`
    ${progressBar(draft.stage)}
    <div class="reception-workspace" data-reception-workspace>${content}</div>`,true);
  bindClose(host);
  bindStage(host,data,draft,callbacks);
}
