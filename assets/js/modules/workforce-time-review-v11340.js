import {fmt} from "../core/format.js";

export function managerQueueSummary(rows=[]){
  const list=Array.isArray(rows)?rows:[];
  return {
    pending:list.length,
    overHour:list.filter(row=>Number(row.activeSeconds||0)>3600).length,
    withPhoto:list.filter(row=>Boolean(finalPhoto(row))).length
  };
}

export function timeReviewCardHtml(row={}){
  const photo=finalPhoto(row);
  return `<article class="work-time-review-card" data-time-review="${fmt.escape(row.executionId||"")}">
    <div class="work-time-review-person">
      <span class="avatar">${fmt.initials(row.profileName||"")}</span>
      <div><strong>${fmt.escape(row.profileName||"Sin responsable")}</strong><small>${fmt.escape(row.catalogName||fmt.label(row.activityGroup||"ACTIVITY"))}</small></div>
    </div>
    <div class="work-time-review-main">
      <span class="work-time-review-state">Pendiente de revisión</span>
      <strong>${fmt.escape(row.title||"Actividad")}</strong>
      <small>${fmt.escape(dateRange(row.startedAt,row.endedAt))}</small>
    </div>
    <div class="work-time-review-duration">
      <strong>${durationText(row.activeSeconds)}</strong>
      <small>${Number(row.pausedSeconds||0)>0?`${durationText(row.pausedSeconds)} en pausa`:"Sin pausas registradas"}</small>
    </div>
    <div class="work-time-review-actions">
      ${photo?.webViewLink?`<a class="btn btn-ghost" href="${fmt.escape(photo.webViewLink)}" target="_blank" rel="noopener noreferrer" data-time-review-photo>Ver foto</a>`:"<span class=\"work-time-review-no-photo\">Foto no disponible</span>"}
      <button type="button" class="btn btn-primary" data-time-review-open="${fmt.escape(row.executionId||"")}">Revisar tiempo</button>
    </div>
  </article>`;
}

export function timeReviewDialogHtml(row={}){
  const photo=finalPhoto(row);
  return `<div class="work-time-review-dialog">
    <section class="work-time-review-hero">
      <div>
        <span>Revisión de tiempo</span>
        <strong>${fmt.escape(row.title||"Actividad")}</strong>
        <p>${fmt.escape(row.profileName||"Sin responsable")} · ${fmt.escape(row.catalogName||fmt.label(row.activityGroup||"ACTIVITY"))}</p>
      </div>
      <div class="work-time-review-clock"><strong>${durationText(row.activeSeconds)}</strong><span>Tiempo activo</span></div>
    </section>

    <div class="work-time-review-metrics">
      <article><span>Inicio</span><strong>${fmt.escape(row.startedAt?fmt.date(row.startedAt):"—")}</strong></article>
      <article><span>Final</span><strong>${fmt.escape(row.endedAt?fmt.date(row.endedAt):"—")}</strong></article>
      <article><span>Pausas</span><strong>${durationText(row.pausedSeconds)}</strong></article>
      <article><span>Tiempo laboral</span><strong>${durationText(row.businessSeconds||row.activeSeconds)}</strong></article>
    </div>

    <section class="work-time-review-photo">
      <div><span>Foto final</span><strong>${fmt.escape(photo?.fileName||"Evidencia de cierre")}</strong><small>Guardada mediante Google Apps Script / Drive</small></div>
      ${photo?.webViewLink?`<a class="btn btn-ghost" href="${fmt.escape(photo.webViewLink)}" target="_blank" rel="noopener noreferrer">Abrir evidencia</a>`:"<span class=\"work-time-review-no-photo\">Sin enlace disponible</span>"}
    </section>

    <section class="work-time-review-choice">
      <label class="choice active"><input type="radio" name="timeReviewDecision" value="REVIEWED" checked><span><strong>Revisado</strong><small>El tiempo es válido y la actividad puede cerrarse.</small></span></label>
      <label class="choice"><input type="radio" name="timeReviewDecision" value="OBSERVED"><span><strong>Observado</strong><small>El tiempo queda cerrado pero con una observación trazable.</small></span></label>
    </section>

    <div class="field"><label>Nota de revisión</label><textarea class="control" name="timeReviewNote" placeholder="Opcional al marcar Revisado. Obligatoria si eliges Observado."></textarea><small class="field-help">No pidas al trabajador justificar el tiempo; registra aquí únicamente la conclusión del revisor.</small></div>
  </div>`;
}

export function durationText(seconds=0){
  const total=Math.max(0,Math.round(Number(seconds)||0));
  const h=Math.floor(total/3600);
  const m=Math.floor((total%3600)/60);
  const s=total%60;
  if(h)return `${h} h ${m} min`;
  if(m)return `${m} min`;
  return `${s} s`;
}

function finalPhoto(row){
  const evidence=Array.isArray(row?.evidence)?row.evidence:[];
  return evidence.find(item=>["FINAL_PHOTO","AFTER_PHOTO"].includes(String(item?.type||"").toUpperCase()))
    ||evidence.find(item=>Boolean(item?.webViewLink))
    ||null;
}

function dateRange(start,end){
  if(!start)return "Sin horario registrado";
  return end?`${fmt.date(start)} → ${fmt.date(end)}`:fmt.date(start);
}
