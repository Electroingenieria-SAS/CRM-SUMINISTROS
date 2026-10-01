import { parseOrderText } from "../../../../services/pdf-order-reader.js";
import { detectInvoiceNumber, detectIssuer, detectDate } from "./invoice-identity.js";
import { detectWeight, detectQuantity } from "./invoice-quantities.js";
import {detectAmount} from "./invoice-amount.js";
import { positiveNumber, clean } from "./localized-values.js";

export function parseInvoiceText(rawText){
  const raw=String(rawText||"").replace(/\r/g,"\n");
  const lines=raw.split(/\n+/).map(clean).filter(Boolean);
  const invoiceNumber=detectInvoiceNumber(raw,lines);
  const issuer=detectIssuer(lines);
  const invoiceDate=detectDate(raw,lines);
  const amount=detectAmount(lines);
  const packageWeightKg=detectWeight(lines);
  const orderParsed=parseOrderText(raw);
  const productLineCount=orderParsed.items?.length||0;
  const explicitQuantity=detectQuantity(lines);
  const parsedQuantity=(orderParsed.items||[]).reduce((sum,item)=>sum+(Number(item.quantity)||0),0);
  const packageQuantity=positiveNumber(explicitQuantity)||positiveNumber(parsedQuantity)||null;
  return {invoiceNumber,issuer,invoiceDate,amount,packageQuantity,packageWeightKg,productLineCount,readerVersion:"factura-pdf-3.11.174-v1199"};
}
