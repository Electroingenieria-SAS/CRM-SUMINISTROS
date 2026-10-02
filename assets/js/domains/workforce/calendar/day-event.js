import { fmt } from "../../../core/format.js";
import { eventStatus } from "./calendar-status.js";
import { cancelButton, photoBadge, clockIcon } from "./calendar-icons.js";
import { timeOnly } from "./calendar-dates.js";

export function dayEvent(item){
  const status=eventStatus(item);
  return `
    <article
      class="work-calendar-event-v11360 work-calendar-event-day-v11360 work-calendar-slot-event-v11367 tone-${status.tone}${item.hasPhoto?" has-photo":""}${item.executionId||item.sourceType==="ORDER_PROCESS"?" is-executed":""}"
      data-assignment-open="${fmt.escape(item.id)}"
      role="button"
      tabindex="0"
      aria-label="Abrir ${fmt.escape(item.title||"Actividad")}">
      <div class="work-calendar-event-time-v11360">
        ${clockIcon()}
        <span>${fmt.escape(timeOnly(item.plannedStart))}${item.plannedEnd?`–${fmt.escape(timeOnly(item.plannedEnd))}`:""}</span>
      </div>
      <strong class="work-calendar-event-title-v11360">${fmt.escape(item.title||"Actividad")}</strong>
      <div class="work-calendar-event-footer-v11360">
        <span class="work-calendar-status-v11360 tone-${status.tone}">${fmt.escape(status.label)}</span>
        ${item.hasPhoto?photoBadge():""}
      </div>
      ${cancelButton(item)}
    </article>`;
}
