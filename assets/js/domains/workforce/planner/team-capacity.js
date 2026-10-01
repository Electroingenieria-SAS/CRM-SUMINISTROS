import { fmt } from "../../../core/format.js";
import { businessDaysForRange } from "./calendar-math.js";
import { stateHtml, personState } from "./planned-person.js";

export function teamCapacityHtml(people,assignments,range,calendar){
  if(!people.length)return `<div class="work-planner-empty"><strong>Sin equipo disponible</strong><span>No hay perfiles dentro de tu ámbito de planificación.</span></div>`;
  const working=businessDaysForRange(range.from,range.to,calendar).filter(x=>!x.isHoliday).length;
  const capacity=Math.max(1,working*Number(calendar?.minutesPerBusinessDay||530));
  return `<div class="work-capacity-list">${people.map(p=>{
    const planned=assignments.filter(a=>a.profileId===p.id&&a.memberStatus!=="CANCELLED").reduce((sum,a)=>sum+Number(a.estimatedMinutes||0),0);
    const pct=Math.round(100*planned/capacity);
    const state=personState(p);
    return `<article class="work-capacity-row">
      <div class="work-capacity-person"><span class="avatar">${fmt.initials(p.name)}</span><div><strong>${fmt.escape(p.name)}</strong>${stateHtml(state,p.activeTitle,p.id)}</div></div>
      <div class="capacity-meter" aria-label="${Math.min(pct,100)}% de capacidad planificada"><span style="width:${Math.min(pct,100)}%"></span></div>
      <div class="work-capacity-value"><b class="${pct>100?"danger":pct>85?"warning":""}">${pct}%</b><small>${fmt.number(planned)} / ${fmt.number(capacity)} min</small></div>
    </article>`;
  }).join("")}</div>`;
}
