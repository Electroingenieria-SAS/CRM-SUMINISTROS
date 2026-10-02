import { fmt } from "../../../../core/format.js";
import { state } from "../reports-state.js";
import { safe, hours, empty } from "../shared/report-values.js";
import { kpi } from "../ui/kpi.js";
import { barPanel } from "../charts/bar-chart.js";
import { lineChart } from "../charts/line-chart.js";

export function renderOperation(){
  const summary=state.data.summary||{};
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Tareas",fmt.number(summary.tasks),`${fmt.number(summary.tasksCompleted)} completadas`)}
      ${kpi("Tiempo productivo",hours(summary.taskBusinessSeconds),"Tiempo de negocio registrado")}
      ${kpi("Sesiones ERP",fmt.number(summary.taskSessions),`${fmt.number(summary.openTaskSessions)} abiertas`,null,null,summary.openTaskSessions?"risk":"good")}
      ${kpi("Incidencias",fmt.number(summary.issues),`${fmt.number(summary.openIssues)} abiertas`,null,null,summary.openIssues?"risk":"good")}
    </div>
    <article class="bi-panel-v11140"><header><div><h3>Rendimiento por etapa</h3><p>Volumen, tiempos promedio, percentiles y espera antes de iniciar.</p></div></header>${stageTable(state.data.stages||[])}</article>
    <div class="bi-grid-2-v11140">
      <article class="bi-panel-v11140"><header><div><h3>Throughput</h3><p>Tareas completadas por periodo.</p></div></header>${lineChart(state.data.trend||[],"tasksCompleted",null)}</article>
      ${barPanel("Pareto de incidencias",state.data.causes?.issueType,"Tipos de problema registrados")}
    </div>
  </section>`;
}

export function stageTable(rows){
  if(!rows.length)return empty("No hay etapas con actividad en el periodo.");
  return `<div class="bi-table-wrap-v11140"><table class="bi-table-v11140">
    <thead><tr><th>Etapa</th><th>Tareas</th><th>Completadas</th><th>Bloqueadas</th><th>Promedio</th><th>P50</th><th>P90</th><th>Espera prom.</th></tr></thead>
    <tbody>${rows.map(row=>`<tr>
      <td><strong>${safe(row.step_name)}</strong><small>${safe(row.step_code)}</small></td>
      <td>${fmt.number(row.tasks)}</td><td>${fmt.number(row.completed)}</td><td>${fmt.number(row.blocked)}</td>
      <td>${hours(row.avg_seconds)}</td><td>${hours(row.p50_seconds)}</td><td>${hours(row.p90_seconds)}</td><td>${hours(row.avg_wait_seconds)}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}
