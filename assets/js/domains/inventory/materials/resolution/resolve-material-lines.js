import { api } from "../../../../services/api.js";

export function applyResolvedMaterial(line,resolution){
  if(!resolution||resolution.status==="NOT_FOUND")return {...line,materialResolution:"NOT_FOUND"};
  const material=resolution.material||{};
  return {...line,
    materialMasterId:material.id||null,materialVariantId:resolution.materialVariantId||null,
    variantLabel:resolution.variantLabel||null,variantOptions:resolution.variants||[],
    reference:material.reference||line.reference,sku:material.reference||line.sku,
    description:material.name||line.description,unit:material.unit||line.unit||"UND",weight:Number(material.weight||line.weight||0),
    materialResolution:resolution.status
  };
}

export async function resolveMaterialLines(lines){
  const resolutions=await api.materialResolve((lines||[]).map(line=>({
    materialMasterId:line.materialMasterId||line.material_master_id||null,
    materialVariantId:line.materialVariantId||line.material_variant_id||null,
    variantLabel:line.variantLabel||line.variant_label||line.color||null,
    reference:line.reference||null,sku:line.sku||null,description:line.description||null
  })));
  return (lines||[]).map((line,index)=>applyResolvedMaterial(line,(resolutions||[]).find(item=>Number(item.index)===index)));
}
