import { fmt } from "../../../core/format.js";
import { plannerRangeForMode, businessDaysForRange } from "./calendar-math.js";
import { assignmentCard } from "./planned-assignment-card.js";
import { personIdentity, personState, assignmentsForDay } from "./planned-person.js";
import { weekdayShort, monthShort, parseIsoDate, isToday } from "./planner-dates.js";

export function weekPlannerHtml(data,calendar,anchor){
  const range=plannerRangeForMode("week",anchor);
  const days=businessDaysForRange(range.from,range.to,calendar);
  const people=data.people||[],assignments=data.assignments||[];
  return `<section class="work-week-board card"><div class="work-week-grid-v11330">
    <div class="work-week-corner"><strong>Equipo</strong><span>Lunes a viernes</span></div>
    ${days.map(day=>weekDayHeader(day)).join("")}
    ${people.map(person=>`${weekPerson(person)}${days.map(day=>weekCell(assignments,person.id,day)).join("")}`).join("")}
  </div></section>`;
}

export function weekDayHeader(day){
  const d=parseIsoDate(day.date);
  return `<button class="work-week-day ${isToday(d)?"today":""} ${day.isHoliday?"holiday":""}" ${day.isHoliday?"disabled":`data-plan-day="${day.date}"`}><strong>${weekdayShort(d)}</strong><span>${d.getDate()} ${monthShort(d)}</span>${day.isHoliday?`<small>${fmt.escape(day.holidayName)}</small>`:""}</button>`;
}

export function weekPerson(person){
  return `<div class="work-week-person-v11330">${personIdentity(person,personState(person))}</div>`;
}

export function weekCell(assignments,profileId,day){
  if(day.isHoliday)return `<div class="work-week-cell-v11330 holiday"><span class="work-holiday-lock">Festivo</span></div>`;
  const rows=assignmentsForDay(assignments,profileId,parseIsoDate(day.date));
  return `<div class="work-week-cell-v11330 ${isToday(parseIsoDate(day.date))?"today":""}">${rows.map(assignmentCard).join("")||'<span class="work-cell-empty-v11330">Disponible</span>'}</div>`;
}
