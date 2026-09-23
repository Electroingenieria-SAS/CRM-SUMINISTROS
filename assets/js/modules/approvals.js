import {api} from "../services/api.js";
import {fmt,statusBadge} from "../core/format.js";
import {empty,loading,wizard,toast,guide,modal} from "../core/ui.js";
import {summaryItem} from "../core/guided.js";
import {state} from "../core/state.js";
import {openOrder} from "./orders.js";
import {timeReviewDialogHtml,durationText} from "./workforce-time-review-v11340.js";
import {ensureWorkforceExperienceStyles} from "./workforce-experience-v11344.js";

let activeMode="CENTER";
let activeState="OPEN";
let activeKind=null;
let workforceQueueCache=null;
let workforceQueueLoadedAt=0;

export async function renderApprovals(root){
  ensureWorkforceExperienceStyles();
  activeMode="CENTER";activeState="OPEN";activeKind=null;
  root.innerHTML=`
    <section class="page-head exception-page-head">
      <div><span class="exception-kicker">Control operacional</span><h2>Centro de excepciones</h2><p>Novedades, reportes, aprobaciones y alertas SLA en una sola bandeja de gestión.</p></div>
      <div class="page-actions"><button class="btn btn-ghost" id="exceptions-refresh">Actualizar SLA</button><button class="btn btn-help" id="approvals-help">Guía</button></div>
    </section>
    <section class="grid grid-kpi exception-summary" id="exception-summary">${loading("Calculando excepciones…")}</section>
    <section id="workforce-alert-banner"></section>
    <section class="exception-mode-bar">
      <button class="exception-mode active" data-mode="CENTER"><strong>Excepciones abiertas</strong><span>Novedades, reportes y aprobaciones</span></button>
      <button class="exception-mode" data-mode="WORKFORCE" hidden><strong>Alertas de jornada</strong><span>Actividades con tiempo en rojo</span><b class="workforce-mode-count" data-workforce-mode-count>0</b></button>
      <button class="exception-mode" data-mode="APPROVALS"><strong>Aprobaciones</strong><span>Decisiones pendientes e históricas</span></button>
      <button class="exception-mode" data-mode="ESCALATED"><strong>Escaladas</strong><span>Casos por encima del SLA</span></button>
      <button class="exception-mode" data-mode="HISTORY"><strong>Historial</strong><span>Situaciones ya cerradas</span></button>
    </section>
    <section class="card card-pad exception-workspace">
      <div class="exception-toolbar" id="exception-toolbar"></div>
      <div id="exception-result">${loading()}</div>
    </section>`;

  root.querySelectorAll("[data-mode]").forEach(button=>button.addEventListener("click",()=>{
    activeMode=button.dataset.mode;
    root.querySelectorAll("[data-mode]").forEach(item=>item.classList.toggle("active",item===button));
    loadWorkspace(root);
  }));
  root.querySelector("#exceptions-refresh")?.addEventListener("click",async()=>{
    try{await api.refreshOperationalSla();toast("SLA y escalamiento actualizados.","success",4500);await Promise.all([loadSummary(root),loadWorkspace(root)]);}catch(error){toast(error.message,"error",7000)}
  });
  root.querySelector("#approvals-help")?.addEventListener("click",()=>guide({title:"Centro de excepciones",description:"La bandeja prioriza lo que puede afectar el flujo y separa las notas operativas de las verdaderas excepciones.",items:[{title:"Atiende primero lo escalado",detail:"Los casos en nivel Alto o Crítico ya superaron el SLA laboral configurado."},{title:"Cierra la causa, no solo la alerta",detail:"Una Novedad o Reporte desaparece del bloqueo cuando registras la solución."},{title:"Decide las aprobaciones",detail:"Solo los perfiles con capacidad de aprobación pueden decidir; Auditoría permanece en consulta."},{title:"Revisa el historial",detail:"Todas las decisiones y tiempos quedan trazados para análisis posterior."}]}));
  await Promise.all([loadSummary(root),loadWorkforceAlertState(root),loadWorkspace(root)]);
}

async function loadSummary(root){
  const target=root.querySelector("#exception-summary");
  try{
    const s=await api.exceptionSummary();
    target.innerHTML=[
      metric("Novedades abiertas",s.openNovelties,"Bloquean el flujo","warning"),
      metric("Reportes abiertos",s.openReports,"Requieren solución","danger"),
      metric("Aprobaciones",s.pendingApprovals,"Pendientes de decisión",""),
      metric("Escaladas",s.escalated,"SLA nivel alto o crítico",s.critical?"danger":"warning")
    ].join("");
  }catch(error){target.innerHTML=`<article class="card kpi"><div class="kpi-label">Centro de excepciones</div><div class="kpi-foot danger">${fmt.escape(error.message)}</div></article>`}
}

function metric(label,value,foot,tone=""){return `<article class="card kpi exception-metric"><div class="kpi-label">${label}</div><div class="kpi-value ${tone}">${fmt.number(value||0)}</div><div class="kpi-foot">${foot}</div></article>`}

async function loadWorkspace(root){
  const toolbar=root.querySelector("#exception-toolbar");
  const target=root.querySelector("#exception-result");
  target.innerHTML=loading("Organizando la bandeja…");
  if(activeMode==="APPROVALS")return loadApprovals(root);
  if(activeMode==="WORKFORCE")return loadWorkforceAlerts(root);

  activeState=activeMode==="HISTORY"?"CLOSED":"OPEN";
  toolbar.innerHTML=`<div class="exception-filter-group"><button class="filter-chip ${!activeKind?"active":""}" data-kind="">Todo</button><button class="filter-chip ${activeKind==="NOVELTY"?"active":""}" data-kind="NOVELTY">Novedades</button><button class="filter-chip ${activeKind==="REPORT"?"active":""}" data-kind="REPORT">Reportes</button><button class="filter-chip ${activeKind==="APPROVAL"?"active":""}" data-kind="APPROVAL">Aprobaciones</button></div><span class="muted">Ordenado por SLA, prioridad y antigüedad laboral</span>`;
  toolbar.querySelectorAll("[data-kind]").forEach(button=>button.addEventListener("click",()=>{activeKind=button.dataset.kind||null;loadWorkspace(root)}));
  try{
    const data=await api.exceptionCenter(activeKind,activeState,1,150);
    let rows=data.items||[];
    if(activeMode==="ESCALATED")rows=rows.filter(item=>Number(item.slaLevel||0)>=2);
    target.innerHTML=rows.length?`<div class="exception-list">${rows.map(exceptionCard).join("")}</div>`:empty(activeMode==="HISTORY"?"Sin historial":"Sin excepciones pendientes",activeMode==="HISTORY"?"No hay situaciones cerradas para mostrar.":"La operación no tiene situaciones que requieran intervención.");
    bindCenterActions(target,root);
  }catch(error){target.innerHTML=`<div class="module-error"><strong>No fue posible cargar el Centro de Excepciones</strong><p>${fmt.escape(error.message)}</p></div>`}
}

function isReadOnlyAudit(){const roles=state.profile?.roles||[];return roles.includes("auditoria")&&roles.every(role=>role==="auditoria")}

function exceptionCard(item){
  const level=Number(item.slaLevel||0);
  const open=item.itemType==="ISSUE"?item.status==="OPEN":item.status==="PENDING";
  const canIntervene=!isReadOnlyAudit();
  const typeLabel=item.itemType==="APPROVAL"?"APROBACIÓN":item.subtype==="NOVELTY"?"NOVEDAD":"REPORTE";
  return `<article class="exception-card sla-${level} ${open?"open":"closed"}" data-exception-id="${fmt.escape(item.id)}">
    <div class="exception-card-rail"></div>
    <div class="exception-card-main">
      <header><div class="exception-identifiers"><span class="exception-type ${String(item.itemType).toLowerCase()}">${typeLabel}</span>${slaBadge(level,item.ageBusinessSeconds)}${priorityBadge(item.priority)}</div><span class="exception-time">${businessAge(item.ageBusinessSeconds)}</span></header>
      <div class="exception-order-line"><strong>${fmt.escape(item.orderNumber)}</strong><span>${fmt.escape(item.clientName)}</span><span>${fmt.escape(fmt.step(item.processCode))}</span></div>
      <h3>${fmt.escape(readable(item.title||item.subtype))}</h3><p>${fmt.escape(item.detail||"")}</p>
      <footer><span>Registró: <strong>${fmt.escape(item.actorName||"Usuario")}</strong></span><span>${Number(item.slaLevel||0)>=2&&item.escalatedRole?"Escalado a":"Destino"}: <strong>${fmt.escape(fmt.role((Number(item.slaLevel||0)>=2&&item.escalatedRole)||item.targetRole||"Sin asignar"))}</strong></span><span>${fmt.date(item.createdAt)}</span></footer>
    </div>
    <div class="exception-card-actions"><button class="btn btn-ghost" data-open-order="${fmt.escape(item.orderId)}">Ver pedido</button>${open&&item.itemType==="ISSUE"&&item.canResolve&&canIntervene?`<button class="btn btn-primary" data-resolve-issue="${fmt.escape(item.id)}">Solucionar</button>`:""}${open&&item.itemType==="APPROVAL"&&item.canResolve&&canIntervene?`<button class="btn btn-primary" data-go-approval>Decidir</button>`:""}</div>
  </article>`;
}

function slaBadge(level,age){
  const labels={0:"Dentro de SLA",1:"SLA en alerta",2:"Escalado",3:"Crítico"};
  return `<span class="sla-badge level-${level}">${labels[level]||labels[0]}</span>`;
}
function priorityBadge(priority){return `<span class="exception-priority priority-${String(priority||"MEDIUM").toLowerCase()}">${fmt.escape(fmt.label(priority||"MEDIUM"))}</span>`}
function businessAge(seconds){const h=Number(seconds||0)/3600;return h<1?`${Math.max(0,Math.round(Number(seconds||0)/60))} min laborales`:`${fmt.number(h,1)} h laborales`}
function readable(value){return String(value||"").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase())}

function bindCenterActions(target,root){
  target.querySelectorAll("[data-open-order]").forEach(button=>button.addEventListener("click",()=>openOrder(button.dataset.openOrder)));
  target.querySelectorAll("[data-resolve-issue]").forEach(button=>button.addEventListener("click",()=>resolveIssue(button.dataset.resolveIssue,root)));
  target.querySelectorAll("[data-go-approval]").forEach(button=>button.addEventListener("click",()=>{
    activeMode="APPROVALS";
    root.querySelectorAll("[data-mode]").forEach(item=>item.classList.toggle("active",item.dataset.mode==="APPROVALS"));
    loadWorkspace(root);
  }));
}

function resolveIssue(issueId,root){
  modal({title:"Solucionar excepción",confirmLabel:"Cerrar y reactivar flujo",size:"wide",body:`<div class="exception-resolution-intro"><strong>Registra la solución aplicada.</strong><p>Si es la última incidencia bloqueante, el pedido podrá continuar desde la tarea donde quedó.</p></div><div class="field"><label>Solución *</label><textarea class="control" name="resolution" rows="5" required placeholder="Describe qué se corrigió y cómo quedó resuelto"></textarea></div><div class="field"><label>Resultado</label><select class="control" name="resolutionCode"><option value="RESOLVED">Solucionado</option><option value="REPROGRAM">Reprogramado</option><option value="RETURN">Retorno / cancelación</option></select></div>`,onConfirm:async dialog=>{
    await api.resolveOrderIssue(issueId,{resolution:dialog.querySelector('[name="resolution"]').value.trim(),resolutionCode:dialog.querySelector('[name="resolutionCode"]').value});
    toast("Excepción solucionada. El flujo fue actualizado.","success",6000);
    await Promise.all([loadSummary(root),loadWorkspace(root)]);
  }});
}

async function getWorkforceQueue(force=false){
  if(!force&&workforceQueueCache&&(Date.now()-workforceQueueLoadedAt)<30000)return workforceQueueCache;
  try{
    workforceQueueCache=await api.workManagerQueue(50);
    workforceQueueLoadedAt=Date.now();
    return workforceQueueCache;
  }catch(error){
    console.info("[Workforce alerts] sin acceso a cola gerencial",error?.message||error);
    workforceQueueCache=null;
    workforceQueueLoadedAt=Date.now();
    return null;
  }
}

function invalidateWorkforceQueue(){
  workforceQueueCache=null;
  workforceQueueLoadedAt=0;
}

async function loadWorkforceAlertState(root){
  const mode=root.querySelector('[data-mode="WORKFORCE"]');
  const banner=root.querySelector("#workforce-alert-banner");
  if(!mode||!banner)return;
  const queue=await getWorkforceQueue();
  if(!queue){
    mode.hidden=true;
    banner.innerHTML="";
    return;
  }
  mode.hidden=false;
  const count=(queue.timeReviews||[]).length;
  const badge=mode.querySelector("[data-workforce-mode-count]");
  if(badge)badge.textContent=String(count);
  mode.classList.toggle("has-alerts",count>0);
  if(!count){
    banner.innerHTML="";
    return;
  }
  banner.innerHTML=`<button type="button" class="workforce-alert-banner" data-open-workforce-alerts>
    <span class="workforce-alert-banner-light"><i></i></span>
    <span class="workforce-alert-banner-copy"><strong>${count} alerta${count===1?"":"s"} de jornada requiere${count===1?"":"n"} revisión</strong><small>Actividad${count===1?"":"es"} con más de 60 minutos. Revisa tiempo real y foto final.</small></span>
    <b>Revisar ahora →</b>
  </button>`;
  banner.querySelector("[data-open-workforce-alerts]")?.addEventListener("click",()=>{
    activeMode="WORKFORCE";
    root.querySelectorAll("[data-mode]").forEach(item=>item.classList.toggle("active",item.dataset.mode==="WORKFORCE"));
    loadWorkspace(root);
  });
}

async function loadWorkforceAlerts(root){
  const toolbar=root.querySelector("#exception-toolbar");
  const target=root.querySelector("#exception-result");
  toolbar.innerHTML=`<div class="exception-filter-group"><span class="filter-chip active">Semáforo rojo · &gt; 60 min</span></div><span class="muted">Solo se muestran actividades finalizadas con foto y pendientes de revisión</span>`;
  target.innerHTML=loading("Consultando alertas de jornada…");
  const queue=await getWorkforceQueue(true);
  if(!queue){
    target.innerHTML=empty("Sin acceso a alertas de jornada","Tu perfil no tiene permisos para revisar tiempos del equipo.");
    return;
  }
  const rows=queue.timeReviews||[];
  target.innerHTML=rows.length?`<section class="workforce-alert-workspace"><header><div><h3>Alertas de jornada</h3><p>El rojo no bloquea el trabajo: señala actividades que superaron 60 minutos y deben ser revisadas después.</p></div><span class="workforce-alert-count">${rows.length}</span></header><div class="workforce-alert-list">${rows.map(workforceAlertCard).join("")}</div></section>`:empty("Sin alertas de jornada","No hay actividades con tiempo superior a 60 minutos pendientes de revisión.");
  target.querySelectorAll("[data-workforce-review]").forEach(button=>button.addEventListener("click",()=>{
    const row=rows.find(item=>item.executionId===button.dataset.workforceReview);
    if(row)openWorkforceTimeReview(row,root);
  }));
}

function workforceAlertCard(row){
  const photo=(row.evidence||[]).find(item=>["FINAL_PHOTO","AFTER_PHOTO"].includes(String(item.type||"").toUpperCase()))||(row.evidence||[]).find(item=>item.webViewLink);
  return `<article class="workforce-alert-card">
    <span class="workforce-alert-light" title="Semáforo rojo"><i></i></span>
    <div class="workforce-alert-person"><strong>${fmt.escape(row.profileName||"Funcionario")}</strong><small>${fmt.escape(row.catalogName||"Actividad")}</small></div>
    <div class="workforce-alert-main"><span>Revisión requerida</span><strong>${fmt.escape(row.title||"Actividad")}</strong><small>${fmt.date(row.startedAt)} → ${fmt.date(row.endedAt)}</small></div>
    <div class="workforce-alert-time"><strong>${durationText(row.activeSeconds)}</strong><small>${Number(row.pausedSeconds||0)>0?`${durationText(row.pausedSeconds)} en pausa`:"Sin pausas"}</small></div>
    <div class="workforce-alert-actions">${photo?.webViewLink?`<a class="btn btn-ghost" href="${fmt.escape(photo.webViewLink)}" target="_blank" rel="noopener noreferrer">Ver foto</a>`:""}<button type="button" class="btn btn-primary" data-workforce-review="${fmt.escape(row.executionId)}">Revisar alerta</button></div>
  </article>`;
}

function openWorkforceTimeReview(row,root){
  const view=modal({
    title:"Revisar alerta de jornada",
    confirmLabel:"Guardar revisión",
    size:"wide",
    body:timeReviewDialogHtml(row),
    onConfirm:async dialog=>{
      const decision=dialog.querySelector('[name="timeReviewDecision"]:checked')?.value||"REVIEWED";
      const note=dialog.querySelector('[name="timeReviewNote"]').value.trim()||null;
      if(decision==="OBSERVED"&&(!note||note.length<5))throw new Error("Escribe una observación breve para cerrar como Observado.");
      await api.workReviewTime(row.executionId,decision,note);
      invalidateWorkforceQueue();
      toast(decision==="REVIEWED"?"Alerta revisada y actividad cerrada.":"Alerta cerrada con observación.","success",6000);
      view.close();
      await Promise.all([loadWorkforceAlertState(root),loadWorkforceAlerts(root)]);
    }
  });
  view.root.querySelectorAll('[name="timeReviewDecision"]').forEach(input=>input.addEventListener("change",()=>{
    view.root.querySelectorAll(".work-time-review-choice .choice").forEach(label=>label.classList.toggle("active",Boolean(label.querySelector("input")?.checked)));
  }));
}

async function loadApprovals(root){
  const toolbar=root.querySelector("#exception-toolbar");
  const target=root.querySelector("#exception-result");
  toolbar.innerHTML=`<div class="exception-filter-group"><button class="filter-chip active" data-approval-status="PENDING">Pendientes</button><button class="filter-chip" data-approval-status="APPROVED">Aprobadas</button><button class="filter-chip" data-approval-status="REJECTED">Rechazadas</button><button class="filter-chip" data-approval-status="">Todas</button></div><span class="muted">Las más antiguas y escaladas aparecen primero</span>`;
  let status="PENDING";
  const load=async()=>{
    target.innerHTML=loading("Consultando aprobaciones…");
    const data=await api.approvals(status||null,1,150);
    target.innerHTML=data.items.length?approvalCards(data.items):empty("Sin solicitudes","No hay decisiones para este grupo.");
    target.querySelectorAll("[data-order]").forEach(button=>button.onclick=()=>openOrder(button.dataset.order));
    target.querySelectorAll("[data-decide]").forEach(button=>button.onclick=()=>decisionWizard(JSON.parse(button.dataset.request),button.dataset.decision,async()=>{await Promise.all([load(),loadSummary(root)])}));
  };
  toolbar.querySelectorAll("[data-approval-status]").forEach(button=>button.addEventListener("click",()=>{
    status=button.dataset.approvalStatus;
    toolbar.querySelectorAll("[data-approval-status]").forEach(item=>item.classList.toggle("active",item===button));
    load();
  }));
  await load();
}

function approvalCards(rows){return `<div class="decision-grid">${rows.map(request=>`<article class="decision-card sla-${Number(request.slaLevel||0)}"><div class="decision-card-head"><div><strong>${fmt.escape(request.orderNumber)}</strong><span>${fmt.escape(request.clientName)}</span></div>${statusBadge(request.status)}</div><div class="decision-card-body"><div class="exception-identifiers">${slaBadge(Number(request.slaLevel||0),request.ageBusinessSeconds)}${priorityBadge(request.priority)}</div><label>Solicitud</label><h3>${fmt.escape(fmt.request(request.requestType))}</h3>${request.requestPayload?.exceptionCode?`<span class="decision-exception-code">${fmt.escape(request.requestPayload.exceptionCode.replaceAll("_"," "))}</span>`:""}<p>${fmt.escape(request.reason)}</p><div class="decision-meta"><span>Solicita: <strong>${fmt.escape(request.requestedBy)}</strong></span><span>Destino: <strong>${fmt.escape(fmt.role(request.assignedRole||"jefe_logistica"))}</strong></span><span>${businessAge(request.ageBusinessSeconds)}</span></div></div><footer class="decision-card-foot"><button class="btn btn-ghost" data-order="${request.orderId}">Ver pedido</button>${request.status==="PENDING"&&request.canDecide?`<button class="btn btn-success" data-decide data-decision="APPROVED" data-request='${fmt.escape(JSON.stringify(request))}'>Aprobar</button><button class="btn btn-danger" data-decide data-decision="REJECTED" data-request='${fmt.escape(JSON.stringify(request))}'>Rechazar</button>`:request.status==="PENDING"?`<span class="muted">Solo consulta</span>`:""}</footer></article>`).join("")}</div>`}

function decisionWizard(request,decision,reload){
  const approve=decision==="APPROVED";
  wizard({title:approve?"Aprobar solicitud":"Rechazar solicitud",subtitle:"Revisa el efecto de la decisión y registra una justificación clara.",finishLabel:approve?"Confirmar aprobación":"Confirmar rechazo",steps:[{title:"Revisar solicitud",description:"Comprueba pedido, cliente, tipo y motivo.",content:`<div class="wizard-summary">${summaryItem("Pedido",request.orderNumber)}${summaryItem("Cliente",request.clientName)}${summaryItem("Tipo",fmt.request(request.requestType))}${summaryItem("Solicitante",request.requestedBy)}</div><div class="review-text"><strong>Motivo registrado</strong><p>${fmt.escape(request.reason)}</p></div>`},{title:"Justificar decisión",description:"La explicación quedará en la auditoría del pedido.",content:`<div class="field"><label>Motivo de la decisión *</label><textarea class="control" name="reason" required placeholder="Explique por qué ${approve?"se aprueba":"se rechaza"} la solicitud"></textarea></div>`},{title:"Confirmar",description:"Esta acción quedará registrada con tu usuario.",content:`<div class="wizard-confirm-box"><strong>${approve?"La solicitud será aprobada":"La solicitud será rechazada"}</strong><p>${approve?"La excepción quedará autorizada para la operación que la solicitó.":"El pedido conservará su estado y la excepción no podrá ejecutarse."}</p></div><div class="review-text" data-decision-reason></div>`,onEnter:({root,data})=>{root.querySelector("[data-decision-reason]").innerHTML=`<strong>Justificación</strong><p>${fmt.escape(data.reason||"")}</p>`}}],onFinish:async({data})=>{await api.decideApproval(request.id,decision,data.reason.trim());toast(`Solicitud ${approve?"aprobada":"rechazada"}.`);await reload()}});
}
