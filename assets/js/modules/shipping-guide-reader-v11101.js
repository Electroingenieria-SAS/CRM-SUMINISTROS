import {api} from "../services/api.js";
import {readDocumentText,documentKind} from "../services/document-reader-v11101.js";

let observer=null;
let scheduled=false;
const originalSaveShippingGuide=api.saveShippingGuide.bind(api);

function patchSave(){
  if(api.__shippingGuideReaderV11101Patched)return;
  api.__shippingGuideReaderV11101Patched=true;
  api.saveShippingGuide=async(orderId,payload={})=>{
    const dialog=document.querySelector("#modal-root .shipping-guide-reader-v11101");
    if(!dialog)return originalSaveShippingGuide(orderId,payload);
    const carrierInvoiceNumber=value(dialog,"carrierInvoiceNumberV11101");
    const carrierCost=positive(value(dialog,"carrierCostV11101"));
    return originalSaveShippingGuide(orderId,{
      ...payload,
      trackingNumber:value(dialog,"trackingNumber")||payload.trackingNumber,
      carrier:value(dialog,"carrier")||payload.carrier,
      carrierInvoiceNumber:carrierInvoiceNumber||null,
      carrierCost:carrierCost??null,
      carrierCostCurrency:"COP"
    });
  };
}

function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;observer?.disconnect();enhanceAll();observe()})}
function observe(){const root=document.querySelector("#modal-root");if(root&&observer)observer.observe(root,{childList:true,subtree:true})}
function enhanceAll(){document.querySelectorAll("#modal-root .modal").forEach(enhanceDialog)}

function enhanceDialog(modal){
  const title=modal.querySelector(".modal-head h3")?.textContent?.trim()||"";
  if(title!=="Agregar guía"||modal.dataset.shippingGuideReaderV11101==="1")return;
  const oldTracking=modal.querySelector('[name="trackingNumber"]')?.value||"";
  const oldCarrier=modal.querySelector('[name="carrier"]')?.value||"";
  const body=modal.querySelector(".modal-body");
  if(!body)return;
  modal.dataset.shippingGuideReaderV11101="1";
  modal.classList.add("shipping-guide-reader-v11101");
  body.innerHTML=`
    <section class="guide-reader-hero-v11101">
      <div class="guide-reader-icon-v11101" aria-hidden="true">↗</div>
      <div><span>GUÍA DE TRANSPORTE</span><h4>Sube el soporte y revisa los datos</h4><p>PDF, imagen o CSV. El CRM intentará leer la transportadora, guía, factura del transportador y costo del flete. Todo queda editable.</p></div>
    </section>
    <section class="guide-upload-zone-v11101" data-guide-dropzone tabindex="0" role="button" aria-label="Seleccionar soporte de guía">
      <input name="guideFile" type="file" accept="application/pdf,.pdf,image/*,.csv,text/csv" hidden>
      <div class="guide-upload-mark-v11101">↑</div>
      <div><strong data-guide-file-title>Seleccionar soporte de guía</strong><small data-guide-file-meta>Arrastra aquí o elige PDF, imagen o CSV · máximo según política del CRM</small></div>
      <button type="button" class="btn btn-ghost" data-guide-choose>Elegir archivo</button>
    </section>
    <section class="guide-reader-status-v11101" data-guide-reader-state="idle">
      <div class="guide-reader-status-head-v11101"><strong data-guide-reader-label>Completa los datos o carga un archivo</strong><span data-guide-reader-percent></span></div>
      <div class="guide-reader-progress-v11101"><i data-guide-reader-bar></i></div>
      <small data-guide-reader-message>Si el lector no encuentra algún dato, puedes escribirlo manualmente.</small>
    </section>
    <div class="guide-reader-grid-v11101">
      ${field("Transportadora","carrier",oldCarrier,"Ej. Coordinadora, TCC, Servientrega",true)}
      ${field("Número de guía","trackingNumber",oldTracking,"Número o código de seguimiento",true)}
      ${field("Factura de la transportadora","carrierInvoiceNumberV11101","","Número de factura o cobro del transportador")}
      ${field("Costo del flete (COP)","carrierCostV11101","","0",false,"number",'step="0.01" min="0" inputmode="decimal"')}
    </div>
    <div class="guide-reader-help-v11101"><span><b>Automático:</b> el lector completa lo que encuentre.</span><span><b>Manual:</b> puedes editar cualquier campo antes de guardar.</span></div>`;

  const input=body.querySelector('[name="guideFile"]');
  const zone=body.querySelector("[data-guide-dropzone]");
  body.querySelector("[data-guide-choose]")?.addEventListener("click",event=>{event.stopPropagation();input.click()});
  zone?.addEventListener("click",event=>{if(!event.target.closest("button"))input.click()});
  zone?.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();input.click()}});
  zone?.addEventListener("dragover",event=>{event.preventDefault();zone.classList.add("dragging")});
  zone?.addEventListener("dragleave",()=>zone.classList.remove("dragging"));
  zone?.addEventListener("drop",event=>{
    event.preventDefault();zone.classList.remove("dragging");
    const file=event.dataTransfer?.files?.[0];if(!file)return;
    const dt=new DataTransfer();dt.items.add(file);input.files=dt.files;input.dispatchEvent(new Event("change",{bubbles:true}));
  });
  input.addEventListener("change",()=>readGuide(modal,input));
  bindManual(modal);
}

function field(label,name,current,placeholder,required=false,type="text",extra=""){
  return `<label class="guide-reader-field-v11101"><span>${escapeHtml(label)}${required?' <em>*</em>':''}</span><input class="control" name="${name}" type="${type}" value="${escapeHtml(current)}" placeholder="${escapeHtml(placeholder)}" ${required?"required":""} ${extra}><small data-guide-source="${name}">Editable manualmente</small></label>`;
}

function bindManual(modal){
  modal.querySelectorAll(".guide-reader-field-v11101 input").forEach(input=>input.addEventListener("input",()=>{
    input.dataset.manual="1";
    const hint=modal.querySelector(`[data-guide-source="${input.name}"]`);if(hint){hint.textContent="Editado manualmente";hint.className="manual"}
  }));
}

async function readGuide(modal,input){
  const file=input.files?.[0];if(!file)return;
  const kind=documentKind(file);
  const title=modal.querySelector("[data-guide-file-title]");
  const meta=modal.querySelector("[data-guide-file-meta]");
  if(title)title.textContent=file.name;
  if(meta)meta.textContent=`${kind.toUpperCase()} · ${formatBytes(file.size)}`;
  updateStatus(modal,"reading",.04,"Preparando lectura…","El CRM está analizando el soporte.");
  try{
    const result=await readDocumentText(file,{onProgress:step=>updateStatus(modal,"reading",step.progress,step.label,"Puedes corregir cualquier campo incluso después de la lectura.")});
    const parsed=parseGuideText(result.text);
    setAuto(modal,"carrier",parsed.carrier);
    setAuto(modal,"trackingNumber",parsed.trackingNumber);
    setAuto(modal,"carrierInvoiceNumberV11101",parsed.carrierInvoiceNumber);
    setAuto(modal,"carrierCostV11101",parsed.carrierCost?String(parsed.carrierCost):"");
    const missing=[];
    if(!parsed.carrier)missing.push("transportadora");
    if(!parsed.trackingNumber)missing.push("guía");
    if(!parsed.carrierInvoiceNumber)missing.push("factura del transportador");
    if(!(parsed.carrierCost>0))missing.push("costo del flete");
    updateStatus(modal,missing.length?"review":"ready",1,missing.length?"Lectura terminada · revisa algunos datos":"Datos detectados","Revisa y corrige antes de guardar. "+(missing.length?`No se detectó: ${missing.join(", ")}.`:""));
  }catch(error){
    updateStatus(modal,"review",1,"Completa manualmente",error?.message||"No fue posible leer el archivo automáticamente.");
  }
}

function parseGuideText(text){
  const raw=String(text||"").replace(/\r/g,"\n");
  const lines=raw.split(/\n+/).map(clean).filter(Boolean);
  return {
    carrier:detectCarrier(lines,raw),
    trackingNumber:detectTracking(lines,raw),
    carrierInvoiceNumber:detectCarrierInvoice(lines,raw),
    carrierCost:detectFreightCost(lines)
  };
}

function detectCarrier(lines,raw){
  for(const line of lines){const m=line.match(/(?:TRANSPORTADORA|TRANSPORTADOR|CARRIER|OPERADOR\s+LOG[ÍI]STICO|EMPRESA\s+TRANSPORTADORA)\s*[:=\-]\s*(.+)$/i);if(m?.[1])return clean(m[1]).slice(0,100)}
  const known=["SERVIENTREGA","COORDINADORA","TCC","INTERRAPIDISIMO","INTER RAPIDISIMO","ENVIA","DEPRISA","DHL","FEDEX","UPS"];
  const upper=raw.toUpperCase();return known.find(name=>upper.includes(name))||"";
}
function detectTracking(lines,raw){
  const patterns=[/(?:N[ÚU]MERO\s+DE\s+GU[IÍ]A|NRO\.?\s*GU[IÍ]A|GU[IÍ]A|TRACKING(?:\s+NUMBER)?|REMESA|AWB)\s*[:#=\-]?\s*([A-Z0-9-]{5,})/i];
  for(const pattern of patterns){const m=raw.match(pattern);if(m?.[1])return clean(m[1]).replace(/\s/g,"")}
  for(const line of lines){if(!/gu[ií]a|tracking|remesa|awb/i.test(line))continue;const m=line.match(/\b([A-Z0-9-]{6,})\b/i);if(m?.[1])return m[1]}
  return "";
}
function detectCarrierInvoice(lines,raw){
  const m=raw.match(/(?:FACTURA(?:\s+(?:TRANSPORTADORA|TRANSPORTADOR|FLETE))?|NRO\.?\s*FACTURA|INVOICE)\s*[:#=\-]?\s*([A-Z0-9.-]{3,})/i);if(m?.[1])return clean(m[1]).replace(/\s/g,"");
  for(const line of lines){if(!/factura|invoice/i.test(line))continue;const x=line.match(/\b([A-Z]{0,5}[-.]?\d{3,}[A-Z0-9.-]*)\b/i);if(x?.[1])return x[1]}
  return "";
}
function detectFreightCost(lines){
  for(const line of lines){
    if(!/(COSTO|VALOR|TOTAL).*(FLETE|TRANSPORTE)|FLETE.*(COSTO|VALOR|TOTAL)|FREIGHT/i.test(line))continue;
    const nums=line.match(/(?:\$|COP\s*)?[\d][\d.,]*/gi)||[];
    for(let i=nums.length-1;i>=0;i--){const n=localizedNumber(nums[i]);if(n>0)return n}
  }
  return null;
}

function setAuto(modal,name,val){const input=modal.querySelector(`[name="${name}"]`);if(!input||input.dataset.manual==="1"||val==null||val==="")return;input.value=val;const hint=modal.querySelector(`[data-guide-source="${name}"]`);if(hint){hint.textContent="Leído automáticamente";hint.className="detected"}}
function updateStatus(modal,state,progress,label,message){const box=modal.querySelector(".guide-reader-status-v11101");if(box)box.dataset.guideReaderState=state;const l=modal.querySelector("[data-guide-reader-label]");if(l)l.textContent=label||"Procesando…";const p=Math.max(0,Math.min(1,Number(progress||0)));const pct=modal.querySelector("[data-guide-reader-percent]");if(pct)pct.textContent=state==="reading"?`${Math.round(p*100)}%`:"";const bar=modal.querySelector("[data-guide-reader-bar]");if(bar)bar.style.width=`${Math.max(5,p*100)}%`;const msg=modal.querySelector("[data-guide-reader-message]");if(msg)msg.textContent=message||""}
function localizedNumber(value){let text=String(value||"").replace(/COP|\$|\s/gi,"").replace(/[^\d,.-]/g,"");if(!text)return NaN;const comma=text.lastIndexOf(","),dot=text.lastIndexOf(".");if(comma>=0&&dot>=0){const decimal=comma>dot?",":".";const thousand=decimal===","?".":",";text=text.split(thousand).join("").replace(decimal,".")}else if(comma>=0){const decimals=text.length-comma-1;text=decimals>0&&decimals<=2?text.replace(/\./g,"").replace(",","."):text.replace(/,/g,"")}else if(dot>=0&&/^\d{1,3}(\.\d{3})+$/.test(text)){text=text.replace(/\./g,"")}return Number(text)}
function positive(value){const n=localizedNumber(value);return Number.isFinite(n)&&n>=0?n:null}
function value(root,name){return root.querySelector(`[name="${name}"]`)?.value?.trim?.()||""}
function clean(value){return String(value||"").replace(/\u00a0/g," ").replace(/\s+/g," ").trim()}
function formatBytes(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1048576).toFixed(1)} MB`}
function escapeHtml(value){return String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char]))}

function install(){patchSave();enhanceAll();const root=document.querySelector("#modal-root");if(!root)return;observer=new MutationObserver(schedule);observe()}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install,{once:true});else install();
