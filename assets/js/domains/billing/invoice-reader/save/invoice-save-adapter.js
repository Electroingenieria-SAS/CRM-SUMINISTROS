import { api } from "../../../../services/api.js";
import { positiveNumber } from "../parse/localized-values.js";
import { value } from "../ui/manual-fields.js";

export const originalSaveInvoice=api.saveInvoice.bind(api);

export function patchInvoiceSave(){
  if(api.__invoiceReaderV1199Patched)return;
  api.__invoiceReaderV1199Patched=true;
  api.saveInvoice=async(orderId,payload={})=>{
    const dialog=document.querySelector("#modal-root .invoice-reader-v1199");
    if(!dialog)return originalSaveInvoice(orderId,payload);
    const invoiceNumber=value(dialog,"invoiceNumberV1199")||payload.invoiceNumber;
    const invoiceDate=value(dialog,"invoiceDateV1199")||payload.invoiceDate;
    const invoiceName=value(dialog,"invoiceNameV1199");
    const amount=positiveNumber(value(dialog,"invoiceAmountV1199"));
    const packageQuantity=positiveNumber(value(dialog,"invoiceQuantityV1199"));
    const packageWeightKg=positiveNumber(value(dialog,"invoiceWeightV1199"));
    const productLineCount=positiveNumber(value(dialog,"invoiceLinesV1199"));
    const readerVersion=dialog.dataset.invoiceReaderVersion||null;
    const autoRead=dialog.dataset.invoiceAutoRead==="1";

    return originalSaveInvoice(orderId,{
      ...payload,
      invoiceNumber,
      invoiceDate,
      amount,
      currency:"COP",
      metadata:{
        ...(payload.metadata||{}),
        invoiceName:invoiceName||null,
        packageQuantity,
        packageWeightKg,
        productLineCount,
        pdfReaderVersion:readerVersion,
        pdfAutoRead:autoRead,
        pdfFieldsEditable:true,
        weightManuallyReviewed:dialog.querySelector('[name="invoiceWeightV1199"]')?.dataset.manual==="1",
        invoiceDataReviewed:true
      }
    });
  };
}
