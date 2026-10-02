import { fmt } from "../../../core/format.js";
import { sameDate } from "./planner-dates.js";

export const STATUS_META={
  PLANNED:{label:"Programada",tone:"planned"},
  READY:{label:"Lista",tone:"ready"},
  IN_PROGRESS:{label:"En curso",tone:"running"},
  PAUSED:{label:"En pausa",tone:"paused"},
  WAITING_EVIDENCE:{label:"Pendiente evidencia",tone:"evidence"},
  SUBMITTED:{label:"En revisión",tone:"review"},
  COMPLETED:{label:"Completada",tone:"completed"},
  RETURNED:{label:"Devuelta",tone:"returned"},
  CANCELLED:{label:"Cancelada",tone:"cancelled"}
};

export function personIdentity(person,state){
  return `<span class="avatar">${fmt.initials(person.name)}</span><div class="work-person-copy"><strong>${fmt.escape(person.name)}</strong>${stateHtml(state,person.activeTitle,person.id)}</div>`;
}

export function stateHtml(state,title,profileId=""){
  return `<div class="work-person-state ${state.tone}"><span>${state.label}</span>${title?`<button type="button" class="work-current-activity" data-active-profile="${fmt.escape(profileId)}" title="Ver qué está haciendo">${fmt.escape(title)}</button>`:""}</div>`;
}

export function personState(person){
  const status=String(person.activeStatus||"").toUpperCase();
  if(status==="PAUSED")return {label:"En pausa",tone:"paused"};
  if(person.activeTitle)return {label:"Ocupado",tone:"busy"};
  return {label:"Disponible",tone:"available"};
}

export function nonWorkingDayHtml(title,detail){
  return `<section class="work-nonworking-day card"><span>✦</span><div><strong>${fmt.escape(title)}</strong><p>${fmt.escape(detail)}</p></div></section>`;
}

export function statusLabel(status){return STATUS_META[String(status||"PLANNED").toUpperCase()]?.label||fmt.label(status||"PLANNED")}

export function statusTone(status){return `status-${STATUS_META[String(status||"PLANNED").toUpperCase()]?.tone||"planned"}`}

export function assignmentsForDay(rows,profileId,day){return rows.filter(a=>a.profileId===profileId&&sameDate(new Date(a.plannedStart||a.dueAt),day)).sort((a,b)=>new Date(a.plannedStart||a.dueAt)-new Date(b.plannedStart||b.dueAt))}

export function firstName(name=""){return String(name).trim().split(/\s+/)[0]||""}
