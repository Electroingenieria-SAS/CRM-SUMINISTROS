import {fmt} from "../../../core/format.js";
import {businessDaysForRange,plannerRangeForMode} from "../planner/index.js";
import {assignmentsForDay} from "./calendar-person.js";
import {eventStatus,personState} from "./calendar-status.js";
import {isoDate,parseIsoDate,weekdayShort,monthShort,isToday,sameDate,timeOnly} from "./calendar-dates.js";

const safe=value=>fmt.escape(String(value??""));
const dateTitle=day=>{
  const date=parseIsoDate(day.date);
  return `${weekdayShort(date)} ${date.getDate()} ${monthShort(date)}`;
};
const eventsOn=(items,day)=>items.filter(item=>{
  const stamp=item.plannedStart||item.dueAt||item.actualStart;
  return stamp&&sameDate(new Date(stamp),parseIsoDate(day.date));
});

export function mobileAssignmentCard(item,personName=""){
  const state=eventStatus(item);
  const time=item.plannedStart?timeOnly(item.plannedStart):"Sin hora";
  const end=item.plannedEnd?`–${timeOnly(item.plannedEnd)}`:"";
  return `<article class="work-mobile-event tone-${safe(state.tone)}" data-assignment-open="${safe(item.id)}" role="button" tabindex="0" aria-label="Ver detalle de ${safe(item.title||"actividad")}">
    <span class="work-mobile-event-time">${safe(time)}${safe(end)}</span>
    <div class="work-mobile-event-copy"><strong>${safe(item.title||"Actividad")}</strong>
      ${personName?`<small>${safe(personName)}</small>`:""}</div>
    <span class="work-mobile-event-state">${safe(state.label)}</span>
  </article>`;
}

function dayCards(data,calendar,anchor){
  const iso=isoDate(anchor);
  const day=businessDaysForRange(iso,iso,calendar)[0];
  if(!day||day.isHoliday)return `<section class="work-mobile-empty" role="status"><strong>${safe(day?.holidayName||"Día no laborable")}</strong><p>Selecciona otro día para consultar actividades.</p></section>`;
  const people=data.people||[],assignments=data.assignments||[];
  const populated=people.filter(p=>assignmentsForDay(assignments,p.id,anchor).length);
  const visible=populated.length?people.filter(p=>populated.includes(p)):people;
  return `<header class="work-mobile-board-heading"><strong>${safe(dateTitle(day))}</strong><small>${assignments.length} actividad(es) · ${people.length} integrante(s)</small></header>
  ${visible.length?visible.map(person=>{
    const items=assignmentsForDay(assignments,person.id,anchor);
    const state=personState(person);
    return `<section class="work-mobile-person"><div class="work-mobile-person-head">
    <span class="work-mobile-avatar">${safe(fmt.initials(person.name))}</span><div><strong>${safe(person.name)}</strong><small>${safe(state.label)}</small></div>
    <b>${items.length} actividad(es)</b></div>
    <div class="work-mobile-event-list">${items.length?items.map(row=>mobileAssignmentCard(row)).join(""):`<span class="work-mobile-available">Sin actividades programadas</span>`}</div></section>`;
  }).join(""):`<div class="work-mobile-empty"><strong>Sin integrantes visibles</strong><p>Ajusta los filtros del cronograma.</p></div>`}`;
}

function weekCards(data,calendar,anchor){
  const range=plannerRangeForMode("week",anchor);
  const days=businessDaysForRange(range.from,range.to,calendar);
  const names=new Map((data.people||[]).map(p=>[String(p.id),p.name]));
  return days.map(day=>{
    const items=eventsOn(data.assignments||[],day);
    return `<section class="work-mobile-day">
      <header class="work-mobile-day-head${isToday(parseIsoDate(day.date))?" is-today":""}">
        <span><strong>${safe(dateTitle(day))}</strong><small>${items.length} actividad(es)</small></span>
        <button type="button" data-work-mobile-day="${safe(day.date)}" ${day.isHoliday?"disabled":""} aria-label="Abrir ${safe(dateTitle(day))}">Ver día</button>
      </header>
      ${day.isHoliday?`<div class="work-mobile-available">${safe(day.holidayName||"Festivo")}</div>`:
        items.length?`<div class="work-mobile-event-list">${items.map(item=>mobileAssignmentCard(item,names.get(String(item.profileId))||"")).join("")}</div>`:
        '<div class="work-mobile-available">Sin actividades planificadas</div>'}
    </section>`;
  }).join("");
}

function monthCards(data,calendar,anchor){
  const first=new Date(anchor.getFullYear(),anchor.getMonth(),1);
  const last=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);
  const days=businessDaysForRange(isoDate(first),isoDate(last),calendar);
  const names=new Map((data.people||[]).map(p=>[String(p.id),p.name]));
  const leading=days[0]?(parseIsoDate(days[0].date).getDay()+6)%7:0;
  const grid=`${Array.from({length:leading},()=>'<span aria-hidden="true"></span>').join("")}${days.map(day=>{
    const date=parseIsoDate(day.date),items=eventsOn(data.assignments||[],day);
    return `<button type="button" class="work-mobile-month-date${isToday(date)?" is-today":""}${items.length?" has-events":""}" data-work-mobile-day="${safe(day.date)}" ${day.isHoliday?"disabled":""} aria-label="${safe(dateTitle(day))}, ${items.length} actividad(es)">
      <b>${date.getDate()}</b><i aria-hidden="true"></i></button>`;
  }).join("")}`;
  const scheduled=days.filter(day=>!day.isHoliday&&eventsOn(data.assignments||[],day).length);
  return `<div class="work-mobile-month-grid" role="group" aria-label="Días laborables del mes">
    ${["L","M","X","J","V"].map(name=>`<span class="work-mobile-month-weekday">${name}</span>`).join("")}
    ${grid}
  </div>
  <div class="work-mobile-month-agenda"><h4>Actividades del mes</h4>
    ${scheduled.length?scheduled.map(day=>`<section class="work-mobile-day">
      <header class="work-mobile-day-head"><strong>${safe(dateTitle(day))}</strong></header>
      <div class="work-mobile-event-list">${eventsOn(data.assignments||[],day).map(item=>mobileAssignmentCard(item,names.get(String(item.profileId))||"")).join("")}</div>
    </section>`).join(""):'<p class="work-mobile-available">No hay actividades programadas para este mes.</p>'}
  </div>`;
}

export function mobileWorkforceCalendar({mode,anchor,data,calendar}){
  const content=mode==="day"?dayCards(data,calendar,anchor):mode==="month"?monthCards(data,calendar,anchor):weekCards(data,calendar,anchor);
  return `<div class="work-calendar-mobile" data-calendar-mobile-view aria-label="Cronograma móvil">${content}</div>`;
}

