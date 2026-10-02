import { fmt, statusBadge } from "../../../core/format.js";
import { GROUP_LABELS } from "../shared/activity-labels.js";
import { timeOnly } from "../shared/local-dates.js";

export function teamNowHtml(rows){
  if(!rows.length)return indicatorEmpty("Sin actividades adicionales activas","El equipo puede estar en procesos normales del CRM o sin actividad adicional iniciada.");
  return `<div class="work-indicator-team-v11363">${rows.map(row=>`<article class="tone-${String(row.status||"").toLowerCase()}"><span class="work-indicator-team-avatar-v11363">${fmt.initials(row.profileName)}</span><div><strong>${fmt.escape(row.profileName)}</strong><span>${fmt.escape(row.title||"Actividad")}</span><small>Desde ${timeOnly(row.startedAt)} · ${fmt.escape(GROUP_LABELS[row.group]||fmt.label(row.group||"GENERAL"))}</small></div>${statusBadge(row.status)}</article>`).join("")}</div>`;
}

export function pendingReviewsHtml(rows){
  return `<div class="work-review-list-v11363">${rows.map(row=>`<article><div class="work-review-copy-v11363"><strong>${fmt.escape(row.title)}</strong><span>${fmt.escape(row.profileName)} · ${row.dueAt?`vencía ${fmt.date(row.dueAt)}`:"sin fecha"}</span><small>${fmt.escape(row.resultNote||"Sin nota de resultado")}</small></div><div class="work-review-evidence-v11363">${(row.evidence||[]).map(evidence=>evidence.webViewLink?`<a href="${fmt.escape(evidence.webViewLink)}" target="_blank" rel="noopener">${fmt.escape(evidence.fileName||fmt.label(evidence.type))}</a>`:`<span>${fmt.escape(evidence.value||fmt.label(evidence.type))}</span>`).join("")}</div><div class="work-review-actions-v11363"><button class="btn btn-ghost" data-review-return="${fmt.escape(row.executionId)}">Devolver</button><button class="btn btn-primary" data-review-accept="${fmt.escape(row.executionId)}">Aceptar</button></div></article>`).join("")}</div>`;
}

export function indicatorEmpty(title,detail){
  return `<div class="work-indicator-empty-v11363"><span>◇</span><div><strong>${fmt.escape(title)}</strong><p>${fmt.escape(detail)}</p></div></div>`;
}
