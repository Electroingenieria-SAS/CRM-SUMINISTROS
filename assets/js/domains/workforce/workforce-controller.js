import { loading } from "../../core/ui.js";
import { icon } from "../../core/icons.js";
import { ensureWorkforceExperienceStyles } from "./today/experience-styles.js";
import { ensureWorkforceTimelineStyles } from "./timeline/index.js";
import { ensureWorkforceCalendarStyles } from "./calendar/index.js";
import { renderToday } from "./today/today-controller.js";
import { renderPlanner } from "./planner/planner-controller.js";
import { renderAnalytics } from "./analytics/analytics-controller.js";
import { workforceState } from "./workforce-state.js";

export async function renderWorkforce(root){
  ensureWorkforceExperienceStyles();
  ensureWorkforceTimelineStyles();
  ensureWorkforceCalendarStyles();
  clearInterval(workforceState.liveTimer);
  root.innerHTML=`
    <section class="page-head workforce-page-head">
      <div><span class="workforce-kicker">Organiza · ejecuta · demuestra</span><h2>Jornada y actividades</h2><p>Tu espacio diario para revisar prioridades, registrar avances y mantener el cronograma del equipo bajo control.</p></div>
      <div class="page-actions"><button class="btn btn-ghost" data-work-refresh>${icon("refresh")}<span>Actualizar jornada</span></button></div>
    </section>
    <nav class="workforce-tabs" aria-label="Vistas de actividades">
      <button class="workforce-tab ${workforceState.currentView==="today"?"active":""}" data-work-view="today">${icon("activity")}<span><strong>Mi jornada</strong><small>Elegir · iniciar · foto</small></span></button>
      <button class="workforce-tab ${workforceState.currentView==="planner"?"active":""}" data-work-view="planner">${icon("calendar")}<span><strong>Cronograma</strong><small>Día · semana · mes</small></span></button>
      <button class="workforce-tab ${workforceState.currentView==="analytics"?"active":""}" data-work-view="analytics">${icon("reports")}<span><strong>Indicadores</strong><small>Carga y resultados</small></span></button>
    </nav>
    <section id="workforce-content">${loading("Preparando tu jornada…")}</section>`;

  root.querySelector("[data-work-refresh]").onclick=()=>renderCurrent(root);
  root.querySelectorAll("[data-work-view]").forEach(button=>button.onclick=()=>{
    workforceState.currentView=button.dataset.workView;
    root.querySelectorAll("[data-work-view]").forEach(b=>b.classList.toggle("active",b===button));
    renderCurrent(root);
  });
  await renderCurrent(root);
}

export async function renderCurrent(root){
  clearInterval(workforceState.liveTimer);
  workforceState.plannerCalendarCleanup?.();
  workforceState.plannerCalendarCleanup=null;
  const content=root.querySelector("#workforce-content");
  if(!content)return;
  content.innerHTML=loading();
  if(workforceState.currentView==="planner")return renderPlanner(root,content);
  if(workforceState.currentView==="analytics")return renderAnalytics(root,content);
  return renderToday(root,content);
}
