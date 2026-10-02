import { fmt } from "../../../../core/format.js";
import { clamp, num, hoursLabel, pctLabel } from "../shared/flow-values.js";

export function buildDiagnostics(summary,steps,throughput){
  const active=steps.filter(step=>num(step.wip)>0||num(step.tasks)>0);
  const bottleneck=[...active].sort((a,b)=>bottleneckScore(b)-bottleneckScore(a))[0];
  const waiting=[...active].sort((a,b)=>num(b.avgWaitHours)-num(a.avgWaitHours))[0];
  const variable=[...active].sort((a,b)=>(num(b.p90LeadHours)-num(b.medianLeadHours))-(num(a.p90LeadHours)-num(a.medianLeadHours)))[0];
  const created=throughput.reduce((sum,row)=>sum+num(row.created),0);
  const closed=throughput.reduce((sum,row)=>sum+num(row.closed),0);
  const balance=closed-created;

  return [
    {
      label:"Cuello de botella",
      title:bottleneck?.name||"Sin presión identificada",
      detail:bottleneck?`${fmt.number(bottleneck.wip)} en WIP · ${fmt.number(bottleneck.overdue)} vencido(s) · P90 ${hoursLabel(bottleneck.p90LeadHours)}.`:"Aún no hay suficiente actividad para priorizar una etapa.",
      tone:bottleneck&&num(bottleneck.overdue)>0?"risk":"info"
    },
    {
      label:"Mayor espera",
      title:waiting?.name||"Sin muestra",
      detail:waiting?`${hoursLabel(waiting.avgWaitHours)} de espera promedio y ${pctLabel(waiting.flowEfficiencyPct)} de eficiencia de flujo.`:"No hay etapas terminadas en el periodo.",
      tone:waiting&&num(waiting.avgWaitHours)>num(waiting.avgTouchHours)?"warning":"info"
    },
    {
      label:"Variabilidad",
      title:variable?.name||"Sin muestra",
      detail:variable?`Mediana ${hoursLabel(variable.medianLeadHours)} frente a P90 ${hoursLabel(variable.p90LeadHours)}.`:"No hay suficientes cierres de etapa para calcular dispersión.",
      tone:variable&&num(variable.p90LeadHours)>num(variable.medianLeadHours)*2?"warning":"info"
    },
    {
      label:"Balance del periodo",
      title:balance>=0?`${balance>0?"+":""}${fmt.number(balance)} pedidos`:`${fmt.number(balance)} pedidos`,
      detail:balance>=0?"Se cerraron tantos o más pedidos de los que ingresaron.":"Ingresaron más pedidos de los que se cerraron; vigila crecimiento del WIP.",
      tone:balance>=0?"good":"warning"
    }
  ];
}

export function bottleneckScore(step){
  const sla=num(step.slaHours);
  const pressure=sla>0?num(step.avgBusinessLeadHours)/sla:0;
  return num(step.overdue)*40+num(step.blocked)*24+num(step.waiting)*14+num(step.wip)*5+pressure*8+(100-clamp(step.flowEfficiencyPct))*0.08;
}
