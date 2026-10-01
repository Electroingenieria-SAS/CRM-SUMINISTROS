

export function stockSnapshot(material,variantId=null){
  const variants=Array.isArray(material?.variants)?material.variants:[];
  const variant=variantId?variants.find(v=>v.id===variantId):null;
  return {
    physical:Number(variant?.physicalAvailable??material?.physicalAvailable??0),
    reserved:Number(variant?.erpReserved??material?.erpReserved??0),
    available:Number(variant?.availableToPromise??material?.availableToPromise??material?.available??0)
  };
}

export function updateStockLabels(container){
  const material=container.__material;
  if(!material)return;
  const stock=stockSnapshot(material,container.dataset.materialVariantId||null);
  const unit=material.unit||"UND";
  const fmtStock=value=>Number(value||0).toLocaleString("es-CO",{maximumFractionDigits:3});
  const physical=container.querySelector("[data-material-physical-label]");
  const reserved=container.querySelector("[data-material-reserved-label]");
  const atp=container.querySelector("[data-material-stock-label]");
  if(physical)physical.textContent=`Físico: ${fmtStock(stock.physical)} ${unit}`;
  if(reserved)reserved.textContent=`Reservado ERP: ${fmtStock(stock.reserved)} ${unit}`;
  if(atp){atp.textContent=`Disponible venta: ${fmtStock(stock.available)} ${unit}`;atp.classList.toggle("is-empty",stock.available<=0)}
  container.dataset.materialPhysical=String(stock.physical);
  container.dataset.materialReserved=String(stock.reserved);
  container.dataset.materialAtp=String(stock.available);
}
