import { api } from "../../../services/api.js";
import { modal, toast } from "../../../core/ui.js";
import { choice } from "../../../core/guided.js";
import { actionCodes } from "./order-stage.js";
import { checklistConfirmation, finalizeAfterDomain } from "./checklist.js";
import { dialogData } from "../shared/form-values.js";
import { refreshLists } from "../shared/refresh-orders.js";

export function quickDelivery(data){
  modal({title:"Registrar entrega",confirmLabel:"Guardar resultado",size:"wide",body:`<div class="simple-choice-row">${choice("status","DELIVERED","Entregado","El cliente recibió el pedido.",true)}${choice("status","NOT_DELIVERED","No entregado","Debe reprogramarse o revisarse.")}${choice("status","IN_TRANSIT","En tránsito","La transportadora aún tiene el pedido.")}</div><div class="form-grid"><div class="field"><label>Transportadora</label><input class="control" name="carrier"></div><div class="field"><label>Número de guía</label><input class="control" name="trackingNumber"></div><div class="field"><label>Recibido por</label><input class="control" name="receivedBy"></div><div class="field"><label>Nueva fecha, si aplica</label><input class="control" name="scheduledAt" type="datetime-local"></div><div class="field full"><label>Observación o motivo</label><textarea class="control" name="noDeliveryReason"></textarea></div></div>${checklistConfirmation(data)}`,onConfirm:async dialog=>{
    const f=dialogData(dialog);if(f.status==="DELIVERED"&&!f.receivedBy)throw new Error("Indica quién recibió el pedido.");if(f.status==="NOT_DELIVERED"&&!f.noDeliveryReason)throw new Error("Indica el motivo de la no entrega.");
    const payload={status:f.status};for(const key of ["carrier","trackingNumber","receivedBy","noDeliveryReason"])if(f[key])payload[key]=f[key];if(f.scheduledAt)payload.scheduledAt=new Date(f.scheduledAt).toISOString();if(f.status==="DELIVERED")payload.deliveredAt=new Date().toISOString();if(f.status==="IN_TRANSIT")payload.dispatchedAt=new Date().toISOString();
    await api.saveDelivery(data.order.id,payload);
    if(f.status==="DELIVERED")return finalizeAfterDomain(data.order.id,"Entrega confirmada y etapa finalizada");
    const latest=await api.getOrder(data.order.id);if(f.status==="NOT_DELIVERED"&&actionCodes(latest).has("NO_DELIVERY"))await api.executeAction(data.order.id,"NO_DELIVERY",{reason:f.noDeliveryReason},latest.order.version);else if(actionCodes(latest).has("WAIT"))await api.executeAction(data.order.id,"WAIT",{reason:f.noDeliveryReason||"Entrega en tránsito"},latest.order.version);toast("Estado de entrega actualizado.","success");refreshLists();
  }});
}
