import { toast } from "../../../../core/ui.js";
import { num, csvEscape } from "../shared/flow-values.js";

export function exportFlow(data,partialData){
  const summary=data.summary||{};
  const steps=data.steps||[];
  const atRisk=data.atRisk||[];
  const slowest=data.slowestOrders||[];
  const partials=partialData?.orders||[];
  const rows=[
    ["SECCION","ELEMENTO","METRICA","VALOR"],
    ["RESUMEN","Flujo","Lead time mediano pedido (h)",summary.medianOrderLeadHours],
    ["RESUMEN","Flujo","P90 lead time pedido (h)",summary.p90OrderLeadHours],
    ["RESUMEN","Flujo","Eficiencia de flujo (%)",summary.flowEfficiencyPct],
    ["RESUMEN","Flujo","Tiempo de toque total (h)",summary.totalTouchHours],
    ["RESUMEN","Flujo","Espera total de etapas (h)",summary.totalWaitHours],
    ["RESUMEN","Flujo","WIP actual",summary.currentWip],
    ["RESUMEN","Flujo","Vencidos actuales",summary.currentOverdue],
    ["RESUMEN","Flujo","Cumplimiento SLA (%)",summary.slaCompliancePct],
    ["RESUMEN","Flujo","Pedidos cerrados",summary.closedOrders],
    ["RESUMEN","Flujo","Pedidos con reproceso",summary.reworkOrders]
  ];

  steps.forEach(step=>rows.push([
    "ETAPA",step.name,
    "Detalle",
    `WIP=${num(step.wip)} | toque=${num(step.avgTouchHours)}h | espera=${num(step.avgWaitHours)}h | lead=${num(step.avgBusinessLeadHours)}h | P90=${num(step.p90LeadHours)}h | eficiencia=${num(step.flowEfficiencyPct)}% | SLA=${step.slaHours??""}h | vencidos=${num(step.overdue)}`
  ]));
  atRisk.forEach(row=>rows.push(["RIESGO",row.orderNumber,row.stepName,`aging=${num(row.ageBusinessHours)}h | SLA=${row.slaHours??""}h | estado=${row.status} | prioridad=${row.priority}`]));
  slowest.forEach(row=>rows.push(["PEDIDO_CERRADO",row.orderNumber,row.clientName,`lead=${num(row.leadBusinessHours)}h | calendario=${num(row.elapsedHours)}h | ruta=${row.route}`]));
  partials.forEach(row=>rows.push(["PARCIAL",row.orderNumber,row.clientName,`rondas=${num(row.roundCount)} | primera_salida=${num(row.partialHours)}h | real=${num(row.realHours)}h | pendientes=${num(row.pendingItemCount)}`]));

  const csv="\ufeff"+rows.map(row=>row.map(csvEscape).join(";")).join("\n");
  const link=document.createElement("a");
  link.href=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
  link.download=`crm_flujo_tiempos_${data.range?.from||"desde"}_${data.range?.to||"hasta"}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
  toast("Análisis de Flujo y tiempos exportado.");
}
