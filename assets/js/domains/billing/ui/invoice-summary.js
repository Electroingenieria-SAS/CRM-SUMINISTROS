import { fmt } from "../../../core/format.js";

export function billingDocumentSummary(document,{pvp}){
  if(pvp)return `<section class="invoice-confirmed pvp-annex-confirmed"><span>Anexo PVP cargado</span><strong>${fmt.escape(document.file_name||"Anexo PVP")}</strong><small>${fmt.date(document.created_at)}</small></section>`;
  return `<section class="invoice-confirmed"><span>Factura registrada</span><strong>${fmt.escape(document.invoice_number)}</strong><small>${fmt.date(document.invoice_date)}${document.amount?` · ${fmt.number(document.amount)} COP`:""}</small></section>`;
}
