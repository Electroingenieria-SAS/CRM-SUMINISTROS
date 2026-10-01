import { toast } from "../../../core/ui.js";
import { baseShell, bindClose, bindDisclosureMarkers } from "./ui/reception-shell.js";
import { bindFooterNavigation } from "./ui/footer-navigation.js";
import { takeStage } from "./stages/take.js";
import { statusStage } from "./stages/status.js";
import { reviewStage } from "./stages/review.js";
import { pdfStage } from "./stages/pdf.js";
import { editStage } from "./stages/edit-lines.js";
import { assignmentStageLoading } from "./stages/assignment.js";
import { bindStage } from "./stages/stage-bindings.js";
import { progressBar } from "./ui/order-context.js";
import { loadDraft } from "./draft/reception-draft.js";
import { activeTask, actionCodes, assigneeName, beginReception } from "./actions/start-reception.js";

export function isOrderReceptionStep(data){return data?.order?.current_step_code==="RECEPCION_PEDIDO"}

function viewData(data){return {...data,assigneeLabel:assigneeName(data)}}

function bindShell(host,stage){
  bindClose(host);
  bindDisclosureMarkers(host);
  bindFooterNavigation(host,stage);
}

export function renderOrderReception(host,data,{reload,refreshLists}={}){
  const task=activeTask(data);
  const actions=actionCodes(data);
  const canStart=actions.has("CLAIM")||actions.has("START")||actions.has("RESUME");
  const inProgress=task?.status==="IN_PROGRESS";
  const presentation=viewData(data);

  if(!task){
    host.innerHTML=baseShell(presentation,statusStage({title:"El pedido no tiene una tarea activa.",text:"Solicita a la jefatura logística revisar el flujo."}),{stage:"STATUS"});
    bindShell(host,"STATUS");
    return;
  }

  if(!inProgress){
    const label=task.status==="WAITING"||task.status==="BLOCKED"?"Retomar pedido":"Tomar pedido";
    host.innerHTML=baseShell(presentation,takeStage(presentation,{label,blocked:!canStart}),{stage:"TAKE"});
    bindShell(host,"TAKE");
    const button=host.querySelector("[data-take-order]");
    if(button)button.onclick=async()=>{
      button.disabled=true;
      try{
        await beginReception(data);
        refreshLists?.();
        await reload?.();
      }catch(error){
        toast(error.message,"error",7000);
        button.disabled=false;
      }
    };
    return;
  }

  if(!actions.has("COMPLETE")){
    host.innerHTML=baseShell(presentation,statusStage({title:"Este pedido está siendo atendido",text:"La recepción permanece bloqueada para evitar que dos usuarios modifiquen las líneas o las asignaciones al mismo tiempo.",assignee:presentation.assigneeLabel}),{stage:"STATUS"});
    bindShell(host,"STATUS");
    return;
  }

  renderWorkbench(host,data,loadDraft(data),{reload,refreshLists});
}

export function renderWorkbench(host,data,draft,callbacks){
  const content=draft.stage==="PDF"?pdfStage(data,draft):draft.stage==="EDIT"?editStage(data,draft):draft.stage==="ASSIGN"?assignmentStageLoading(data,draft):reviewStage(data,draft);
  const presentation=viewData(data);
  host.innerHTML=baseShell(presentation,`${progressBar(draft.stage)}<div class="reception-workspace" data-reception-workspace>${content}</div>`,{showDetails:true,stage:draft.stage});
  bindShell(host,draft.stage);
  bindStage(host,data,draft,callbacks);
}
