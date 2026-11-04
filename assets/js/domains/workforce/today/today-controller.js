import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { modal, toast } from "../../../core/ui.js";
import { renderCurrent } from "../workforce-controller.js";
import { activeWorkCard } from "./active-activity-card.js";
import { agendaHtml } from "./agenda.js";
import { catalogHtml, bindCatalogBrowser } from "../catalog/catalog-browser.js";
import { historyHtml } from "./activity-history.js";
import { pauseDialog } from "./pause-activity.js";
import { finishDialog } from "./finish-activity.js";
import { photoPicker, evidenceDialog } from "../evidence/evidence-dialogs.js";
import { startLiveClock } from "./live-clock.js";
import { activityRequestsHtml } from "./activity-requests.js";

export async function renderToday(root,content,prefetchedData=null){
  const data=prefetchedData||await api.workMyDay();
  const plannerTab=root.querySelector('[data-work-view="planner"]');
  if(plannerTab)plannerTab.hidden=false;
  const active=Boolean(data.active?.status==="IN_PROGRESS");
  const paused=(data.pausedActivities||[]).filter(row=>row.id!==data.active?.id);
  const pending=(data.summary?.pendingApproval||0)+(data.summary?.pendingEvidence||0)+(data.summary?.pendingReview||0);
  const scheduled=[...(data.overdue||[]),...(data.today||[]),...(data.upcoming||[])];
  content.innerHTML=`
    <section class="workday-guide ${active?"is-running":"is-ready"}">
      <div class="workday-guide-copy">
        <span class="workday-eyebrow">MI JORNADA</span>
        <h2>${active?"Actividad en curso":data.active?.status==="PAUSED"?"Actividad pausada":"Elige y empieza cuando lo necesites."}</h2>
        <p>${active?"El CRM registra el tiempo automáticamente. Puedes iniciar otra actividad y la actual quedará pausada.":"Elige cualquier actividad activa, iníciala ahora o prográmala. Las pausadas conservan su avance para continuarlas."}</p>
      </div>
      <div class="workday-traffic-legend" aria-label="Semáforo de tiempo de actividad">
        <span class="green"><i></i><b>Verde</b><small>Menos de 45 min</small></span>
        <span class="yellow"><i></i><b>Amarillo</b><small>45 a 60 min</small></span>
        <span class="red"><i></i><b>Rojo</b><small>Más de 60 min · genera alerta</small></span>
      </div>
    </section>

    <section class="workday-steps" aria-label="Pasos de Mi jornada">
      <article class="workday-step ${active?"done":"current"}"><b>1</b><span><strong>Elige</strong><small>Categoría → subcategoría → actividad</small></span></article>
      <article class="workday-step ${active?"current":""}"><b>2</b><span><strong>Trabaja</strong><small>El tiempo se registra solo</small></span></article>
      <article class="workday-step"><b>3</b><span><strong>Finaliza</strong><small>Foto obligatoria en Drive</small></span></article>
    </section>

    ${activeWorkCard(data.active)}
    ${paused.length?`<section class="card workforce-agenda-card"><header class="card-head"><div><h3>Mis actividades pausadas</h3><p>Retoma cualquier actividad; el CRM pausará automáticamente la que tengas en curso y conservará los tiempos.</p></div><span class="workforce-count">${paused.length}</span></header><div class="card-body workforce-agenda-list">${paused.map(row=>`<article class="agenda-row compact"><div class="agenda-main"><strong>${fmt.escape(row.title||"Actividad")}</strong><small>${fmt.escape(row.catalogName||"")} · Pausada desde ${fmt.date(row.startedAt)}</small></div><div class="agenda-actions"><button type="button" class="btn btn-primary" data-resume-paused="${fmt.escape(row.id)}">Continuar actividad</button></div></article>`).join("")}</div></section>`:""}

    <section class="workday-status-strip">
      <article><span class="workday-status-icon">◷</span><div><small>Tiempo activo hoy</small><strong>${fmt.hours(data.summary?.activeSeconds)}</strong></div></article>
      <article><span class="workday-status-icon">✓</span><div><small>Completadas</small><strong>${fmt.number(data.summary?.completed)}</strong></div></article>
      <article class="${pending?"attention":""}"><span class="workday-status-icon">!</span><div><small>Pendientes</small><strong>${fmt.number(pending)}</strong></div></article>
    </section>

    <section class="card workday-launch-card">
      <header class="card-head">
        <div><h3>¿Qué actividad vas a realizar?</h3><p>Elige cualquiera e iníciala ahora o prográmala. Si tienes otra en curso, el sistema la pausará y podrás retomarla.</p></div>
        <span class="workday-safe-chip">Selección segura</span>
      </header>
      <div class="card-body">${catalogHtml(data.catalog||[],false)}</div>
    </section>

    ${scheduled.length?`<section class="card workforce-agenda-card workday-agenda-card">
      <header class="card-head"><div><h3>Tu agenda</h3><p>Puedes iniciar cualquiera de tus actividades programadas, incluso antes del horario previsto.</p></div><span class="workforce-count">${scheduled.length}</span></header>
      <div class="card-body workforce-agenda-list">${agendaHtml(data)}</div>
    </section>`:`<section class="workday-no-schedule"><span>✓</span><div><strong>Sin actividades programadas</strong><small>Elige una actividad del catálogo para iniciarla directamente o añadirla a tu agenda.</small></div></section>`}

    ${activityRequestsHtml(data.pendingRequests||[],data.requestHistory||[])}

    <section class="card workforce-history-card workday-history-card">
      <header class="card-head"><div><h3>Actividad de hoy</h3><p>Tiempo real, semáforo, evidencia fotográfica y revisiones.</p></div></header>
      <div class="card-body">${historyHtml(data.history||[])}</div>
    </section>`;

  bindTodayActions(content,data);
  startLiveClock(content,data.active);
}

export function bindTodayActions(content,data){
  bindCatalogBrowser(content,data,()=>rerenderWorkforceContent(content));

  content.querySelectorAll("[data-select-assignment]").forEach(button=>button.onclick=()=>{
    const all=[...(data.overdue||[]),...(data.today||[]),...(data.upcoming||[])];
    const assignment=all.find(row=>row.id===button.dataset.selectAssignment);
    if(!assignment)return;
    modal({
      title:"Confirmar inicio",
      confirmLabel:"Iniciar actividad",
      cancelLabel:"Cancelar",
      body:`<div class="work-start-dialog"><span>Actividad programada</span><strong>${fmt.escape(assignment.title)}</strong><small>${fmt.escape(assignment.catalogName||assignment.kind||"")}${assignment.plannedStart?` · ${fmt.date(assignment.plannedStart)}`:""}</small><p>El cronómetro no comenzará hasta que confirmes este paso.</p></div>`,
      onConfirm:async()=>{
        await api.workStart(button.dataset.catalogId,button.dataset.selectAssignment,{});
        toast("Actividad programada iniciada.");
        window.dispatchEvent(new CustomEvent("erp:refresh-workforce"));
        await rerenderWorkforceContent(content);
      }
    });
  });

  content.querySelectorAll("[data-resume-paused]").forEach(button=>button.addEventListener("click",async()=>{
    button.disabled=true;
    try{
      await api.workResume(button.dataset.resumePaused);
      toast("Actividad retomada. La anterior permanece pausada.");
      await rerenderWorkforceContent(content);
    }catch(error){
      toast(error.message,"error",8000);
      button.disabled=false;
    }
  }));

  content.querySelector("[data-work-pause]")?.addEventListener("click",()=>pauseDialog(data.active,content));
  content.querySelector("[data-work-resume]")?.addEventListener("click",async event=>{const button=event.currentTarget;button.disabled=true;try{await api.workResume(data.active.id);toast("Actividad reanudada.");await rerenderWorkforceContent(content)}catch(error){toast(error.message,"error");button.disabled=false}});
  content.querySelector("[data-work-finish]")?.addEventListener("click",()=>finishDialog(data.active,content));
  content.querySelector("[data-work-before-photo]")?.addEventListener("click",()=>photoPicker(data.active,"BEFORE_PHOTO",content));
  content.querySelectorAll("[data-add-evidence]").forEach(button=>button.onclick=()=>evidenceDialog({id:button.dataset.addEvidence,evidencePolicy:button.dataset.policy,title:button.dataset.title},content));
}

export async function rerenderWorkforceContent(content){
  const page=content.closest("#page-content");
  if(!page)return location.reload();
  const root=page;
  await renderCurrent(root);
}
