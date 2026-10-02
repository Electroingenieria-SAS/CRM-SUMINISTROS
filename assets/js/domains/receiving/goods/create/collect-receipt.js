import { readMaterialPicker } from "../../../../services/materials.js";
import { n } from "../shared/goods-values.js";

export function collectGoodsReceipt(dialog,pveDetail,requestId){
  const defaultLocation=dialog.querySelector('[name="defaultLocation"]').value.trim()||"RECEPCION";
  const rows=[...dialog.querySelectorAll("[data-v115-line]")];
  const lines=[];
  rows.forEach((row,index)=>{
    const received=n(row.querySelector('[data-field="received"]').value),accepted=n(row.querySelector('[data-field="accepted"]').value),rejected=n(row.querySelector('[data-field="rejected"]').value);
    if(received<=0)return;
    if(Math.abs(accepted+rejected-received)>0.0001)throw new Error(`Línea ${index+1}: aceptado + rechazado debe ser igual a recibido.`);
    let material;
    try{material=readMaterialPicker(row.querySelector("[data-material-picker]"),true)}catch(error){throw new Error(`Línea ${index+1}: ${error.message}`)}
    lines.push({orderItemId:row.dataset.orderItemId||null,materialMasterId:material.materialMasterId,materialVariantId:material.materialVariantId,receivedQuantity:received,acceptedQuantity:accepted,rejectedQuantity:rejected,location:row.querySelector('[data-field="location"]').value.trim()||defaultLocation,lotNumber:row.querySelector('[data-field="lot"]').value.trim()||null,qualityStatus:rejected>0?"REJECTED":"ACCEPTED"});
  });
  if(!lines.length)throw new Error("Registra al menos un material con cantidad recibida mayor que cero.");
  const noveltyType=dialog.querySelector('[name="noveltyType"]').value||null,noveltyNote=dialog.querySelector('[name="noveltyNote"]').value.trim()||null;
  if(noveltyType&&!noveltyNote)throw new Error("Describe la novedad registrada.");
  return {requestId,linkedPveId:pveDetail?.order?.id||null,linkedPurchaseOrderId:pveDetail?.purchaseOrder?.id||null,receiptType:dialog.querySelector('[name="receiptType"]').value,documentPrefix:dialog.querySelector('[name="documentPrefix"]').value.trim().toUpperCase(),status:dialog.querySelector('[name="receiptStatus"]:checked')?.value||"CONFORMING",purchaseOrderNumber:dialog.querySelector('[name="purchaseOrderNumber"]').value.trim()||null,supplierName:dialog.querySelector('[name="supplierName"]').value.trim()||null,supplierDocument:dialog.querySelector('[name="supplierDocument"]').value.trim()||null,invoiceNumber:dialog.querySelector('[name="invoiceNumber"]').value.trim()||null,warehouseCode:dialog.querySelector('[name="warehouseCode"]').value.trim()||null,defaultLocation,noveltyType,noveltySeverity:dialog.querySelector('[name="noveltySeverity"]').value,noveltyNote,verified:dialog.querySelector('[name="verified"]').checked,informationCaptured:dialog.querySelector('[name="informationCaptured"]').value.trim()||null,verificationNote:dialog.querySelector('[name="verificationNote"]').value.trim()||null,generalNote:dialog.querySelector('[name="generalNote"]').value.trim()||null,lines,metadata:{uiVersion:"11.5.1",domain:"WAREHOUSE_RECEIVING"}};
}
