import { fmt } from "../../../core/format.js";
import { statusLabel, statusTone } from "./planned-person.js";
import { timeOnly } from "./planner-dates.js";

export function assignmentCard(a){
  return `<article class="work-assignment-card-v11330 ${statusTone(a.memberStatus)} ${a.kind==="DELIVERABLE"?"deliverable":""}${timelineVisualClass(a)}" data-assignment-open="${fmt.escape(a.id)}" role="button" tabindex="0" aria-label="Ver detalle de ${fmt.escape(a.title)}">
    <div class="work-assignment-card-head"><span>${a.plannedStart?timeOnly(a.plannedStart):"Entregable"}${a.plannedEnd?`–${timeOnly(a.plannedEnd)}`:""}</span><em>${statusLabel(a.memberStatus)}</em></div>
    <strong>${fmt.escape(a.title)}</strong>
    <small>${fmt.escape(a.catalogName||fmt.label(a.kind))} · ${fmt.number(a.estimatedMinutes||0)} min</small>
    ${evidenceMark(a)}
    ${cancelControl(a)}
  </article>`;
}

export function compactAssignment(a){return `<button type="button" class="work-floating-assignment ${statusTone(a.memberStatus)}${timelineVisualClass(a)}" data-assignment-open="${fmt.escape(a.id)}"><b>${fmt.escape(a.title)}</b><small>${statusLabel(a.memberStatus)}${a.hasPhoto?" · 📷":""}</small></button>`}

export function timelineVisualClass(a){
  return `${a.executionId?" has-execution":""}${a.sourceType==="EXECUTION"?" manual-execution":""}`;
}

export function evidenceMark(a){
  return a.hasPhoto?'<span class="work-timeline-evidence-dot-v11350">Foto</span>':"";
}

export function cancelControl(a){
  return a.canCancel?`<button data-assignment-cancel="${fmt.escape(a.assignmentId||a.id)}" title="Cancelar asignación" aria-label="Cancelar asignación">×</button>`:"";
}
