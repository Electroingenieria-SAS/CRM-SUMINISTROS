import {readDocumentText,documentKind} from "../services/document-reader-v11101.js";

let observer=null;let scheduled=false;
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;observer?.disconnect();enhanceAll();observe()})}
function observe(){const root=document.querySelector("#modal-root");if(root&&observer)observer.observe(root,{childList:true,subtree:true})}
function enhanceAll(){document.querySelectorAll("#modal-root .invoice-reader-v1199").forEach(enhance)}

function enhance(modal){
  if(modal.dataset.billingMultiformatV11101==="1")return;
  const input=modal.querySelector('input[type="file"][name="file"]');if(!input)return;
  modal.dataset.billingMultiformatV11101="1";
  modal.classList.add("billing-multiformat-v11101");
  input.accept="application/pdf,.pdf,image/*,.csv,text/csv";
  const label=input.closest(".field")?.querySelector("label");if(label)label.textContent="Factura (PDF, imagen o CSV) *";
  const note=modal.querySelector(".billing-upload-note p");if(note)note.textContent="Selecciona PDF, imagen o CSV. El CRM intentará leer los datos y podrás corregirlos manualmente antes de guardar.";
  const readerCopy=modal.querySelector(".invoice-reader-head-v1199 p");if(readerCopy)readerCopy.textContent="El CRM lee PDF, imagen o CSV y completa lo que encuentre. Todos los campos siguen editables.";
  const initial=modal.querySelector("[data-invoice-reader-message]");if(initial&&/PDF/i.test(initial.textContent||""))initial.textContent="Selecciona la factura para iniciar la lectura automática.";
  input.addEventListener("change",event=>{event.stopImmediatePropagation();handleFile(modal,input)},{capture:true});
}

async function handleFile(modal,input){
  const file=input.files?.[0];if(!file)return;
  seedFallbacks(modal,file);
  setStatus(modal,"reading","Preparando documento…","El CRM está leyendo el archivo.");
  try{
    const result=await readDocumentText(file,{onProgress:step=>setStatus(modal,"reading",step.label,`Procesando ${documentKind(file).toUpperCase()}…`)});
    const parsed=parseInvoiceText(result.text);
    apply(modal,parsed,file);
    modal.dataset.invoiceReaderVersion=`factura-${result.kind}-v11101`;
    modal.dataset.invoiceAutoRead="1";
    const missing=[];
    if(!parsed.invoiceNumber)missing.push("número");
    if(!parsed.issuer)missing.push("nombre/emisor");
    if(!(parsed.amount>0))missing.push("valor");
    if(!(parsed.packageQuantity>0))missing.push("cantidad");
    if(!(parsed.packageWeightKg>0))missing.push("peso");
    setStatus(modal,missing.length?"manual":"ready",missing.length?"Lectura terminada · revisa algunos datos":"Lectura terminada",missing.length?`Completa o corrige: ${missing.join(", ")}.`:"El CRM encontró los datos principales. Revísalos antes de guardar.");
  }catch(error){
    modal.dataset.invoiceAutoRead="0";
    setStatus(modal,"manual","Completar manualmente",error?.message||"No fue posible leer el documento automáticamente.");
    refreshWeight(modal);
  }
}

function parseInvoiceText(text){
  const raw=String(text||"").replace(/_/g," ").replace(/\r/g,"\n");
  const lines=raw.split(/\n+/).map(clean).filter(Boolean);
  const invoiceNumber=matchValue(raw,[/(?:N[ÚU]MERO\s+(?:DE\s+)?FACTURA|FACTURA(?:\s+ELECTR[ÓO]NICA)?|INVOICE(?:\s+NUMBER)?)\s*[:#=\-]?\s*([A-Z0-9.-]{3,})/i]);
  const issuer=matchValue(raw,[/(?:EMISOR|PROVEEDOR|VENDEDOR|RAZ[ÓO]N\s+SOCIAL|NOMBRE\s+EMISOR)\s*[:=\-]\s*([^\n,;]{3,100})/i])||detectIssuer(lines);
  const invoiceDate=normalizeDate(matchValue(raw,[/(?:FECHA(?:\s+DE\s+(?:FACTURA|EMISI[ÓO]N))?)\s*[:=\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i]));
  const amount=detectLabeledNumber(lines,/(TOTAL\s+A\s+PAGAR|TOTAL\s+FACTURA|VALOR\s+TOTAL|TOTAL\s+NETO|VALOR\s+FACTURA|TOTAL)\b/i);
  const packageWeightKg=detectLabeledNumber(lines,/(PESO(?:\s+(?:TOTAL|BRUTO|NETO))?|WEIGHT)\b/i);
  const packageQuantity=detectLabeledNumber(lines,/(CANTIDAD\s+TOTAL|TOTAL\s+(?:PRODUCTOS|UNIDADES|CANTIDAD)|N[ÚU]MERO\s+DE\s+(?:PRODUCTOS|UNIDADES)|QUANTITY)\b/i);
  const productLineCount=Math.max(0,lines.filter(line=>/^\s*(?:SKU|REF(?:ERENCIA)?|ITEM|PRODUCTO)\b/i.test(line)).length)||null;
  return {invoiceNumber,issuer,invoiceDate,amount,packageWeightKg,packageQuantity,productLineCount};
}
function detectIssuer(lines){for(const line of lines.slice(0,25)){if(/\b(?:S\.?(?:A\.?S\.?|A\.?)|LTDA|LIMITADA|SAS)\b/i.test(line)&&!/cliente|adquirente|factura|dian|nit\s*:/i.test(line))return line}return ""}
function detectLabeledNumber(lines,label){for(let i=0;i<lines.length;i++){if(!label.test(lines[i]))continue;const nums=lines[i].match(/(?:\$|COP\s*)?[\d][\d.,]*/gi)||[];if(nums.length){const n=localizedNumber(nums.at(-1));if(n>0)return n}if(lines[i+1]){const next=lines[i+1].match(/(?:\$|COP\s*)?[\d][\d.,]*/gi)||[];if(next.length){const n=localizedNumber(next.at(-1));if(n>0)return n}}}return null}
function matchValue(raw,patterns){for(const p of patterns){const m=raw.match(p);if(m?.[1])return clean(m[1])}return ""}
function apply(modal,parsed,file){setAuto(modal,"invoiceNumberV1199",parsed.invoiceNumber||base(file.name));setAuto(modal,"invoiceNameV1199",parsed.issuer||base(file.name));setAuto(modal,"invoiceDateV1199",parsed.invoiceDate||new Date().toISOString().slice(0,10));setAuto(modal,"invoiceAmountV1199",parsed.amount>0?trim(parsed.amount):"");setAuto(modal,"invoiceQuantityV1199",parsed.packageQuantity>0?trim(parsed.packageQuantity):"");setAuto(modal,"invoiceWeightV1199",parsed.packageWeightKg>0?trim(parsed.packageWeightKg):"");const lines=modal.querySelector('[name="invoiceLinesV1199"]');if(lines&&parsed.productLineCount)lines.value=String(parsed.productLineCount);refreshWeight(modal)}
function setAuto(modal,name,val){const input=modal.querySelector(`[name="${name}"]`);if(!input||input.dataset.manual==="1")return;input.value=val??"";const hint=modal.querySelector(`[data-field-source="${name}"]`);if(hint){hint.textContent=val!==""?"Leído automáticamente":"Revisar manualmente";hint.classList.toggle("detected",val!=="");hint.classList.toggle("missing",val==="")}}
function seedFallbacks(modal,file){setAuto(modal,"invoiceNumberV1199",base(file.name));setAuto(modal,"invoiceNameV1199",base(file.name))}
function setStatus(modal,state,label,message){const panel=modal.querySelector(".invoice-reader-panel-v1199");if(panel)panel.dataset.invoiceReaderState=state;const status=modal.querySelector("[data-invoice-reader-status]");if(status)status.textContent=label;const msg=modal.querySelector("[data-invoice-reader-message]");if(msg){msg.textContent=message;msg.classList.toggle("needs-review",state==="manual")}}
function refreshWeight(modal){const input=modal.querySelector('[name="invoiceWeightV1199"]');const field=input?.closest(".invoice-reader-field-v1199");const valid=Number(input?.value)>0;field?.classList.toggle("needs-review",!valid);const hint=modal.querySelector('[data-field-source="invoiceWeightV1199"]');if(hint&&!valid){hint.textContent="Peso pendiente · escribe un valor mayor que 0";hint.classList.add("missing")}}
function localizedNumber(value){let text=String(value||"").replace(/COP|\$|\s/gi,"").replace(/[^\d,.-]/g,"");if(!text)return NaN;const comma=text.lastIndexOf(","),dot=text.lastIndexOf(".");if(comma>=0&&dot>=0){const decimal=comma>dot?",":".";const thousand=decimal===","?".":",";text=text.split(thousand).join("").replace(decimal,".")}else if(comma>=0){const decimals=text.length-comma-1;text=decimals>0&&decimals<=2?text.replace(/\./g,"").replace(",","."):text.replace(/,/g,"")}else if(dot>=0&&/^\d{1,3}(\.\d{3})+$/.test(text))text=text.replace(/\./g,"");return Number(text)}
function normalizeDate(value){const text=String(value||"").trim();if(!text)return "";if(/^\d{4}[\/-]\d{1,2}[\/-]\d{1,2}$/.test(text)){const [y,m,d]=text.split(/[\/-]/);return `${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`}const m=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);if(!m)return "";return `${m[3].length===2?`20${m[3]}`:m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`}
function trim(n){return String(Number(Number(n).toFixed(3))).replace(/\.0+$/u,"")}
function base(name){return String(name||"").replace(/\.[^.]+$/u,"").trim()}
function clean(value){return String(value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
function install(){enhanceAll();const root=document.querySelector("#modal-root");if(!root)return;observer=new MutationObserver(schedule);observe()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
