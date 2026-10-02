import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { choice } from "../../../core/guided.js";
import { actionCodes } from "./order-stage.js";
import { checklistConfirmation, finalizeAfterDomain } from "./checklist.js";
import { dialogData } from "../shared/form-values.js";
import { refreshLists } from "../shared/refresh-orders.js";

export async function quickReceipt(data){
  const progress=await api.receiptProgress(data.order.id);
  const previous=new Map((progress?.items||[]).map(item=>[String(item.orderItemId),item]));
  const items=(data.items||[]).map(item=>{
    const p=previous.get(String(item.id));
    const remaining=Math.max(0,Number(p?.remainingQuantity??item.quantity??0));
    return {...item,_receivedBefore:Number(p?.acceptedQuantity||0),_remaining:remaining};
  }).filter(item=>item._remaining>0.0001);
  if(!items.length){
    toast("Las cantidades aceptadas ya cubren el pedido. Actualiza el pedido para continuar con el cierre de Recepción.","success",6500);
    return;
  }
  const requestId=crypto.randomUUID?.()||`receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const rows=items.map(item=>`<div class="simple-receipt-line" data-item="${item.id}"><div><strong>${fmt.escape(item.sku||item.description)}</strong><small>Pendiente: ${fmt.number(item._remaining,3)} de ${fmt.number(item.quantity,3)} ${fmt.escape(item.unit)}${item._receivedBefore?` · ya aceptado ${fmt.number(item._receivedBefore,3)}`:""}</small></div><label>Aceptado<input class="control" name="accepted" type="number" min="0" max="${Number(item._remaining)}" step="any" value="${Number(item._remaining)}"></label></div>`).join("");
  modal({title:"Confirmar recepción de mercancía",confirmLabel:"Guardar recepción",size:"wide",body:`<div class="simple-choice-row">${choice("status","CONFORMING","Conforme","Con esta llegada se completan todas las cantidades pendientes.",true)}${choice("status","PARTIAL","Parcial","Todavía quedarán cantidades pendientes por recibir.")}${choice("status","NONCONFORMING","Con novedad","Hay cantidad rechazada o una diferencia que debe resolverse.")}</div><div class="form-grid"><div class="field"><label>Orden de compra</label><input class="control" name="purchaseOrder"></div><div class="field"><label>Proveedor</label><input class="control" name="supplierName"></div><div class="field"><label>Ubicación *</label><input class="control" name="location" value="RECEPCION" required></div><div class="field"><label>Lote común</label><input class="control" name="lotNumber"></div></div><div class="simple-receipt-list">${rows}</div><div class="field"><label>Observación</label><textarea class="control" name="note"></textarea></div>${checklistConfirmation(data)}`,onConfirm:async dialog=>{
    const f=dialogData(dialog);
    const captured=[...dialog.querySelectorAll("[data-item]")].map(row=>{
      const item=items.find(x=>x.id===row.dataset.item);
      const accepted=Number(row.querySelector('[name="accepted"]').value||0);
      const pending=Number(item._remaining||0);
      if(!Number.isFinite(accepted)||accepted<0||accepted>pending)throw new Error(`Cantidad aceptada inválida para ${item.sku||item.description}`);
      if(f.status==="CONFORMING"&&Math.abs(accepted-pending)>0.0001)throw new Error("Una recepción Conforme debe cubrir toda la cantidad pendiente. Usa Parcial o Con novedad si aún faltará mercancía.");
      const received=f.status==="NONCONFORMING"?pending:accepted;
      const rejected=f.status==="NONCONFORMING"?Math.max(0,pending-accepted):0;
      return {orderItemId:item.id,sku:item.sku||null,reference:item.reference||null,description:item.description,expectedQuantity:Number(item.quantity||0),receivedQuantity:received,acceptedQuantity:accepted,rejectedQuantity:rejected,unit:item.unit||"UND",location:f.location,lotNumber:f.lotNumber||null,qualityStatus:f.status==="NONCONFORMING"?"REJECTED":f.status==="PARTIAL"?"CONDITIONAL":"ACCEPTED",metadata:{lotNumber:f.lotNumber||null,materialMasterId:item.material_master_id||item.metadata?.materialMasterId||null,materialVariantId:item.material_variant_id||item.metadata?.materialVariantId||null}};
    });
    const lines=f.status==="PARTIAL"?captured.filter(line=>line.receivedQuantity>0):captured;
    if(!lines.length)throw new Error("Debes registrar al menos una cantidad recibida mayor que cero.");
    await api.saveReceipt(data.order.id,{requestId,purchaseOrder:f.purchaseOrder||null,supplierName:f.supplierName||null,status:f.status,lines});
    if(f.status==="CONFORMING")return finalizeAfterDomain(data.order.id,"Recepción confirmada y etapa finalizada");
    const latest=await api.getOrder(data.order.id);const reason=f.note||"Recepción pendiente de resolución";if(actionCodes(latest).has("WAIT"))await api.executeAction(data.order.id,"WAIT",{reason},latest.order.version);toast("Recepción registrada. El pedido queda pendiente de resolución.","success");refreshLists();
  }});
}
