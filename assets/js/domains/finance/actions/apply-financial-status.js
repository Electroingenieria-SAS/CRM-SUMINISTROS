import { api } from "../../../services/api.js";
import { activeTask, actionCodes } from "../shared/financial-status.js";

export async function applyState(data,state,notes,payment=null){
  let latest=await api.getOrder(data.order.id);
  let actions=actionCodes(latest);
  if(state==="IN_PROGRESS"){
    if(actions.has("RESUME"))await api.executeAction(latest.order.id,"RESUME",{detail:notes||"Gestión retomada"},latest.order.version);
    else if(actions.has("COMMENT")&&notes)await api.executeAction(latest.order.id,"COMMENT",{body:notes,commentType:"STATUS",visibility:"INTERNAL"},latest.order.version);
    return;
  }
  if(state==="CLOSED"){
    if(actions.has("RESUME")){
      await api.executeAction(latest.order.id,"RESUME",{detail:"Gestión retomada para cierre"},latest.order.version);
      latest=await api.getOrder(latest.order.id);
    }
    const step=String(latest.order.current_step_code||"").toUpperCase();
    const payload={validationType:step,decision:"APPROVED",notes:notes||"Gestión cerrada y lista para liberar",metadata:{operationalStatus:"CLOSED"}};
    if(step==="CAJA"){
      if(!(Number(payment?.amount)>0)||!String(payment?.reference||"").trim())throw new Error("Caja requiere valor pagado y referencia para cerrar.");
      payload.amount=Number(payment.amount);
      payload.reference=String(payment.reference).trim();
      payload.metadata={...payload.metadata,paymentConfirmed:true,paymentMeasurementVersion:"11.39.1"};
    }
    await api.saveFinancialValidation(latest.order.id,payload);
    return;
  }
  if(state==="NOVELTY"&&actions.has("COMMENT")){
    await api.executeAction(latest.order.id,"COMMENT",{body:notes,commentType:"NOVELTY",visibility:"INTERNAL"},latest.order.version);
    latest=await api.getOrder(latest.order.id);actions=actionCodes(latest);
  }
  if(actions.has("WAIT"))await api.executeAction(latest.order.id,"WAIT",{reason:notes},latest.order.version);
}

export async function completeChecklist(data,note){
  const task=activeTask(data);
  const pending=(data.checklist||[]).filter(item=>item.task_id===task?.id&&item.required&&!item.completed);
  for(const item of pending)await api.updateChecklist(task.id,item.item_code,true,note);
}
