import {api} from "../services/api.js";
import {fmt,statusBadge} from "../core/format.js";
import {modal,toast} from "../core/ui.js";
import {uploadOrderFile} from "../services/drive.js";
import {state,hasRole} from "../core/state.js";
import {navigate} from "../core/router.js";
import {moduleForStep} from "./active-work.js";

const ROUTE_STEPS=new Set(["CLIENT_POINT","CLIENT_PICKUP","LOCAL_DISPATCH","NATIONAL_DISPATCH"]);
const ACTIVE_TASK_STATUSES=new Set(["QUEUED","ASSIGNED","IN_PROGRESS","WAITING","BLOCKED"]);

const ROUTE_PROFILE={
  CLIENT_POINT:{label:"Entrega en punto",icon:"⌖",takeTitle:"Confirma el punto y toma la entrega",takeCopy:"Revisa el destino registrado por Ventas. Al tomarla podrás registrar el soporte y continuar al cierre.",takeCta:"Tomar entrega y continuar",guideTitle:"Registrar soporte de entrega",guideCopy:"Carga el soporte o completa manualmente los datos requeridos antes de continuar.",destination:"Punto de entrega",closureTitle:"Finalizar entrega en punto"},
  CLIENT_PICKUP:{label:"Cliente recoge",icon:"↙",takeTitle:"Confirma el retiro y toma el pedido",takeCopy:"Deja trazado el retiro del cliente y continúa con el soporte correspondiente.",takeCta:"Tomar retiro y continuar",guideTitle:"Registrar soporte del retiro",guideCopy:"Carga el soporte o completa manualmente los datos antes de continuar al cierre.",destination:"Referencia de retiro",closureTitle:"Finalizar retiro del cliente"},
  LOCAL_DISPATCH:{label:"Despacho local",icon:"↗",takeTitle:"Confirma el destino y toma el despacho",takeCopy:"La dirección ya fue registrada por Ventas. Toma el pedido y continúa con la guía del envío local.",takeCta:"Tomar despacho y continuar",guideTitle:"Registrar guía del despacho local",guideCopy:"Carga PDF, imagen o CSV, o registra manualmente transportadora, guía, factura y flete.",destination:"Destino",closureTitle:"Finalizar despacho local"},
  NATIONAL_DISPATCH:{label:"Despacho nacional",icon:"↗",takeTitle:"Confirma el destino y toma el despacho",takeCopy:"La dirección ya fue registrada por Ventas. Toma el pedido y continúa con la guía del envío nacional.",takeCta:"Tomar despacho y continuar",guideTitle:"Registrar guía del despacho nacional",guideCopy:"Carga PDF, imagen o CSV, o registra manualmente transportadora, guía, factura y flete.",destination:"Destino",closureTitle:"Finalizar despacho nacional"},
  GENERIC:{label:"Despacho",icon:"↗",takeTitle:"Confirma la información y toma el pedido",takeCopy:"Revisa los datos esenciales y continúa con el soporte del envío.",takeCta:"Tomar pedido y continuar",guideTitle:"Registrar guía o soporte",guideCopy:"Carga el soporte o completa manualmente los datos antes de continuar.",destination:"Destino",closureTitle:"Finalizar despacho"}
};

export function isShippingFlow(data){return ROUTE_STEPS.has(data?.order?.current_step_code)||data?.order?.current_step_code==="CLOSURE"}

function activeTask(data){return (data.tasks||[]).find(task=>ACTIVE_TASK_STATUSES.has(String(task.status||"").toUpperCase()))||null}
function actionSet(data){return new Set((data.actions?.actions||[]).map(action=>action.code))}
function latestDelivery(data){return [...(data.deliveries||[])].sort((a,b)=>new Date(b.updated_at||b.created_at)-new Date(a.updated_at||a.created_at))[0]||null}
function deliveryEvidence(data,taskId){return (data.files||[]).filter(file=>file.file_category==="DELIVERY_EVIDENCE"&&(!taskId||file.task_id===taskId)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null}
function guideFile(data){return (data.files||[]).filter(file=>file.file_category==="SHIPPING_GUIDE").sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0]||null}
function canReportNoDelivery(){return hasRole("ventas")||hasRole("super_admin")}
function canOperateShipping(){return hasRole("super_admin")||hasRole("coordinador_logistico")||hasRole("despacho_nacional")||hasRole("lider_logistica")||hasRole("jefe_logistica")}
function canOperateTask(task){const assignee=task?.assigned_profile_id||task?.assignedProfileId;return !assignee||assignee===state.profile?.id||hasRole("super_admin")||hasRole("jefe_logistica")}
function profileFor(order){return ROUTE_PROFILE[order?.delivery_route_code]||ROUTE_PROFILE.GENERIC}

function destination(delivery,order={}){
  const stored=delivery?.metadata?.destination||{};
  const metadata=order?.metadata||{};
  return {
    department:stored.department||metadata.clientDepartment||order.client_department||"",
    municipality:stored.municipality||metadata.clientCity||order.client_city||"",
    address:stored.address||metadata.clientAddress||order.client_address||"",
    source:stored.source||"SALES_ORDER_ADDRESS"
  };
}

async function storeShippingFile(data,file,category,taskId){return uploadOrderFile(data.order.id,file,category,taskId,data.order.order_number)}

export function renderShippingFlow(host,data,{reload,refreshLists}={}){
  if(!canOperateShipping())return renderCommercialViewer(host,data,{refreshLists});
  if(data.order.current_step_code==="CLOSURE")return renderClosure(host,data,{reload,refreshLists});
  return renderDispatch(host,data,{reload,refreshLists});
}

function shell(host,data,body,{nextDisabled=false,nextLabel="Siguiente",showFooter=true}={}){
  const order=data.order;
  host.innerHTML=`<div class="modal-overlay shipping-process-overlay"><section class="modal shipping-process-modal shipping-core-v11107" data-order-id="${fmt.escape(order.id)}">
    <header class="modal-head shipping-process-head"><div><span class="wizard-kicker">Despachos y entregas</span><h3>${fmt.escape(order.order_number)}</h3><p>${fmt.escape(order.client_name)} · ${fmt.escape(fmt.route(order.delivery_route_code))}</p></div><button type="button" class="icon-btn" data-close aria-label="Cerrar">×</button></header>
    <div class="modal-body shipping-process-body">${body}</div>
    ${showFooter?shippingFooter(order.current_step_code,nextDisabled,nextLabel):""}
  </section></div>`;
  host.querySelectorAll("[data-close]").forEach(button=>button.onclick=()=>host.replaceChildren());
}

function shippingFooter(step,nextDisabled=false,nextLabel="Siguiente"){
  return `<footer class="modal-foot shipping-core-footer-v11107">
    <div class="shipping-core-parallel-v11107"><span aria-hidden="true">⇄</span><div><strong>Trabajo en paralelo habilitado</strong><small>El pedido permanece asignado aunque cierres esta ventana.</small></div></div>
    <div class="shipping-core-footer-actions-v11107">
      <button type="button" class="btn btn-ghost" data-shipping-close-another="${fmt.escape(String(step||""))}">Cerrar y tomar otro</button>
      <button type="button" class="btn btn-primary" data-shipping-next-core ${nextDisabled?"disabled":""}>${fmt.escape(nextLabel)}</button>
    </div>
  </footer>`;
}

function bindFooter(host,data,{onNext,refreshLists}={}){
  const closeAnother=host.querySelector("[data-shipping-close-another]");
  if(closeAnother)closeAnother.onclick=()=>{
    const step=closeAnother.dataset.shippingCloseAnother||data.order.current_step_code||"";
    host.replaceChildren();
    navigate(moduleForStep(step),{step,assignment:"ALL"});
    refreshLists?.();
    toast("El pedido continúa en Mis pedidos activos. Puedes tomar otro sin perder el avance.","success",5500);
  };
  const next=host.querySelector("[data-shipping-next-core]");
  if(next&&onNext)next.onclick=async()=>{
    if(next.disabled)return;
    next.disabled=true;
    const old=next.textContent;
    next.textContent="Procesando…";
    try{await onNext(next)}catch(error){toast(error.message||"No fue posible continuar.","error",7500);if(next.isConnected){next.disabled=false;next.textContent=old}}
  };
}

function workflowHeader(data,stage,delivery=null){
  const profile=profileFor(data.order);
  const place=destination(delivery,data.order);
  const title=stage==="TAKE"?`Preparar ${profile.label.toLowerCase()}`:stage==="GUIDE"?profile.guideTitle:profile.closureTitle;
  const copy=stage==="TAKE"?"Empieza con lo esencial. La información detallada y las novedades quedan abajo, fuera del área principal.":stage==="GUIDE"?profile.guideCopy:"Adjunta la evidencia final requerida para completar el proceso.";
  const facts=stage==="GUIDE"&&delivery?[
    ["Guía",delivery.tracking_number||"Pendiente"],["Transportadora",delivery.carrier||"Pendiente"],["Factura transporte",carrierInvoice(delivery)||"Pendiente"],["Flete",formatCurrency(carrierCost(delivery))]
  ]:[
    ["Pedido",data.order.order_number],["Cliente",data.order.client_name],["Modalidad",profile.label],[profile.destination,place.municipality||place.address||"Registrado por Ventas"]
  ];
  return `<section class="shipping-core-summary-v11107">
    <div class="shipping-core-summary-main-v11107"><div class="shipping-core-route-icon-v11107" aria-hidden="true">${fmt.escape(profile.icon)}</div><div class="shipping-core-summary-copy-v11107"><span>${fmt.escape(profile.label)}</span><h4>${fmt.escape(title)}</h4><p>${fmt.escape(copy)}</p></div></div>
    <div class="shipping-core-facts-v11107">${facts.map(([label,value])=>`<div><small>${fmt.escape(label)}</small><strong title="${fmt.escape(value||"—")}">${fmt.escape(value||"—")}</strong></div>`).join("")}</div>
  </section>`;
}

function progress(stage){
  const active=stage==="TAKE"?1:stage==="GUIDE"?2:3;
  const rows=[[1,"Tomar"],[2,"Guía / soporte"],[3,"Cierre"]];
  return `<div class="shipping-core-progress-v11107">${rows.map(([n,label])=>`<div class="${n<active?"done":n===active?"active":""}"><span>${n<active?"✓":n}</span><strong>${label}</strong></div>`).join("")}</div>`;
}

function workspace(data,stage,taskHtml,place){
  return `<section class="shipping-core-workspace-v11107">
    <aside class="shipping-core-context-v11107">${progress(stage)}<div class="shipping-core-context-note-v11107"><strong>Solo lo necesario</strong>Completa la tarea visible a la derecha. Los datos de consulta y las novedades están debajo.</div></aside>
    <section class="shipping-core-task-v11107">${taskHtml}</section>
  </section>${secondaryPanel(data,place)}`;
}

function secondaryPanel(data,place){
  return `<details class="shipping-core-secondary-v11107">
    <summary><strong>Más información y novedades</strong><small>Destino, trazabilidad, excepciones y datos completos</small></summary>
    <div class="shipping-core-secondary-body-v11107">
      ${locationSummary(place)}
      <div data-order-support-slot></div>
      <div data-order-cancellation-slot></div>
      <details class="simple-details"><summary>Ver información completa del pedido</summary>${shippingSummary(data)}</details>
    </div>
  </details>`;
}

function destinationCard(place,label="Destino"){
  return `<div class="shipping-core-destination-v11107"><small>${fmt.escape(label)}</small><strong>${fmt.escape(place.municipality||"Municipio no registrado")}${place.department?`, ${fmt.escape(place.department)}`:""}</strong><p>${fmt.escape(place.address||"Dirección no registrada")}</p></div>`;
}

function renderDispatch(host,data,{reload,refreshLists}){
  const task=activeTask(data),delivery=latestDelivery(data),place=destination(delivery,data.order),profile=profileFor(data.order);
  const started=task?.status==="IN_PROGRESS";
  const guideReady=Boolean(delivery?.tracking_number);

  if(started&&!canOperateTask(task)){
    shell(host,data,`${workflowHeader(data,"GUIDE",delivery)}${workspace(data,"GUIDE",`<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">EN GESTIÓN</span><h4>Pedido tomado por otro responsable</h4><p>Solo el responsable actual o Jefatura puede registrar la guía y avanzar el despacho.</p></div></div>`,place)}`,{showFooter:false});
    return;
  }

  if(!started){
    const taskHtml=`<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">PASO 1</span><h4>${fmt.escape(profile.takeTitle)}</h4><p>${fmt.escape(profile.takeCopy)}</p></div><span class="shipping-core-step-badge-v11107">Paso 1 de 3</span></div>${destinationCard(place,profile.destination)}<button type="button" class="btn btn-primary shipping-core-primary-v11107" data-take-shipping>${fmt.escape(profile.takeCta)}</button>`;
    shell(host,data,`${workflowHeader(data,"TAKE")}${workspace(data,"TAKE",taskHtml,place)}`);
    const take=async()=>{
      disableCoreActions(host,true);
      try{
        let current=data,available=actionSet(current);
        if(available.has("CLAIM")){await api.executeAction(current.order.id,"CLAIM",{detail:"Pedido tomado para despacho"},current.order.version);current=await api.getOrder(current.order.id);available=actionSet(current)}
        if(available.has("START"))await api.executeAction(current.order.id,"START",{detail:"Gestión de despacho iniciada"},current.order.version);
        else if(available.has("RESUME"))await api.executeAction(current.order.id,"RESUME",{detail:"Gestión de despacho retomada"},current.order.version);
        toast("Pedido tomado. Continúa con la guía o soporte.","success",5000);refreshLists?.();await reload?.();
      }catch(error){disableCoreActions(host,false);throw error}
    };
    host.querySelector("[data-take-shipping]")?.addEventListener("click",()=>take().catch(error=>toast(error.message,"error",7000)));
    bindFooter(host,data,{refreshLists,onNext:take});
    return;
  }

  const taskHtml=`<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">PASO 2</span><h4>${fmt.escape(profile.guideTitle)}</h4><p>${fmt.escape(guideReady?"Los datos del transporte ya están registrados. Revísalos o continúa al cierre.":profile.guideCopy)}</p></div><span class="shipping-core-step-badge-v11107">Paso 2 de 3</span></div>
    ${guideReady?guideSummary(delivery,guideFile(data)):`<div class="shipping-core-destination-v11107"><small>Documento de transporte</small><strong>Pendiente de registrar</strong><p>El lector acepta PDF, imagen o CSV. Todo dato detectado puede corregirse manualmente.</p></div>`}
    <button type="button" class="btn ${guideReady?"btn-ghost":"btn-primary"} shipping-core-primary-v11107" data-add-guide>${guideReady?"Revisar o editar guía":"Cargar archivo o registrar manualmente"}</button>`;
  shell(host,data,`${workflowHeader(data,"GUIDE",delivery)}${workspace(data,"GUIDE",taskHtml,place)}`);

  const openGuide=()=>openGuideDialog(data,delivery,{reload,refreshLists});
  host.querySelector("[data-add-guide]")?.addEventListener("click",openGuide);

  const continueGuide=async()=>{
    if(!guideReady){openGuide();return;}
    disableCoreActions(host,true);
    try{
      await api.sendShippingToClosure(data.order.id,{detail:"Pedido despachado y enviado a cierre",expectedVersion:data.order.version});
      toast("Despacho registrado. Continúa con el cierre.","success",5500);refreshLists?.();await reload?.();
    }catch(error){disableCoreActions(host,false);throw error}
  };
  bindFooter(host,data,{refreshLists,onNext:continueGuide});
}

function renderClosure(host,data,{reload,refreshLists}){
  const delivery=latestDelivery(data),place=destination(delivery,data.order),task=activeTask(data),evidence=deliveryEvidence(data,task?.id),profile=profileFor(data.order);
  const taskHtml=`<div class="shipping-core-task-head-v11107"><div><span class="shipping-core-task-kicker-v11107">PASO 3</span><h4>Adjunta la evidencia final</h4><p>${fmt.escape(profile.closureTitle)}. La evidencia finaliza el proceso automáticamente cuando la carga y el registro terminan correctamente.</p></div><span class="shipping-core-step-badge-v11107">Paso 3 de 3</span></div>
    ${delivery?guideSummary(delivery,guideFile(data)):""}
    ${evidence?`<div class="shipping-core-destination-v11107" data-auto-close-status><small>Evidencia</small><strong>Registrada</strong><p>Finalizando el pedido automáticamente…</p></div>`:`<input type="file" accept="image/*" capture="environment" data-closure-photo hidden><div class="shipping-core-destination-v11107"><small>Evidencia requerida</small><strong>Foto final del despacho o entrega</strong><p>Usa la cámara o selecciona una imagen existente. Después de subirla no habrá otro paso manual.</p></div><button type="button" class="btn btn-success shipping-core-primary-v11107" data-attach-closure-photo>Adjuntar evidencia y finalizar</button>`}`;
  shell(host,data,`${workflowHeader(data,"CLOSURE",delivery)}${workspace(data,"CLOSURE",taskHtml,place)}`,{nextDisabled:Boolean(evidence)});

  const input=host.querySelector("[data-closure-photo]");
  const attach=host.querySelector("[data-attach-closure-photo]");
  const choose=()=>input?.click();
  attach?.addEventListener("click",choose);
  bindFooter(host,data,{refreshLists,onNext:choose});

  if(input)input.addEventListener("change",async()=>{
    const file=input.files?.[0];
    if(!file)return;
    if(!file.type?.startsWith("image/")){toast("Debes seleccionar una imagen.","error",6500);input.value="";return}
    disableCoreActions(host,true);
    if(attach){attach.disabled=true;attach.textContent="Procesando evidencia…"}
    try{
      const current=await ensureClosureInProgress(data);
      const closureTask=activeTask(current);
      if(!closureTask?.id)throw new Error("No se encontró la tarea activa de cierre.");
      const uploaded=await storeShippingFile(current,file,"DELIVERY_EVIDENCE",closureTask.id);
      if(!uploaded?.file?.id)throw new Error("Google Drive no devolvió el archivo cargado.");
      await api.registerShippingEvidence(current.order.id,{fileId:uploaded.file.id,taskId:closureTask.id});
      await api.finalizeShipping(current.order.id,{});
      toast("Evidencia registrada. Pedido finalizado correctamente.","success",6500);host.replaceChildren();refreshLists?.();
    }catch(error){disableCoreActions(host,false);if(attach){attach.disabled=false;attach.textContent="Adjuntar evidencia y finalizar"}input.value="";toast(error.message||"No fue posible finalizar el pedido.","error",8000)}
  });

  if(evidence)queueMicrotask(async()=>{
    try{const current=await ensureClosureInProgress(data);await api.finalizeShipping(current.order.id,{});toast("Pedido finalizado correctamente.","success",5500);host.replaceChildren();refreshLists?.();}
    catch(error){const status=host.querySelector("[data-auto-close-status]");if(status)status.innerHTML=`<small>Evidencia registrada</small><strong>Pendiente de cierre</strong><p>${fmt.escape(error.message||"No fue posible cerrar automáticamente.")}</p><button type="button" class="btn btn-success shipping-core-primary-v11107" data-retry-auto-close>Reintentar cierre</button>`;host.querySelector("[data-retry-auto-close]")?.addEventListener("click",()=>renderClosure(host,data,{reload,refreshLists}))}
  });
}

function disableCoreActions(host,disabled){host.querySelectorAll("[data-take-shipping],[data-add-guide],[data-attach-closure-photo],[data-shipping-next-core]").forEach(button=>button.disabled=disabled)}

async function ensureClosureInProgress(data){
  let current=await api.getOrder(data.order.id);
  if(current?.order?.current_step_code!=="CLOSURE")throw new Error("El pedido ya no está en la etapa de cierre.");
  let task=activeTask(current);
  if(!task)throw new Error("No existe una tarea activa de cierre para este pedido.");
  if(task.status==="IN_PROGRESS")return current;
  let available=actionSet(current);
  if(available.has("CLAIM")){await api.executeAction(current.order.id,"CLAIM",{detail:"Cierre de despacho asignado automáticamente al anexar la evidencia"},current.order.version);current=await api.getOrder(current.order.id);task=activeTask(current);available=actionSet(current)}
  if(task?.status==="WAITING"||task?.status==="BLOCKED"){
    if(available.has("RESUME")){await api.executeAction(current.order.id,"RESUME",{detail:"Cierre de despacho retomado para anexar la evidencia"},current.order.version);current=await api.getOrder(current.order.id)}
  }else if(task?.status!=="IN_PROGRESS"&&available.has("START")){await api.executeAction(current.order.id,"START",{detail:"Cierre de despacho iniciado para anexar la evidencia"},current.order.version);current=await api.getOrder(current.order.id)}
  task=activeTask(current);
  if(task?.status!=="IN_PROGRESS")throw new Error("No fue posible iniciar automáticamente la etapa de cierre.");
  return current;
}

function openGuideDialog(data,delivery,{reload,refreshLists}){
  modal({title:"Agregar guía",confirmLabel:"Guardar guía",size:"wide",body:`<div class="shipping-dialog-intro"><strong>Información de transporte</strong><p>Registra los datos del envío. El lector puede completar la información desde PDF, imagen o CSV.</p></div><div class="form-grid"><div class="field"><label>Número de guía *</label><input class="control" name="trackingNumber" value="${fmt.escape(delivery?.tracking_number||"")}" required autofocus></div><div class="field"><label>Transportadora *</label><input class="control" name="carrier" value="${fmt.escape(delivery?.carrier||"")}" required></div><div class="field full"><label>Soporte de guía</label><input class="control" name="guideFile" type="file" accept="application/pdf,.pdf,image/*,.csv,text/csv"></div></div>`,onConfirm:async dialog=>{
    const trackingNumber=dialog.querySelector('[name="trackingNumber"]')?.value.trim()||"";
    const carrier=dialog.querySelector('[name="carrier"]')?.value.trim()||"";
    const file=dialog.querySelector('[name="guideFile"]')?.files?.[0]||null;
    let fileId=delivery?.metadata?.guideFileId||null;
    if(file){const uploaded=await storeShippingFile(data,file,"SHIPPING_GUIDE",activeTask(data)?.id);fileId=uploaded?.file?.id||null}
    await api.saveShippingGuide(data.order.id,{trackingNumber,carrier,guideFileId:fileId});
    toast("Guía guardada. Revisa los datos y continúa.","success",5000);refreshLists?.();setTimeout(()=>reload?.(),80);
  }});
}

function renderCommercialViewer(host,data,{refreshLists}={}){
  const delivery=latestDelivery(data),place=destination(delivery,data.order),hasException=Boolean(data.order?.metadata?.deliveryExceptionOpen)||delivery?.status==="NOT_DELIVERED";
  shell(host,data,`<section class="shipping-commercial-view"><header><div><span>Seguimiento comercial</span><h4>Pedido enviado</h4><p>Consulta la guía, la dirección registrada y el estado. Ventas no puede modificar el despacho.</p></div>${statusBadge(delivery?.status||data.order.status)}</header>${dispatchRecap(delivery,place)}<div class="commercial-shipping-actions">${canReportNoDelivery()&&!hasException&&delivery?.dispatched_at?'<button class="btn btn-danger btn-large" data-commercial-no-delivery>Reportar no entrega</button>':hasException?'<span class="sent-order-alert">Novedad de no entrega registrada</span>':''}</div><details class="simple-details" open><summary>Ver trazabilidad y tiempos</summary>${shippingSummary(data)}</details></section>`,{showFooter:false});
  host.querySelector("[data-commercial-no-delivery]")?.addEventListener("click",()=>openNoDeliveryReport({id:data.order.id,orderNumber:data.order.order_number},{onSaved:()=>{host.replaceChildren();refreshLists?.();}}));
}

export function openNoDeliveryReport(order,{onSaved}={}){
  if(!canReportNoDelivery())return toast("Solo Ventas o Superadministración pueden registrar una no entrega.","error",7000);
  modal({title:"Reportar no entrega a Logística",confirmLabel:"Enviar reporte",size:"wide",body:`<div class="shipping-dialog-intro danger"><strong>${fmt.escape(order.orderNumber||order.order_number||"Pedido")}</strong><p>Se generará un Reporte bloqueante para Logística. El pedido no continuará hasta que Logística lo solucione y cierre.</p></div><div class="field"><label>Motivo de no entrega *</label><textarea class="control" name="reason" required autofocus placeholder="Explica por qué el cliente no recibió el pedido"></textarea></div><div class="field"><label>Acción solicitada</label><select class="control" name="requestedAction"><option value="CONTACT_CLIENT">Contactar al cliente</option><option value="REPROGRAM">Reprogramar entrega</option><option value="RETURN">Retornar mercancía</option><option value="REVIEW">Revisar con Logística</option></select></div>`,onConfirm:async dialog=>{const reason=dialog.querySelector('[name="reason"]').value.trim(),requestedAction=dialog.querySelector('[name="requestedAction"]').value;await api.reportShippingNoDelivery(order.id,{reason,requestedAction});toast("Reporte de no entrega enviado a Logística.","success",6500);onSaved?.();}});
}

function guideSummary(delivery,file){
  return `<div class="shipping-core-guide-summary-v11107"><div><small>Número de guía</small><strong>${fmt.escape(delivery?.tracking_number||"—")}</strong></div><div><small>Transportadora</small><strong>${fmt.escape(delivery?.carrier||"—")}</strong></div><div><small>Factura transportadora</small><strong>${fmt.escape(carrierInvoice(delivery)||"—")}</strong></div><div><small>Costo del flete</small><strong>${fmt.escape(formatCurrency(carrierCost(delivery)))}</strong></div></div>${file?`<a class="btn btn-ghost btn-compact" href="${fmt.escape(file.web_view_link||"#")}" target="_blank" rel="noopener">Ver soporte cargado</a>`:""}`;
}

function locationSummary(place){return `<section class="shipping-sales-address"><header><span>Dirección registrada por Ventas</span><strong>${fmt.escape(place.municipality||"Municipio no registrado")}${place.department?`, ${fmt.escape(place.department)}`:""}</strong></header><p>${fmt.escape(place.address||"Dirección no registrada")}</p><small>En Despachos esta información es de consulta. Cualquier corrección debe realizarse desde Ventas antes del envío.</small></section>`}
function dispatchRecap(delivery,place){return `<section class="dispatch-recap"><header><div><span>Envío en cierre</span><h4>${fmt.escape(delivery?.tracking_number||"Guía registrada")}</h4></div>${statusBadge(delivery?.status||"IN_TRANSIT")}</header><div class="dispatch-recap-grid"><div><small>Transportadora</small><strong>${fmt.escape(delivery?.carrier||"—")}</strong></div><div><small>Municipio</small><strong>${fmt.escape(place.municipality||"—")}</strong></div><div><small>Dirección</small><strong>${fmt.escape(place.address||"—")}</strong></div><div><small>Salida</small><strong>${fmt.date(delivery?.dispatched_at)}</strong></div></div></section>`}
function carrierInvoice(delivery){return delivery?.carrier_invoice_number||delivery?.carrierInvoiceNumber||delivery?.metadata?.carrierInvoiceNumber||""}
function carrierCost(delivery){return delivery?.carrier_cost??delivery?.carrierCost??delivery?.metadata?.carrierCost??null}
function formatCurrency(value){const n=Number(value);return Number.isFinite(n)&&n>0?new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0}).format(n):"—"}

function shippingSummary(data){
  const delivery=latestDelivery(data),place=destination(delivery,data.order),trace=data.deliveryTimeTrace||{};
  const traceCards=[["Gestión de despacho",trace.dispatchBusinessSeconds,"Tiempo productivo"],["Espera y tránsito",trace.transitBusinessSeconds,"Desde salida hasta entrega"],["Cierre de entrega",trace.closureBusinessSeconds,"Validación y evidencia"],["Tiempo muerto",trace.deadBusinessSeconds??trace.deadTimeSeconds,"Tiempo laboral sin gestión"]];
  return `<div class="simple-detail-sections"><section><h4>Información del envío</h4><div class="detail-grid"><div class="info-box"><label>Ruta</label><strong>${fmt.escape(fmt.route(data.order.delivery_route_code))}</strong></div><div class="info-box"><label>Guía</label><strong>${fmt.escape(delivery?.tracking_number||"—")}</strong></div><div class="info-box"><label>Transportadora</label><strong>${fmt.escape(delivery?.carrier||"—")}</strong></div><div class="info-box"><label>Factura transporte</label><strong>${fmt.escape(carrierInvoice(delivery)||"—")}</strong></div><div class="info-box"><label>Flete</label><strong>${fmt.escape(formatCurrency(carrierCost(delivery)))}</strong></div><div class="info-box"><label>Municipio</label><strong>${fmt.escape(place.municipality||"—")}</strong></div><div class="info-box"><label>Dirección</label><strong>${fmt.escape(place.address||"—")}</strong></div></div></section><section><h4>Resumen de tiempos laborales</h4><div class="shipping-trace-metrics">${traceCards.map(([label,value,caption])=>`<article><small>${fmt.escape(label)}</small><strong>${fmt.hours(Number(value||0))}</strong><span>${fmt.escape(caption)}</span></article>`).join("")}</div><div class="shipping-time-list">${(data.tasks||[]).map(task=>`<article><span>${fmt.escape(fmt.step(task.step_code))}</span><strong>${fmt.hours(task.business_seconds)}</strong><small>Transcurrido: ${fmt.hours(task.raw_seconds)}</small></article>`).join("")}</div></section></div>`;
}
