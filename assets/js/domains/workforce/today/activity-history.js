import { fmt, statusBadge } from "../../../core/format.js";
import { empty } from "../../../core/ui.js";
import { timeTrafficLight } from "./time-traffic.js";
import { GROUP_LABELS } from "../shared/activity-labels.js";
import { timeOnly } from "../shared/local-dates.js";

export function historyHtml(rows){
  if(!rows.length)return empty("Aún no has registrado actividades hoy","Cuando finalices una actividad aparecerá aquí.");
  return `<div class="work-history-list">${rows.map(row=>{
    const evidencePending=row.status==="WAITING_EVIDENCE";
    const reviewPending=row.status==="SUBMITTED";
    const traffic=timeTrafficLight(row.activeSeconds||0);
    return `<article class="work-history-row">
      <div class="work-history-time"><strong>${timeOnly(row.startedAt)}</strong><span>${row.endedAt?timeOnly(row.endedAt):"En curso"}</span></div>
      <div class="work-history-main"><div>${statusBadge(row.status)} <span class="work-mini-traffic tone-${traffic.tone}"><i></i>${traffic.label}</span></div><strong>${fmt.escape(row.title)}</strong><small>${fmt.hours(row.activeSeconds)} activas · ${fmt.hours(row.pausedSeconds)} pausa · ${fmt.escape(GROUP_LABELS[row.activityGroup]||fmt.label(row.activityGroup))}</small></div>
      <div class="work-history-actions">${evidencePending?`<button class="btn btn-primary" data-add-evidence="${fmt.escape(row.id)}" data-policy="${fmt.escape(row.evidencePolicy||"")}" data-title="${fmt.escape(row.title)}">Subir foto pendiente</button>`:reviewPending?'<span class="work-awaiting-review">Pendiente de revisión</span>':(row.evidence||[]).length?`<span class="work-evidence-count">${row.evidence.length} evidencia(s)</span>`:""}</div>
    </article>`;
  }).join("")}</div>`;
}
