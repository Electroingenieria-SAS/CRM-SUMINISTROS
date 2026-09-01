import {state} from "../core/state.js";
import {fmt} from "../core/format.js";
import {modal,toast,closeDialog,loading,empty} from "../core/ui.js";
import {getSupabase} from "../services/supabase.js";

let installed=false;
let enhanceTimer=null;

async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error){
    const detail=[error.message,error.details,error.hint].filter(Boolean).join(" · ");
    throw new Error(detail||"No fue posible completar la recepción.");
  }
  return data;
}

function esc(value){return fmt.escape(String(value??""))}
function number(value,digits=3){return fmt.number(Number(value||0),digits)}
function currentReceivingStage(){return document.querySelector('.simple-stage-selector [data-step="RECEPCION_MERCANCIA"].active')?"RECEPCION_MERCANCIA":document.querySelector('.simple-stage-selector [data-step="RECEPCION_PEDIDO"].active')?"RECEPCION_PEDIDO":null}
function isReceivingModule(){return state.currentModule==="receiving"}

export function installReceivingV114(){
  if(installed)return;
  installed=true;
  document.addEventListener("click",captureReceivingActions,true);
  const observer=new MutationObserver(scheduleEnhance);
  const app=document.querySelector("#app");
  const modalRoot=document.querySelector("#modal-root");
  if(app)observer.observe(app,{childList:true,subtree:true});
  if(modalRoot)observer.observe(modalRoot,{childList:true,subtree:true});
  scheduleEnhance();
}

function captureReceivingActions(event){
  const create=event.target?.closest?.("[data-v114-create-receipt]");
  if(create){
    event.preventDefault();event.stopImmediatePropagation();
    const orderId=create.dataset.v114CreateReceipt||null;
    if(create.closest("#modal-root"))closeDialog();
    setTimeout(()=>orderId?openPhysicalReceipt(orderId):openReceiptPicker(),20);
    return;
  }

  const direct=event.target?.closest?.("[data-v114-direct-receipt]");
  if(direct){
    event.preventDefault();event.stopImmediatePropagation();
    const orderId=direct.dataset.order||direct.dataset.v114DirectReceipt;
    if(orderId)openPhysicalReceipt(orderId);
    return;
  }

  const arrived=event.target?.closest?.('[data-arrival="ARRIVED"]');
  if(arrived&&isReceivingModule()){
    const shell=arrived.closest("[data-order-id]");
    const orderId=shell?.dataset.orderId;
    if(orderId){
      event.preventDefault();event.stopImmediatePropagation();
      closeDialog();
      setTimeout(()=>openPhysicalReceipt(orderId),20);
    }
  }
}

function scheduleEnhance(){
  clearTimeout(enhanceTimer);
  enhanceTimer=setTimeout(enhanceReceivingUi,60);
}

function enhanceReceivingUi(){
  if(!isReceivingModule())return;
  const root=document.querySelector("#page-content");
  if(!root)return;

  const actions=root.querySelector(".page-head .page-actions");
  if(actions&&!actions.querySelector("[data-v114-create-receipt]")){
    const button=document.createElement("button");
    button.type="button";
    button.className="btn btn-create v114-create-receipt-head";
    button.dataset.v114CreateReceipt="";
    button.innerHTML='<span class="v114-plus">+</span><span>Crear recepción</span>';
    actions.prepend(button);
  }

  const panel=root.querySelector(".simple-queue-panel");
  if(panel&&!root.querySelector("[data-v114-receiving-entry]")){
    const entry=document.createElement("section");
    entry.className="v114-receiving-entry";
    entry.dataset.v114ReceivingEntry="1";
    entry.innerHTML=`
      <div class="v114-receiving-entry-icon">▣</div>
      <div class="v114-receiving-entry-copy">
        <span>Recepción física</span>
        <strong>Registra la mercancía cuando llegue a la sede</strong>
        <p>Selecciona el pedido u orden de compra, registra cantidades, Compra/Devolución, novedades y verificación. El CRM genera consecutivo, código de barras y QR.</p>
      </div>
      <div class="v114-receiving-entry-actions">
        <button type="button" class="btn btn-create" data-v114-create-receipt>Crear recepción de mercancía</button>
        <small>Si el PVE sigue en Compras, la recepción física se registra sin cerrar Compras.</small>
      </div>`;
    panel.before(entry);
  }

  if(currentReceivingStage()==="RECEPCION_MERCANCIA"){
    root.querySelectorAll("#queue-result [data-order]").forEach(button=>{
      button.dataset.v114DirectReceipt=button.dataset.order||"1";
      button.classList.add("v114-direct-receipt");
      button.textContent="Crear recepción";
    });
  }

  const purchaseModal=document.querySelector("#modal-root .purchase-shadow-modal[data-order-id]");
  if(purchaseModal){
    const orderId=purchaseModal.dataset.orderId;
    const actionArea=purchaseModal.querySelector(".purchase-shadow-actions");
    if(actionArea&&orderId&&!actionArea.querySelector("[data-v114-create-receipt]")){
      const button=document.createElement("button");
      button.type="button";
      button.className="btn btn-create btn-large";
      button.dataset.v114CreateReceipt=orderId;
      button.textContent="Crear recepción física";
      actionArea.append(button);
      const note=document.createElement("p");
      note.className="v114-purchase-receipt-note";
      note.textContent="La llegada física debe quedar registrada con cantidades, verificación, consecutivo y evidencia trazable.";
      actionArea.append(note);
    }
  }
}

export async function openReceiptPicker(){
  try{
    const rows=await rpc("erp_x_receipt_candidates",{p_search:null,p_limit:120});
    const view=modal({
      title:"Crear recepción de mercancía",
      confirmLabel:rows.length?"Crear recepción":"Cerrar",
      cancelLabel:"Cancelar",
      size:"wide",
      body:`
        <section class="v114-picker-head">
          <div><span>Recepción física</span><strong>Selecciona el pedido que llegó</strong><p>También aparecen PVE que todavía están en Compras; registrar la llegada física no cierra el proceso de Compras.</p></div>
          <label class="v114-picker-search"><span>Buscar</span><input class="control" type="search" placeholder="Pedido, cliente, OC o proveedor…" data-v114-candidate-search></label>
        </section>
        <div data-v114-candidate-list>${rows.length?candidateList(rows):empty("No hay pedidos disponibles","No existen PVE en Compras ni pedidos en Recepción de mercancía disponibles para registrar.")}</div>`,
      onConfirm:async dialog=>{
        if(!rows.length)return;
        const selected=dialog.querySelector('[name="v114Candidate"]:checked')?.value;
        if(!selected)throw new Error("Selecciona el pedido que vas a recibir.");
        setTimeout(()=>openPhysicalReceipt(selected),50);
      }
    });
    const search=view.root.querySelector("[data-v114-candidate-search]");
    const list=view.root.querySelector("[data-v114-candidate-list]");
    if(search&&list)search.addEventListener("input",()=>{
      const q=normalize(search.value);
      const filtered=rows.filter(row=>normalize(`${row.orderNumber} ${row.clientName} ${row.purchaseOrder||""} ${row.supplierName||""}`).includes(q));
      list.innerHTML=filtered.length?candidateList(filtered):empty("Sin coincidencias","Prueba con número de pedido, cliente, orden de compra o proveedor.");
    });
  }catch(error){toast(error.message||String(error),"error",7500)}
}

function candidateList(rows){
  return `<div class="v114-candidate-list">${rows.map(row=>{
    const inPurchase=row.currentStep==="COMPRAS";
    const progress=Number(row.receiptCount||0)>0?`${row.receiptCount} recepción${Number(row.receiptCount)===1?"":"es"} previa${Number(row.receiptCount)===1?"":"s"}`:"Sin recepción creada";
    return `<label class="v114-candidate-card">
      <input type="radio" name="v114Candidate" value="${esc(row.id)}">
      <span class="v114-candidate-marker"></span>
      <div class="v114-candidate-main"><span>${inPurchase?"PVE · EN COMPRAS":"RECEPCIÓN DE MERCANCÍA"}</span><strong>${esc(row.orderNumber)}</strong><small>${esc(row.clientName)}</small></div>
      <div class="v114-candidate-meta"><span><small>Orden de compra</small><b>${esc(row.purchaseOrder||"—")}</b></span><span><small>Proveedor</small><b>${esc(row.supplierName||"—")}</b></span><span><small>Registro</small><b>${esc(progress)}</b></span></div>
      <i>›</i>
    </label>`;
  }).join("")}</div>`;
}

export async function openPhysicalReceipt(orderId){
  try{
    const data=await rpc("erp_x_receipt_prepare",{p_order_id:orderId});
    if(data.complete){
      openCompletedReceipt(data);
      return;
    }
    const items=(data.items||[]).filter(item=>Number(item.remainingQuantity||0)>0.0001);
    if(!items.length){openCompletedReceipt(data);return}
    const po=data.purchaseOrder||{};
    const inPurchase=data.order.currentStep==="COMPRAS";
    const requestId=crypto.randomUUID?.()||`receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const view=modal({
      title:"Nueva recepción de mercancía",
      confirmLabel:"Guardar recepción",
      cancelLabel:"Cancelar",
      size:"wide",
      body:`
        <section class="v114-receipt-hero ${inPurchase?"purchase":"ready"}">
          <div><span>${inPurchase?"RECEPCIÓN FÍSICA ANTICIPADA":"RECEPCIÓN DE MERCANCÍA"}</span><strong>${esc(data.order.orderNumber)}</strong><p>${esc(data.order.clientName)}${inPurchase?" · El pedido permanece en Compras después de guardar.":" · Esta recepción puede finalizar la etapa cuando quede completa y conforme."}</p></div>
          <div class="v114-receipt-hero-state"><small>Etapa actual</small><b>${inPurchase?"Compras":"Recepción"}</b></div>
        </section>

        <div class="v114-receipt-status" role="radiogroup" aria-label="Resultado de la recepción">
          <label><input type="radio" name="receiptStatus" value="CONFORMING" checked><span><strong>Conforme</strong><small>Todo lo pendiente llegó y fue aceptado.</small></span></label>
          <label><input type="radio" name="receiptStatus" value="PARTIAL"><span><strong>Parcial</strong><small>Llegó solo una parte; el saldo queda pendiente.</small></span></label>
          <label><input type="radio" name="receiptStatus" value="NONCONFORMING"><span><strong>Con novedad</strong><small>Hay rechazo, avería, faltante o problema documental.</small></span></label>
        </div>

        <section class="v114-form-section">
          <header><div><span>1</span><strong>Identificación de la recepción</strong></div><small>El consecutivo, QR y código de barras se generan automáticamente.</small></header>
          <div class="form-grid">
            <div class="field"><label>Tipo *</label><select class="control" name="receiptType" required><option value="PURCHASE" selected>Compra</option><option value="RETURN">Devolución</option></select></div>
            <div class="field"><label>Prefijo *</label><input class="control" name="documentPrefix" value="REC" minlength="2" maxlength="8" required></div>
            <div class="field"><label>Orden de compra</label><input class="control" name="purchaseOrder" value="${esc(po.poNumber||"")}"></div>
            <div class="field"><label>Proveedor / origen</label><input class="control" name="supplierName" value="${esc(po.supplierName||"")}"></div>
            <div class="field"><label>Ubicación *</label><input class="control" name="location" value="RECEPCION" required></div>
            <div class="field"><label>Lote común</label><input class="control" name="commonLot" placeholder="Opcional"></div>
          </div>
        </section>

        <section class="v114-form-section">
          <header><div><span>2</span><strong>Material recibido</strong></div><small>Recibido = Aceptado + Rechazado. Puedes dejar una línea en cero cuando la recepción sea parcial.</small></header>
          <div class="v114-receipt-lines">${items.map(receiptLine).join("")}</div>
        </section>

        <section class="v114-form-section" data-v114-novelty-section>
          <header><div><span>3</span><strong>Novedades</strong></div><small>Clasifica la novedad para que quede trazable y pueda revisarse posteriormente.</small></header>
          <div class="form-grid">
            <div class="field"><label>Tipo de novedad</label><select class="control" name="noveltyType"><option value="">Sin novedad</option><option value="SHORTAGE">Faltante</option><option value="EXCESS">Sobrante</option><option value="DAMAGED">Avería</option><option value="WRONG_ITEM">Material incorrecto</option><option value="DOCUMENT">Documento / factura</option><option value="QUALITY">Calidad</option><option value="OTHER">Otra</option></select></div>
            <div class="field"><label>Severidad</label><select class="control" name="noveltySeverity"><option value="LOW">Baja</option><option value="MEDIUM" selected>Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></div>
            <div class="field full"><label>Detalle de la novedad</label><textarea class="control" name="noveltyNote" rows="3" placeholder="Describe qué llegó diferente, dañado, incompleto o con problema documental."></textarea></div>
          </div>
        </section>

        <section class="v114-form-section">
          <header><div><span>4</span><strong>Verificación e información levantada</strong></div><small>La verificación queda asociada al usuario que registra la recepción.</small></header>
          <div class="form-grid">
            <label class="v114-verified full"><input type="checkbox" name="verified" checked><span><strong>Recepción verificada</strong><small>Registra automáticamente quién verificó y la fecha.</small></span></label>
            <div class="field full"><label>Información levantada</label><textarea class="control" name="informationCaptured" rows="3" placeholder="Referencias, estado del empaque, factura, observaciones del proveedor, placas, sellos u otros datos relevantes."></textarea></div>
            <div class="field full"><label>Nota de verificación</label><textarea class="control" name="verificationNote" rows="2" placeholder="Resultado de la revisión física y documental."></textarea></div>
            <div class="field full"><label>Observación general</label><textarea class="control" name="generalNote" rows="2"></textarea></div>
          </div>
        </section>`,
      onConfirm:async dialog=>{
        const status=dialog.querySelector('[name="receiptStatus"]:checked')?.value||"CONFORMING";
        const location=dialog.querySelector('[name="location"]').value.trim();
        const commonLot=dialog.querySelector('[name="commonLot"]').value.trim();
        const lines=collectLines(dialog,items,location,commonLot,status);
        if(!lines.length)throw new Error("Registra al menos una cantidad recibida mayor que cero.");
        const noveltyType=dialog.querySelector('[name="noveltyType"]').value||null;
        const noveltyNote=dialog.querySelector('[name="noveltyNote"]').value.trim()||null;
        if(status==="NONCONFORMING"&&!noveltyType)throw new Error("Selecciona el tipo de novedad.");
        if(status==="NONCONFORMING"&&!noveltyNote)throw new Error("Describe la novedad encontrada.");

        const payload={
          requestId,
          purchaseOrder:dialog.querySelector('[name="purchaseOrder"]').value.trim()||null,
          supplierName:dialog.querySelector('[name="supplierName"]').value.trim()||null,
          status,
          lines,
          metadata:{
            receiptType:dialog.querySelector('[name="receiptType"]').value,
            documentPrefix:dialog.querySelector('[name="documentPrefix"]').value.trim().toUpperCase(),
            noveltyType,noveltySeverity:dialog.querySelector('[name="noveltySeverity"]').value,noveltyNote,
            verified:dialog.querySelector('[name="verified"]').checked,
            verificationNote:dialog.querySelector('[name="verificationNote"]').value.trim()||null,
            informationCaptured:dialog.querySelector('[name="informationCaptured"]').value.trim()||null,
            generalNote:dialog.querySelector('[name="generalNote"]').value.trim()||null,
            uiVersion:"11.4.0"
          }
        };

        const result=await rpc("erp_x_create_physical_receipt",{p_order_id:orderId,p_payload:payload});
        let finalization=null;
        if(result.complete&&result.canFinalize&&status==="CONFORMING"){
          finalization=await rpc("erp_x_receipt_finalize",{p_order_id:orderId});
        }
        window.__erpQueueRefresh?.();window.__erpOrderListRefresh?.();
        setTimeout(()=>openReceiptSaved(result,finalization,data.order),60);
      }
    });
    bindReceiptForm(view.root);
  }catch(error){toast(error.message||String(error),"error",8000)}
}

function receiptLine(item){
  const remaining=Number(item.remainingQuantity||0);
  return `<article class="v114-receipt-line" data-v114-line="${esc(item.orderItemId)}">
    <div class="v114-receipt-line-main"><span>Línea ${esc(item.lineNumber||"")}</span><strong>${esc(item.sku||item.reference||item.description)}</strong><small>${esc(item.description||"")} · Pendiente ${number(remaining)} ${esc(item.unit||"UND")}</small></div>
    <label><span>Recibido</span><input class="control" type="number" step="any" min="0" name="received" value="${remaining}"></label>
    <label><span>Aceptado</span><input class="control" type="number" step="any" min="0" max="${remaining}" name="accepted" value="${remaining}"></label>
    <label><span>Rechazado</span><input class="control" type="number" step="any" min="0" name="rejected" value="0"></label>
    <label><span>Lote</span><input class="control" name="lotNumber" placeholder="Opcional"></label>
  </article>`;
}

function bindReceiptForm(root){
  const type=root.querySelector('[name="receiptType"]');
  const prefix=root.querySelector('[name="documentPrefix"]');
  type?.addEventListener("change",()=>{if(prefix)prefix.value=type.value==="RETURN"?"DEV":"REC"});

  const syncNovelty=()=>{
    const status=root.querySelector('[name="receiptStatus"]:checked')?.value||"CONFORMING";
    const typeField=root.querySelector('[name="noveltyType"]');
    const note=root.querySelector('[name="noveltyNote"]');
    if(typeField)typeField.required=status==="NONCONFORMING";
    if(note)note.required=status==="NONCONFORMING";
    root.querySelector("[data-v114-novelty-section]")?.classList.toggle("required",status==="NONCONFORMING");
  };
  root.querySelectorAll('[name="receiptStatus"]').forEach(radio=>radio.addEventListener("change",syncNovelty));
  syncNovelty();

  root.querySelectorAll("[data-v114-line]").forEach(row=>{
    const received=row.querySelector('[name="received"]');
    const accepted=row.querySelector('[name="accepted"]');
    const rejected=row.querySelector('[name="rejected"]');
    received?.addEventListener("input",()=>{
      const r=Number(received.value||0),a=Number(accepted.value||0),x=Number(rejected.value||0);
      if(a+x>r&&x===0)accepted.value=String(Math.max(0,r));
    });
  });
}

function collectLines(dialog,items,location,commonLot,status){
  const rows=[];
  dialog.querySelectorAll("[data-v114-line]").forEach(row=>{
    const item=items.find(x=>String(x.orderItemId)===String(row.dataset.v114Line));
    if(!item)return;
    const received=Number(row.querySelector('[name="received"]').value||0);
    const accepted=Number(row.querySelector('[name="accepted"]').value||0);
    const rejected=Number(row.querySelector('[name="rejected"]').value||0);
    const remaining=Number(item.remainingQuantity||0);
    if(!Number.isFinite(received)||!Number.isFinite(accepted)||!Number.isFinite(rejected)||received<0||accepted<0||rejected<0)throw new Error(`Revisa las cantidades de la línea ${item.lineNumber}.`);
    if(received<=0.000001)return;
    if(Math.abs(accepted+rejected-received)>0.0001)throw new Error(`En la línea ${item.lineNumber}, Aceptado + Rechazado debe ser igual a Recibido.`);
    if(accepted>remaining+0.0001)throw new Error(`La cantidad aceptada de la línea ${item.lineNumber} supera lo pendiente.`);
    if(status==="CONFORMING"&&(Math.abs(accepted-remaining)>0.0001||rejected>0.0001||Math.abs(received-remaining)>0.0001))throw new Error(`Una recepción Conforme debe aceptar exactamente todo lo pendiente. Revisa la línea ${item.lineNumber} o usa Parcial/Con novedad.`);
    rows.push({
      orderItemId:item.orderItemId,
      receivedQuantity:received,acceptedQuantity:accepted,rejectedQuantity:rejected,
      location,lotNumber:row.querySelector('[name="lotNumber"]').value.trim()||commonLot||null,
      qualityStatus:rejected>0?"REJECTED":"ACCEPTED",
      metadata:{materialMasterId:item.materialMasterId||null,materialVariantId:item.materialVariantId||null,uiVersion:"11.4.0"}
    });
  });
  if(status==="CONFORMING"&&rows.length!==items.length)throw new Error("Una recepción Conforme debe registrar todas las líneas pendientes.");
  return rows;
}

function openCompletedReceipt(data){
  const latest=(data.receipts||[])[0]||null;
  const canFinalize=Boolean(data.canFinalize);
  const view=modal({
    title:"Recepción física ya registrada",
    confirmLabel:canFinalize?"Finalizar recepción":"Cerrar",
    cancelLabel:"Cerrar",
    size:"wide",
    body:`
      <section class="v114-complete-state"><span>✓</span><div><strong>${latest?.receipt_number?esc(latest.receipt_number):"Cantidades completas"}</strong><p>${canFinalize?"Todas las cantidades ya están recibidas. Puedes finalizar la etapa de Recepción sin volver a crear líneas.":"La recepción física ya está completa y el pedido continúa en Compras. No debes duplicar la recepción."}</p></div></section>
      ${latest?receiptSummary(latest):""}`,
    onConfirm:async()=>{
      if(!canFinalize)return;
      const finalization=await rpc("erp_x_receipt_finalize",{p_order_id:data.order.id});
      window.__erpQueueRefresh?.();window.__erpOrderListRefresh?.();
      toast(`Recepción finalizada. El pedido continuó a ${fmt.step(finalization.currentStep||"")}.`,"success",7000);
    }
  });
  if(latest){
    const body=view.root.querySelector(".modal-body");
    const print=document.createElement("button");print.type="button";print.className="btn btn-ghost v114-print-existing";print.textContent="Imprimir etiqueta QR + código";print.onclick=()=>printReceiptLabel(latest,data.order);body?.append(print);
  }
}

function openReceiptSaved(result,finalization,order){
  const receipt=result.receipt||{};
  const workflowPending=Boolean(result.workflowPending);
  const view=modal({
    title:"Recepción creada correctamente",
    confirmLabel:"Cerrar",
    cancelLabel:"Cerrar",
    size:"wide",
    body:`
      <section class="v114-saved-state"><span>✓</span><div><small>RECEPCIÓN REGISTRADA</small><strong>${esc(receipt.receipt_number||"Recepción guardada")}</strong><p>${finalization?`La etapa quedó finalizada y el pedido continuó a ${esc(fmt.step(finalization.currentStep||""))}.`:workflowPending?"La mercancía quedó registrada físicamente. Compras continúa activa; cuando libere el pedido, Recepción reconocerá lo que ya fue recibido.":result.complete?"Las cantidades quedaron completas. Revisa cualquier novedad antes de finalizar la etapa.":"La recepción quedó parcial; las cantidades pendientes seguirán disponibles para una recepción posterior."}</p></div></section>
      ${receiptSummary(receipt)}
      <div class="v114-saved-actions"><button type="button" class="btn btn-primary" data-v114-print-saved>Imprimir etiqueta QR + código de barras</button></div>`,
    onConfirm:async()=>{}
  });
  view.root.querySelector("[data-v114-print-saved]")?.addEventListener("click",()=>printReceiptLabel(receipt,order));
  toast(`Recepción ${receipt.receipt_number||""} registrada.`,"success",6500);
}

function receiptSummary(receipt){
  return `<section class="v114-receipt-summary">
    <div><small>Tipo</small><strong>${receipt.receipt_type==="RETURN"?"Devolución":"Compra"}</strong></div>
    <div><small>Prefijo</small><strong>${esc(receipt.document_prefix||"REC")}</strong></div>
    <div><small>Consecutivo</small><strong>${esc(receipt.consecutive_no||"—")}</strong></div>
    <div><small>Estado</small><strong>${esc(fmt.label(receipt.status||""))}</strong></div>
    <div><small>Novedad</small><strong>${receipt.novelty_status==="OPEN"?esc(receipt.novelty_type||"Abierta"):"Sin novedad abierta"}</strong></div>
    <div><small>Verificación</small><strong>${receipt.verified_at?"Verificada":"Pendiente"}</strong></div>
  </section>`;
}

function printReceiptLabel(receipt,order={}){
  try{
    if(!window.JsBarcode||!window.qrcode)throw new Error("Los componentes de QR/código de barras todavía no están disponibles.");
    const number=receipt.receipt_number||"Recepción";
    const barcode=String(receipt.barcode_value||`CRM-REC|${number}`);
    const qrValue=typeof receipt.qr_value==="string"?receipt.qr_value:JSON.stringify(receipt.qr_value||{type:"CRM_RECEIPT",number,order:order.orderNumber||order.order_number||null});
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    window.JsBarcode(svg,barcode,{format:"CODE128",displayValue:true,fontSize:13,height:50,margin:6});
    const qr=window.qrcode(0,"M");qr.addData(qrValue);qr.make();
    const qrUrl=qr.createDataURL(5,2);
    const win=window.open("","_blank","width=900,height=700");
    if(!win)throw new Error("El navegador bloqueó la ventana de impresión. Habilita ventanas emergentes para este sitio.");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(number)}</title><style>body{font-family:Arial,sans-serif;margin:12mm;color:#111}.label{border:2px solid #111;border-radius:14px;padding:10mm;max-width:185mm}.top{display:flex;justify-content:space-between;gap:10mm;border-bottom:1px solid #bbb;padding-bottom:5mm}.top h1{margin:2mm 0 0;font-size:25px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm 8mm;margin:7mm 0}.grid div{border:1px solid #ddd;border-radius:8px;padding:4mm}.grid small{display:block;text-transform:uppercase;color:#555;font-size:10px}.codes{display:grid;grid-template-columns:1fr 46mm;align-items:center;gap:8mm;border-top:1px solid #bbb;padding-top:6mm}.codes svg{max-width:100%;height:auto}.codes img{width:42mm;height:42mm}@media print{body{margin:4mm}.label{max-width:none}}</style></head><body><section class="label"><div class="top"><div><small>Recepción de mercancía</small><h1>${esc(number)}</h1><strong>${receipt.receipt_type==="RETURN"?"DEVOLUCIÓN":"COMPRA"}</strong></div><div><small>Pedido</small><h2>${esc(order.orderNumber||order.order_number||"—")}</h2></div></div><div class="grid"><div><small>Orden de compra</small><strong>${esc(receipt.purchase_order||"—")}</strong></div><div><small>Proveedor</small><strong>${esc(receipt.supplier_name||"—")}</strong></div><div><small>Prefijo / consecutivo</small><strong>${esc(receipt.document_prefix||"REC")} · ${esc(receipt.consecutive_no||"—")}</strong></div><div><small>Estado</small><strong>${esc(fmt.label(receipt.status||""))}</strong></div><div><small>Novedad</small><strong>${receipt.novelty_status==="OPEN"?esc(receipt.novelty_type||"Abierta"):"Sin novedad abierta"}</strong></div><div><small>Verificación</small><strong>${receipt.verified_at?"Verificada":"Pendiente"}</strong></div></div><div class="codes"><div>${svg.outerHTML}</div><img src="${qrUrl}" alt="Código QR"></div></section><script>window.addEventListener('load',()=>window.print(),{once:true});<\/script></body></html>`);
    win.document.close();
  }catch(error){toast(error.message||String(error),"error",7000)}
}

function normalize(value){return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
