import { fmt } from "../../../../core/format.js";
import { empty } from "../../../../core/ui.js";
import { num, hoursLabel, pctLabel } from "../shared/flow-values.js";
import { bottleneckScore } from "../analysis/flow-diagnostics.js";

export function renderValueStream(steps){
  if(!steps.length)return empty("No hay etapas configuradas.");
  return `<div class="flow-map-scroll-v11120"><div class="flow-map-v11120" role="list" aria-label="Etapas del flujo">${steps.map((step,index)=>{
    const score=bottleneckScore(step);
    const state=num(step.overdue)>0?"risk":num(step.waiting)+num(step.blocked)>0?"warning":num(step.wip)>0?"active":"quiet";
    return `<button class="flow-node-v11120 ${state}" data-flow-stage="${fmt.escape(step.code)}" role="listitem" aria-label="${fmt.escape(step.name)}, WIP ${fmt.number(step.wip)}, lead ${hoursLabel(step.avgBusinessLeadHours)}">
      <span class="flow-node-sequence-v11120">${String(index+1).padStart(2,"0")}</span>
      <span class="flow-node-title-v11120"><strong>${fmt.escape(step.name)}</strong><small>SLA ${step.slaHours?hoursLabel(step.slaHours):"—"}</small></span>
      <span class="flow-node-kpis-v11120">
        <span><small>WIP</small><b>${fmt.number(step.wip)}</b></span>
        <span><small>Toque</small><b>${hoursLabel(step.avgTouchHours)}</b></span>
        <span><small>Espera</small><b>${hoursLabel(step.avgWaitHours)}</b></span>
        <span><small>P90</small><b>${hoursLabel(step.p90LeadHours)}</b></span>
      </span>
      <span class="flow-node-foot-v11120"><span>Efic. <b>${pctLabel(step.flowEfficiencyPct)}</b></span>${num(step.overdue)>0?`<em>${fmt.number(step.overdue)} SLA vencido(s)</em>`:`<em>${score>25?"Vigilar":"Estable"}</em>`}</span>
    </button>`;
  }).join("")}</div></div>`;
}
