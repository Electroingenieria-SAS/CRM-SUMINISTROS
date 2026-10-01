import { fmt } from "../../../core/format.js";
import { GROUP_LABELS } from "../shared/activity-labels.js";
import { indicatorEmpty } from "./team-now.js";

export function activityStandardsHtml(rows){
  if(!rows.length)return indicatorEmpty("Aún no hay referencias suficientes","Con ejecuciones reales el CRM aprende medianas y percentil 80 por actividad.");
  return `<div class="work-indicator-standards-v11363">${rows.slice(0,8).map((row,index)=>{
    const median=Math.max(0,Number(row.medianMinutes||0));
    const p80=Math.max(median,Number(row.p80Minutes||0));
    const max=Math.max(1,p80);
    return `<article>
      <span class="work-indicator-rank-v11363">${String(index+1).padStart(2,"0")}</span>
      <div class="work-indicator-standard-copy-v11363"><strong>${fmt.escape(row.name)}</strong><small>${fmt.escape(GROUP_LABELS[row.group]||fmt.label(row.group))} · ${fmt.number(row.executions)} muestras</small><div class="work-indicator-standard-bars-v11363"><span class="median" style="--standard-size:${Math.max(6,100*median/max)}%"></span><span class="p80" style="--standard-size:100%"></span></div></div>
      <div class="work-indicator-standard-values-v11363"><span><b>${fmt.number(median,1)}</b><small>min mediana</small></span><span><b>${fmt.number(p80,1)}</b><small>min P80</small></span></div>
    </article>`;
  }).join("")}</div>`;
}
