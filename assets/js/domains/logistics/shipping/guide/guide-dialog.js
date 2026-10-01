import { fmt } from "../../../../core/format.js";
import { modal, toast } from "../../../../core/ui.js";
import { activeTask } from "../shared/shipping-status.js";
import { storeShippingFile } from "../files/shipping-file.js";
import { readShippingGuideFile } from "./reader.js";
import { buildShippingGuidePayload } from "./payload.js";
import { saveShippingGuideExplicit } from "./save-guide.js";

export function openGuideDialog(data,delivery,{reload,refreshLists}={}){
  const existing=existingGuidePayload(delivery);
  const dialogHandle=modal({
    title:"Agregar guía",
    confirmLabel:"Guardar guía",
    size:"wide shipping-guide-reader-v11101",
    body:guideBody(existing),
    onConfirm:async dialog=>{
      const file=selectedGuideFile(dialog);
      let fileId=existing.guideFileId||null;
      if(file){
        const uploaded=await storeShippingFile(data,file,"SHIPPING_GUIDE",activeTask(data)?.id);
        fileId=uploaded?.file?.id||null;
      }
      const payload=buildShippingGuidePayload({
        existingPayload:existing,
        trackingNumber:value(dialog,"trackingNumber"),
        carrier:value(dialog,"carrier"),
        carrierInvoiceNumber:value(dialog,"carrierInvoiceNumber"),
        carrierCost:value(dialog,"carrierCost"),
        carrierCostCurrency:"COP",
        guideFileId:fileId
      });
      await saveShippingGuideExplicit(data.order.id,payload);
      toast("Guía guardada. Revisa los datos y continúa.","success",5000);
      refreshLists?.();
      setTimeout(()=>reload?.(),80);
    }
  });
  const dialog=dialogHandle.root.querySelector(".shipping-guide-reader-v11101");
  bindGuideReader(dialog);
  return dialogHandle;
}

export function bindGuideReader(dialog){
  if(!dialog||dialog.dataset.guideReaderBound==="1")return dialog;
  dialog.dataset.guideReaderBound="1";
  const input=dialog.querySelector('[name="guideFile"]');
  const zone=dialog.querySelector("[data-guide-dropzone]");
  const choose=dialog.querySelector("[data-guide-choose]");

  choose?.addEventListener("click",event=>{event.stopPropagation();input?.click()});
  zone?.addEventListener("click",event=>{if(!event.target.closest?.("button"))input?.click()});
  zone?.addEventListener("keydown",event=>{
    if(event.key==="Enter"||event.key===" "){event.preventDefault();input?.click()}
  });
  zone?.addEventListener("dragover",event=>{event.preventDefault();zone.classList.add("dragging")});
  zone?.addEventListener("dragleave",()=>zone.classList.remove("dragging"));
  zone?.addEventListener("drop",event=>{
    event.preventDefault();
    zone.classList.remove("dragging");
    const file=event.dataTransfer?.files?.[0];
    if(!file)return;
    dialog.__shippingGuideFile=file;
    readGuideIntoDialog(dialog,file).catch(()=>{});
  });
  input?.addEventListener("change",()=>{
    const file=input.files?.[0];
    if(!file)return;
    dialog.__shippingGuideFile=file;
    readGuideIntoDialog(dialog,file).catch(()=>{});
  });
  dialog.querySelectorAll(".guide-reader-field-v11101 input").forEach(control=>{
    control.addEventListener("input",()=>markManual(dialog,control));
  });
  return dialog;
}

export async function readGuideIntoDialog(dialog,file,{reader=readShippingGuideFile}={}){
  if(!dialog||!file)return null;
  const title=dialog.querySelector("[data-guide-file-title]");
  const meta=dialog.querySelector("[data-guide-file-meta]");
  if(title)title.textContent=file.name||"Soporte de guía";
  if(meta)meta.textContent=formatBytes(file.size||0);
  updateStatus(dialog,"reading",.04,"Preparando lectura…","El CRM está analizando el soporte.");
  try{
    const result=await reader(file,{onProgress:step=>updateStatus(dialog,"reading",step.progress,step.label,"Puedes corregir cualquier campo incluso después de la lectura.")});
    applyAutoreadValues(dialog,result.parsed);
    const missing=missingGuideFields(result.parsed);
    updateStatus(dialog,missing.length?"review":"ready",1,missing.length?"Lectura terminada · completa lo pendiente":"Datos detectados","Revisa y corrige antes de guardar. "+(missing.length?`No se detectó: ${missing.join(", ")}.`:""));
    return result.parsed;
  }catch(error){
    updateStatus(dialog,"review",1,"Completa manualmente",error?.message||"No fue posible leer el archivo automáticamente.");
    return null;
  }
}

export function applyAutoreadValues(dialog,parsed={}){
  setAuto(dialog,"carrier",parsed.carrier);
  setAuto(dialog,"trackingNumber",parsed.trackingNumber);
  setAuto(dialog,"carrierInvoiceNumber",parsed.carrierInvoiceNumber);
  setAuto(dialog,"carrierCost",parsed.carrierCost?String(parsed.carrierCost):"");
}

function existingGuidePayload(delivery){
  const metadata=delivery?.metadata||{};
  return {
    trackingNumber:delivery?.tracking_number||"",
    carrier:delivery?.carrier||"",
    carrierInvoiceNumber:metadata.carrierInvoiceNumber||"",
    carrierCost:metadata.carrierCost??"",
    carrierCostCurrency:metadata.carrierCostCurrency||"COP",
    guideFileId:metadata.guideFileId||null
  };
}

function guideBody(existing){
  return `
    <section class="guide-reader-hero-v11101"><div class="guide-reader-icon-v11101" aria-hidden="true">↗</div><div><span>GUÍA DE TRANSPORTE</span><h4>Sube el soporte y revisa los datos</h4><p>PDF, imagen o CSV. El CRM intenta leer transportadora, guía, factura del transportador y costo del flete. Los cuatro datos deben quedar completos antes de guardar.</p></div></section>
    <section class="guide-upload-zone-v11101" data-guide-dropzone tabindex="0" role="button" aria-label="Seleccionar soporte de guía"><input name="guideFile" type="file" accept="application/pdf,.pdf,image/*,.csv,text/csv" hidden><div class="guide-upload-mark-v11101">↑</div><div><strong data-guide-file-title>Seleccionar soporte de guía</strong><small data-guide-file-meta>Arrastra aquí o elige PDF, imagen o CSV</small></div><button type="button" class="btn btn-ghost" data-guide-choose>Elegir archivo</button></section>
    <section class="guide-reader-status-v11101" data-guide-reader-state="idle"><div class="guide-reader-status-head-v11101"><strong data-guide-reader-label>Completa los datos o carga un archivo</strong><span data-guide-reader-percent></span></div><div class="guide-reader-progress-v11101"><i data-guide-reader-bar></i></div><small data-guide-reader-message>Si el lector no encuentra algún dato, puedes escribirlo manualmente.</small></section>
    <div class="guide-reader-grid-v11101">
      ${field("Transportadora","carrier",existing.carrier,"Ej. Coordinadora, TCC, Servientrega")}
      ${field("Número de guía","trackingNumber",existing.trackingNumber,"Número o código de seguimiento")}
      ${field("Factura de la transportadora","carrierInvoiceNumber",existing.carrierInvoiceNumber,"Número de factura o cobro del transportador")}
      ${field("Costo del flete (COP)","carrierCost",existing.carrierCost,"0","number",'step="0.01" min="0.01" inputmode="decimal"')}
    </div>
    <div class="guide-reader-help-v11101"><span><b>Automático:</b> el lector completa lo que encuentre.</span><span><b>Manual:</b> puedes editar cualquier campo antes de guardar.</span></div>`;
}

function field(label,name,current,placeholder,type="text",extra=""){
  return `<label class="guide-reader-field-v11101"><span>${fmt.escape(label)} <em>*</em></span><input class="control" name="${name}" type="${type}" value="${fmt.escape(current)}" placeholder="${fmt.escape(placeholder)}" required ${extra}><small data-guide-source="${name}">Editable manualmente</small></label>`;
}

function markManual(dialog,control){
  control.dataset.manual="1";
  const hint=dialog.querySelector(`[data-guide-source="${control.name}"]`);
  if(hint){hint.textContent="Editado manualmente";hint.className="manual"}
}

function setAuto(dialog,name,valueToSet){
  const input=dialog.querySelector(`[name="${name}"]`);
  if(!input||input.dataset.manual==="1"||valueToSet==null||valueToSet==="")return;
  input.value=valueToSet;
  const hint=dialog.querySelector(`[data-guide-source="${name}"]`);
  if(hint){hint.textContent="Leído automáticamente";hint.className="detected"}
}

function missingGuideFields(parsed={}){
  const missing=[];
  if(!parsed.carrier)missing.push("transportadora");
  if(!parsed.trackingNumber)missing.push("guía");
  if(!parsed.carrierInvoiceNumber)missing.push("factura del transportador");
  if(!(parsed.carrierCost>0))missing.push("costo del flete");
  return missing;
}

function selectedGuideFile(dialog){return dialog?.__shippingGuideFile||dialog?.querySelector('[name="guideFile"]')?.files?.[0]||null}
function value(root,name){return root.querySelector(`[name="${name}"]`)?.value?.trim?.()||""}

function updateStatus(dialog,state,progress,label,message){
  const box=dialog.querySelector(".guide-reader-status-v11101");
  if(box)box.dataset.guideReaderState=state;
  const text=dialog.querySelector("[data-guide-reader-label]");
  if(text)text.textContent=label||"Procesando…";
  const numeric=Math.max(0,Math.min(1,Number(progress||0)));
  const percent=dialog.querySelector("[data-guide-reader-percent]");
  if(percent)percent.textContent=state==="reading"?`${Math.round(numeric*100)}%`:"";
  const bar=dialog.querySelector("[data-guide-reader-bar]");
  if(bar)bar.style.width=`${Math.max(5,numeric*100)}%`;
  const detail=dialog.querySelector("[data-guide-reader-message]");
  if(detail)detail.textContent=message||"";
}

function formatBytes(bytes){
  if(bytes<1024)return `${bytes} B`;
  if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;
  return `${(bytes/1048576).toFixed(1)} MB`;
}
