import {renderQueue} from "./queue.js";
import {state} from "../core/state.js";
import {fmt} from "../core/format.js";
import {modal,toast,closeDialog,loading,empty} from "../core/ui.js";
import {getSupabase} from "../services/supabase.js";
import {materialPickerHtml,bindMaterialPicker,readMaterialPicker} from "../services/materials.js";

let domainInstalled=false;
let activeView="GOODS";

async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error){
    const detail=[error.message,error.details,error.hint].filter(Boolean).join(" · ");
    throw new Error(detail||"No fue posible completar la operación de Recepción.");
  }
  return data;
}
function esc(value){return fmt.escape(String(value??""))}
function normalize(value){return String(value??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase()}
function n(value){const x=Number(value);return Number.isFinite(x)?x:0}
function dateInput(date=new Date()){return new Date(date).toISOString().slice(0,10)}

export function installReceivingDomainV115(){
  if(domainInstalled)return;
  domainInstalled=true;
  document.addEventListener("click",event=>{
    const arrival=event.target?.closest?.('[data-arrival="ARRIVED"]');
    if(!arrival)return;
    const shell=arrival.closest(".purchase-shadow-modal[data-order-id]");
    if(!shell)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const orderId=shell.dataset.orderId;
    closeDialog();
    setTimeout(()=>openGoodsReceiptFormForPve(orderId),30);
  },true);
  const root=document.querySelector("#modal-root");
  if(root){
    const observer=new MutationObserver(()=>enhancePurchaseShadow(root));
    observer.observe(root,{childList:true,subtree:true});
    enhancePurchaseShadow(root);
  }
}

function enhancePurchaseShadow(root){
  root.querySelectorAll('.purchase-shadow-modal [data-arrival="ARRIVED"]').forEach(button=>{
    if(button.dataset.v115Enhanced==="1")return;
    button.dataset.v115Enhanced="1";
    button.textContent="Registrar recepción de mercancía";
    const note=button.nextElementSibling;
    if(note)note.textContent="Al guardar la recepción de bodega enlazada con este PVE, Mercancía OK se marcará automáticamente.";
  });
  root.querySelectorAll('.purchase-shadow-modal .v114-purchase-receipt-note,[data-v114-create-receipt]').forEach(node=>node.remove());
}

export async function renderReceivingHub(root){
  activeView="GOODS";
  root.innerHTML=`
    <section class="page-head v115-receiving-head">
      <div><span class="v115-kicker">Dos procesos · una sola área</span><h2>Recepción</h2><p>Separa el ingreso físico a bodega de la validación logística de pedidos.</p></div>
      <div class="page-actions"><button type="button" class="btn btn-help" data-v113-guide-module>Guía de Recepción</button></div>
    </section>
    <section class="v115-process-switch" aria-label="Procesos de Recepción">
      <button type="button" class="v115-process-card active" data-v115-view="GOODS">
        <span class="v115-process-icon">▣</span><div><small>PROCESO DE BODEGA</small><strong>Recepción de mercancía</strong><p>Recibe compras, registra materiales e ingresa existencias al sistema y a bodega.</p></div><em>Independiente de pedidos</em>
      </button>
      <button type="button" class="v115-process-card" data-v115-view="ORDER">
        <span class="v115-process-icon">✓</span><div><small>PROCESO DEL PEDIDO</small><strong>Recepción de pedido</strong><p>Valida la información comercial y asigna responsables para continuar el pedido.</p></div><em>Sí modifica el flujo del pedido</em>
      </button>
    </section>
    <div id="receiving-v115-content">${loading("Preparando Recepción de mercancía…")}</div>`;
  root.querySelectorAll("[data-v115-view]").forEach(button=>button.addEventListener("click",()=>switchView(root,button.dataset.v115View)));
  await renderGoodsReceiving(root.querySelector("#receiving-v115-content"));
}

async function switchView(root,view){
  if(view===activeView)return;
  activeView=view;
  root.querySelectorAll("[data-v115-view]").forEach(button=>button.classList.toggle("active",button.dataset.v115View===view));
  const host=root.querySelector("#receiving-v115-content");
  host.innerHTML=loading(view==="GOODS"?"Preparando Recepción de mercancía…":"Cargando Recepción de pedido…");
  if(view==="ORDER"){
    host.className="v115-order-host";
    await renderQueue(host,{moduleId:"receiving",steps:["RECEPCION_PEDIDO"],params:{step:"RECEPCION_PEDIDO"}});
  }else{
    host.className="";
    await renderGoodsReceiving(host);
  }
}

async function renderGoodsReceiving(host){
  host.innerHTML=`
    <section class="v115-goods-hero">
      <div class="v115-goods-copy"><span>RECEPCIÓN DE MERCANCÍA</span><h3>Ingreso físico a sistema y bodega</h3><p>Este proceso no crea, mueve ni finaliza pedidos. Puedes registrar una compra directamente o enlazar un PVE solo para centralizar la OC y marcar Mercancía OK.</p></div>
      <div class="v115-goods-actions"><button type="button" class="btn btn-create btn-large" data-v115-new-goods>+ Nueva recepción de mercancía</button><small>PVE opcional · inventario obligatorio</small></div>
    </section>
    <section class="card card-pad v115-goods-list-card">
      <div class="v115-list-toolbar"><div><span>Historial de bodega</span><strong>Recepciones de mercancía</strong></div><div class="v115-list-filters"><input class="control" type="search" placeholder="Recepción, PVE, OC, proveedor o factura…" data-v115-search><input class="control" type="date" data-v115-from><input class="control" type="date" data-v115-to><button type="button" class="btn btn-search" data-v115-filter>Buscar</button></div></div>
      <div data-v115-goods-list>${loading("Consultando recepciones de bodega…")}</div>
    </section>`;
  const today=new Date(),from=new Date(today.getTime()-30*864e5);
  host.querySelector("[data-v115-from]").value=dateInput(from);
  host.querySelector("[data-v115-to]").value=dateInput(today);
  host.querySelector("[data-v115-new-goods]").addEventListener("click",openGoodsReceiptOrigin);
  const load=()=>loadGoodsList(host);
  host.querySelector("[data-v115-filter]").addEventListener("click",load);
  host.querySelector("[data-v115-search]").addEventListener("keydown",event=>{if(event.key==="Enter")load()});
  await load();
}

async function loadGoodsList(host){
  const target=host.querySelector("[data-v115-goods-list]");
  target.innerHTML=loading("Consultando recepciones de bodega…");
  try{
    const rows=await rpc("erp_x_goods_receipt_list",{
      p_search:host.querySelector("[data-v115-search]").value.trim()||null,
      p_from:host.querySelector("[data-v115-from]").value||null,
      p_to:host.querySelector("[data-v115-to]").value||null,
      p_limit:200
    });
    target.innerHTML=rows.length?`<div class="v115-goods-list">${rows.map(goodsReceiptCard).join("")}</div>`:empty("Aún no hay recepciones de mercancía","Crea la primera recepción cuando llegue una compra a bodega.");
    target.querySelectorAll("[data-v115-open-receipt]").forEach(button=>button.addEventListener("click",()=>openGoodsReceiptDetail(button.dataset.v115OpenReceipt)));
  }catch(error){
    target.innerHTML=`<div class="module-error"><strong>No fue posible consultar las recepciones</strong><p>${esc(error.message)}</p></div>`;
  }
}

function goodsReceiptCard(row){
  const linked=Boolean(row.linkedPveId);
  return `<article class="v115-goods-row">
    <div class="v115-goods-id"><span>${row.receiptType==="RETURN"?"DEVOLUCIÓN":"COMPRA"}</span><strong>${esc(row.receiptNumber)}</strong><small>${fmt.date(row.receivedAt)}</small></div>
    <div class="v115-goods-meta"><span><small>Proveedor</small><b>${esc(row.supplierName||"—")}</b></span><span><small>OC / factura</small><b>${esc(row.purchaseOrderNumber||row.invoiceNumber||"—")}</b></span><span><small>Materiales</small><b>${fmt.number(row.lineCount||0)} línea(s)</b></span><span><small>Aceptado</small><b>${fmt.number(row.acceptedQuantity||0,3)}</b></span></div>
    <div class="v115-goods-link ${linked?"linked":"standalone"}"><small>${linked?"PVE ENLAZADO":"INDEPENDIENTE"}</small><strong>${linked?esc(row.linkedPveNumber):"Sin pedido"}</strong>${linked?"<em>Mercancía OK sincronizado</em>":"<em>No afecta pedidos</em>"}</div>
    <button type="button" class="btn btn-primary" data-v115-open-receipt="${esc(row.id)}">Ver recepción</button>
  </article>`;
}

async function openGoodsReceiptOrigin(){
  try{
    const pves=await rpc("erp_x_goods_receipt_pve_candidates",{p_search:null,p_limit:120});
    const view=modal({
      title:"Nueva recepción de mercancía",
      confirmLabel:"Continuar",
      size:"wide",
      body:`
        <section class="v115-dialog-intro"><span>PASO 1</span><strong>¿Quieres enlazar esta recepción con un PVE?</strong><p>El enlace es opcional. Nunca cambia el estado ni la etapa del pedido; solo precarga datos y marca Mercancía OK al guardar.</p></section>
        <div class="v115-source-choice">
          <label><input type="radio" name="sourceMode" value="NONE" checked><span><b>Recepción independiente</b><small>Compra o devolución que llega a bodega sin depender de un pedido.</small></span></label>
          <label class="${pves.length?"":"disabled"}"><input type="radio" name="sourceMode" value="PVE" ${pves.length?"":"disabled"}><span><b>Enlazar con PVE</b><small>Precarga OC, proveedor y materiales. Al guardar marca Mercancía OK.</small></span></label>
        </div>
        <section class="v115-pve-picker" data-v115-pve-picker hidden>
          <div class="field"><label>Buscar PVE</label><input class="control" type="search" placeholder="PVE, cliente, OC o proveedor…" data-v115-pve-search></div>
          <div data-v115-pve-list>${pves.length?pveCards(pves):empty("No hay PVE disponibles","Puedes crear la recepción de forma independiente.")}</div>
        </section>`,
      onConfirm:async dialog=>{
        const mode=dialog.querySelector('[name="sourceMode"]:checked')?.value||"NONE";
        if(mode==="NONE"){
          setTimeout(()=>openGoodsReceiptForm(null),40);
          return;
        }
        const selected=dialog.querySelector('[name="v115Pve"]:checked')?.value;
        if(!selected)throw new Error("Selecciona el PVE que deseas enlazar.");
        const detail=await rpc("erp_x_goods_receipt_pve_detail",{p_order_id:selected});
        setTimeout(()=>openGoodsReceiptForm(detail),40);
      }
    });
    const picker=view.root.querySelector("[data-v115-pve-picker]");
    view.root.querySelectorAll('[name="sourceMode"]').forEach(input=>input.addEventListener("change",()=>picker.hidden=input.value!=="PVE"||!input.checked));
    const search=view.root.querySelector("[data-v115-pve-search]"),list=view.root.querySelector("[data-v115-pve-list]");
    search?.addEventListener("input",()=>{
      const q=normalize(search.value);
      const filtered=pves.filter(row=>normalize(`${row.orderNumber} ${row.clientName} ${row.purchaseOrder||""} ${row.supplierName||""}`).includes(q));
      list.innerHTML=filtered.length?pveCards(filtered):empty("Sin coincidencias","Busca por PVE, cliente, OC o proveedor.");
    });
  }catch(error){toast(error.message,"error",7500)}
}

function pveCard(row){
  let arrivalLabel="Sin recepción";
  if(row.arrivalStatus==="ARRIVED")arrivalLabel="Mercancía OK";
  else if(row.warehouseReceiptCount)arrivalLabel=`${row.warehouseReceiptCount} recepción(es)`;
  return `<label class="v115-pve-card"><input type="radio" name="v115Pve" value="${esc(row.id)}"><span></span><div><small>PVE · ${esc(fmt.step(row.currentStep))}</small><strong>${esc(row.orderNumber)}</strong><p>${esc(row.clientName)}</p></div><div><small>Orden de compra</small><b>${esc(row.purchaseOrder||"—")}</b><small>Proveedor</small><b>${esc(row.supplierName||"—")}</b></div><em>${esc(arrivalLabel)}</em></label>`;
}
function pveCards(rows){return `<div class="v115-pve-list">${rows.map(pveCard).join("")}</div>`}

async function openGoodsReceiptFormForPve(orderId){
  try{
    const detail=await rpc("erp_x_goods_receipt_pve_detail",{p_order_id:orderId});
    openGoodsReceiptForm(detail);
  }catch(error){toast(error.message,"error",7500)}
}

function openGoodsReceiptForm(pveDetail){
  const linked=Boolean(pveDetail?.order?.id);
  const po=pveDetail?.purchaseOrder||{};
  const initial=(pveDetail?.items||[]).map(item=>({
    orderItemId:item.orderItemId,materialMasterId:item.materialMasterId,materialVariantId:item.materialVariantId,reference:item.reference||item.sku,
    description:item.description,unit:item.unit||"UND",expected:item.quantity,received:item.quantity,accepted:item.quantity,rejected:0,location:"RECEPCION",lot:""
  }));
  const lines=initial.length?initial:[blankGoodsLine()];
  const requestId=crypto.randomUUID?.()||`goods-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const view=modal({
    title:"Recepción de mercancía · ingreso a bodega",
    confirmLabel:"Guardar e ingresar a bodega",
    size:"wide",
    body:`
      <section class="v115-receipt-banner ${linked?"linked":"standalone"}"><div><span>${linked?"PVE ENLAZADO":"RECEPCIÓN INDEPENDIENTE"}</span><strong>${linked?esc(pveDetail.order.orderNumber):"Ingreso físico de mercancía"}</strong><p>${linked?"El PVE solo aporta contexto. Esta recepción no cambia su etapa ni su estado.":"No necesitas un pedido para registrar esta entrada a bodega."}</p></div><div><small>Efecto sobre pedidos</small><b>${linked?"Mercancía OK únicamente":"Ninguno"}</b></div></section>
      <div class="v115-receipt-status" role="radiogroup"><label><input type="radio" name="receiptStatus" value="CONFORMING" checked><span><b>Conforme</b><small>Mercancía aceptada.</small></span></label><label><input type="radio" name="receiptStatus" value="PARTIAL"><span><b>Parcial</b><small>Ingreso parcial.</small></span></label><label><input type="radio" name="receiptStatus" value="NONCONFORMING"><span><b>Con novedad</b><small>Existe rechazo o incidencia.</small></span></label></div>
      <section class="v115-form-section"><header><span>1</span><div><strong>Documento y origen</strong><small>Identifica la compra o devolución que está entrando a bodega.</small></div></header><div class="form-grid">
        <div class="field"><label>Tipo *</label><select class="control" name="receiptType"><option value="PURCHASE">Compra</option><option value="RETURN">Devolución</option></select></div>
        <div class="field"><label>Prefijo *</label><input class="control" name="documentPrefix" value="REC" minlength="2" maxlength="8" required></div>
        <div class="field"><label>Orden de compra</label><input class="control" name="purchaseOrderNumber" value="${esc(po.poNumber||"")}"></div>
        <div class="field"><label>Proveedor / origen</label><input class="control" name="supplierName" value="${esc(po.supplierName||"")}"></div>
        <div class="field"><label>NIT / documento proveedor</label><input class="control" name="supplierDocument"></div>
        <div class="field"><label>Factura proveedor</label><input class="control" name="invoiceNumber"></div>
        <div class="field"><label>Bodega</label><input class="control" name="warehouseCode" placeholder="Código o nombre"></div>
        <div class="field"><label>Ubicación por defecto *</label><input class="control" name="defaultLocation" value="RECEPCION" required></div>
      </div></section>
      <section class="v115-form-section"><header><span>2</span><div><strong>Materiales recibidos</strong><small>Selecciona siempre el material oficial Siesa. Solo las cantidades aceptadas ingresan al inventario.</small></div></header><div class="v115-goods-lines" data-v115-lines>${lines.map((line,index)=>goodsLineHtml(line,index)).join("")}</div><button type="button" class="btn btn-create" data-v115-add-line>+ Agregar material</button></section>
      <section class="v115-form-section"><header><span>3</span><div><strong>Novedades y verificación</strong><small>La evidencia queda en la recepción de bodega, no en el workflow del pedido.</small></div></header><div class="form-grid">
        <div class="field"><label>Tipo de novedad</label><select class="control" name="noveltyType"><option value="">Sin novedad</option><option value="SHORTAGE">Faltante</option><option value="EXCESS">Sobrante</option><option value="DAMAGED">Avería</option><option value="WRONG_ITEM">Material incorrecto</option><option value="DOCUMENT">Documento / factura</option><option value="QUALITY">Calidad</option><option value="OTHER">Otra</option></select></div>
        <div class="field"><label>Severidad</label><select class="control" name="noveltySeverity"><option value="LOW">Baja</option><option value="MEDIUM" selected>Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></div>
        <div class="field full"><label>Detalle de novedad</label><textarea class="control" name="noveltyNote"></textarea></div>
        <label class="v115-verified full"><input type="checkbox" name="verified" checked><span><b>Recepción verificada</b><small>Registra automáticamente usuario y fecha.</small></span></label>
        <div class="field full"><label>Información levantada</label><textarea class="control" name="informationCaptured" placeholder="Empaque, placas, sellos, factura, referencias, observaciones del proveedor, etc."></textarea></div>
        <div class="field full"><label>Nota de verificación</label><textarea class="control" name="verificationNote"></textarea></div>
        <div class="field full"><label>Observación general</label><textarea class="control" name="generalNote"></textarea></div>
      </div></section>`,
    onConfirm:async dialog=>{
      const payload=collectGoodsReceipt(dialog,pveDetail,requestId);
      const result=await rpc("erp_x_goods_receipt_create",{p_payload:payload});
      const message=linked?`Recepción ${result.receipt.receipt_number} guardada. Mercancía OK quedó marcada en el PVE sin mover su flujo.`:`Recepción ${result.receipt.receipt_number} guardada e ingresada a bodega.`;
      toast(message,"success",8000);
      window.__erpQueueRefresh?.();
      setTimeout(()=>openGoodsReceiptDetail(result.receipt.id),60);
      if(state.currentModule==="receiving"&&activeView==="GOODS")setTimeout(()=>{const host=document.querySelector("#receiving-v115-content");if(host)renderGoodsReceiving(host)},120);
    }
  });
  bindGoodsLines(view.root);
  view.root.querySelector("[data-v115-add-line]").addEventListener("click",()=>{
    const host=view.root.querySelector("[data-v115-lines]");
    host.insertAdjacentHTML("beforeend",goodsLineHtml(blankGoodsLine(),host.children.length));
    bindGoodsLines(view.root);
  });
  const type=view.root.querySelector('[name="receiptType"]'),prefix=view.root.querySelector('[name="documentPrefix"]');
  type.addEventListener("change",()=>{prefix.value=type.value==="RETURN"?"DEV":"REC"});
}

function blankGoodsLine(){return {orderItemId:null,materialMasterId:null,materialVariantId:null,reference:"",description:"",unit:"UND",expected:null,received:"",accepted:"",rejected:0,location:"RECEPCION",lot:""}}
function goodsLineHtml(line,index){
  const expected=line.expected!=null?`<small class="v115-expected">Referencia PVE: ${fmt.number(line.expected,3)} ${esc(line.unit||"UND")}</small>`:"";
  return `<article class="v115-goods-line" data-v115-line data-order-item-id="${esc(line.orderItemId||"")}">
    <div class="v115-line-number">${index+1}</div>
    <div class="v115-line-material">${materialPickerHtml({materialMasterId:line.materialMasterId,materialVariantId:line.materialVariantId,reference:line.reference,name:line.description,unit:line.unit})}${expected}</div>
    <div class="v115-line-qty"><label>Recibido<input class="control" type="number" step="any" min="0" data-field="received" value="${esc(line.received)}"></label><label>Aceptado<input class="control" type="number" step="any" min="0" data-field="accepted" value="${esc(line.accepted)}"></label><label>Rechazado<input class="control" type="number" step="any" min="0" data-field="rejected" value="${esc(line.rejected)}"></label></div>
    <div class="v115-line-lot"><label>Ubicación<input class="control" data-field="location" value="${esc(line.location||"RECEPCION")}"></label><label>Lote<input class="control" data-field="lot" value="${esc(line.lot||"")}"></label></div>
    <button type="button" class="icon-btn" data-v115-remove-line aria-label="Quitar material">×</button>
  </article>`;
}

function bindGoodsLines(root){
  const host=root.querySelector("[data-v115-lines]");
  host.querySelectorAll("[data-v115-line]").forEach(row=>{
    bindMaterialPicker(row.querySelector("[data-material-picker]"));
    const received=row.querySelector('[data-field="received"]'),accepted=row.querySelector('[data-field="accepted"]'),rejected=row.querySelector('[data-field="rejected"]');
    received.oninput=()=>{if(!accepted.dataset.touched)accepted.value=received.value};
    accepted.oninput=()=>{accepted.dataset.touched="1";const r=n(received.value),a=n(accepted.value);rejected.value=String(Math.max(0,r-a))};
    rejected.oninput=()=>{rejected.dataset.touched="1"};
    row.querySelector("[data-v115-remove-line]").onclick=()=>{if(host.children.length<=1)return toast("La recepción necesita al menos un material.","error");row.remove();renumberLines(host)};
  });
}
function renumberLines(host){host.querySelectorAll(".v115-line-number").forEach((node,index)=>node.textContent=String(index+1))}

function collectGoodsReceipt(dialog,pveDetail,requestId){
  const defaultLocation=dialog.querySelector('[name="defaultLocation"]').value.trim()||"RECEPCION";
  const rows=[...dialog.querySelectorAll("[data-v115-line]")];
  const lines=[];
  rows.forEach((row,index)=>{
    const received=n(row.querySelector('[data-field="received"]').value),accepted=n(row.querySelector('[data-field="accepted"]').value),rejected=n(row.querySelector('[data-field="rejected"]').value);
    if(received<=0)return;
    if(Math.abs(accepted+rejected-received)>0.0001)throw new Error(`Línea ${index+1}: aceptado + rechazado debe ser igual a recibido.`);
    let material;
    try{material=readMaterialPicker(row.querySelector("[data-material-picker]"),true)}catch(error){throw new Error(`Línea ${index+1}: ${error.message}`)}
    lines.push({orderItemId:row.dataset.orderItemId||null,materialMasterId:material.materialMasterId,materialVariantId:material.materialVariantId,receivedQuantity:received,acceptedQuantity:accepted,rejectedQuantity:rejected,location:row.querySelector('[data-field="location"]').value.trim()||defaultLocation,lotNumber:row.querySelector('[data-field="lot"]').value.trim()||null,qualityStatus:rejected>0?"REJECTED":"ACCEPTED"});
  });
  if(!lines.length)throw new Error("Registra al menos un material con cantidad recibida mayor que cero.");
  const noveltyType=dialog.querySelector('[name="noveltyType"]').value||null,noveltyNote=dialog.querySelector('[name="noveltyNote"]').value.trim()||null;
  if(noveltyType&&!noveltyNote)throw new Error("Describe la novedad registrada.");
  return {requestId,linkedPveId:pveDetail?.order?.id||null,linkedPurchaseOrderId:pveDetail?.purchaseOrder?.id||null,receiptType:dialog.querySelector('[name="receiptType"]').value,documentPrefix:dialog.querySelector('[name="documentPrefix"]').value.trim().toUpperCase(),status:dialog.querySelector('[name="receiptStatus"]:checked')?.value||"CONFORMING",purchaseOrderNumber:dialog.querySelector('[name="purchaseOrderNumber"]').value.trim()||null,supplierName:dialog.querySelector('[name="supplierName"]').value.trim()||null,supplierDocument:dialog.querySelector('[name="supplierDocument"]').value.trim()||null,invoiceNumber:dialog.querySelector('[name="invoiceNumber"]').value.trim()||null,warehouseCode:dialog.querySelector('[name="warehouseCode"]').value.trim()||null,defaultLocation,noveltyType,noveltySeverity:dialog.querySelector('[name="noveltySeverity"]').value,noveltyNote,verified:dialog.querySelector('[name="verified"]').checked,informationCaptured:dialog.querySelector('[name="informationCaptured"]').value.trim()||null,verificationNote:dialog.querySelector('[name="verificationNote"]').value.trim()||null,generalNote:dialog.querySelector('[name="generalNote"]').value.trim()||null,lines,metadata:{uiVersion:"11.5.1",domain:"WAREHOUSE_RECEIVING"}};
}

async function openGoodsReceiptDetail(id){
  try{
    const data=await rpc("erp_x_goods_receipt_detail",{p_receipt_id:id});
    const r=data.receipt,linked=data.linkedPve;
    const verificationText=r.verified_at?`Verificada · ${esc(data.verifiedBy||"")}`:"Pendiente";
    const relationText=linked?`${esc(linked.orderNumber)} · Mercancía OK`:"Independiente";
    const workflowHtml=linked
      ? `<div class="v115-no-workflow"><strong>✓ PVE enlazado sin modificar workflow</strong><span>Etapa actual: ${esc(fmt.step(linked.currentStep))} · Estado: ${esc(fmt.label(linked.status))}</span></div>`
      : `<div class="v115-no-workflow"><strong>Recepción independiente</strong><span>No existe ni se requiere un pedido para este ingreso de bodega.</span></div>`;
    const linesHtml=(data.lines||[]).map(line=>{
      return `<tr><td><strong>${esc(line.reference)}</strong><small>${esc(line.description)}</small></td><td>${fmt.number(line.receivedQuantity,3)} ${esc(line.unit)}</td><td>${fmt.number(line.acceptedQuantity,3)}</td><td>${fmt.number(line.rejectedQuantity,3)}</td><td>${esc(line.location)}</td><td>${esc(line.lotNumber||"—")}</td></tr>`;
    }).join("");
    const body=`
      <section class="v115-detail-hero"><div><span>RECEPCIÓN DE MERCANCÍA</span><strong>${esc(r.receipt_number)}</strong><p>${esc(r.supplier_name||"Proveedor no informado")} · ${fmt.date(r.received_at)}</p></div><div class="v115-detail-actions"><button type="button" class="btn btn-primary" data-v115-print>Imprimir QR + código</button></div></section>
      <div class="v115-detail-grid"><article><small>Tipo</small><strong>${r.receipt_type==="RETURN"?"Devolución":"Compra"}</strong></article><article><small>Orden de compra</small><strong>${esc(r.purchase_order_number||"—")}</strong></article><article><small>Factura proveedor</small><strong>${esc(r.invoice_number||"—")}</strong></article><article><small>Recibió</small><strong>${esc(data.receivedBy||"—")}</strong></article><article><small>Verificación</small><strong>${verificationText}</strong></article><article><small>Relación con pedido</small><strong>${relationText}</strong></article></div>
      ${workflowHtml}
      <div class="table-wrap v115-detail-lines"><table><thead><tr><th>Material</th><th>Recibido</th><th>Aceptado</th><th>Rechazado</th><th>Ubicación</th><th>Lote</th></tr></thead><tbody>${linesHtml}</tbody></table></div>`;
    const view=modal({title:`Recepción ${r.receipt_number}`,confirmLabel:"Cerrar",size:"wide",body});
    view.root.querySelector("[data-v115-print]")?.addEventListener("click",()=>printGoodsReceipt(data));
  }catch(error){toast(error.message,"error",7500)}
}

function printGoodsReceipt(data){
  try{
    if(!window.JsBarcode||!window.qrcode)throw new Error("Los componentes de QR/código de barras no están disponibles todavía.");
    const r=data.receipt,svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    window.JsBarcode(svg,String(r.barcode_value),{format:"CODE128",displayValue:true,height:52,margin:5,fontSize:13});
    const qr=window.qrcode(0,"M");
    qr.addData(String(r.qr_value));
    qr.make();
    const qrUrl=qr.createDataURL(5,2);
    const win=window.open("","_blank","width=900,height=700");
    if(!win)throw new Error("El navegador bloqueó la ventana de impresión.");
    const linkedLabel=data.linkedPve?esc(data.linkedPve.orderNumber):"INDEPENDIENTE";
    const document=`<!doctype html><html><head><meta charset="utf-8"><title>${esc(r.receipt_number)}</title><style>body{font-family:Arial,sans-serif;margin:10mm;color:#111}.label{border:2px solid #111;border-radius:14px;padding:9mm}.head{display:flex;justify-content:space-between;border-bottom:1px solid #aaa;padding-bottom:5mm}.head h1{margin:2mm 0}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm;margin:6mm 0}.meta div{border:1px solid #ddd;border-radius:8px;padding:3mm}.meta small{display:block;color:#555;text-transform:uppercase}.codes{display:grid;grid-template-columns:1fr 45mm;gap:8mm;align-items:center;border-top:1px solid #aaa;padding-top:5mm}.codes svg{max-width:100%}.codes img{width:42mm;height:42mm}@media print{body{margin:3mm}}</style></head><body><section class="label"><div class="head"><div><small>Recepción de mercancía · Bodega</small><h1>${esc(r.receipt_number)}</h1><strong>${r.receipt_type==="RETURN"?"DEVOLUCIÓN":"COMPRA"}</strong></div><div><small>${data.linkedPve?"PVE enlazado":"Registro"}</small><h2>${linkedLabel}</h2></div></div><div class="meta"><div><small>Proveedor</small><strong>${esc(r.supplier_name||"—")}</strong></div><div><small>Orden de compra</small><strong>${esc(r.purchase_order_number||"—")}</strong></div><div><small>Recibió</small><strong>${esc(data.receivedBy||"—")}</strong></div><div><small>Materiales</small><strong>${(data.lines||[]).length}</strong></div></div><div class="codes"><div>${svg.outerHTML}</div><img src="${qrUrl}" alt="QR"></div></section><script>window.addEventListener('load',()=>window.print(),{once:true});<\/script></body></html>`;
    win.document.write(document);
    win.document.close();
  }catch(error){toast(error.message,"error",7000)}
}
