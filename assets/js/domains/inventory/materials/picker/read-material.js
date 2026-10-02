

export function readMaterialPicker(container,strict=true){
  const result={
    materialMasterId:container?.dataset.materialId||null,
    materialVariantId:container?.dataset.materialVariantId||null,
    variantLabel:container?.dataset.materialVariantLabel||null,
    reference:container?.dataset.materialReference||null,
    sku:container?.dataset.materialReference||null,
    description:container?.dataset.materialName||null,
    unit:container?.dataset.materialUnit||"UND",
    weight:Number(container?.dataset.materialWeight||0),
    physicalAvailable:Number(container?.dataset.materialPhysical||0),
    erpReserved:Number(container?.dataset.materialReserved||0),
    availableToPromise:Number(container?.dataset.materialAtp||0)
  };
  if(strict&&!result.materialMasterId)throw new Error("Selecciona el material desde el maestro oficial Siesa.");
  if(strict&&container?.dataset.variantRequired==="true"&&!result.materialVariantId)throw new Error(`Selecciona el color o variante de ${result.reference||"la referencia"}.`);
  return result;
}
