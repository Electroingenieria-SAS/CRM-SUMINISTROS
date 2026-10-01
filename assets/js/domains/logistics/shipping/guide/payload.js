import { localizedNumber } from "./reader.js";

function text(value){return String(value??"").trim()}
function resolved(value,fallback){return value===undefined?text(fallback):text(value)}

export function buildShippingGuidePayload({
  existingPayload={},
  trackingNumber,
  carrier,
  carrierInvoiceNumber,
  carrierCost,
  carrierCostCurrency,
  guideFileId
}={}){
  const output={
    ...existingPayload,
    trackingNumber:resolved(trackingNumber,existingPayload.trackingNumber),
    carrier:resolved(carrier,existingPayload.carrier),
    carrierInvoiceNumber:resolved(carrierInvoiceNumber,existingPayload.carrierInvoiceNumber),
    carrierCostCurrency:resolved(carrierCostCurrency,existingPayload.carrierCostCurrency||"COP").toUpperCase()||"COP"
  };
  const rawCost=carrierCost===undefined?existingPayload.carrierCost:carrierCost;
  const amount=typeof rawCost==="number"?rawCost:localizedNumber(rawCost);
  output.carrierCost=Number.isFinite(amount)?amount:null;
  if(guideFileId!==undefined)output.guideFileId=guideFileId;

  if(!output.trackingNumber)throw new Error("Registra el número de guía.");
  if(!output.carrier)throw new Error("Registra la transportadora.");
  if(!output.carrierInvoiceNumber)throw new Error("Registra la factura de la transportadora.");
  if(!(output.carrierCost>0))throw new Error("Registra un costo de flete mayor que 0.");
  if(output.carrierCostCurrency!=="COP")throw new Error("La moneda del flete debe ser COP.");
  return output;
}
