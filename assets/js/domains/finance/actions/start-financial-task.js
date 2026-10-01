import { api } from "../../../services/api.js";
import { actionCodes } from "../shared/financial-status.js";

export async function begin(data){
  let latest=await api.getOrder(data.order.id);
  let actions=actionCodes(latest);
  if(actions.has("CLAIM")){
    await api.executeAction(latest.order.id,"CLAIM",{detail:"Pedido tomado por el área financiera"},latest.order.version);
    latest=await api.getOrder(latest.order.id);actions=actionCodes(latest);
  }
  if(actions.has("START"))await api.executeAction(latest.order.id,"START",{detail:"Gestión financiera iniciada"},latest.order.version);
  else if(actions.has("RESUME"))await api.executeAction(latest.order.id,"RESUME",{detail:"Gestión financiera retomada"},latest.order.version);
}
