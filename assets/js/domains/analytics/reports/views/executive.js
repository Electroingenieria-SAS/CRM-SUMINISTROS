import { fmt } from "../../../../core/format.js";
import { state } from "../reports-state.js";
import { safe, num, pct, money, hours } from "../shared/report-values.js";
import { kpi } from "../ui/kpi.js";
import { barPanel } from "../charts/bar-chart.js";
import { lineChart } from "../charts/line-chart.js";

export function renderExecutive(){
  const summary=state.data.summary||{},previous=state.data.previous||{};
  return `<section class="bi-tab-section-v11140">
    <div class="bi-kpis-v11140">
      ${kpi("Pedidos creados",fmt.number(summary.orders),`${fmt.number(summary.activeOrders)} activos`,summary.orders,previous.orders)}
      ${kpi("Facturación",money(summary.invoiceAmount),`${fmt.number(summary.invoicedOrders)} pedidos facturados`,summary.invoiceAmount,previous.invoiceAmount,"good")}
      ${kpi("Pedidos cerrados",fmt.number(summary.closedOrders),`A tiempo: ${pct(summary.onTimePct)}`,summary.closedOrders,previous.closedOrders)}
      ${kpi("Ciclo promedio",hours(summary.avgCycleSeconds),`P90: ${hours(summary.p90CycleSeconds)}`,summary.avgCycleSeconds,previous.avgCycleSeconds,"warn")}
      ${kpi("Entregas",fmt.number(summary.delivered),`${fmt.number(summary.deliveries)} gestiones`,summary.delivered,previous.delivered,"good")}
      ${kpi("Costo logístico",money(summary.shippingCost),"Transportadoras y despachos",summary.shippingCost,previous.shippingCost,"warn")}
      ${kpi("Tareas completadas",fmt.number(summary.tasksCompleted),`${hours(summary.taskBusinessSeconds)} productivas`,summary.tasksCompleted,previous.tasksCompleted)}
      ${kpi("Incidencias",fmt.number(summary.issues),`${fmt.number(summary.blockingIssues)} bloqueantes`,summary.issues,previous.issues,summary.issues?"risk":"good")}
    </div>
    <div class="bi-grid-v11140">
      <article class="bi-panel-v11140">
        <header><div><h3>Tendencia operacional</h3><p>Pedidos creados y cerrados durante el periodo.</p></div><div class="bi-legend-v11140"><i></i>Creados<i class="secondary"></i>Cerrados</div></header>
        ${lineChart(state.data.trend||[],"ordersCreated","ordersClosed")}
      </article>
      <article class="bi-panel-v11140"><header><div><h3>Lectura ejecutiva</h3><p>Señales que requieren atención o seguimiento.</p></div></header>${insights()}</article>
    </div>
    <div class="bi-grid-3-v11140">
      ${barPanel("Distribución por estado",state.data.dimensions?.status,"Pedidos según estado actual")}
      ${barPanel("Etapas actuales",state.data.dimensions?.steps,"Carga visible por etapa")}
      ${barPanel("Ciudades",state.data.dimensions?.cities,"Concentración geográfica de pedidos")}
    </div>
  </section>`;
}

export function insights(){
  const summary=state.data.summary||{},quality=state.data.quality||{},stages=state.data.stages||[];
  const slow=[...stages].sort((a,b)=>num(b.p90_seconds)-num(a.p90_seconds))[0];
  const items=[];
  if(num(quality.orderFieldCompletenessPct)<90)items.push(["Calidad de datos",`La completitud de campos clave está en ${pct(quality.orderFieldCompletenessPct)}. Conviene cerrar primero las brechas de captura.`]);
  if(num(quality.openTaskSessions)>0)items.push(["Sesiones abiertas",`${fmt.number(quality.openTaskSessions)} sesión(es) de tarea continúan abiertas y pueden distorsionar tiempos.`]);
  if(num(summary.pendingApprovals)>0)items.push(["Aprobaciones pendientes",`${fmt.number(summary.pendingApprovals)} solicitud(es) permanecen pendientes.`]);
  if(num(summary.blockingIssues)>0)items.push(["Bloqueos",`${fmt.number(summary.blockingIssues)} incidencia(s) bloqueante(s) fueron registradas en el periodo.`]);
  if(slow)items.push(["Etapa con mayor P90",`${slow.step_name||slow.step_code} presenta P90 de ${hours(slow.p90_seconds)}.`]);
  if(!items.length)items.push(["Sin alertas críticas","Los indicadores disponibles no muestran alertas fuertes para este periodo; valida siempre la cobertura de captura."]);
  return `<div class="bi-insights-v11140">${items.map(([title,text])=>`<div class="bi-insight-v11140"><strong>${safe(title)}</strong><p>${safe(text)}</p></div>`).join("")}</div>`;
}
