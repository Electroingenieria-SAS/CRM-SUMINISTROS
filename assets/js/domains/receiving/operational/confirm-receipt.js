import { api } from "../../../services/api.js";
import { toast } from "../../../core/ui.js";
import { actionCodes, reopenOrder, finalizeAfterDomain } from "../../../core/layout/operational/order-refresh.js";

export async function confirmOperationalReceipt(receiptDialog,dialog){
        const get=name=>dialog.querySelector(`[name="${name}"]`);
        const status=dialog.querySelector('[name="status"]:checked')?.value||"CONFORMING";
        const receiptType=get("receiptType").value;
        const prefix=get("documentPrefix").value.trim().toUpperCase();
        const location=get("location").value.trim();
        const lotNumber=get("lotNumber").value.trim();
        const captured=[...dialog.querySelectorAll("[data-item]")].map(row=>{
          const item=receiptDialog.items.find(x=>x.id===row.dataset.item);
          const accepted=Number(row.querySelector('[name="accepted"]').value||0);
          const pending=Number(item._remaining||0);
          if(!Number.isFinite(accepted)||accepted<0||accepted>pending)throw new Error(`Cantidad aceptada inválida para ${item.sku||item.description}`);
          if(status==="CONFORMING"&&Math.abs(accepted-pending)>0.0001)throw new Error("Una recepción Conforme debe cubrir toda la cantidad pendiente. Usa Parcial o Con novedad.");
          const received=status==="NONCONFORMING"?pending:accepted;
          const rejected=status==="NONCONFORMING"?Math.max(0,pending-accepted):0;
          return {orderItemId:item.id,sku:item.sku||null,reference:item.reference||null,description:item.description,expectedQuantity:Number(item.quantity||0),receivedQuantity:received,acceptedQuantity:accepted,rejectedQuantity:rejected,unit:item.unit||"UND",location,lotNumber:lotNumber||null,qualityStatus:status==="NONCONFORMING"?"REJECTED":status==="PARTIAL"?"CONDITIONAL":"ACCEPTED",metadata:{lotNumber:lotNumber||null,materialMasterId:item.material_master_id||item.metadata?.materialMasterId||null,materialVariantId:item.material_variant_id||item.metadata?.materialVariantId||null}};
        });
        const lines=status==="PARTIAL"?captured.filter(line=>line.receivedQuantity>0):captured;
        if(!lines.length)throw new Error("Debes registrar al menos una cantidad recibida mayor que cero.");
        const noveltyType=get("noveltyType").value||null;
        const noveltyNote=get("noveltyNote").value.trim()||null;
        if(noveltyType&&!noveltyNote)throw new Error("Describe la novedad registrada.");
        const payload={requestId:receiptDialog.requestId,purchaseOrder:get("purchaseOrder").value.trim()||null,supplierName:get("supplierName").value.trim()||null,status,lines,metadata:{receiptType,documentPrefix:prefix,noveltyType,noveltySeverity:get("noveltySeverity").value,noveltyNote,verified:get("verified").checked,verificationNote:get("verificationNote").value.trim()||null,informationCaptured:get("informationCaptured").value.trim()||null,generalNote:get("note").value.trim()||null,uiVersion:"11.2.0"}};
        const result=await api.saveReceipt(receiptDialog.data.order.id,payload);
        const receipt=result?.receipt;
        if(receipt?.receipt_number)toast(`Recepción ${receipt.receipt_number} guardada con código de barras y QR.`,"success",7000);
        if(status==="CONFORMING")return finalizeAfterDomain(receiptDialog.data.order.id,"Recepción confirmada y etapa finalizada");
        const latest=await api.getOrder(receiptDialog.data.order.id);
        const reason=get("note").value.trim()||noveltyNote||"Recepción pendiente de resolución";
        if(actionCodes(latest).has("WAIT"))await api.executeAction(receiptDialog.data.order.id,"WAIT",{reason},latest.order.version);
        toast("Recepción registrada. El pedido queda pendiente de resolución.","success",6500);reopenOrder(receiptDialog.data.order.id);
      }
