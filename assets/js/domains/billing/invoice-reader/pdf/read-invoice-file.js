import { readDocumentText, documentKind } from "../../../../services/document-reader-v11101.js";
import { seedFallbacks, applyParsed, refreshWeightState } from "../ui/manual-fields.js";
import { parseInvoiceText } from "../parse/invoice-text.js";

export async function handleFile(modal,fileInput){
  const file=fileInput.files?.[0];
  const panel=modal.querySelector(".invoice-reader-panel-v1199");
  const status=modal.querySelector("[data-invoice-reader-status]");
  const message=modal.querySelector("[data-invoice-reader-message]");
  if(!panel||!status||!message)return;
  if(!file){
    panel.dataset.invoiceReaderState="idle";
    status.textContent="Esperando documento";
    message.textContent="Selecciona la factura para iniciar la lectura automática.";
    modal.dataset.invoiceAutoRead="0";
    return;
  }

  seedFallbacks(modal,file);
  panel.dataset.invoiceReaderState="reading";
  status.innerHTML='<span class="spinner"></span> Leyendo documento';
  message.textContent="Analizando PDF, imagen o CSV. Puedes corregir cualquier campo.";
  try{
    const parsed=await readInvoiceDocument(file,{onProgress:step=>{
      status.textContent=step?.label||`Leyendo ${documentKind(file).toUpperCase()}`;
    }});
    applyParsed(modal,parsed,file);
    modal.dataset.invoiceReaderVersion=parsed.readerVersion;
    modal.dataset.invoiceAutoRead="1";
    const missing=[];
    if(!parsed.invoiceNumber)missing.push("número");
    if(!parsed.issuer)missing.push("nombre/emisor");
    if(!(parsed.amount>0))missing.push("valor");
    if(!(parsed.packageQuantity>0))missing.push("cantidad");
    if(!(parsed.packageWeightKg>0))missing.push("peso");
    panel.dataset.invoiceReaderState=missing.length?"manual":"ready";
    status.textContent=missing.length?"Lectura terminada · revisar":"Lectura terminada";
    message.textContent=missing.length
      ?`Completa o corrige: ${missing.join(", ")}. Los campos siguen editables.`
      :"El CRM encontró los datos principales. Revísalos antes de guardar.";
    message.classList.toggle("needs-review",missing.length>0);
  }catch(error){
    panel.dataset.invoiceReaderState="manual";
    status.textContent="Completar manualmente";
    message.textContent=`No fue posible leer todos los datos automáticamente. ${error?.message||""}`.trim();
    message.classList.add("needs-review");
    modal.dataset.invoiceAutoRead="0";
    modal.dataset.invoiceReaderVersion=`factura-${documentKind(file)}-manual-v11101`;
    refreshWeightState(modal);
  }
}

export async function readInvoiceDocument(file,{reader=readDocumentText,onProgress}={}){
  const result=await reader(file,{onProgress});
  const parsed=parseInvoiceText(result.text);
  const kind=result.kind||documentKind(file);
  return {...parsed,readerVersion:`factura-${kind}-v11101`};
}
