

export function fromOrderItem(item,index){
  return {orderItemId:item.id,materialMasterId:item.material_master_id||item.metadata?.materialMasterId||null,materialVariantId:item.material_variant_id||item.metadata?.materialVariantId||null,variantLabel:item.metadata?.variantLabel||null,sku:item.sku||null,reference:item.reference||null,description:item.description||"",quantity:Number(item.quantity||0),unit:item.unit||"UND",warehouseLocation:item.warehouse_location||null,requiresCut:Boolean(item.requires_cut),requestedCutLength:item.requested_cut_length==null?null:Number(item.requested_cut_length),sourceLine:index+1};
}

export function mergeReaderLine(line,current,index){
  const normalized=String(line.reference||line.sku||"").trim().toUpperCase();
  const match=current.find(item=>[item.reference,item.sku].some(value=>String(value||"").trim().toUpperCase()===normalized))||current[index];
  return {...line,orderItemId:match?.id||null,materialMasterId:match?.material_master_id||match?.metadata?.materialMasterId||null,materialVariantId:match?.material_variant_id||match?.metadata?.materialVariantId||null,variantLabel:match?.metadata?.variantLabel||line.variantLabel||line.color||null,warehouseLocation:match?.warehouse_location||"",requestedCutLength:line.requiresCut?(line.requestedCutLength||line.quantity):null};
}

export function blankLine(){return {orderItemId:null,materialMasterId:null,materialVariantId:null,variantLabel:null,sku:null,reference:null,description:"",quantity:1,unit:"UND",warehouseLocation:"",requiresCut:false,requestedCutLength:null,materialResolution:"NOT_FOUND"}}
