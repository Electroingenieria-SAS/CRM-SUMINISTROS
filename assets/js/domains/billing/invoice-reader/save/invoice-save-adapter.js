import { api } from "../../../../services/api.js";
import { positiveNumber } from "../parse/localized-values.js";
import { value } from "../ui/manual-fields.js";

export function buildInvoiceReaderPayload(dialog,payload={}){
  const invoiceNumber=value(dialog,"invoiceNumberV1199")||String(payload.invoiceNumber||"").trim();
  const invoiceDate=value(dialog,"invoiceDateV1199")||String(payload.invoiceDate||"").trim();
  const invoiceName=value(dialog,"invoiceNameV1199");
  const amount=positiveNumber(value(dialog,"invoiceAmountV1199"));
  const packageQuantity=positiveNumber(value(dialog,"invoiceQuantityV1199"));
  const packageWeightKg=positiveNumber(value(dialog,"invoiceWeightV1199"));
  const productLineCount=positiveNumber(value(dialog,"invoiceLinesV1199"));
  const readerVersion=dialog?.dataset?.invoiceReaderVersion||"factura-manual-v11101";
  const autoRead=dialog?.dataset?.invoiceAutoRead==="1";
  const weightField=dialog?.querySelector?.('[name="invoiceWeightV1199"]');

  if(!invoiceNumber)throw new Error("Registra el número de factura.");
  if(!invoiceDate)throw new Error("Registra la fecha de factura.");
  if(!invoiceName)throw new Error("Registra el nombre o emisor de la factura.");
  if(!(amount>0))throw new Error("Registra un valor total de factura mayor que cero.");
  if(!(packageQuantity>0))throw new Error("Registra una cantidad total mayor que cero.");
  if(!(packageWeightKg>0))throw new Error("Registra un peso total mayor que cero.");

  return {
    ...payload,
    invoiceNumber,
    invoiceDate,
    amount,
    currency:"COP",
    metadata:{
      ...(payload.metadata||{}),
      invoiceName,
      packageQuantity,
      packageWeightKg,
      productLineCount,
      pdfReaderVersion:readerVersion,
      readerVersion,
      autoRead,
      pdfAutoRead:autoRead,
      pdfFieldsEditable:true,
      weightManuallyReviewed:weightField?.dataset?.manual==="1",
      invoiceDataReviewed:true
    }
  };
}

export async function saveInvoiceExplicit(orderId,payload,{save=api.saveInvoice}={}){
  return save(orderId,payload);
}
