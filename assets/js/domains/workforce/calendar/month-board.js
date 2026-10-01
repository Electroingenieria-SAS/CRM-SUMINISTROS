import { fmt } from "../../../core/format.js";
import { businessDaysForRange } from "../planner/index.js";
import { eventStatus } from "./calendar-status.js";
import { cameraIcon } from "./calendar-icons.js";
import { timeOnly, sameDate, isoDate, parseIsoDate, isoWeekday, isToday } from "./calendar-dates.js";

export function monthBoard(data,calendar,anchor){
  const first=new Date(anchor.getFullYear(),anchor.getMonth(),1);
  const last=new Date(anchor.getFullYear(),anchor.getMonth()+1,0);
  const days=businessDaysForRange(isoDate(first),isoDate(last),calendar);
  const firstVisible=days[0]?.dateObject||first;
  const leading=Math.max(0,Math.min(4,isoWeekday(firstVisible)-1));
  const cells=[...Array(leading).fill(null),...days];

  while(cells.length%5)cells.push(null);

  const assignments=data.assignments||[];

  return `
    <section class="work-calendar-v11360 work-calendar-month-v11360 card">
      <div class="work-calendar-scroll-v11360">
        <div class="work-calendar-month-weekdays-v11360">
          ${["Lunes","Martes","Miércoles","Jueves","Viernes"].map(day=>`<span>${day}</span>`).join("")}
        </div>
        <div class="work-calendar-month-grid-v11360">
          ${cells.map(day=>monthCell(day,assignments)).join("")}
        </div>
      </div>
    </section>`;
}

export function monthCell(day,assignments){
  if(!day)return '<div class="work-calendar-month-cell-v11360 is-spacer" aria-hidden="true"></div>';

  const date=parseIsoDate(day.date);
  const rows=assignments.filter(item=>sameDate(new Date(item.plannedStart||item.dueAt),date));

  if(day.isHoliday){
    return `
      <div class="work-calendar-month-cell-v11360 is-holiday">
        <div class="work-calendar-month-date-v11360"><strong>${date.getDate()}</strong><span>Festivo</span></div>
        <p>${fmt.escape(day.holidayName||"Festivo")}</p>
      </div>`;
  }

  return `
    <div
      class="work-calendar-month-cell-v11360${isToday(date)?" is-today":""}"
      data-plan-day="${day.date}"
      role="button"
      tabindex="0">
      <div class="work-calendar-month-date-v11360">
        <strong>${date.getDate()}</strong>
        <span>${rows.length?`${rows.length} actividad${rows.length===1?"":"es"}`:"Disponible"}</span>
      </div>
      <div class="work-calendar-month-events-v11360">
        ${rows.slice(0,3).map(monthEvent).join("")}
        ${rows.length>3?`<span class="work-calendar-more-v11360">+${rows.length-3} más</span>`:""}
      </div>
    </div>`;
}

export function monthEvent(item){
  const status=eventStatus(item);
  return `
    <article
      class="work-calendar-month-event-v11360 tone-${status.tone}"
      data-assignment-open="${fmt.escape(item.id)}"
      role="button"
      tabindex="0">
      <div>
        <span>${item.plannedStart?fmt.escape(timeOnly(item.plannedStart)):"Límite"}</span>
        ${item.hasPhoto?cameraIcon():""}
      </div>
      <strong>${fmt.escape(item.title||"Actividad")}</strong>
      <small>${fmt.escape(status.label)}</small>
    </article>`;
}

export function compactEvent(item){
  const status=eventStatus(item);
  return `
    <article class="work-calendar-floating-event-v11360 tone-${status.tone}" data-assignment-open="${fmt.escape(item.id)}" role="button" tabindex="0">
      <strong>${fmt.escape(item.title||"Actividad")}</strong>
      <span>${fmt.escape(status.label)}</span>
    </article>`;
}
