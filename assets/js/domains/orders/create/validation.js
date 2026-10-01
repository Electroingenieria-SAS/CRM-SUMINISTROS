import { readMaterialPicker } from "../../../services/materials.js";

export function validateSalesMaterialCard(card,index){
  let material;try{material=readMaterialPicker(card.querySelector("[data-material-picker]"),true)}catch(error){throw new Error(`Material ${index+1}: ${error.message}`)}
  const mode=card.dataset.mode||"DIRECT";
  if(mode==="CUTS"){
    if(String(material.unit).toUpperCase()!=="M")throw new Error(`Material ${index+1}: solo los materiales en metros pueden usar plan de cortes.`);
    const rows=[...card.querySelectorAll(".sales-cut-row")];if(!rows.length)throw new Error(`Material ${index+1}: agrega al menos una medida de corte.`);
    rows.forEach((row,cutIndex)=>{const pieces=Number(row.querySelector("[data-cut-pieces]").value),length=Number(row.querySelector("[data-cut-length]").value);if(!Number.isInteger(pieces)||pieces<=0)throw new Error(`Material ${index+1}, corte ${cutIndex+1}: indica cuántas piezas necesitas.`);if(!Number.isFinite(length)||length<=0)throw new Error(`Material ${index+1}, corte ${cutIndex+1}: indica una longitud válida.`);});
  }else{
    const quantity=Number(card.querySelector("[data-sales-quantity]").value);if(!Number.isFinite(quantity)||quantity<=0)throw new Error(`Material ${index+1}: registra una cantidad válida.`);
  }
  return material;
}

export function collectSalesItems(root){
  const output=[];let line=0;
  [...root.querySelectorAll("[data-sales-material]")].forEach((card,index)=>{
    const material=validateSalesMaterialCard(card,index);const mode=card.dataset.mode||"DIRECT";const groupId=crypto.randomUUID();
    const baseMeta={materialMasterId:material.materialMasterId,materialVariantId:material.materialVariantId,variantLabel:material.variantLabel,source:"SALES_SIESA_MASTER_V10_15",salesMaterialGroupId:groupId};
    if(mode==="CUTS"){
      [...card.querySelectorAll(".sales-cut-row")].forEach((row,cutIndex)=>{line+=1;const pieces=Number(row.querySelector("[data-cut-pieces]").value),length=Number(row.querySelector("[data-cut-length]").value);output.push({lineNumber:line,sku:material.reference,reference:material.reference,description:material.description,quantity:pieces,unit:material.unit,warehouseLocation:null,requiresCut:true,requestedCutLength:length,metadata:{...baseMeta,salesDemandMode:"CUTS",salesCutIndex:cutIndex+1,totalRequested:pieces*length}});});
    }else{
      line+=1;const quantity=Number(card.querySelector("[data-sales-quantity]").value);output.push({lineNumber:line,sku:material.reference,reference:material.reference,description:material.description,quantity,unit:material.unit,warehouseLocation:null,requiresCut:false,requestedCutLength:null,metadata:{...baseMeta,salesDemandMode:"DIRECT",totalRequested:quantity}});
    }
  });
  return output;
}

export function validateDeliveryAddress({root}){
            const department=root.querySelector('[name="clientDepartment"]')?.value.trim();
            const city=root.querySelector('[name="clientCity"]')?.value.trim();
            const address=root.querySelector('[name="clientAddress"]')?.value.trim();
            if(!department)throw new Error("Selecciona el departamento de entrega.");
            if(!city)throw new Error("Selecciona el municipio o ciudad de entrega.");
            if(!address||address.length<5)throw new Error("Escribe una dirección de entrega completa.");
            return true;
          }

export function validateOrderMaterials({root}){
          const cards=[...root.querySelectorAll("[data-sales-material]")];
          if(!cards.length)throw new Error("Agrega al menos un material.");
          cards.forEach((card,index)=>validateSalesMaterialCard(card,index));
          return true;
        }
