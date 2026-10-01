import { fmt } from "../../../core/format.js";
import { businessDaysForRange } from "../planner/index.js";
import { buildDaySlots, slotHeader, eventOverlapsSlot } from "./day-slots.js";
import { dayEvent } from "./day-event.js";
import { compactEvent } from "./month-board.js";
import { personIdentity, nonWorking, assignmentsForDay } from "./calendar-person.js";
import { clipCalendarSegments } from "./calendar-board.js";
import { isoDate, isoWeekday } from "./calendar-dates.js";

export function dayBoard(data,calendar,anchor,filters={}){
  const date=isoDate(anchor);
  const day=businessDaysForRange(date,date,calendar)[0];

  if(!day)return nonWorking("Fin de semana","Este día no pertenece a la jornada laboral.");
  if(day.isHoliday)return nonWorking(day.holidayName||"Festivo","Día no laborable. No se permiten asignaciones.");

  const segments=clipCalendarSegments((calendar?.segments||[]).filter(x=>x.isoWeekday===isoWeekday(anchor)),filters);
  const slots=buildDaySlots(segments,120);
  const people=data.people||[];
  const assignments=data.assignments||[];

  return `
    <section class="work-calendar-v11360 work-calendar-day-v11360 work-calendar-day-slots-v11367 work-calendar-day-table-v11368 card">
      <div class="work-calendar-scroll-v11360">
        <header class="work-calendar-day-head-v11360 work-calendar-day-table-grid-v11368">
          <div class="work-calendar-team-head-v11360">
            <span>Equipo</span>
            <strong>Actividad y estado</strong>
          </div>
          ${slots.map(slotHeader).join("")}
        </header>

        <div class="work-calendar-day-rows-v11360">
          ${people.map(person=>dayPersonRow(person,assignments,slots,anchor)).join("")||
            '<div class="work-calendar-empty-v11360"><strong>Sin actividades visibles</strong><span>No hay usuarios dentro de este ámbito.</span></div>'}
        </div>
      </div>
    </section>`;
}

export function dayPersonRow(person,assignments,slots,day){
  const rows=person?.specialTreatment?[]:assignmentsForDay(assignments,person.id,day);
  const noTime=rows.filter(row=>!row.plannedStart);

  return `
    <article class="work-calendar-person-row-v11360 work-calendar-day-table-grid-v11368${person?.specialTreatment?" is-special-treatment":""}">
      <div class="work-calendar-person-v11360">
        ${personIdentity(person)}
      </div>
      ${slots.map((slot,index)=>daySlot(rows,slot,index,slots,Boolean(person?.specialTreatment))).join("")}
      ${noTime.length?`<div class="work-calendar-floating-v11360">${noTime.map(compactEvent).join("")}</div>`:""}
    </article>`;
}

export function daySlot(rows,slot,index,slots,specialTreatment=false){
  const events=rows.filter(row=>row.plannedStart&&eventOverlapsSlot(row,slot));
  return `
    <div class="work-calendar-segment-cell-v11360 work-calendar-slot-cell-v11367" data-slot-start="${fmt.escape(slot.startTime)}" data-slot-end="${fmt.escape(slot.endTime)}">
      ${specialTreatment
        ? '<span class="work-calendar-special-slot-v11380">Tratamiento especial</span>'
        : events.length
          ? `<div class="work-calendar-slot-events-v11367">${events.map(dayEvent).join("")}</div>`
          : '<span class="work-calendar-slot-empty-v11367">Disponible</span>'}
    </div>`;
}
