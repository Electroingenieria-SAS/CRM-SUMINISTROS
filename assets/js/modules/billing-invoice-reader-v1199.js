import {api} from "../services/api.js";
import {ensurePdfReader,parseOrderText} from "../services/pdf-order-reader.js";

let observer=null;
let scheduled=false;
const originalSaveInvoice=api.saveInvoice.bind(api);

function patchInvoiceSave(){
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

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{
    scheduled=false;
    observer?.disconnect();
    enhanceAll();
    observe();
  });
}
function observe(){
  const root=document.querySelector("#modal-root");
  if(root&&observer)observer.observe(root,{childList:true,subtree:true});
}
function enhanceAll(){
  document.querySelectorAll("#modal-root .modal").forEach(enhanceInvoiceDialog);
}

function enhanceInvoiceDialog(modal){
  const note=modal.querySelector(".billing-upload-note");
  const fileInput=modal.querySelector('input[type="file"][name="file"]');
  if(!note||!fileInput)return;
  if(/PVP/i.test(modal.querySelector(".modal-head")?.textContent||""))return;
  if(modal.dataset.invoiceReaderEnhanced==="1")return;
  modal.dataset.invoiceReaderEnhanced="1";
  modal.classList.add("invoice-reader-v1199");

  const workspace=modal.querySelector(".billing-upload-workspace-v1199")||fileInput.closest(".field")||modal.querySelector(".modal-body");
  if(!workspace)return;
  const section=document.createElement("section");
  section.className="invoice-reader-panel-v1199";
  section.dataset.invoiceReaderState="idle";
  section.innerHTML=`
    <header class="invoice-reader-head-v1199">
      <div class="invoice-reader-icon-v1199" aria-hidden="true">⌁</div>
      <div><span>LECTURA AUTOMÁTICA</span><h4>Datos de la factura</h4><p>Al seleccionar el PDF, el CRM intentará completar estos campos. Todos se pueden editar antes de guardar.</p></div>
      <span class="invoice-reader-status-v1199" data-invoice-reader-status>Esperando PDF</span>
    </header>
    <div class="invoice-reader-message-v1199" data-invoice-reader-message>Selecciona la factura para iniciar la lectura automática.</div>
    <div class="invoice-reader-grid-v1199">
      ${field("Número de factura","invoiceNumberV1199","text","Ej. FE-102845",true)}
      ${field("Nombre / emisor de factura","invoiceNameV1199","text","Razón social o nombre que aparece en la factura",true)}
      ${field("Fecha de factura","invoiceDateV1199","date","",true)}
      ${field("Valor total","invoiceAmountV1199","number","0",true,'step="0.01" min="0.01" inputmode="decimal"')}
      ${field("Cantidad total de productos","invoiceQuantityV1199","number","0",true,'step="0.001" min="0.001" inputmode="decimal"')}
      ${field("Peso total (kg)","invoiceWeightV1199","number","Completar si el PDF no lo informa",true,'step="0.001" min="0.001" inputmode="decimal" data-weight-field')}
    </div>
    <input type="hidden" name="invoiceLinesV1199" value="">
    <div class="invoice-reader-foot-v1199">
      <span><b>Automático</b> número, fecha, valor, cantidad y peso cuando estén presentes.</span>
      <span><b>Editable</b> puedes corregir cualquier dato antes de guardar.</span>
    </div>`;
  workspace.append(section);

  const today=new Date().toISOString().slice(0,10);
  modal.querySelector('[name="invoiceDateV1199"]').value=today;
  bindManualTracking(modal);
  fileInput.addEventListener("change",()=>handleFile(modal,fileInput));
  if(fileInput.files?.[0])handleFile(modal,fileInput);
}

function field(label,name,type,placeholder,required=false,extra=""){
  return `<label class="invoice-reader-field-v1199"><span>${escapeHtml(label)}${required?' <em>*</em>':''}</span><input class="control" name="${name}" type="${type}" placeholder="${escapeHtml(placeholder)}" ${required?"required":""} ${extra}><small data-field-source="${name}">Editable</small></label>`;
}

function bindManualTracking(modal){
  modal.querySelectorAll(".invoice-reader-field-v1199 input").forEach(input=>{
    input.addEventListener("input",()=>{
      input.dataset.manual="1";
      const hint=modal.querySelector(`[data-field-source="${input.name}"]`);
      if(hint){hint.textContent="Editado manualmente";hint.classList.add("manual")}
      if(input.name==="invoiceWeightV1199")refreshWeightState(modal);
    });
  });
}

async function handleFile(modal,fileInput){
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

function seedFallbacks(modal,file){
  const number=modal.querySelector('[name="invoiceNumberV1199"]');
  const name=modal.querySelector('[name="invoiceNameV1199"]');
  if(number&&!number.value)number.value=file.name.replace(/\.[^.]+$/u,"").trim();
  if(name&&!name.value)name.value=file.name.replace(/\.[^.]+$/u,"").trim();
}

function applyParsed(modal,parsed,file){
  setAuto(modal,"invoiceNumberV1199",parsed.invoiceNumber||file.name.replace(/\.[^.]+$/u,""));
  setAuto(modal,"invoiceNameV1199",parsed.issuer||file.name.replace(/\.[^.]+$/u,""));
  setAuto(modal,"invoiceDateV1199",parsed.invoiceDate||new Date().toISOString().slice(0,10));
  setAuto(modal,"invoiceAmountV1199",parsed.amount>0?trimNumber(parsed.amount):"");
  setAuto(modal,"invoiceQuantityV1199",parsed.packageQuantity>0?trimNumber(parsed.packageQuantity):"");
  setAuto(modal,"invoiceWeightV1199",parsed.packageWeightKg>0?trimNumber(parsed.packageWeightKg):"");
  const lines=modal.querySelector('[name="invoiceLinesV1199"]');
  if(lines)lines.value=parsed.productLineCount>0?String(parsed.productLineCount):"";
  refreshWeightState(modal);
}

function setAuto(modal,name,val){
  const input=modal.querySelector(`[name="${name}"]`);
  if(!input||input.dataset.manual==="1")return;
  input.value=val??"";
  const hint=modal.querySelector(`[data-field-source="${name}"]`);
  if(hint){hint.textContent=val!==""?"Leído automáticamente":"Revisar manualmente";hint.classList.toggle("detected",val!=="");hint.classList.toggle("missing",val==="")}
}

function refreshWeightState(modal){
  const input=modal.querySelector('[name="invoiceWeightV1199"]');
  const field=input?.closest(".invoice-reader-field-v1199");
  const valid=positiveNumber(input?.value)>0;
  field?.classList.toggle("needs-review",!valid);
  const hint=modal.querySelector('[data-field-source="invoiceWeightV1199"]');
  if(hint&&!valid){hint.textContent="Peso pendiente · escribe un valor mayor que 0";hint.classList.add("missing")}
}

async function readInvoicePdf(file){
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

function extractPageText(items){
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

function parseInvoiceText(rawText){
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

function detectInvoiceNumber(raw,lines){
  const patterns=[
    /(?:FACTURA(?:\s+ELECTR[ÓO]NICA)?(?:\s+DE\s+VENTA)?|N[ÚU]MERO\s+DE\s+FACTURA)\s*(?:N(?:O|RO|ÚMERO|UMERO)?\.?|N[°º])?\s*[:#-]?\s*([A-Z]{0,6}[- ]?\d[A-Z0-9.-]{1,})/i,
    /(?:FACTURA|INVOICE)\s*(?:NO\.?|N[°º])\s*[:#-]?\s*([A-Z0-9.-]{3,})/i
  ];
  for(const pattern of patterns){const match=raw.match(pattern);if(match?.[1])return clean(match[1]).replace(/\s+/g,"")}
  for(const line of lines){
    if(!/factura/i.test(line)||/nit|dian|resoluci/i.test(line))continue;
    const match=line.match(/\b([A-Z]{1,5}[- ]?\d{3,}[A-Z0-9.-]*)\b/i);if(match?.[1])return clean(match[1]).replace(/\s+/g,"");
  }
  return "";
}

function detectIssuer(lines){
  const labels=[/^(?:EMISOR|PROVEEDOR|VENDEDOR|RAZ[ÓO]N SOCIAL(?: DEL EMISOR)?)\s*[:\-]\s*(.+)$/i];
  for(const line of lines){for(const re of labels){const m=line.match(re);if(m?.[1])return clean(m[1])}}
  for(let i=0;i<Math.min(lines.length,20);i++){
    const line=lines[i];
    if(/\b(?:S\.?(?:A\.?S\.?|A\.?)|LTDA|LIMITADA|SAS)\b/i.test(line)&&!/cliente|adquirente|factura|dian|nit\s*:/i.test(line))return line;
  }
  return "";
}

function detectDate(raw,lines){
  const labeled=raw.match(/(?:FECHA(?:\s+DE\s+(?:EMISI[ÓO]N|FACTURA))?)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i);
  const any=labeled?.[1]||raw.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})\b/)?.[1]||"";
  return normalizeDate(any);
}

function detectAmount(lines){
  const labels=/(TOTAL\s+A\s+PAGAR|TOTAL\s+FACTURA|VALOR\s+TOTAL|TOTAL\s+NETO|TOTAL)\b/i;
  for(let i=lines.length-1;i>=0;i--){
    if(!labels.test(lines[i]))continue;
    const numbers=extractNumbers(lines[i]);
    if(numbers.length){const n=numbers.at(-1);if(n>0)return n}
    if(lines[i+1]){const next=extractNumbers(lines[i+1]);if(next.length&&next.at(-1)>0)return next.at(-1)}
  }
  return null;
}

function detectWeight(lines){
  for(const line of lines){
    if(!/PESO/i.test(line))continue;
    const match=line.match(/(?:PESO(?:\s+(?:TOTAL|BRUTO|NETO))?)\s*[:=\-]?\s*([\d.,]+)\s*(?:KG|KGS|KILOGRAMOS?)\b/i);
    const value=match?localizedNumber(match[1]):null;
    if(value>0)return value;
  }
  return null;
}

function detectQuantity(lines){
  for(const line of lines){
    const match=line.match(/(?:CANTIDAD\s+TOTAL|TOTAL\s+(?:PRODUCTOS|UNIDADES|CANTIDAD)|N[ÚU]MERO\s+DE\s+(?:PRODUCTOS|UNIDADES))\s*[:=\-]?\s*([\d.,]+)/i);
    const value=match?localizedNumber(match[1]):null;
    if(value>0)return value;
  }
  return null;
}

function extractNumbers(text){
  const matches=String(text||"").match(/(?:\$|COP\s*)?\d[\d.,]*(?:\s*COP)?/gi)||[];
  return matches.map(localizedNumber).filter(number=>Number.isFinite(number));
}
function localizedNumber(value){
  let text=String(value||"").replace(/COP|\$|\s/gi,"").replace(/[^\d,.-]/g,"");
  if(!text)return NaN;
  const comma=text.lastIndexOf(","),dot=text.lastIndexOf(".");
  if(comma>=0&&dot>=0){
    const decimal=comma>dot?",":".";const thousand=decimal===","?".":",";
    text=text.split(thousand).join("").replace(decimal,".");
  }else if(comma>=0){
    const decimals=text.length-comma-1;text=decimals>0&&decimals<=2?text.replace(/\./g,"").replace(",","."):text.replace(/,/g,"");
  }else if(dot>=0){
    const decimals=text.length-dot-1;text=decimals===3&&/^\d{1,3}(\.\d{3})+$/.test(text)?text.replace(/\./g,""):text;
  }
  return Number(text);
}
function normalizeDate(value){
  const text=String(value||"").trim();if(!text)return "";
  if(/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(text)){const [y,m,d]=text.split(/[\/-]/);return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`}
  const match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);if(!match)return "";
  const year=match[3].length===2?`20${match[3]}`:match[3];return `${year}-${match[2].padStart(2,"0")}-${match[1].padStart(2,"0")}`;
}
function positiveNumber(value){const n=Number(value);return Number.isFinite(n)&&n>0?n:null}
function trimNumber(value){return String(Number(value.toFixed?.(3)??value)).replace(/\.0+$/u,"")}
function clean(value){return String(value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
function value(root,name){return root.querySelector(`[name="${name}"]`)?.value?.trim?.()||""}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}

function install(){
  patchInvoiceSave();
  enhanceAll();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  observer=new MutationObserver(schedule);
  observe();
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
