import { fmt } from "../../../core/format.js";
import { personState } from "./calendar-status.js";
import { sameDate } from "./calendar-dates.js";

export function personIdentity(person){
  const state=personState(person);
  return `
    <span class="work-calendar-avatar-v11360">${fmt.initials(person.name)}</span>
    <div class="work-calendar-person-copy-v11360">
      <strong>${fmt.escape(person.name)}</strong>
      <div class="work-calendar-person-state-v11360 tone-${state.tone}">
        <i></i>
        <span>${state.label}</span>
        ${person.activeTitle?`<button type="button" data-active-profile="${fmt.escape(person.id)}">${fmt.escape(person.activeTitle)}</button>`:""}
      </div>
    </div>`;
}

export function nonWorking(title,detail){
  return `
    <section class="work-calendar-v11360 work-calendar-nonworking-v11360 card">
      <span>✦</span>
      <div><strong>${fmt.escape(title)}</strong><p>${fmt.escape(detail)}</p></div>
    </section>`;
}

export function assignmentsForDay(rows,profileId,day){
  return (rows||[])
    .filter(item=>item.profileId===profileId&&sameDate(new Date(item.plannedStart||item.dueAt),day))
    .sort((a,b)=>new Date(a.plannedStart||a.dueAt)-new Date(b.plannedStart||b.dueAt));
}
