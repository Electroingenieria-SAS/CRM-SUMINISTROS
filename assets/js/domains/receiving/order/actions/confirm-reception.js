import { api } from "../../../../services/api.js";
import { toast } from "../../../../core/ui.js";
import { openSubdialog } from "./purchase-arrival.js";
import { clearDraft } from "../draft/reception-draft.js";
import { summaryChip } from "../ui/order-context.js";

export function confirmReception(host,data,draft,{reload,refreshLists}={}){
  openSubdialog(host,{
    title:"Confirmar recepción y asignación",
    confirmLabel:"Sí, confirmar y enviar",
    body:`<div class="reception-confirm-dialog"><strong>Esta acción cerrará Recepción de pedidos.</strong><p>Se guardarán las líneas definitivas. Alistamiento quedará activo inmediatamente y, si existen cortes, únicamente esas líneas se enviarán a Corte en paralelo.</p><div>${summaryChip("Líneas",draft.lines.length)}${summaryChip("Con corte",draft.lines.filter(line=>line.requiresCut).length)}</div></div>`,
    onConfirm:async button=>{
      button.disabled=true;
      try{
        await api.confirmOrderReception(data.order.id,{
          sourceMode:draft.mode,
          sourceFileId:draft.sourceFileId||null,
          sourceFileName:draft.sourceFileName||null,
          readerVersion:draft.readerVersion||null,
          pickingProfileId:draft.pickingProfileId,
          cutProfileId:draft.lines.some(line=>line.requiresCut)?draft.cutProfileId:null,
          lines:draft.lines.map((line,index)=>({
            orderItemId:line.orderItemId||null,
            lineNumber:index+1,
            sku:line.sku||null,
            reference:line.reference||null,
            description:line.description,
            quantity:Number(line.quantity),
            unit:line.unit||"UND",
            warehouseLocation:line.warehouseLocation||null,
            requiresCut:Boolean(line.requiresCut),
            requestedCutLength:line.requiresCut?Number(line.requestedCutLength||line.quantity):null,
            metadata:{readerConfidence:line.readerConfidence||null,sourceLine:line.sourceLine||null,materialMasterId:line.materialMasterId||null,materialVariantId:line.materialVariantId||null,variantLabel:line.variantLabel||null,source:"RECEPTION_SIESA_MASTER"}
          }))
        });
        clearDraft(data.order.id);
        host.replaceChildren();
        refreshLists?.();
        toast(draft.lines.some(line=>line.requiresCut)?"Recepción confirmada. Alistamiento quedó activo y los cortes fueron enviados a Corte en paralelo.":"Recepción confirmada. El pedido fue asignado a Alistamiento.","success",7000);
      }catch(error){toast(error.message,"error",7500);button.disabled=false}
    }
  });
}
