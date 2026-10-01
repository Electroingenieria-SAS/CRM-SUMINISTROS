import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { openOrder } from "./order-detail.js";
import { activeTask, actionCodes } from "./order-stage.js";
import { refreshLists } from "../shared/refresh-orders.js";

export function checklistConfirmation(data){
  const task=activeTask(data);const rows=(data.checklist||[]).filter(item=>item.task_id===task?.id&&item.required&&!item.completed);
  if(!rows.length)return "";
  return `<div class="simple-check-confirm"><strong>Controles obligatorios</strong><ul>${rows.map(item=>`<li>${fmt.escape(item.label)}</li>`).join("")}</ul><label><input type="checkbox" name="confirmChecklist" required> Confirmo que realicé estos controles.</label></div>`;
}

export async function completeChecklist(data,note="Verificado desde gestión rápida"){
  const task=activeTask(data);const rows=(data.checklist||[]).filter(item=>item.task_id===task?.id&&item.required&&!item.completed);
  for(const item of rows)await api.updateChecklist(task.id,item.item_code,true,note);
}

export async function finalizeAfterDomain(orderId,message){
  let latest=await api.getOrder(orderId);
  await completeChecklist(latest);
  latest=await api.getOrder(orderId);
  if(actionCodes(latest).has("COMPLETE"))await api.executeAction(orderId,"COMPLETE",{detail:message},latest.order.version);
  toast(message,"success",6000);refreshLists();setTimeout(()=>openOrder(orderId),100);
}

export function quickChecklist(data){
  modal({title:"Confirmar controles",confirmLabel:"Confirmar y finalizar",body:`<div class="simple-form-intro"><strong>Una sola confirmación</strong><p>Revisa la lista y confirma únicamente cuando todos los controles estén realizados.</p></div>${checklistConfirmation(data)}<div class="field"><label>Observación opcional</label><textarea class="control" name="note"></textarea></div>`,onConfirm:async dialog=>{const note=dialog.querySelector('[name="note"]').value.trim()||"Controles verificados";await completeChecklist(data,note);const latest=await api.getOrder(data.order.id);if(actionCodes(latest).has("COMPLETE"))await api.executeAction(data.order.id,"COMPLETE",{detail:note},latest.order.version);toast("Controles confirmados y etapa finalizada.","success");refreshLists()}});
}
