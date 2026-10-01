import { api } from "../../../services/api.js";
import { toast } from "../../ui.js";

export function activeTask(data){return (data?.tasks||[]).find(t=>["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED"].includes(t.status))||null}

export function actionCodes(data){return new Set((data?.actions?.actions||[]).map(x=>x.code))}

export function refreshLists(){window.__erpQueueRefresh?.();window.__erpOrderListRefresh?.()}

export function reopenOrder(orderId){refreshLists();setTimeout(()=>window.dispatchEvent(new CustomEvent("erp:open-order",{detail:orderId})),90)}

export async function finalizeAfterDomain(orderId,message){
  let latest=await api.getOrder(orderId);
  const task=activeTask(latest);
  const required=(latest.checklist||[]).filter(item=>item.task_id===task?.id&&item.required&&!item.completed);
  for(const item of required)await api.updateChecklist(task.id,item.item_code,true,"Verificado desde flujo V11.2");
  latest=await api.getOrder(orderId);
  if(actionCodes(latest).has("COMPLETE"))await api.executeAction(orderId,"COMPLETE",{detail:message},latest.order.version);
  toast(message,"success",6500);reopenOrder(orderId);
}
