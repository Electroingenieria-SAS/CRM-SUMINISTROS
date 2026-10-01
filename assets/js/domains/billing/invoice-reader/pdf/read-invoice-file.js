import { ensurePdfReader } from "../../../../services/pdf-order-reader.js";
import { seedFallbacks, applyParsed, refreshWeightState } from "../ui/manual-fields.js";
import { parseInvoiceText } from "../parse/invoice-text.js";
import { clean } from "../parse/localized-values.js";

export async function handleFile(modal,fileInput){
  const file=fileInput.files?.[0];
  const panel=modal.querySelector(".invoice-reader-panel-v1199");
  const status=modal.querySelector("[data-invoice-reader-status]");
  const message=modal.querySelector("[data-invoice-reader-message]");
  if(!panel||!status||!message)return;
  if(!file){
    panel.dataset.invoiceReaderState="idle";
    status.textContent="Esperando PDF";
    message.textContent="Selecciona la factura para iniciar la lectura automática.";
    modal.dataset.invoiceAutoRead="0";
    return;
  }

  seedFallbacks(modal,file);
  panel.dataset.invoiceReaderState="reading";
  status.innerHTML='<span class="spinner"></span> Leyendo PDF';
  message.textContent="Analizando el documento. Puedes seguir viendo la ventana mientras termina la lectura.";
  try{
    const parsed=await readInvoicePdf(file);
    applyParsed(modal,parsed,file);
    modal.dataset.invoiceReaderVersion=parsed.readerVersion;
    modal.dataset.invoiceAutoRead="1";
    panel.dataset.invoiceReaderState="ready";
    status.textContent="Lectura terminada";
    const missing=[];
    if(!parsed.invoiceNumber)missing.push("número");
    if(!parsed.issuer)missing.push("nombre/emisor");
    if(!(parsed.amount>0))missing.push("valor");
    if(!(parsed.packageQuantity>0))missing.push("cantidad");
    if(!(parsed.packageWeightKg>0))missing.push("peso");
    message.textContent=missing.length
      ?`Lectura terminada. Revisa especialmente: ${missing.join(", ")}. Los campos siguen completamente editables.`
      :"El CRM encontró los datos principales. Revísalos y corrige cualquier valor antes de guardar.";
    message.classList.toggle("needs-review",missing.length>0);
  }catch(error){
    panel.dataset.invoiceReaderState="manual";
    status.textContent="Completar manualmente";
    message.textContent=`No fue posible leer todos los datos automáticamente. Completa o corrige los campos manualmente. ${error?.message||""}`.trim();
    message.classList.add("needs-review");
    modal.dataset.invoiceAutoRead="0";
    refreshWeightState(modal);
  }
}

export async function readInvoicePdf(file){
  const pdfjs=await ensurePdfReader();
  const buffer=await file.arrayBuffer();
  const pdf=await pdfjs.getDocument({data:buffer}).promise;
  const pages=[];
  for(let pageNumber=1;pageNumber<=pdf.numPages;pageNumber++){
    const page=await pdf.getPage(pageNumber);
    const content=await page.getTextContent();
    pages.push(extractPageText(content.items||[]));
  }
  const raw=pages.join("\n");
  return parseInvoiceText(raw);
}

export function extractPageText(items){
  const rows=new Map();
  for(const item of items){
    const text=clean(item.str);if(!text)continue;
    const y=Math.round(Number(item.transform?.[5]||0)*2)/2;
    const x=Number(item.transform?.[4]||0);
    if(!rows.has(y))rows.set(y,[]);
    rows.get(y).push({x,text});
  }
  return [...rows.entries()].sort((a,b)=>b[0]-a[0]).map(([,parts])=>parts.sort((a,b)=>a.x-b.x).map(part=>part.text).join(" ").replace(/\s+/g," ").trim()).filter(Boolean).join("\n");
}
