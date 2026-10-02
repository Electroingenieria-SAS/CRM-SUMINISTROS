import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { openOrder } from "./order-detail.js";
import { actionCodes, stageRequirement } from "./order-stage.js";
import { quickFinancial, quickPurchase, quickInvoice } from "./financial-actions.js";
import { quickChecklist } from "./checklist.js";
import { quickReceipt } from "./receipt-actions.js";
import { quickDelivery } from "./delivery-actions.js";
import { refreshLists } from "../shared/refresh-orders.js";

export async function runSimpleIntent(data,intent){
  if(intent==="PENDING")return;
  if(intent==="WORKING")return beginManagement(data);
  if(intent==="WAITING")return markWaiting(data,false);
  if(intent==="NOVELTY")return markWaiting(data,true);
  if(intent==="DONE")return finishStage(data);
  if(intent==="RESOLVE")return resolveRequirement(data,stageRequirement(data));
}

export async function beginManagement(data){
  try{
    let latest=data;
    let actions=actionCodes(latest);
    if(actions.has("CLAIM")){
      await api.executeAction(latest.order.id,"CLAIM",{detail:"Pedido tomado"},latest.order.version);
      latest=await api.getOrder(latest.order.id);actions=actionCodes(latest);
    }
    if(actions.has("START"))await api.executeAction(latest.order.id,"START",{detail:"Gestión iniciada"},latest.order.version);
    else if(actions.has("RESUME"))await api.executeAction(latest.order.id,"RESUME",{detail:"Gestión retomada"},latest.order.version);
    toast("El pedido quedó en gestión.","success");
    refreshLists();
    await openOrder(data.order.id);
  }catch(error){toast(error.message,"error",7000)}
}

export function markWaiting(data,novelty=false){
  modal({
    title:novelty?"Registrar novedad":"Dejar pedido en espera",
    confirmLabel:novelty?"Guardar novedad":"Dejar en espera",
    body:`<div class="simple-form-intro"><strong>${novelty?"¿Qué impide continuar?":"¿Qué información o respuesta falta?"}</strong><p>Escribe una frase clara. El pedido seguirá visible para retomarlo después.</p></div><div class="field"><label>Motivo *</label><textarea class="control" name="reason" required autofocus></textarea></div>`,
    onConfirm:async dialog=>{
      const reason=dialog.querySelector('[name="reason"]').value.trim();if(!reason)throw new Error("Escribe el motivo.");
      let latest=await api.getOrder(data.order.id);const actions=actionCodes(latest);
      if(novelty&&actions.has("COMMENT")){
        await api.executeAction(latest.order.id,"COMMENT",{body:reason,commentType:"NOVELTY",visibility:"INTERNAL"},latest.order.version);
        latest=await api.getOrder(data.order.id);
      }
      if(actionCodes(latest).has("WAIT"))await api.executeAction(latest.order.id,"WAIT",{reason},latest.order.version);
      toast(novelty?"Novedad registrada.":"Pedido en espera.","success");refreshLists();setTimeout(()=>openOrder(data.order.id),100);
    }
  });
}

export async function finishStage(data){
  const latest=await api.getOrder(data.order.id);
  const requirement=stageRequirement(latest);
  if(requirement)return resolveRequirement(latest,requirement);
  return confirmComplete(latest);
}

export function confirmComplete(data){
  modal({title:"Marcar etapa como gestionada",confirmLabel:"Sí, finalizar etapa",body:`<div class="wizard-confirm-box"><strong>${fmt.escape(fmt.step(data.order.current_step_code))} completada</strong><p>El pedido avanzará automáticamente a la siguiente etapa.</p></div><div class="field"><label>Observación opcional</label><textarea class="control" name="detail" placeholder="Solo si necesitas dejar una aclaración"></textarea></div>`,onConfirm:async dialog=>{const detail=dialog.querySelector('[name="detail"]').value.trim()||"Etapa gestionada";await api.executeAction(data.order.id,"COMPLETE",{detail},data.order.version);toast("Etapa finalizada y pedido enviado al siguiente proceso.","success",6000);refreshLists();}});
}

export function resolveRequirement(data,requirement){
  if(!requirement)return confirmComplete(data);
  if(requirement.code==="FINANCIAL")return quickFinancial(data);
  if(requirement.code==="PURCHASE")return quickPurchase(data);
  if(requirement.code==="RECEIPT")return quickReceipt(data);
  if(requirement.code==="INVOICE")return quickInvoice(data);
  if(requirement.code==="DELIVERY")return quickDelivery(data);
  if(requirement.code==="CHECKLIST")return quickChecklist(data);
  toast(requirement.detail,"error",7000);
}
