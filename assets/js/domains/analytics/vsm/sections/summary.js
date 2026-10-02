import { fmt } from "../../../../core/format.js";
import { hoursLabel, pctLabel } from "../shared/flow-values.js";
import { metric } from "../ui/metric.js";

export function flowSummaryHtml(flowView){return `
    <section class="flow-summary-v11120" aria-label="Indicadores principales del flujo">
      ${metric("Lead time mediano",hoursLabel(flowView.summary.medianOrderLeadHours),`P90 ${hoursLabel(flowView.summary.p90OrderLeadHours)}`,"lead")}
      ${metric("Eficiencia de flujo",pctLabel(flowView.summary.flowEfficiencyPct),`${hoursLabel(flowView.summary.totalTouchHours)} de toque`,"efficiency")}
      ${metric("Espera del proceso",hoursLabel(flowView.summary.totalWaitHours),`${pctLabel(flowView.waitShare)} del tiempo de etapas`,"wait")}
      ${metric("WIP actual",fmt.number(flowView.summary.currentWip),`${fmt.number(flowView.summary.currentWaitingBlocked)} esperando o bloqueados`,"wip")}
      ${metric("Cumplimiento SLA",pctLabel(flowView.summary.slaCompliancePct),`${fmt.number(flowView.summary.currentOverdue)} actualmente vencidos`,"sla")}
      ${metric("Pedidos cerrados",fmt.number(flowView.closed),`${fmt.number(flowView.summary.reworkOrders)} con reproceso de etapa`,"throughput")}
    </section>
`;}

export function flowDiagnosticsHtml(flowView){return `
    <section class="flow-diagnostics-v11120" aria-label="Diagnóstico automático del flujo">
      ${flowView.diagnostics.map(item=>`
        <article class="flow-diagnostic-v11120 ${item.tone}">
          <span>${fmt.escape(item.label)}</span>
          <strong>${fmt.escape(item.title)}</strong>
          <p>${fmt.escape(item.detail)}</p>
        </article>`).join("")}
    </section>
`;}
