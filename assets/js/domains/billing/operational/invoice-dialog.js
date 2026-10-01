import { api } from "../../../services/api.js";
import { uploadOrderFile } from "../../../services/drive.js";
import { modal } from "../../../core/ui.js";
import { fmt } from "../../../core/format.js";
import { activeTask, finalizeAfterDomain } from "../../../core/layout/operational/order-refresh.js";
import { escapeText } from "../../../core/layout/operational/operational-values.js";

export function openInvoiceDialog(data){
  const task=activeTask(data);
  const quantity=(data.items||[]).reduce((sum,item)=>sum+Number(item.quantity||0),0);
  const view=modal({
    title:"Registrar factura",
    confirmLabel:"Guardar factura y continuar",
    size:"wide",
    body:`
      <section class="v112-dialog-intro"><span>Facturación integrada</span><strong>${escapeText(data.order.order_number)}</strong><p>El peso y la relación cantidad/peso quedan en la misma factura. El soporte se carga al expediente institucional antes de guardar.</p></section>
      <div class="form-grid">
        <div class="field"><label>Número de factura *</label><input class="control" name="invoiceNumber" required autofocus></div>
        <div class="field"><label>Fecha *</label><input class="control" name="invoiceDate" type="date" value="${new Date().toISOString().slice(0,10)}" required></div>
        <div class="field"><label>Valor</label><input class="control" name="amount" type="number" min="0" step="any"></div>
        <div class="field"><label>Cantidad asociada *</label><input class="control" name="packageQuantity" type="number" min="0.000001" step="any" value="${quantity||1}" required></div>
        <div class="field"><label>Peso total de factura (kg) *</label><input class="control" name="packageWeightKg" type="number" min="0.001" step="0.001" required></div>
        <div class="field"><label>Volumen total (m³)</label><input class="control" name="packageVolumeM3" type="number" min="0" step="0.0001" placeholder="Opcional"><small class="field-help">Ayuda al CRM a aprender cuándo el flete depende del volumen.</small></div>
        <div class="field v112-ratio-field"><label>Relación peso / cantidad</label><output data-v112-weight-ratio>— kg/unidad</output></div>
        <div class="field full"><label>Factura / soporte institucional *</label><input class="control" name="invoiceFile" type="file" accept="image/*,.pdf,application/pdf" required><small class="field-help">Se guarda en Google Drive dentro del expediente del pedido.</small></div>
      </div>`,
    onConfirm:async dialog=>{
      if(!task?.id)throw new Error("No se encontró la tarea activa de Facturación.");
      const invoiceNumber=dialog.querySelector('[name="invoiceNumber"]').value.trim();
      const invoiceDate=dialog.querySelector('[name="invoiceDate"]').value;
      const amount=dialog.querySelector('[name="amount"]').value;
      const packageQuantity=Number(dialog.querySelector('[name="packageQuantity"]').value);
      const packageWeightKg=Number(dialog.querySelector('[name="packageWeightKg"]').value);
      const packageVolumeM3=Number(dialog.querySelector('[name="packageVolumeM3"]')?.value||0);
      const file=dialog.querySelector('[name="invoiceFile"]').files?.[0];
      if(!file)throw new Error("Adjunta la factura o soporte institucional.");
      if(!(packageQuantity>0)||!(packageWeightKg>0))throw new Error("Cantidad y peso deben ser mayores que cero.");
      const uploaded=await uploadOrderFile(data.order.id,file,"INVOICE",task.id,data.order.order_number);
      const recordId=uploaded?.file?.id;
      if(!recordId)throw new Error("El expediente no devolvió el registro del archivo de factura.");
      const payload={invoiceNumber,invoiceDate,currency:"COP",driveFileRecordId:recordId,metadata:{packageQuantity,packageWeightKg,packageVolumeM3:packageVolumeM3>0?packageVolumeM3:null,weightPerUnitKg:packageWeightKg/packageQuantity,uiVersion:"11.39.0"}};
      if(amount)payload.amount=amount;
      await api.saveInvoice(data.order.id,payload);
      await finalizeAfterDomain(data.order.id,"Factura registrada con peso y soporte; pedido liberado");
    }
  });
  const updateRatio=()=>{
    const q=Number(view.root.querySelector('[name="packageQuantity"]')?.value||0);
    const w=Number(view.root.querySelector('[name="packageWeightKg"]')?.value||0);
    const out=view.root.querySelector("[data-v112-weight-ratio]");
    if(out)out.textContent=q>0&&w>0?`${fmt.number(w/q,4)} kg/unidad`:"— kg/unidad";
  };
  view.root.querySelector('[name="packageQuantity"]')?.addEventListener("input",updateRatio);
  view.root.querySelector('[name="packageWeightKg"]')?.addEventListener("input",updateRatio);
}
