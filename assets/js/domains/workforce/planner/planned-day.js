import { fmt } from "../../../core/format.js";
import { businessDaysForRange } from "./calendar-math.js";
import { compactAssignment, timelineVisualClass, cancelControl } from "./planned-assignment-card.js";
import { personIdentity, personState, nonWorkingDayHtml, statusLabel, statusTone, assignmentsForDay } from "./planned-person.js";
import { toMinutes, hourMarks, bogotaMinutes, timeOnly, isoDate, isoWeekday } from "./planner-dates.js";

export function dayPlannerHtml(data,calendar,anchor){
  const date=isoDate(anchor),day=businessDaysForRange(date,date,calendar)[0];
  if(!day)return nonWorkingDayHtml("Fin de semana","Este día no pertenece a la jornada laboral.");
  if(day.isHoliday)return nonWorkingDayHtml(day.holidayName||"Festivo","Día no laborable. No se permiten asignaciones.");
  const segments=(calendar.segments||[]).filter(x=>x.isoWeekday===isoWeekday(anchor));
  const people=data.people||[],assignments=data.assignments||[];
  return `<section class="work-day-board card">
    <header class="work-day-timeline-head">
      <div class="work-day-team-label"><strong>Equipo</strong><span>Estado actual y actividad</span></div>
      <div class="work-day-segments-head">${segments.map(segmentHeader).join("")}</div>
    </header>
    <div class="work-day-rows">${people.map(person=>dayPersonRow(person,assignments,segments,anchor)).join("")||'<div class="work-planner-empty"><strong>Sin equipo</strong><span>No hay usuarios visibles para esta jornada.</span></div>'}</div>
  </section>`;
}

export function segmentHeader(segment){
  const marks=hourMarks(segment.startTime,segment.endTime);
  return `<div class="work-day-segment-head" style="--segment-minutes:${toMinutes(segment.endTime)-toMinutes(segment.startTime)}"><div><strong>${segment.startTime}</strong><span>– ${segment.endTime}</span></div><div class="work-day-hour-marks">${marks.map(x=>`<span style="left:${x.left}%">${x.label}</span>`).join("")}</div></div>`;
}

export function dayPersonRow(person,assignments,segments,day){
  const rows=assignmentsForDay(assignments,person.id,day);
  const state=personState(person);
  const noTime=rows.filter(a=>!a.plannedStart);
  return `<article class="work-day-person-row">
    <div class="work-day-person">${personIdentity(person,state)}</div>
    <div class="work-day-segments">${segments.map(seg=>daySegmentCell(rows,seg)).join("")}${noTime.length?`<div class="work-day-floating">${noTime.map(compactAssignment).join("")}</div>`:""}</div>
  </article>`;
}

export function daySegmentCell(rows,segment){
  const start=toMinutes(segment.startTime),end=toMinutes(segment.endTime),duration=end-start;
  const timed=rows.filter(a=>a.plannedStart&&a.plannedEnd).map(a=>{
    const aStart=bogotaMinutes(a.plannedStart),aEnd=bogotaMinutes(a.plannedEnd);
    const overlapStart=Math.max(start,aStart),overlapEnd=Math.min(end,aEnd);
    if(overlapEnd<=overlapStart)return null;
    return {a,left:100*(overlapStart-start)/duration,width:100*(overlapEnd-overlapStart)/duration};
  }).filter(Boolean);
  return `<div class="work-day-segment-cell">${timed.map(({a,left,width},i)=>`<div class="work-day-task ${statusTone(a.memberStatus)} ${a.kind==="DELIVERABLE"?"deliverable":""}${timelineVisualClass(a)}" data-assignment-open="${fmt.escape(a.id)}" role="button" tabindex="0" style="left:${left.toFixed(2)}%;width:${Math.max(width,7).toFixed(2)}%;top:${6+(i%2)*31}px" title="Ver detalle · ${fmt.escape(a.title)}"><span>${timeOnly(a.plannedStart)}–${timeOnly(a.plannedEnd)}</span><strong>${fmt.escape(a.title)}</strong><small>${statusLabel(a.memberStatus)}${a.hasPhoto?" · 📷":""}</small>${cancelControl(a)}</div>`).join("")}</div>`;
}
