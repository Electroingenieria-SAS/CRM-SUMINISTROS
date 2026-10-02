import { api } from "../../../services/api.js";
import { actionCodes, latestValidation } from "../shared/financial-status.js";
import { completeChecklist } from "./apply-financial-status.js";

export async function releaseToReception(data){
  let latest=await api.getOrder(data.order.id);
  const step=latest.order.current_step_code;
  const validation=latestValidation(latest,step);
  if(validation?.decision!=="APPROVED")throw new Error("Primero debes cerrar la gestión.");
  if(actionCodes(latest).has("RESUME")){
    await api.executeAction(latest.order.id,"RESUME",{detail:"Gestión retomada para liberar"},latest.order.version);
    latest=await api.getOrder(latest.order.id);
  }
  await completeChecklist(latest,"Confirmado al liberar el pedido");
  latest=await api.getOrder(latest.order.id);
  if(!actionCodes(latest).has("COMPLETE"))throw new Error("El pedido no está listo para liberarse.");
  await api.executeAction(latest.order.id,"COMPLETE",{detail:"Gestión cerrada y pedido liberado a Recepción"},latest.order.version);
}
