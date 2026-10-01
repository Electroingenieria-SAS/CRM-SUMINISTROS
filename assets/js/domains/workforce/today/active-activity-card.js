import { fmt } from "../../../core/format.js";
import { icon } from "../../../core/icons.js";
import { timeTrafficLight, trafficHelp, elapsedActiveSeconds } from "./time-traffic.js";
import { clock, timeOnly } from "../shared/local-dates.js";

export function activeWorkCard(active){
  if(!active)return `<section class="work-active-console idle">
    <div class="work-active-idle-icon">${icon("play")}</div>
    <div class="work-active-idle-copy"><small>Estado actual</small><strong>Sin actividad en curso</strong><p>Selecciona categoría, subcategoría y actividad. El cronómetro solo inicia después de confirmar.</p></div>
  </section>`;

  const metrics=active.metrics||{};
  const paused=active.status==="PAUSED";
  const types=new Set((active.evidence||[]).map(x=>x.type));
  const needsBefore=active.evidencePolicy==="BEFORE_AFTER"&&!types.has("BEFORE_PHOTO");
  const activeSeconds=elapsedActiveSeconds(active);
  const traffic=timeTrafficLight(activeSeconds);

  return `<section class="work-active-console running ${paused?"paused":""}" data-active-execution="${fmt.escape(active.id)}" data-started-at="${fmt.escape(active.startedAt)}" data-base-elapsed="${Number(metrics.elapsedSeconds||0)}" data-paused="${paused}">
    <div class="work-active-context">
      <span class="work-active-state"><i></i>${paused?"Actividad pausada":"Trabajando ahora"}</span>
      <strong>${fmt.escape(active.title)}</strong>
      <small>${fmt.escape(active.catalogName||"")}${active.plannedStart?` · Programada ${timeOnly(active.plannedStart)}`:""}</small>
    </div>

    <div class="work-timer-panel">
      <div class="work-timer-face">
        <span>Tiempo activo</span>
        <strong data-live-clock>${clock(activeSeconds)}</strong>
      </div>
      <div class="work-timer-traffic tone-${traffic.tone}" data-time-traffic data-tone="${traffic.tone}">
        <span class="work-traffic-light"><i></i><i></i><i></i></span>
        <div><b data-traffic-label>${traffic.label}</b><small data-traffic-help>${trafficHelp(activeSeconds)}</small></div>
      </div>
    </div>

    <div class="work-active-controls">
      ${needsBefore?`<button class="btn btn-ghost" data-work-before-photo>${icon("activity")}<span>Foto inicial</span></button>`:""}
      ${paused?`<button class="btn btn-primary" data-work-resume>${icon("play")}<span>Reanudar</span></button>`:`<button class="btn btn-ghost" data-work-pause>${icon("pause")}<span>Pausar</span></button>`}
      <button class="btn btn-success" data-work-finish ${needsBefore?'disabled title="Toma primero la foto inicial"':""}>${icon("check")}<span>${needsBefore?"Foto inicial pendiente":"Finalizar + foto"}</span></button>
    </div>
  </section>`;
}

export function summaryCard(label,value,detail,iconName,tone){return `<article class="workforce-summary-card tone-${tone}"><span class="workforce-summary-icon">${icon(iconName)}</span><div><span>${fmt.escape(label)}</span><strong>${fmt.escape(String(value))}</strong><small>${fmt.escape(detail)}</small></div></article>`}
