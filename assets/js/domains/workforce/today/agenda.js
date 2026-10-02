import { fmt, priorityBadge } from "../../../core/format.js";
import { empty } from "../../../core/ui.js";
import { icon } from "../../../core/icons.js";
import { timeOnly, weekdayShort } from "../shared/local-dates.js";

export function agendaHtml(data){
  const overdue=data.overdue||[],today=data.today||[],upcoming=data.upcoming||[];
  if(!overdue.length&&!today.length&&!upcoming.length)return empty("Jornada sin actividades programadas","Puedes iniciar una actividad espontánea desde el catálogo.");
  return `
    ${overdue.length?`<div class="agenda-section overdue"><div class="agenda-section-title"><strong>Vencidas</strong><span>${overdue.length}</span></div>${overdue.map(a=>agendaRow(a,true,Boolean(data.active))).join("")}</div>`:""}
    ${today.length?`<div class="agenda-section"><div class="agenda-section-title"><strong>Hoy</strong><span>${today.length}</span></div>${today.map(a=>agendaRow(a,false,Boolean(data.active))).join("")}</div>`:""}
    ${upcoming.length?`<div class="agenda-section upcoming"><div class="agenda-section-title"><strong>Próximos 7 días</strong><span>${upcoming.length}</span></div>${upcoming.map(upcomingRow).join("")}</div>`:""}`;
}

export function agendaRow(a,overdue,hasActive){
  return `<article class="agenda-row ${overdue?"is-overdue":""}">
    <div class="agenda-time"><strong>${a.plannedStart?timeOnly(a.plannedStart):a.dueAt?"Límite":"—"}</strong><span>${a.plannedEnd?timeOnly(a.plannedEnd):a.dueAt?fmt.day(a.dueAt):""}</span></div>
    <div class="agenda-main"><div>${priorityBadge(a.priority)} ${a.kind==="DELIVERABLE"?'<span class="badge badge-blue"><span class="badge-dot"></span>Entregable</span>':""}</div><strong>${fmt.escape(a.title)}</strong><small>${fmt.escape(a.catalogName||a.kind||"")}${a.dueAt?` · vence ${fmt.date(a.dueAt)}`:""} · tiempo automático</small></div>
    <div class="agenda-actions"><button class="btn btn-primary" data-select-assignment="${fmt.escape(a.id)}" data-catalog-id="${fmt.escape(a.catalogId||"")}" ${hasActive||!a.catalogId?"disabled":""}>${icon("activity")}<span>Seleccionar</span></button></div>
  </article>`;
}

export function upcomingRow(a){return `<article class="agenda-row compact"><div class="agenda-time"><strong>${a.plannedStart?weekdayShort(a.plannedStart):"Límite"}</strong><span>${a.plannedStart?timeOnly(a.plannedStart):fmt.day(a.dueAt)}</span></div><div class="agenda-main"><strong>${fmt.escape(a.title)}</strong><small>${fmt.escape(a.catalogName||fmt.label(a.kind))}</small></div></article>`}
