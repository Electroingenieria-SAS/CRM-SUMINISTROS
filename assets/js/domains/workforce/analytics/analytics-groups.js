import { fmt } from "../../../core/format.js";
import { DEVIATION_REASONS } from "../shared/activity-labels.js";
import { indicatorEmpty } from "./team-now.js";

export function barList(rows,label,value){
  if(!rows.length)return indicatorEmpty("Sin distribución todavía","Cuando existan ejecuciones aparecerá la participación por familia.");
  const total=rows.reduce((sum,row)=>sum+Number(value(row)||0),0);
  const max=Math.max(...rows.map(row=>Number(value(row)||0)),1);
  return `<div class="work-indicator-bars-v11363">${rows.map((row,index)=>{
    const current=Number(value(row)||0);
    const share=total?100*current/total:0;
    const width=Math.max(4,100*current/max);
    return `<div class="work-indicator-bar-v11363 tone-${index%6}">
      <div class="work-indicator-bar-copy-v11363"><span><strong>${fmt.escape(label(row))}</strong><small>${fmt.number(row.executions)} ejecución${Number(row.executions)===1?"":"es"}</small></span><b>${fmt.hours(current)}</b></div>
      <div class="work-indicator-bar-track-v11363"><span style="--bar-size:${width}%"></span></div>
      <small>${fmt.number(share,1)}% del tiempo activo adicional</small>
    </div>`;
  }).join("")}</div>`;
}

export function causeList(rows){
  if(!rows.length)return indicatorEmpty("Sin causas registradas","Las causas aparecerán cuando el equipo las indique al finalizar una actividad.");
  const max=Math.max(...rows.map(row=>Number(row.executions||0)),1);
  return `<div class="work-indicator-deviations-v11363">${rows.slice(0,7).map((row,index)=>{
    const width=Math.max(8,100*Number(row.executions||0)/max);
    return `<article><span class="work-indicator-deviation-index-v11363">${index+1}</span><div><strong>${fmt.escape(DEVIATION_REASONS[row.reason]||fmt.label(row.reason))}</strong><small>${fmt.number(row.executions)} caso${Number(row.executions)===1?"":"s"} · ${fmt.hours(row.activeSeconds)}</small><div><span style="--cause-size:${width}%"></span></div></div></article>`;
  }).join("")}</div>`;
}
