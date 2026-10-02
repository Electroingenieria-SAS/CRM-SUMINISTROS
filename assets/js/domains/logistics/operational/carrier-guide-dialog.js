import { api } from "../../../services/api.js";
import { uploadOrderFile } from "../../../services/drive.js";
import { modal, toast } from "../../../core/ui.js";
import { fmt } from "../../../core/format.js";
import { activeTask, reopenOrder } from "../../../core/layout/operational/order-refresh.js";
import { escapeText, money } from "../../../core/layout/operational/operational-values.js";

export async function openCarrierGuideDialog(orderId){
  try{
    const data=await api.getOrder(orderId);
    const task=activeTask(data);
    const delivery=[...(data.deliveries||[])].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))[0]||null;
    const view=modal({
      title:"Agregar guía y costo de transportadora",
      confirmLabel:"Guardar guía",
      size:"wide",
      body:`
        <section class="v112-dialog-intro"><span>Despachos y entregas</span><strong>${escapeText(data.order.order_number)}</strong><p>Guía, factura y costo de transportadora quedan dentro del mismo despacho.</p></section>
        <div class="form-grid">
          <div class="field"><label>Número de guía *</label><input class="control" name="trackingNumber" value="${escapeText(delivery?.tracking_number||"")}" required autofocus></div>
          <div class="field"><label>Transportadora *</label><input class="control" name="carrier" value="${escapeText(delivery?.carrier||"")}" required></div>
          <div class="field"><label>Número factura transportadora</label><input class="control" name="carrierInvoiceNumber" value="${escapeText(delivery?.carrier_invoice_number||"")}"></div>
          <div class="field"><label>Costo transportadora</label><input class="control" name="carrierCost" type="number" min="0" step="0.01" value="${delivery?.carrier_cost??""}"></div>
          <div class="field"><label>Moneda</label><select class="control" name="carrierCostCurrency"><option value="COP" selected>COP</option><option value="USD">USD</option></select></div>
          <div class="field full"><label>Soporte de guía, opcional</label><input class="control" name="guideFile" type="file" accept="image/*,.pdf,application/pdf"></div>
        </div>
        <div class="v1141-carrier-guard" data-v1141-carrier-guard><strong>Control predictivo</strong><span>Escribe la transportadora y el costo para comparar contra la predicción guardada al crear el pedido.</span></div>
        <div class="v112-cost-note"><strong>Control de consecutivos</strong><span>El número de factura y el costo alimentarán el Dashboard de Transportadoras, la auditoría predicho vs real y PACO.</span></div>`,
      onConfirm:async dialog=>{
        const trackingNumber=dialog.querySelector('[name="trackingNumber"]').value.trim();
        const carrier=dialog.querySelector('[name="carrier"]').value.trim();
        const carrierInvoiceNumber=dialog.querySelector('[name="carrierInvoiceNumber"]').value.trim()||null;
        const costRaw=dialog.querySelector('[name="carrierCost"]').value;
        const carrierCost=costRaw===""?null:Number(costRaw);
        const currency=dialog.querySelector('[name="carrierCostCurrency"]').value;
        const file=dialog.querySelector('[name="guideFile"]').files?.[0];
        if(carrierCost!==null&&carrierCost<0)throw new Error("El costo de transportadora no puede ser negativo.");
        if(carrierCost!==null&&!carrierInvoiceNumber)throw new Error("Indica el número de factura de la transportadora para registrar un costo.");
        let guideFileId=null;
        if(file){
          const uploaded=await uploadOrderFile(orderId,file,"SHIPPING_GUIDE",task?.id,data.order.order_number);
          guideFileId=uploaded?.file?.id||null;
        }
        await api.saveShippingGuide(orderId,{trackingNumber,carrier,carrierInvoiceNumber,carrierCost,carrierCostCurrency:currency,guideFileId});
        const prediction=carrierPredictionV1141(data.order,carrier);
        const outside=carrierCost!=null&&prediction?.estimateHigh!=null&&carrierCost>Number(prediction.estimateHigh);
        toast(outside?"Guía guardada. El costo quedó por encima del rango predicho y será auditado por PACO.":"Guía y datos de transportadora guardados en el despacho.",outside?"warning":"success",7500);reopenOrder(orderId);
      }
    });
    if(delivery?.carrier_cost_currency)view.root.querySelector('[name="carrierCostCurrency"]').value=delivery.carrier_cost_currency;
    const syncGuard=()=>{
      const carrier=view.root.querySelector('[name="carrier"]')?.value||"";
      const raw=view.root.querySelector('[name="carrierCost"]')?.value;
      const cost=raw===""?null:Number(raw);
      const guard=view.root.querySelector("[data-v1141-carrier-guard]");
      const prediction=carrierPredictionV1141(data.order,carrier);
      if(!guard)return;
      if(!prediction){
        guard.className="v1141-carrier-guard";
        guard.innerHTML="<strong>Control predictivo</strong><span>No hay una predicción guardada para esta transportadora en este pedido.</span>";
        return;
      }
      const low=Number(prediction.estimateLow||0),mid=Number(prediction.estimateMid||0),high=Number(prediction.estimateHigh||0);
      const deviation=cost!=null&&mid>0?100*(cost-mid)/mid:null;
      const outside=cost!=null&&high>0&&cost>high;
      guard.className=`v1141-carrier-guard ${outside?"is-warning":cost!=null?"is-good":""}`;
      guard.innerHTML=`<strong>${escapeText(String(prediction.carrier||carrier))} · esperado ${money(low)} – ${money(high)}</strong><span>${cost==null?`Valor central ${money(mid)}.`:outside?`El costo ingresado está ${fmt.number(deviation,1)}% frente al valor central y supera el rango esperado.`:`El costo ingresado está dentro del control predictivo (${fmt.number(deviation||0,1)}% frente al valor central).`}</span>`;
    };
    view.root.querySelector('[name="carrier"]')?.addEventListener("input",syncGuard);
    view.root.querySelector('[name="carrierCost"]')?.addEventListener("input",syncGuard);
    syncGuard();
  }catch(error){toast(error.message||String(error),"error",7500)}
}

export function carrierPredictionV1141(order,carrier){
  const prediction=order?.metadata?.freightPredictionAtCreation;
  const rows=Array.isArray(prediction?.carriers)?prediction.carriers:[];
  const normalize=value=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toUpperCase();
  return rows.find(row=>normalize(row.carrier)===normalize(carrier))||null;
}
