import { fmt } from "../../../../core/format.js";
import { clamp, num, hoursLabel, pctLabel } from "../shared/flow-values.js";

export function renderCurrentFlowTable(steps){
  const rows=steps.filter(step=>num(step.wip)>0||num(step.tasks)>0);
  if(!rows.length)return `<div class="flow-empty-v11120">No hay actividad suficiente para construir el control por etapa.</div>`;
  return `<div class="table-wrap flow-table-wrap-v11120"><table class="flow-table-v11120">
    <thead><tr><th>Etapa</th><th>WIP</th><th>Trabajando</th><th>Espera</th><th>Bloq.</th><th>Vencidos</th><th>Más antiguo</th><th>SLA</th></tr></thead>
    <tbody>${rows.map(step=>`<tr data-stage-row="${fmt.escape(step.code)}" class="${num(step.overdue)>0?"flow-row-risk-v11120":""}">
      <td data-label="Etapa"><strong>${fmt.escape(step.name)}</strong><small>${fmt.number(step.tasks)} cierre(s) en muestra</small></td>
      <td data-label="WIP"><b>${fmt.number(step.wip)}</b></td>
      <td data-label="Trabajando">${fmt.number(step.inProgress)}</td>
      <td data-label="Espera">${fmt.number(step.waiting)}</td>
      <td data-label="Bloqueados">${fmt.number(step.blocked)}</td>
      <td data-label="Vencidos"><span class="${num(step.overdue)>0?"danger":"success"}">${fmt.number(step.overdue)}</span></td>
      <td data-label="Más antiguo">${hoursLabel(step.oldestBusinessHours)}</td>
      <td data-label="SLA">${step.slaHours?hoursLabel(step.slaHours):"—"}</td>
    </tr>`).join("")}</tbody>
  </table></div>`;
}

export function renderTimeComposition(steps){
  const rows=steps.filter(step=>num(step.tasks)>0);
  if(!rows.length)return `<div class="flow-empty-v11120">Las etapas aún no tienen cierres dentro del periodo seleccionado.</div>`;
  return `<div class="flow-time-list-v11120">${rows.map(step=>{
    const lead=Math.max(num(step.avgBusinessLeadHours),num(step.avgTouchHours)+num(step.avgWaitHours),0);
    const touchPct=lead>0?clamp(num(step.avgTouchHours)/lead*100):0;
    const waitPct=lead>0?clamp(num(step.avgWaitHours)/lead*100):0;
    return `<article class="flow-time-row-v11120" data-stage-time="${fmt.escape(step.code)}">
      <div class="flow-time-label-v11120"><strong>${fmt.escape(step.name)}</strong><span>${fmt.number(step.tasks)} tarea(s) · SLA ${step.slaHours?hoursLabel(step.slaHours):"—"}</span></div>
      <div class="flow-time-bar-v11120" aria-label="Toque ${pctLabel(touchPct)}, espera ${pctLabel(waitPct)}">
        <span class="touch" style="--flow-size:${touchPct}%"></span><span class="wait" style="--flow-size:${waitPct}%"></span>
      </div>
      <div class="flow-time-values-v11120"><span><small>Toque</small><b>${hoursLabel(step.avgTouchHours)}</b></span><span><small>Espera</small><b>${hoursLabel(step.avgWaitHours)}</b></span><span><small>Lead</small><b>${hoursLabel(step.avgBusinessLeadHours)}</b></span><span><small>Efic.</small><b>${pctLabel(step.flowEfficiencyPct)}</b></span></div>
    </article>`;
  }).join("")}</div>`;
}
