import { api } from "../../../../services/api.js";
import { state } from "../../../../core/state.js";
import { fmt } from "../../../../core/format.js";

export function activeTask(data){return (data.tasks||[]).find(task=>["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED"].includes(task.status))||null}

export function actionCodes(data){return new Set((data.actions?.actions||[]).map(action=>action.code))}

export function assigneeName(data){const task=activeTask(data);const profileId=state.profile?.id;if(profileId&&task?.assigned_profile_id===profileId)return state.profile?.name||"Tu usuario";return task?.assigned_name||fmt.role(task?.assigned_role_code||data.order.current_role_code)||"Sin asignar"}

export async function beginReception(data){
  let latest=data;
  let actions=actionCodes(latest);
  if(actions.has("CLAIM")){
    await api.executeAction(latest.order.id,"CLAIM",{detail:"Pedido tomado en Recepción"},latest.order.version);
    latest=await api.getOrder(latest.order.id);
    actions=actionCodes(latest);
  }
  if(actions.has("START"))await api.executeAction(latest.order.id,"START",{detail:"Recepción de pedido iniciada"},latest.order.version);
  else if(actions.has("RESUME"))await api.executeAction(latest.order.id,"RESUME",{detail:"Recepción de pedido retomada"},latest.order.version);
}
