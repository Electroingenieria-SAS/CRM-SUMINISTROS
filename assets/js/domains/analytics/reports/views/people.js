import { fmt } from "../../../../core/format.js";
import { state } from "../reports-state.js";
import { safe, hours, empty } from "../shared/report-values.js";
import { kpi } from "../ui/kpi.js";

export function renderPeople(){
  const summary=state.data.summary||{},rows=state.data.people||[];
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Personas activas",fmt.number(summary.activePeople),"Perfiles operativos")}
      ${kpi("Sesiones ERP",fmt.number(summary.taskSessions),hours(summary.sessionBusinessSeconds))}
      ${kpi("Actividades",fmt.number(summary.workExecutions),hours(summary.workActiveSeconds))}
      ${kpi("Pausas registradas",hours(summary.workPausedSeconds),"Dentro de actividades")}
    </div>
    <article class="bi-panel-v11140"><header><div><h3>Actividad por persona</h3><p>Sesiones, tareas y actividades capturadas. La ausencia de registro no equivale automáticamente a inactividad.</p></div></header>${peopleTable(rows)}</article>
    <div class="bi-data-note-v11140"><strong>Interpretación:</strong> esta vista mide actividad registrada en el ERP y en Jornada y actividades. Para evaluación individual debe analizarse junto con la cobertura de captura y el contexto operativo.</div>
  </section>`;
}

export function peopleTable(rows){
  if(!rows.length)return empty("No hay perfiles para analizar.");
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140">
    <thead><tr><th>Persona</th><th>Sesiones</th><th>Tiempo sesiones</th><th>Tareas</th><th>Completadas</th><th>Actividades</th><th>Tiempo actividades</th><th>Pausas</th></tr></thead>
    <tbody>${rows.map(row=>`<tr><td><strong>${safe(row.profile_name)}</strong></td><td>${fmt.number(row.sessions)}</td><td>${hours(row.session_seconds)}</td><td>${fmt.number(row.tasks)}</td><td>${fmt.number(row.tasks_completed)}</td><td>${fmt.number(row.work_executions)}</td><td>${hours(row.work_active_seconds)}</td><td>${hours(row.work_paused_seconds)}</td></tr>`).join("")}</tbody>
  </table></div>`;
}
