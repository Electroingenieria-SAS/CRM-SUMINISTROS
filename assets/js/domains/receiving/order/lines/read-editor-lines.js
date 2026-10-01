import { readMaterialPicker } from "../../../../services/materials.js";

export function collectEditorLines(editor,strict){
  const rows=[...editor.querySelectorAll("[data-line-row]")];
  if(strict&&!rows.length)throw new Error("Agrega al menos una línea al pedido.");
  return rows.map((row,index)=>{
    let material;
    try{material=readMaterialPicker(row.querySelector("[data-material-picker]"),strict)}catch(error){throw new Error(`Línea ${index+1}: ${error.message}`)}
    const value=name=>row.querySelector(`[data-field="${name}"]`)?.value?.trim()||"";
    const quantity=Number(value("quantity"));
    const requiresCut=row.querySelector('[data-field="requiresCut"]').checked;
    const requestedCutLength=Number(value("requestedCutLength"));
    if(strict&&(!Number.isFinite(quantity)||quantity<=0))throw new Error(`La línea ${index+1} necesita una cantidad válida.`);
    if(strict&&requiresCut&&(!Number.isFinite(requestedCutLength)||requestedCutLength<=0))throw new Error(`Registra la longitud de corte de la línea ${index+1}.`);
    return {orderItemId:row.dataset.orderItemId||null,materialMasterId:material.materialMasterId,materialVariantId:material.materialVariantId,variantLabel:material.variantLabel,sku:material.sku,reference:material.reference,description:material.description,quantity:Number.isFinite(quantity)?quantity:0,unit:material.unit||"UND",warehouseLocation:value("warehouseLocation")||null,requiresCut,requestedCutLength:requiresCut&&Number.isFinite(requestedCutLength)?requestedCutLength:null};
  });
}
