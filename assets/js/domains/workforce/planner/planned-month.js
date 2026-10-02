import { fmt } from "../../../core/format.js";
import { businessDaysForRange } from "./calendar-math.js";
import { timelineVisualClass } from "./planned-assignment-card.js";
import { statusTone, firstName } from "./planned-person.js";
import { timeOnly, parseIsoDate, isoDate, isoWeekday, sameDate, isToday } from "./planner-dates.js";

export function monthPlannerHtml(data,calendar,anchor){
  const first=new Date(anchor.getFullYear(),anchor.getMonth(),1),last=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);
  const days=businessDaysForRange(isoDate(first),isoDate(last),calendar);
  const firstVisible=days[0]?.dateObject||first;
  const leading=Math.max(0,Math.min(4,isoWeekday(firstVisible)-1));
  const cells=[...Array(leading).keys()].map(()=>null).concat(days);
  while(cells.length%5)cells.push(null);
  const assignments=data.assignments||[];
  return `<section class="work-month-board card"><div class="work-month-weekdays-v11330">${["Lun","Mar","Mié","Jue","Vie"].map(x=>`<span>${x}</span>`).join("")}</div><div class="work-month-grid-v11330">${cells.map(day=>{
    if(!day)return '<div class="work-month-day-v11330 spacer" aria-hidden="true"></div>';
    const d=parseIsoDate(day.date),rows=assignments.filter(a=>sameDate(new Date(a.plannedStart||a.dueAt),d));
    if(day.isHoliday)return `<div class="work-month-day-v11330 holiday"><div class="work-month-date"><strong>${d.getDate()}</strong><span>Festivo</span></div><p>${fmt.escape(day.holidayName)}</p></div>`;
    return `<div class="work-month-day-v11330 ${isToday(d)?"today":""}" data-plan-day="${day.date}" role="button" tabindex="0"><div class="work-month-date"><strong>${d.getDate()}</strong><span>${rows.length?"Actividad":"Disponible"}</span></div><div class="work-month-items-v11330">${rows.slice(0,4).map(monthAssignment).join("")}${rows.length>4?`<small class="work-more-count">+${rows.length-4} más</small>`:""}</div></div>`;
  }).join("")}</div></section>`;
}

export function monthAssignment(a){
  return `<button type="button" class="work-month-item-v11330 ${statusTone(a.memberStatus)} ${a.kind==="DELIVERABLE"?"deliverable":""}${timelineVisualClass(a)}" data-assignment-open="${fmt.escape(a.id)}"><b>${a.plannedStart?timeOnly(a.plannedStart):"Límite"}</b><span>${fmt.escape(a.title)}</span><small>${fmt.escape(firstName(a.profileName))}${a.hasPhoto?" · 📷":""}</small></button>`;
}
