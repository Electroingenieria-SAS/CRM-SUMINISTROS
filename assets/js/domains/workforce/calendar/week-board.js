import { fmt } from "../../../core/format.js";
import { businessDaysForRange, plannerRangeForMode } from "../planner/index.js";
import { personIdentity, assignmentsForDay } from "./calendar-person.js";
import { eventStatus } from "./calendar-status.js";
import { cancelButton, photoBadge, clockIcon } from "./calendar-icons.js";
import { timeOnly, parseIsoDate, isToday, weekdayShort, monthShort } from "./calendar-dates.js";

export function weekBoard(data,calendar,anchor){
  const range=plannerRangeForMode("week",anchor);
  const days=businessDaysForRange(range.from,range.to,calendar);
  const people=data.people||[];
  const assignments=data.assignments||[];

  return `
    <section class="work-calendar-v11360 work-calendar-week-v11360 card">
      <div class="work-calendar-scroll-v11360">
        <div class="work-calendar-week-grid-v11360">
          <div class="work-calendar-week-corner-v11360">
            <span>Equipo</span>
            <strong>Lunes a viernes</strong>
          </div>

          ${days.map(weekDayHeader).join("")}

          ${people.map(person=>`
            <div class="work-calendar-week-person-v11360${person?.specialTreatment?" is-special-treatment":""}">${personIdentity(person)}</div>
            ${days.map(day=>weekCell(assignments,person.id,day,Boolean(person?.specialTreatment))).join("")}
          `).join("")}
        </div>
      </div>
    </section>`;
}

export function weekDayHeader(day){
  const date=parseIsoDate(day.date);
  return `
    <button
      class="work-calendar-day-head-v11360${isToday(date)?" is-today":""}${day.isHoliday?" is-holiday":""}"
      ${day.isHoliday?"disabled":`data-plan-day="${day.date}"`}>
      <strong>${weekdayShort(date)}</strong>
      <span>${date.getDate()} ${monthShort(date)}</span>
      ${day.isHoliday?`<small>${fmt.escape(day.holidayName||"Festivo")}</small>`:""}
    </button>`;
}

export function weekCell(assignments,profileId,day,specialTreatment=false){
  if(day.isHoliday){
    return `<div class="work-calendar-week-cell-v11360 is-holiday"><span class="work-calendar-holiday-v11360">Festivo</span></div>`;
  }

  const date=parseIsoDate(day.date);
  const rows=assignmentsForDay(assignments,profileId,date);

  return `
    <div
      class="work-calendar-week-cell-v11360${isToday(date)?" is-today":""}"
      data-plan-day="${day.date}"
      role="button"
      tabindex="0">
      ${specialTreatment
        ? '<span class="work-calendar-special-slot-v11380">Tratamiento especial</span>'
        : rows.length?rows.map(weekEvent).join(""):'<span class="work-calendar-available-v11360">Disponible</span>'}
    </div>`;
}

export function weekEvent(item){
  const status=eventStatus(item);
  return `
    <article
      class="work-calendar-event-v11360 work-calendar-event-week-v11360 tone-${status.tone}${item.hasPhoto?" has-photo":""}${item.executionId||item.sourceType==="ORDER_PROCESS"?" is-executed":""}"
      data-assignment-open="${fmt.escape(item.id)}"
      role="button"
      tabindex="0">
      <div class="work-calendar-event-time-v11360">
        ${clockIcon()}
        <span>${item.plannedStart?fmt.escape(timeOnly(item.plannedStart)):"Sin hora"}${item.plannedEnd?`–${fmt.escape(timeOnly(item.plannedEnd))}`:""}</span>
      </div>
      <strong class="work-calendar-event-title-v11360">${fmt.escape(item.title||"Actividad")}</strong>
      <div class="work-calendar-event-meta-v11360">${fmt.escape(item.catalogName||fmt.label(item.kind||"ACTIVITY"))}</div>
      <div class="work-calendar-event-footer-v11360">
        <span class="work-calendar-status-v11360 tone-${status.tone}">${fmt.escape(status.label)}</span>
        ${item.hasPhoto?photoBadge():""}
      </div>
      ${cancelButton(item)}
    </article>`;
}
