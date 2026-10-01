import { fmt } from "../../../core/format.js";
import { isPhotoEvidence, statusLabel, statusTone, evidenceLabel, timeRange, durationLabel, safeHttpUrl } from "./timeline-formatters.js";

export function timelineDetailHtml(detail={}){
  const evidence=Array.isArray(detail.evidence)?detail.evidence:[];
  const images=evidence.filter(isPhotoEvidence);
  const cover=images[0]||null;
  const status=detail.status||"PLANNED";
  const activeSeconds=Number(detail.activeSeconds||0);
  const planned=detail.plannedStart?timeRange(detail.plannedStart,detail.plannedEnd):"Sin bloque previo";
  const actual=detail.startedAt?timeRange(detail.startedAt,detail.endedAt):"Aún no iniciada";
  const isOrderProcess=detail.type==="ORDER_PROCESS"||detail.sourceType==="ORDER_TASK"||detail.sourceType==="CUT_EXECUTION";

  return `
    <section class="work-timeline-hero-v11350 ${cover?"has-photo":""}">
      ${cover?`
        <button type="button" class="work-timeline-photo-v11350 is-loading" data-timeline-photo-main data-evidence-id="${fmt.escape(cover.id||"")}" data-drive-file-id="${fmt.escape(cover.driveFileId||"")}" aria-label="Ver evidencia fotográfica">
          <span class="work-timeline-photo-loader-v11350">Cargando evidencia…</span>
          <img alt="Evidencia fotográfica de ${fmt.escape(detail.title||"actividad")}" hidden>
          <em>Fotografía de evidencia</em>
        </button>`:
        `<div class="work-timeline-photo-empty-v11350"><span>✓</span><div><strong>${fmt.escape(statusLabel(status))}</strong><small>${evidence.length?"Evidencia registrada":"Sin fotografía disponible"}</small></div></div>`}
      <div class="work-timeline-hero-copy-v11350">
        <div class="work-timeline-badges-v11350">
          <span class="state ${statusTone(status)}">${fmt.escape(statusLabel(status))}</span>
          <span>${fmt.escape(isOrderProcess?"Proceso automático del pedido":detail.source==="MANUAL"?"Registro espontáneo":"Actividad programada")}</span>
          ${evidence.length?`<span class="photo">📷 ${evidence.length} evidencia${evidence.length===1?"":"s"}</span>`:""}
        </div>
        <h4>${fmt.escape(detail.title||"Actividad")}</h4>
        <p>${fmt.escape(detail.description||detail.resultNote||(isOrderProcess?"Trabajo registrado automáticamente desde el flujo real del pedido.":"Actividad registrada en la jornada de trabajo."))}</p>
      </div>
    </section>

    ${images.length>1?`<div class="work-timeline-gallery-v11350">${images.map((row,index)=>`
      <button type="button" class="${index===0?"active":""}" data-timeline-thumb data-evidence-id="${fmt.escape(row.id||"")}" data-drive-file-id="${fmt.escape(row.driveFileId||"")}" aria-label="Ver evidencia ${index+1}">
        <span>${index+1}</span>
      </button>`).join("")}</div>`:""}

    <section class="work-timeline-facts-v11350">
      ${fact("Responsable",detail.profileName||"—")}
      ${isOrderProcess?fact("Pedido",detail.orderNumber||"—"):fact("Programación",planned)}
      ${isOrderProcess?fact("Etapa",detail.stepName||fmt.step(detail.stepCode||detail.currentStep||"—")):fact("Ejecución real",actual)}
      ${isOrderProcess?fact("Estado de etapa",fmt.label(detail.processStatus||detail.status||"—")):fact("Tiempo activo",durationLabel(activeSeconds))}
      ${isOrderProcess?fact("Ejecución real",actual):fact("Pausas",durationLabel(Number(detail.pausedSeconds||0)))}
      ${isOrderProcess?fact("Tiempo activo",durationLabel(activeSeconds)):fact("Catálogo",detail.catalogName||fmt.label(detail.kind||"ACTIVITY"))}
    </section>

    ${Array.isArray(detail.participants)&&detail.participants.length>1?`<section class="work-timeline-section-v11350"><header><span>Equipo</span><strong>Participantes</strong></header><div class="work-timeline-people-v11350">${detail.participants.map(person=>`<span><b class="avatar">${fmt.initials(person.profileName)}</b><em>${fmt.escape(person.profileName)}</em><small>${fmt.escape(statusLabel(person.status))}</small></span>`).join("")}</div></section>`:""}

    ${evidence.length?`<section class="work-timeline-section-v11350"><header><span>Evidencia</span><strong>Registro de la actividad</strong></header><div class="work-timeline-evidence-v11350">${evidence.map(evidenceRow).join("")}</div></section>`:""}

    <footer class="work-timeline-foot-v11350"><span>${isOrderProcess?"Este registro proviene automáticamente del flujo del pedido; no requiere actividad manual.":"La actividad y su evidencia se conservan en la trazabilidad institucional."}</span></footer>`;
}

export function evidenceRow(row){
  const photo=isPhotoEvidence(row);
  const link=safeHttpUrl(row?.webViewLink);
  return `<article>
    <span class="work-timeline-evidence-icon-v11350">${photo?"📷":"◫"}</span>
    <div><strong>${fmt.escape(evidenceLabel(row?.type))}</strong><small>${fmt.escape(row?.fileName||row?.externalValue||"Registro de evidencia")}</small></div>
    <div class="work-timeline-evidence-actions-v11350">
      ${photo&&row?.driveFileId?`<button type="button" class="work-timeline-preview-btn-v11351" data-timeline-evidence-preview data-evidence-id="${fmt.escape(row.id||"")}" data-drive-file-id="${fmt.escape(row.driveFileId)}"><span class="work-timeline-preview-icon-v11351" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 5.5 10.3 4h3.4L15 5.5h2.75A2.25 2.25 0 0 1 20 7.75v8.5a2.25 2.25 0 0 1-2.25 2.25H6.25A2.25 2.25 0 0 1 4 16.25v-8.5A2.25 2.25 0 0 1 6.25 5.5H9Zm3 2.25A4.25 4.25 0 1 0 12 16.25 4.25 4.25 0 0 0 12 7.75Zm0 1.75A2.5 2.5 0 1 1 12 14.5 2.5 2.5 0 0 1 12 9.5Z"/></svg></span><span data-preview-label>Ver foto</span></button>`:""}
      ${link?`<a href="${link}" target="_blank" rel="noopener noreferrer">Original</a>`:""}
    </div>
  </article>`;
}

export function fact(label,value){
  return `<div><small>${fmt.escape(label)}</small><strong>${fmt.escape(String(value||"—"))}</strong></div>`;
}
