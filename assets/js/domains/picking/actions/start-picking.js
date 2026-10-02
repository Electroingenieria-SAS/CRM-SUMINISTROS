import { api } from "../../../services/api.js";
import { actionCodes } from "../shared/picking-status.js";

export async function beginPicking(data){
  let latest=await api.getOrder(data.order.id);
  let actions=actionCodes(latest);
  if(actions.has("CLAIM")){
    await api.executeAction(latest.order.id,"CLAIM",{detail:"Pedido tomado para Alistamiento"},latest.order.version);
    latest=await api.getOrder(latest.order.id);
    actions=actionCodes(latest);
  }
  if(actions.has("START"))await api.executeAction(latest.order.id,"START",{detail:"Verificación de mercancía iniciada"},latest.order.version);
  else if(actions.has("RESUME"))await api.executeAction(latest.order.id,"RESUME",{detail:"Verificación de mercancía retomada"},latest.order.version);
}
