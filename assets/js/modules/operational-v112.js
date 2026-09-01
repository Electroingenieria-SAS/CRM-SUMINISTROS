import {api} from "../services/api.js";
import {getSupabase} from "../services/supabase.js";
import {uploadOrderFile} from "../services/drive.js";
import {modal,toast,empty,loading} from "../core/ui.js";
import {fmt,statusBadge} from "../core/format.js";
import {state} from "../core/state.js";

const AUX_ROLES=new Set(["aux_logistica","auxiliar_corte"]);
const APPROVER_ROLES=new Set(["super_admin","jefe_logistica","lider_logistica","coordinador_logistico","gerencia"]);
const OPS_MODULES=[
  {code:"receiving",label:"Recepción",icon:"▣"},
  {code:"billing",label:"Facturación",icon:"▤"},
  {code:"shipping",label:"Transportadoras",icon:"↗"}
];
let installed=false;
let dashboardState={module:null,from:null,to:null,data:null};

async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error){
    const detail=[error.message,error.details,error.hint].filter(Boolean).join(" · ");
    throw new Error(detail||"No fue posible completar la operación.");
  }
  return data;
}

function roles(){return new Set(state.profile?.roles||[])}
function hasAny(set){const r=roles();return [...set].some(x=>r.has(x))}
function isAuxiliary(){return hasAny(AUX_ROLES)}
function canApproveWork(){return hasAny(APPROVER_ROLES)}
function moduleReadable(code){return Boolean(state.modules?.find(m=>m.code===code)?.canRead)}
function activeTask(data){return (data?.tasks||[]).find(t=>["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED"].includes(t.status))||null}
function actionCodes(data){return new Set((data?.actions?.actions||[]).map(x=>x.code))}
function refreshLists(){window.__erpQueueRefresh?.();window.__erpOrderListRefresh?.()}
function reopenOrder(orderId){refreshLists();setTimeout(()=>window.dispatchEvent(new CustomEvent("erp:open-order",{detail:orderId})),90)}
function localDateTime(date){const d=new Date(date);const pad=n=>String(n).padStart(2,"0");return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
function roundFive(date=new Date()){const d=new Date(date);d.setSeconds(0,0);d.setMinutes(Math.ceil(d.getMinutes()/5)*5);return d}
function escapeText(value){return fmt.escape(String(value??""))}
function num(value){const n=Number(value);return Number.isFinite(n)?n:0}
function money(value,currency="COP"){try{return new Intl.NumberFormat("es-CO",{style:"currency",currency:currency||"COP",maximumFractionDigits:0}).format(num(value))}catch{return fmt.number(value)}}

export function installOperationalV112(){
  if(installed)return;
  installed=true;
  document.addEventListener("click",handleCapturedClick,true);
  window.addEventListener("erp:work-changed",()=>{
    if(state.currentModule!=="workforce")return;
    setTimeout(()=>enhanceWorkforce(document.querySelector("#page-content")).catch(()=>{}),250);
  });
}

async function handleCapturedClick(event){
  const target=event.target?.closest?.("button,[role='button']");
  if(!target||target.disabled)return;

  if(target.matches("[data-start-catalog]")){
    event.preventDefault();event.stopImmediatePropagation();
    const catalogId=target.dataset.startCatalog;
    if(catalogId)await openScheduleActivityDialog(catalogId);
    return;
  }

  if(target.matches("[data-add-guide]")){
    const shell=target.closest(".shipping-process-modal[data-order-id]");
    if(!shell)return;
    event.preventDefault();event.stopImmediatePropagation();
    const orderId=shell.dataset.orderId;
    if(orderId)await openCarrierGuideDialog(orderId);
    return;
  }

  if(target.matches("[data-next-action='RESOLVE']")){
    const shell=target.closest(".simple-process-modal[data-order-id]");
    const orderId=shell?.dataset.orderId;
    if(!orderId)return;
    const data=await api.getOrder(orderId);
    const step=String(data?.order?.current_step_code||"").toUpperCase();
    if(step==="RECEPCION_MERCANCIA"){
      event.preventDefault();event.stopImmediatePropagation();
      await openReceiptDialog(data);
      return;
    }
    if(step==="FACTURACION"&&String(data?.order?.order_type_code||"").toUpperCase()!=="PVP"){
      event.preventDefault();event.stopImmediatePropagation();
      openInvoiceDialog(data);
      return;
    }
  }
}

async function openScheduleActivityDialog(catalogId){
  try{
    const catalog=await api.workCatalog();
    const item=(catalog||[]).find(x=>x.id===catalogId);
    if(!item)throw new Error("La actividad ya no está disponible en el catálogo.");
    const start=roundFive();
    const minutes=Math.max(1,Number(item.medianMinutes&&item.samples>=5?item.medianMinutes:item.standardMinutes||60));
    const end=new Date(start.getTime()+minutes*60000);
    const auxiliary=isAuxiliary();
    const title=auxiliary?"Solicitar actividad":"Programar actividad";
    const view=modal({
      title,
      confirmLabel:auxiliary?"Enviar para aprobación":"Programar actividad",
      size:"wide",
      body:`
        <section class="v112-dialog-intro">
          <span>${auxiliary?"Requiere autorización":"No inicia el cronómetro"}</span>
          <strong>${escapeText(item.name)}</strong>
          <p>${auxiliary?"La actividad quedará pendiente hasta que Jefe, Líder o Coordinación Logística la apruebe.":"La actividad quedará en tu agenda. El cronómetro solo iniciará cuando pulses Iniciar."}</p>
        </section>
        <div class="form-grid v112-schedule-grid">
          <div class="field"><label>Inicio programado *</label><input class="control" type="datetime-local" name="plannedStart" value="${localDateTime(start)}" required></div>
          <div class="field" data-v112-end-field><label>Final estimado *</label><input class="control" type="datetime-local" name="plannedEnd" value="${localDateTime(end)}" required></div>
          <label class="v112-open-ended full"><input type="checkbox" name="openEnded"><span><strong>Sin hora final estimada</strong><small>La actividad se finalizará manualmente desde Mi Jornada.</small></span></label>
          <div class="field"><label>Prioridad</label><select class="control" name="priority"><option value="MEDIUM" selected>Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option><option value="CRITICAL">Crítica</option><option value="LOW">Baja</option></select></div>
          <div class="field"><label>Duración de referencia</label><input class="control" value="${fmt.number(minutes)} min" readonly aria-readonly="true"></div>
          <div class="field full"><label>Motivo / alcance *</label><textarea class="control" name="reason" minlength="10" required>${auxiliary?"Solicito programar esta actividad dentro de mi jornada.":"Actividad programada desde Mi Jornada."}</textarea><small class="field-help">Puedes escoger fechas de esta semana o de semanas posteriores.</small></div>
        </div>`,
      onConfirm:async dialog=>{
        const plannedStart=dialog.querySelector('[name="plannedStart"]').value;
        const openEnded=dialog.querySelector('[name="openEnded"]').checked;
        const plannedEnd=openEnded?null:dialog.querySelector('[name="plannedEnd"]').value;
        const priority=dialog.querySelector('[name="priority"]').value;
        const reason=dialog.querySelector('[name="reason"]').value.trim();
        if(!plannedStart)throw new Error("Indica la fecha y hora de inicio.");
        if(!openEnded&&!plannedEnd)throw new Error("Indica una hora final o marca Sin hora final estimada.");
        if(!openEnded&&new Date(plannedEnd)<=new Date(plannedStart))throw new Error("La hora final debe ser posterior al inicio.");
        const payload={catalogId,plannedStart:new Date(plannedStart).toISOString(),plannedEnd:plannedEnd?new Date(plannedEnd).toISOString():null,openEnded,priority,estimatedMinutes:minutes,reason};
        if(auxiliary||!canApproveWork()){
          await api.workProposeAssignment(payload);
          toast("Actividad enviada para aprobación. No podrá iniciarse hasta ser autorizada.","success",6500);
        }else{
          await rpc("erp_x_work_schedule",{p_payload:{...payload,profileIds:[state.profile.id],title:item.name,description:item.description||null}});
          toast("Actividad programada. Iníciala manualmente desde Mi Jornada cuando corresponda.","success",6500);
        }
        window.dispatchEvent(new HashChangeEvent("hashchange"));
      }
    });
    const open=view.root.querySelector('[name="openEnded"]');
    const endInput=view.root.querySelector('[name="plannedEnd"]');
    open?.addEventListener("change",()=>{
      endInput.disabled=open.checked;
      endInput.required=!open.checked;
      view.root.querySelector('[data-v112-end-field]')?.classList.toggle("disabled",open.checked);
    });
  }catch(error){toast(error.message||String(error),"error",7500)}
}

export async function enhanceWorkforce(root){
  if(!root||state.currentModule!=="workforce")return;
  const content=root.querySelector("#workforce-content");
  if(!content||!content.querySelector(".workforce-agenda-card"))return;
  content.querySelector("[data-v112-work-requests]")?.remove();
  try{
    const data=await api.workMyDay();
    const pending=data.pendingRequests||[];
    const history=data.requestHistory||[];
    let approvals=[];
    if(canApproveWork())approvals=await api.workPendingApprovals().catch(()=>[]);
    if(!pending.length&&!history.length&&!approvals.length)return;
    const section=document.createElement("section");
    section.className="card v112-work-requests";
    section.dataset.v112WorkRequests="1";
    section.innerHTML=`
      <header class="card-head"><div><h3>Programación y autorizaciones</h3><p>Las solicitudes no inician cronómetro. Primero se programan y, cuando corresponda, se aprueban.</p></div></header>
      <div class="card-body v112-work-requests-body">
        ${pending.length?`<div class="v112-request-group"><div class="v112-group-title"><strong>Mis solicitudes pendientes</strong><span>${pending.length}</span></div>${pending.map(requestRow).join("")}</div>`:""}
        ${approvals.length?`<div class="v112-request-group"><div class="v112-group-title"><strong>Por aprobar</strong><span>${approvals.length}</span></div>${approvals.map(approvalRow).join("")}</div>`:""}
        ${history.length?`<div class="v112-request-group"><div class="v112-group-title"><strong>Decisiones recientes</strong><span>${history.length}</span></div>${history.map(historyRow).join("")}</div>`:""}
      </div>`;
    const historyCard=content.querySelector(".workforce-history-card");
    if(historyCard)historyCard.before(section);else content.append(section);
    section.querySelectorAll("[data-v112-approval]").forEach(button=>button.addEventListener("click",()=>{
      const row=approvals.find(x=>x.id===button.dataset.v112Approval);
      if(row)openApprovalDialog(row);
    }));
  }catch(error){console.warn("[V11.2 Workforce]",error)}
}

function requestRow(row){
  const openEnded=Boolean(row.metadata?.openEnded)||!row.plannedEnd;
  return `<article class="v112-request-row pending"><div><span class="v112-request-status">Pendiente</span><strong>${escapeText(row.title)}</strong><small>${fmt.date(row.plannedStart)} · ${openEnded?"sin hora final":`hasta ${fmt.date(row.plannedEnd)}`}</small></div><p>${escapeText(row.reason||"")}</p></article>`;
}
function approvalRow(row){
  const openEnded=Boolean(row.metadata?.openEnded)||!row.plannedEnd;
  return `<article class="v112-request-row approval ${row.hasOverlap||row.outsideWorkingTime?"warning":""}"><div><span class="v112-request-status">${escapeText(row.profileName)}</span><strong>${escapeText(row.title)}</strong><small>${fmt.date(row.plannedStart)} · ${openEnded?"sin hora final":`hasta ${fmt.date(row.plannedEnd)}`}</small></div><p>${escapeText(row.reason||"")}</p><div class="v112-request-flags">${row.hasOverlap?"<span>Superposición detectada</span>":""}${row.outsideWorkingTime?"<span>Fuera de jornada</span>":""}</div><button class="btn btn-primary" data-v112-approval="${escapeText(row.id)}">Revisar solicitud</button></article>`;
}
function historyRow(row){return `<article class="v112-request-row history"><div><span class="v112-request-status ${String(row.approvalStatus).toLowerCase()}">${row.approvalStatus==="APPROVED"?"Aprobada":"Rechazada"}</span><strong>${escapeText(row.title)}</strong><small>${fmt.date(row.plannedStart)}${row.decidedBy?` · ${escapeText(row.decidedBy)}`:""}</small></div>${row.decisionNote?`<p>${escapeText(row.decisionNote)}</p>`:""}</article>`}

function openApprovalDialog(row){
  const view=modal({
    title:"Revisar solicitud de actividad",
    confirmLabel:"Aprobar actividad",
    size:"wide",
    body:`
      <section class="v112-dialog-intro"><span>Autorización de Jornada</span><strong>${escapeText(row.title)}</strong><p>${escapeText(row.profileName)} · ${escapeText(row.catalogName||"")}</p></section>
      <div class="detail-grid v112-approval-details">
        <div class="info-box"><label>Inicio</label><strong>${fmt.date(row.plannedStart)}</strong></div>
        <div class="info-box"><label>Final</label><strong>${row.plannedEnd?fmt.date(row.plannedEnd):"Sin hora final"}</strong></div>
        <div class="info-box"><label>Prioridad</label><strong>${escapeText(fmt.label(row.priority))}</strong></div>
        <div class="info-box"><label>Ámbito</label><strong>${escapeText(fmt.label(row.approvalScope))}</strong></div>
      </div>
      <div class="field"><label>Justificación del auxiliar</label><textarea class="control" readonly>${escapeText(row.reason||"")}</textarea></div>
      ${(row.hasOverlap||row.outsideWorkingTime)?`<label class="v112-open-ended"><input type="checkbox" name="force"><span><strong>Autorizar la excepción detectada</strong><small>${row.hasOverlap?"Existe superposición con otra actividad. ":""}${row.outsideWorkingTime?"El horario toca tiempo fuera de la jornada configurada.":""}</small></span></label>`:""}
      <div class="field"><label>Nota de decisión</label><textarea class="control" name="note" placeholder="Opcional al aprobar; obligatoria al rechazar"></textarea></div>
      <button type="button" class="btn btn-danger v112-reject-button" data-v112-reject>Rechazar solicitud</button>`,
    onConfirm:async dialog=>{
      const force=Boolean(dialog.querySelector('[name="force"]')?.checked);
      if((row.hasOverlap||row.outsideWorkingTime)&&!force)throw new Error("Revisa la excepción detectada y autorízala explícitamente para aprobar.");
      const note=dialog.querySelector('[name="note"]').value.trim()||null;
      await api.workDecideAssignment(row.id,"APPROVED",note,force);
      toast("Actividad aprobada. Ya puede iniciarse manualmente desde Mi Jornada.","success",6500);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    }
  });
  view.root.querySelector("[data-v112-reject]")?.addEventListener("click",async event=>{
    const note=view.root.querySelector('[name="note"]').value.trim();
    if(note.length<5)return toast("Escribe el motivo del rechazo.","error",6000);
    const button=event.currentTarget;button.disabled=true;
    try{
      await api.workDecideAssignment(row.id,"REJECTED",note,false);
      view.close();toast("Solicitud rechazada.","success");window.dispatchEvent(new HashChangeEvent("hashchange"));
    }catch(error){toast(error.message,"error",7000);button.disabled=false}
  });
}

async function finalizeAfterDomain(orderId,message){
  let latest=await api.getOrder(orderId);
  const task=activeTask(latest);
  const required=(latest.checklist||[]).filter(item=>item.task_id===task?.id&&item.required&&!item.completed);
  for(const item of required)await api.updateChecklist(task.id,item.item_code,true,"Verificado desde flujo V11.2");
  latest=await api.getOrder(orderId);
  if(actionCodes(latest).has("COMPLETE"))await api.executeAction(orderId,"COMPLETE",{detail:message},latest.order.version);
  toast(message,"success",6500);reopenOrder(orderId);
}

async function openReceiptDialog(data){
  try{
    const progress=await api.receiptProgress(data.order.id);
    const previous=new Map((progress?.items||[]).map(item=>[String(item.orderItemId),item]));
    const items=(data.items||[]).map(item=>{
      const p=previous.get(String(item.id));
      const remaining=Math.max(0,Number(p?.remainingQuantity??item.quantity??0));
      return {...item,_receivedBefore:Number(p?.acceptedQuantity||0),_remaining:remaining};
    }).filter(item=>item._remaining>0.0001);
    if(!items.length){toast("Las cantidades aceptadas ya cubren el pedido.","success",6000);return}
    const requestId=crypto.randomUUID?.()||`receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const rows=items.map(item=>`<div class="simple-receipt-line v112-receipt-line" data-item="${escapeText(item.id)}"><div><strong>${escapeText(item.sku||item.description)}</strong><small>Pendiente: ${fmt.number(item._remaining,3)} de ${fmt.number(item.quantity,3)} ${escapeText(item.unit)}${item._receivedBefore?` · ya aceptado ${fmt.number(item._receivedBefore,3)}`:""}</small></div><label>Aceptado<input class="control" name="accepted" type="number" min="0" max="${Number(item._remaining)}" step="any" value="${Number(item._remaining)}"></label></div>`).join("");
    const view=modal({
      title:"Confirmar recepción de mercancía",
      confirmLabel:"Guardar recepción",
      size:"wide",
      body:`
        <section class="v112-dialog-intro"><span>Recepción integrada</span><strong>${escapeText(data.order.order_number)}</strong><p>Compra y devolución utilizan el mismo flujo de Recepción. El CRM genera prefijo, consecutivo, código de barras y QR.</p></section>
        <div class="simple-choice-row v112-status-choices">
          <label class="choice"><input type="radio" name="status" value="CONFORMING" checked><span><strong>Conforme</strong><small>Completa cantidades pendientes.</small></span></label>
          <label class="choice"><input type="radio" name="status" value="PARTIAL"><span><strong>Parcial</strong><small>Quedarán cantidades pendientes.</small></span></label>
          <label class="choice"><input type="radio" name="status" value="NONCONFORMING"><span><strong>Con novedad</strong><small>Existe diferencia o rechazo.</small></span></label>
        </div>
        <div class="form-grid">
          <div class="field"><label>Tipo de recepción *</label><select class="control" name="receiptType"><option value="PURCHASE" selected>Compra</option><option value="RETURN">Devolución</option></select></div>
          <div class="field"><label>Prefijo *</label><input class="control" name="documentPrefix" value="REC" minlength="2" maxlength="8" required></div>
          <div class="field"><label>Orden de compra</label><input class="control" name="purchaseOrder"></div>
          <div class="field"><label>Proveedor / origen</label><input class="control" name="supplierName"></div>
          <div class="field"><label>Ubicación *</label><input class="control" name="location" value="RECEPCION" required></div>
          <div class="field"><label>Lote común</label><input class="control" name="lotNumber"></div>
        </div>
        <div class="simple-receipt-list">${rows}</div>
        <section class="v112-subsection">
          <header><strong>Verificación y levantamiento de información</strong><small>Queda asociado a la misma recepción y a su trazabilidad.</small></header>
          <div class="form-grid">
            <label class="v112-open-ended full"><input type="checkbox" name="verified" checked><span><strong>Recepción verificada</strong><small>Registra quién verificó y la fecha automáticamente.</small></span></label>
            <div class="field full"><label>Información levantada</label><textarea class="control" name="informationCaptured" placeholder="Datos tomados durante la recepción, referencias, empaque, observaciones del proveedor, etc."></textarea></div>
            <div class="field full"><label>Nota de verificación</label><textarea class="control" name="verificationNote" placeholder="Resultado de la revisión física/documental"></textarea></div>
          </div>
        </section>
        <section class="v112-subsection">
          <header><strong>Novedades</strong><small>Solo diligencia estos campos cuando exista una novedad real.</small></header>
          <div class="form-grid">
            <div class="field"><label>Tipo de novedad</label><select class="control" name="noveltyType"><option value="">Sin novedad</option><option value="SHORTAGE">Faltante</option><option value="EXCESS">Sobrante</option><option value="DAMAGED">Avería</option><option value="WRONG_ITEM">Material incorrecto</option><option value="DOCUMENT">Documento / factura</option><option value="QUALITY">Calidad</option><option value="OTHER">Otra</option></select></div>
            <div class="field"><label>Severidad</label><select class="control" name="noveltySeverity"><option value="LOW">Baja</option><option value="MEDIUM" selected>Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></div>
            <div class="field full"><label>Detalle de novedad</label><textarea class="control" name="noveltyNote"></textarea></div>
          </div>
        </section>
        <div class="field"><label>Observación general</label><textarea class="control" name="note"></textarea></div>`,
      onConfirm:async dialog=>{
        const get=name=>dialog.querySelector(`[name="${name}"]`);
        const status=dialog.querySelector('[name="status"]:checked')?.value||"CONFORMING";
        const receiptType=get("receiptType").value;
        const prefix=get("documentPrefix").value.trim().toUpperCase();
        const location=get("location").value.trim();
        const lotNumber=get("lotNumber").value.trim();
        const captured=[...dialog.querySelectorAll("[data-item]")].map(row=>{
          const item=items.find(x=>x.id===row.dataset.item);
          const accepted=Number(row.querySelector('[name="accepted"]').value||0);
          const pending=Number(item._remaining||0);
          if(!Number.isFinite(accepted)||accepted<0||accepted>pending)throw new Error(`Cantidad aceptada inválida para ${item.sku||item.description}`);
          if(status==="CONFORMING"&&Math.abs(accepted-pending)>0.0001)throw new Error("Una recepción Conforme debe cubrir toda la cantidad pendiente. Usa Parcial o Con novedad.");
          const received=status==="NONCONFORMING"?pending:accepted;
          const rejected=status==="NONCONFORMING"?Math.max(0,pending-accepted):0;
          return {orderItemId:item.id,sku:item.sku||null,reference:item.reference||null,description:item.description,expectedQuantity:Number(item.quantity||0),receivedQuantity:received,acceptedQuantity:accepted,rejectedQuantity:rejected,unit:item.unit||"UND",location,lotNumber:lotNumber||null,qualityStatus:status==="NONCONFORMING"?"REJECTED":status==="PARTIAL"?"CONDITIONAL":"ACCEPTED",metadata:{lotNumber:lotNumber||null,materialMasterId:item.material_master_id||item.metadata?.materialMasterId||null,materialVariantId:item.material_variant_id||item.metadata?.materialVariantId||null}};
        });
        const lines=status==="PARTIAL"?captured.filter(line=>line.receivedQuantity>0):captured;
        if(!lines.length)throw new Error("Debes registrar al menos una cantidad recibida mayor que cero.");
        const noveltyType=get("noveltyType").value||null;
        const noveltyNote=get("noveltyNote").value.trim()||null;
        if(noveltyType&&!noveltyNote)throw new Error("Describe la novedad registrada.");
        const payload={requestId,purchaseOrder:get("purchaseOrder").value.trim()||null,supplierName:get("supplierName").value.trim()||null,status,lines,metadata:{receiptType,documentPrefix:prefix,noveltyType,noveltySeverity:get("noveltySeverity").value,noveltyNote,verified:get("verified").checked,verificationNote:get("verificationNote").value.trim()||null,informationCaptured:get("informationCaptured").value.trim()||null,generalNote:get("note").value.trim()||null,uiVersion:"11.2.0"}};
        const result=await api.saveReceipt(data.order.id,payload);
        const receipt=result?.receipt;
        if(receipt?.receipt_number)toast(`Recepción ${receipt.receipt_number} guardada con código de barras y QR.`,"success",7000);
        if(status==="CONFORMING")return finalizeAfterDomain(data.order.id,"Recepción confirmada y etapa finalizada");
        const latest=await api.getOrder(data.order.id);
        const reason=get("note").value.trim()||noveltyNote||"Recepción pendiente de resolución";
        if(actionCodes(latest).has("WAIT"))await api.executeAction(data.order.id,"WAIT",{reason},latest.order.version);
        toast("Recepción registrada. El pedido queda pendiente de resolución.","success",6500);reopenOrder(data.order.id);
      }
    });
    const type=view.root.querySelector('[name="receiptType"]');
    const prefix=view.root.querySelector('[name="documentPrefix"]');
    type?.addEventListener("change",()=>{prefix.value=type.value==="RETURN"?"DEV":"REC"});
  }catch(error){toast(error.message||String(error),"error",7500)}
}

function openInvoiceDialog(data){
  const task=activeTask(data);
  const quantity=(data.items||[]).reduce((sum,item)=>sum+Number(item.quantity||0),0);
  const view=modal({
    title:"Registrar factura",
    confirmLabel:"Guardar factura y continuar",
    size:"wide",
    body:`
      <section class="v112-dialog-intro"><span>Facturación integrada</span><strong>${escapeText(data.order.order_number)}</strong><p>El peso y la relación cantidad/peso quedan en la misma factura. El soporte se carga al expediente institucional antes de guardar.</p></section>
      <div class="form-grid">
        <div class="field"><label>Número de factura *</label><input class="control" name="invoiceNumber" required autofocus></div>
        <div class="field"><label>Fecha *</label><input class="control" name="invoiceDate" type="date" value="${new Date().toISOString().slice(0,10)}" required></div>
        <div class="field"><label>Valor</label><input class="control" name="amount" type="number" min="0" step="any"></div>
        <div class="field"><label>Cantidad asociada *</label><input class="control" name="packageQuantity" type="number" min="0.000001" step="any" value="${quantity||1}" required></div>
        <div class="field"><label>Peso total de factura (kg) *</label><input class="control" name="packageWeightKg" type="number" min="0.001" step="0.001" required></div>
        <div class="field v112-ratio-field"><label>Relación peso / cantidad</label><output data-v112-weight-ratio>— kg/unidad</output></div>
        <div class="field full"><label>Factura / soporte institucional *</label><input class="control" name="invoiceFile" type="file" accept="image/*,.pdf,application/pdf" required><small class="field-help">Se guarda en Google Drive dentro del expediente del pedido.</small></div>
      </div>`,
    onConfirm:async dialog=>{
      if(!task?.id)throw new Error("No se encontró la tarea activa de Facturación.");
      const invoiceNumber=dialog.querySelector('[name="invoiceNumber"]').value.trim();
      const invoiceDate=dialog.querySelector('[name="invoiceDate"]').value;
      const amount=dialog.querySelector('[name="amount"]').value;
      const packageQuantity=Number(dialog.querySelector('[name="packageQuantity"]').value);
      const packageWeightKg=Number(dialog.querySelector('[name="packageWeightKg"]').value);
      const file=dialog.querySelector('[name="invoiceFile"]').files?.[0];
      if(!file)throw new Error("Adjunta la factura o soporte institucional.");
      if(!(packageQuantity>0)||!(packageWeightKg>0))throw new Error("Cantidad y peso deben ser mayores que cero.");
      const uploaded=await uploadOrderFile(data.order.id,file,"INVOICE",task.id,data.order.order_number);
      const recordId=uploaded?.file?.id;
      if(!recordId)throw new Error("El expediente no devolvió el registro del archivo de factura.");
      const payload={invoiceNumber,invoiceDate,currency:"COP",driveFileRecordId:recordId,metadata:{packageQuantity,packageWeightKg,weightPerUnitKg:packageWeightKg/packageQuantity,uiVersion:"11.2.0"}};
      if(amount)payload.amount=amount;
      await api.saveInvoice(data.order.id,payload);
      await finalizeAfterDomain(data.order.id,"Factura registrada con peso y soporte; pedido liberado");
    }
  });
  const updateRatio=()=>{
    const q=Number(view.root.querySelector('[name="packageQuantity"]')?.value||0);
    const w=Number(view.root.querySelector('[name="packageWeightKg"]')?.value||0);
    const out=view.root.querySelector("[data-v112-weight-ratio]");
    if(out)out.textContent=q>0&&w>0?`${fmt.number(w/q,4)} kg/unidad`:"— kg/unidad";
  };
  view.root.querySelector('[name="packageQuantity"]')?.addEventListener("input",updateRatio);
  view.root.querySelector('[name="packageWeightKg"]')?.addEventListener("input",updateRatio);
}

async function openCarrierGuideDialog(orderId){
  try{
    const data=await api.getOrder(orderId);
    const task=activeTask(data);
    const delivery=[...(data.deliveries||[])].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))[0]||null;
    const view=modal({
      title:"Agregar guía y costo de transportadora",
      confirmLabel:"Guardar guía",
      size:"wide",
      body:`
        <section class="v112-dialog-intro"><span>Despachos y entregas</span><strong>${escapeText(data.order.order_number)}</strong><p>Guía, factura y costo de transportadora quedan dentro del mismo despacho.</p></section>
        <div class="form-grid">
          <div class="field"><label>Número de guía *</label><input class="control" name="trackingNumber" value="${escapeText(delivery?.tracking_number||"")}" required autofocus></div>
          <div class="field"><label>Transportadora *</label><input class="control" name="carrier" value="${escapeText(delivery?.carrier||"")}" required></div>
          <div class="field"><label>Número factura transportadora</label><input class="control" name="carrierInvoiceNumber" value="${escapeText(delivery?.carrier_invoice_number||"")}"></div>
          <div class="field"><label>Costo transportadora</label><input class="control" name="carrierCost" type="number" min="0" step="0.01" value="${delivery?.carrier_cost??""}"></div>
          <div class="field"><label>Moneda</label><select class="control" name="carrierCostCurrency"><option value="COP" selected>COP</option><option value="USD">USD</option></select></div>
          <div class="field full"><label>Soporte de guía, opcional</label><input class="control" name="guideFile" type="file" accept="image/*,.pdf,application/pdf"></div>
        </div>
        <div class="v112-cost-note"><strong>Control de consecutivos</strong><span>El número de factura y el costo alimentarán el Dashboard de Transportadoras y su exportación Excel.</span></div>`,
      onConfirm:async dialog=>{
        const trackingNumber=dialog.querySelector('[name="trackingNumber"]').value.trim();
        const carrier=dialog.querySelector('[name="carrier"]').value.trim();
        const carrierInvoiceNumber=dialog.querySelector('[name="carrierInvoiceNumber"]').value.trim()||null;
        const costRaw=dialog.querySelector('[name="carrierCost"]').value;
        const carrierCost=costRaw===""?null:Number(costRaw);
        const currency=dialog.querySelector('[name="carrierCostCurrency"]').value;
        const file=dialog.querySelector('[name="guideFile"]').files?.[0];
        if(carrierCost!==null&&carrierCost<0)throw new Error("El costo de transportadora no puede ser negativo.");
        if(carrierCost!==null&&!carrierInvoiceNumber)throw new Error("Indica el número de factura de la transportadora para registrar un costo.");
        let guideFileId=null;
        if(file){
          const uploaded=await uploadOrderFile(orderId,file,"SHIPPING_GUIDE",task?.id,data.order.order_number);
          guideFileId=uploaded?.file?.id||null;
        }
        await api.saveShippingGuide(orderId,{trackingNumber,carrier,carrierInvoiceNumber,carrierCost,carrierCostCurrency:currency,guideFileId});
        toast("Guía y datos de transportadora guardados en el despacho.","success",6500);reopenOrder(orderId);
      }
    });
    if(delivery?.carrier_cost_currency)view.root.querySelector('[name="carrierCostCurrency"]').value=delivery.carrier_cost_currency;
  }catch(error){toast(error.message||String(error),"error",7500)}
}

export async function enhanceOperationalDashboard(root){
  if(!root||state.currentModule!=="dashboard")return;
  root.querySelector("[data-v112-operational-dashboard]")?.remove();
  const available=OPS_MODULES.filter(m=>moduleReadable(m.code));
  if(!available.length)return;
  const today=new Date();
  const to=today.toISOString().slice(0,10);
  const from=new Date(today.getTime()-29*864e5).toISOString().slice(0,10);
  dashboardState={module:available[0].code,from,to,data:null};
  const section=document.createElement("section");
  section.className="card v112-operational-dashboard";
  section.dataset.v112OperationalDashboard="1";
  section.innerHTML=`
    <header class="card-head v112-dashboard-head"><div><span class="v112-dashboard-kicker">Control operativo integrado</span><h3>Recepción · Facturación · Transportadoras</h3><p>Indicadores, consecutivos y exportaciones con fórmulas sin separar los procesos del CRM.</p></div></header>
    <div class="card-body">
      <div class="v112-dashboard-toolbar">
        <div class="v112-dashboard-tabs">${available.map((m,i)=>`<button class="btn ${i===0?"btn-primary":"btn-ghost"}" data-v112-module="${m.code}"><span>${m.icon}</span>${m.label}</button>`).join("")}</div>
        <div class="v112-dashboard-filters"><label>Desde<input class="control" type="date" data-v112-from value="${from}"></label><label>Hasta<input class="control" type="date" data-v112-to value="${to}"></label><button class="btn btn-search" data-v112-apply>Aplicar</button><button class="btn btn-success" data-v112-export disabled>Exportar Excel con fórmulas</button></div>
      </div>
      <div data-v112-dashboard-content>${loading("Preparando indicadores operativos…")}</div>
    </div>`;
  const firstGap=root.querySelector(".section-gap");
  if(firstGap)firstGap.before(section);else root.append(section);
  section.querySelectorAll("[data-v112-module]").forEach(button=>button.addEventListener("click",async()=>{
    dashboardState.module=button.dataset.v112Module;
    section.querySelectorAll("[data-v112-module]").forEach(b=>{b.classList.toggle("btn-primary",b===button);b.classList.toggle("btn-ghost",b!==button)});
    await loadDashboardModule(section);
  }));
  section.querySelector("[data-v112-apply]").addEventListener("click",async()=>{
    dashboardState.from=section.querySelector("[data-v112-from]").value;
    dashboardState.to=section.querySelector("[data-v112-to]").value;
    await loadDashboardModule(section);
  });
  section.querySelector("[data-v112-export]").addEventListener("click",()=>exportOperationalWorkbook(dashboardState.module,dashboardState.data));
  await loadDashboardModule(section);
}

async function loadDashboardModule(section){
  const target=section.querySelector("[data-v112-dashboard-content]");
  const exportButton=section.querySelector("[data-v112-export]");
  target.innerHTML=loading("Consultando datos operativos…");exportButton.disabled=true;
  try{
    const data=await rpc("erp_x_operational_module_dashboard",{p_module:dashboardState.module,p_from:dashboardState.from,p_to:dashboardState.to});
    dashboardState.data=data;
    target.innerHTML=dashboardHtml(dashboardState.module,data);
    exportButton.disabled=!(data.rows||[]).length;
    if(dashboardState.module==="receiving"){
      target.querySelectorAll("[data-v112-print-receipt]").forEach(button=>button.addEventListener("click",()=>{
        const row=(data.rows||[])[Number(button.dataset.v112PrintReceipt)];if(row)printReceiptLabel(row);
      }));
    }
  }catch(error){dashboardState.data=null;target.innerHTML=`<div class="module-error"><strong>No fue posible cargar estos indicadores</strong><p>${escapeText(error.message)}</p></div>`;}
}

function dashboardHtml(module,data){
  const rows=data.rows||[],summary=data.summary||{};
  if(module==="billing"){
    const duplicates=countDuplicates(rows,"invoiceNumber");
    return `${summaryStrip([["Facturas",summary.records||rows.length,"registros del rango"],["Valor facturado",money(summary.totalAmount||0),"acumulado"],["Peso total",`${fmt.number(summary.totalWeightKg||0,3)} kg`,"registrado"],["Consecutivos repetidos",duplicates,"revisar antes de cierre"]])}${rows.length?billingTable(rows):empty("Sin facturas","No hay facturas registradas en el rango seleccionado.")}`;
  }
  if(module==="shipping"){
    const duplicates=countDuplicates(rows,"carrierInvoiceNumber"),missing=rows.filter(r=>r.carrierCost!=null&&!r.carrierInvoiceNumber).length;
    return `${summaryStrip([["Despachos",summary.records||rows.length,"registros del rango"],["Costo transportadoras",money(summary.totalCarrierCost||0),"acumulado"],["Facturas repetidas",duplicates,"por número de factura"],["Costos sin factura",missing,"deben quedar en cero"]])}${rows.length?shippingTable(rows):empty("Sin despachos","No hay datos de transportadora en el rango seleccionado.")}`;
  }
  const gaps=receiptSequenceGaps(rows);
  return `${summaryStrip([["Recepciones",summary.records||rows.length,"registros del rango"],["Novedades abiertas",summary.openNovelties||0,"requieren seguimiento"],["Consecutivos con salto",gaps,"por prefijo"],["Verificadas",rows.filter(r=>r.verifiedAt).length,"con usuario y fecha"]])}${rows.length?receivingTable(rows):empty("Sin recepciones","No hay recepciones registradas en el rango seleccionado.")}`;
}

function summaryStrip(items){return `<section class="v112-summary-strip">${items.map(([label,value,detail])=>`<article><small>${escapeText(label)}</small><strong>${escapeText(value)}</strong><span>${escapeText(detail)}</span></article>`).join("")}</section>`}
function countDuplicates(rows,key){const counts=new Map();for(const row of rows){const value=String(row[key]||"").trim();if(value)counts.set(value,(counts.get(value)||0)+1)}return [...counts.values()].filter(n=>n>1).reduce((sum,n)=>sum+n-1,0)}
function receiptSequenceGaps(rows){let gaps=0;const groups=new Map();for(const row of rows){const prefix=String(row.documentPrefix||"");const n=Number(row.consecutiveNo);if(!prefix||!Number.isFinite(n))continue;(groups.get(prefix)||groups.set(prefix,[]).get(prefix)).push(n)}for(const nums of groups.values()){const sorted=[...new Set(nums)].sort((a,b)=>a-b);for(let i=1;i<sorted.length;i++)gaps+=Math.max(0,sorted[i]-sorted[i-1]-1)}return gaps}

function billingTable(rows){return `<div class="table-wrap mobile-card-table v112-op-table"><table><thead><tr><th>Factura</th><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Valor</th><th>Cantidad</th><th>Peso</th><th>kg/unidad</th><th>Control</th></tr></thead><tbody>${rows.map(row=>{const dup=rows.filter(x=>String(x.invoiceNumber||"")===String(row.invoiceNumber||"")).length>1;return `<tr><td data-label="Factura"><strong>${escapeText(row.invoiceNumber)}</strong></td><td data-label="Pedido">${escapeText(row.orderNumber)}</td><td data-label="Cliente">${escapeText(row.clientName)}</td><td data-label="Fecha">${fmt.date(row.invoiceDate)}</td><td data-label="Valor">${money(row.amount,row.currency)}</td><td data-label="Cantidad">${fmt.number(row.packageQuantity||0,3)}</td><td data-label="Peso">${fmt.number(row.packageWeightKg||0,3)} kg</td><td data-label="kg/unidad">${fmt.number(row.weightPerUnitKg||0,4)}</td><td data-label="Control"><span class="v112-control-chip ${dup?"bad":"ok"}">${dup?"Duplicado":"OK"}</span></td></tr>`}).join("")}</tbody></table></div>`}
function shippingTable(rows){return `<div class="table-wrap mobile-card-table v112-op-table"><table><thead><tr><th>Pedido</th><th>Transportadora</th><th>Guía</th><th>Factura transportadora</th><th>Costo</th><th>Estado</th><th>Control</th></tr></thead><tbody>${rows.map(row=>{const dup=row.carrierInvoiceNumber&&rows.filter(x=>String(x.carrierInvoiceNumber||"")===String(row.carrierInvoiceNumber)).length>1;const missing=row.carrierCost!=null&&!row.carrierInvoiceNumber;return `<tr><td data-label="Pedido"><strong>${escapeText(row.orderNumber)}</strong><small>${escapeText(row.clientName)}</small></td><td data-label="Transportadora">${escapeText(row.carrier||"—")}</td><td data-label="Guía">${escapeText(row.trackingNumber||"—")}</td><td data-label="Factura">${escapeText(row.carrierInvoiceNumber||"—")}</td><td data-label="Costo">${row.carrierCost==null?"—":money(row.carrierCost,row.currency)}</td><td data-label="Estado">${statusBadge(row.status)}</td><td data-label="Control"><span class="v112-control-chip ${dup||missing?"bad":"ok"}">${missing?"Falta factura":dup?"Duplicada":"OK"}</span></td></tr>`}).join("")}</tbody></table></div>`}
function receivingTable(rows){return `<div class="table-wrap mobile-card-table v112-op-table"><table><thead><tr><th>Recepción</th><th>Tipo</th><th>Pedido</th><th>Proveedor</th><th>Recibido</th><th>Aceptado</th><th>Rechazado</th><th>Novedad</th><th>Verificación</th><th>Etiqueta</th></tr></thead><tbody>${rows.map((row,index)=>`<tr><td data-label="Recepción"><strong>${escapeText(row.receiptNumber)}</strong><small>${escapeText(row.documentPrefix)} · #${escapeText(row.consecutiveNo)}</small></td><td data-label="Tipo">${row.receiptType==="RETURN"?"Devolución":"Compra"}</td><td data-label="Pedido">${escapeText(row.orderNumber)}</td><td data-label="Proveedor">${escapeText(row.supplierName||"—")}</td><td data-label="Recibido">${fmt.number(row.receivedQuantity||0,3)}</td><td data-label="Aceptado">${fmt.number(row.acceptedQuantity||0,3)}</td><td data-label="Rechazado">${fmt.number(row.rejectedQuantity||0,3)}</td><td data-label="Novedad"><span class="v112-control-chip ${row.noveltyStatus==="OPEN"?"bad":"ok"}">${row.noveltyStatus==="OPEN"?escapeText(row.noveltyType||"Abierta"):"Sin novedad"}</span></td><td data-label="Verificación"><strong>${row.verifiedAt?"Verificada":"Pendiente"}</strong>${row.verifiedBy?`<small>${escapeText(row.verifiedBy)}</small>`:""}</td><td data-label="Etiqueta"><button class="btn btn-ghost btn-compact" data-v112-print-receipt="${index}">QR + código</button></td></tr>`).join("")}</tbody></table></div>`}

function exportOperationalWorkbook(module,data){
  const rows=data?.rows||[];
  if(!rows.length)return toast("No hay registros para exportar.","error");
  if(!window.XLSX)return toast("El componente de Excel no terminó de cargar. Recarga la página e inténtalo nuevamente.","error",7000);
  const XLSX=window.XLSX;let aoa=[],formulaCells=[];let widths=[];let name="Control";
  if(module==="billing"){
    name="Facturacion";aoa=[["Pedido","Cliente","Factura","Fecha","Valor","Cantidad","Peso kg","Kg/unidad (fórmula)","Validación consecutivo (fórmula)"]];
    rows.forEach((r,i)=>{const row=i+2;aoa.push([r.orderNumber,r.clientName,r.invoiceNumber,r.invoiceDate,num(r.amount),num(r.packageQuantity),num(r.packageWeightKg),null,null]);formulaCells.push([`H${row}`,{t:"n",f:`IF(AND(F${row}>0,G${row}>0),G${row}/F${row},0)`}],[`I${row}`,{t:"str",f:`IF(COUNTIF($C:$C,C${row})>1,"DUPLICADO","OK")`}])});widths=[16,28,18,14,16,14,14,20,25];
  }else if(module==="shipping"){
    name="Transportadoras";aoa=[["Pedido","Cliente","Transportadora","Guía","Factura transportadora","Costo","Moneda","Validación factura (fórmula)"]];
    rows.forEach((r,i)=>{const row=i+2;aoa.push([r.orderNumber,r.clientName,r.carrier,r.trackingNumber,r.carrierInvoiceNumber,num(r.carrierCost),r.currency||"COP",null]);formulaCells.push([`H${row}`,{t:"str",f:`IF(E${row}="","FALTA FACTURA",IF(COUNTIF($E:$E,E${row})>1,"DUPLICADO","OK"))`}])});widths=[16,28,24,22,24,16,10,26];
  }else{
    name="Recepcion";aoa=[["Prefijo","Consecutivo","Recepción","Tipo","Pedido","Proveedor","Recibido","Aceptado","Rechazado","Diferencia (fórmula)","Novedad","Verificado por","Fecha verificación","Control consecutivo (fórmula)"]];
    rows.forEach((r,i)=>{const row=i+2;aoa.push([r.documentPrefix,num(r.consecutiveNo),r.receiptNumber,r.receiptType==="RETURN"?"Devolución":"Compra",r.orderNumber,r.supplierName,num(r.receivedQuantity),num(r.acceptedQuantity),num(r.rejectedQuantity),null,r.noveltyStatus==="OPEN"?(r.noveltyType||"Abierta"):"Sin novedad",r.verifiedBy||"",r.verifiedAt||"",null]);formulaCells.push([`J${row}`,{t:"n",f:`G${row}-H${row}-I${row}`}],[`N${row}`,{t:"str",f:`IF(B${row}="","SIN CONSECUTIVO","OK")`}])});widths=[10,14,22,14,16,26,14,14,14,20,18,24,24,24];
  }
  const ws=XLSX.utils.aoa_to_sheet(aoa);for(const [cell,value] of formulaCells)ws[cell]=value;ws["!cols"]=widths.map(w=>({wch:w}));ws["!autofilter"]={ref:ws["!ref"]};
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,name);wb.Workbook={CalcPr:{calcMode:"auto",fullCalcOnLoad:true,forceFullCalc:true}};
  const safeDate=new Date().toISOString().slice(0,10);XLSX.writeFile(wb,`CRM_${name}_${safeDate}.xlsx`,{compression:true});
  toast("Excel generado con fórmulas de control.","success");
}

function printReceiptLabel(row){
  try{
    if(!window.JsBarcode||!window.qrcode)throw new Error("Los componentes de código de barras/QR todavía no están disponibles.");
    const barcodeValue=String(row.barcodeValue||`CRM-REC|${row.receiptNumber}`);
    const qrValue=String(row.qrValue||JSON.stringify({type:"CRM_RECEIPT",number:row.receiptNumber,order:row.orderNumber}));
    const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
    window.JsBarcode(svg,barcodeValue,{format:"CODE128",displayValue:true,fontSize:14,height:52,margin:6});
    const qr=window.qrcode(0,"M");qr.addData(qrValue);qr.make();const qrUrl=qr.createDataURL(5,2);
    const win=window.open("","_blank","width=900,height=700");if(!win)throw new Error("El navegador bloqueó la ventana de impresión.");
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeText(row.receiptNumber)}</title><style>body{font-family:Arial,sans-serif;margin:12mm;color:#111}.label{border:2px solid #111;border-radius:14px;padding:10mm;max-width:185mm}.head{display:flex;justify-content:space-between;gap:12mm;border-bottom:1px solid #bbb;padding-bottom:6mm}.head h1{margin:0;font-size:26px}.meta{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm 10mm;margin:7mm 0}.meta div{border:1px solid #ddd;border-radius:8px;padding:4mm}.meta small{display:block;text-transform:uppercase;color:#555;font-size:10px}.codes{display:grid;grid-template-columns:1fr 46mm;align-items:center;gap:8mm;border-top:1px solid #bbb;padding-top:6mm}.codes svg{max-width:100%;height:auto}.codes img{width:42mm;height:42mm}.note{margin-top:5mm;font-size:11px;color:#555}@media print{body{margin:4mm}.label{max-width:none}}</style></head><body><section class="label"><div class="head"><div><small>Recepción de mercancía</small><h1>${escapeText(row.receiptNumber)}</h1><strong>${row.receiptType==="RETURN"?"DEVOLUCIÓN":"COMPRA"}</strong></div><div><small>Pedido</small><h2>${escapeText(row.orderNumber)}</h2></div></div><div class="meta"><div><small>Proveedor / origen</small><strong>${escapeText(row.supplierName||"—")}</strong></div><div><small>Prefijo / consecutivo</small><strong>${escapeText(row.documentPrefix)} · ${escapeText(row.consecutiveNo)}</strong></div><div><small>Aceptado</small><strong>${fmt.number(row.acceptedQuantity||0,3)}</strong></div><div><small>Rechazado</small><strong>${fmt.number(row.rejectedQuantity||0,3)}</strong></div><div><small>Novedad</small><strong>${row.noveltyStatus==="OPEN"?escapeText(row.noveltyType||"Abierta"):"Sin novedad"}</strong></div><div><small>Verificación</small><strong>${row.verifiedAt?`Verificada · ${escapeText(row.verifiedBy||"")}`:"Pendiente"}</strong></div></div><div class="codes"><div>${svg.outerHTML}</div><img src="${qrUrl}" alt="Código QR"></div><div class="note">Código de barras y QR generados desde el registro trazable del CRM Suministros.</div></section><script>window.addEventListener('load',()=>window.print(),{once:true});<\/script></body></html>`);win.document.close();
  }catch(error){toast(error.message||String(error),"error",7000)}
}
