import { fmt } from "../../../core/format.js";
import { clockSvg, cameraSvg } from "./calendar-icons.js";
import { eventStatus } from "./calendar-status.js";
import { timeOnly } from "./calendar-dates.js";

export function calendarCloudHtml(item){
  const status=eventStatus(item);
  const planned=item.plannedStart?`${timeOnly(item.plannedStart)}${item.plannedEnd?`–${timeOnly(item.plannedEnd)}`:""}`:"Sin hora";
  const duration=item.activeSeconds?cloudDuration(item.activeSeconds):cloudPlannedDuration(item.plannedStart,item.plannedEnd);
  return `
    <div class="work-calendar-cloud-head-v11361">
      <div><span>${clockSvg()}${fmt.escape(planned)}</span><h4>${fmt.escape(item.title||"Actividad")}</h4></div>
      <b class="tone-${status.tone}">${fmt.escape(status.label)}</b>
    </div>
    <div class="work-calendar-cloud-worker-v11361">
      <span>${fmt.initials(item.profileName||"")}</span>
      <div><small>Responsable</small><strong>${fmt.escape(item.profileName||"—")}</strong></div>
    </div>
    <div class="work-calendar-cloud-grid-v11361">
      <span><small>Actividad</small><strong>${fmt.escape(item.catalogName||fmt.label(item.kind||"ACTIVITY"))}</strong></span>
      <span><small>Duración</small><strong>${fmt.escape(duration)}</strong></span>
      <span><small>Origen</small><strong>${fmt.escape(item.source==="MANUAL"?"Registro espontáneo":"Programada")}</strong></span>
      <span><small>Evidencia</small><strong>${item.hasPhoto?"Fotografía disponible":item.evidenceCount?`${item.evidenceCount} registro${item.evidenceCount===1?"":"s"}`:"Sin evidencia"}</strong></span>
    </div>
    <div class="work-calendar-cloud-foot-v11361">
      <span>${item.hasPhoto?`${cameraSvg()} Precargando evidencia`:"Doble clic para abrir"}</span>
      <button type="button" data-calendar-cloud-open>Abrir detalle</button>
    </div>`;
}

export function cloudPlannedDuration(start,end){
  if(!start||!end)return "—";
  const minutes=Math.max(1,Math.round((new Date(end)-new Date(start))/60000));
  return minutes>=60?`${Math.floor(minutes/60)} h${minutes%60?` ${minutes%60} min`:""}`:`${minutes} min`;
}

export function cloudDuration(seconds){
  const total=Math.max(0,Math.round(Number(seconds||0)));
  if(!total)return "—";
  const hours=Math.floor(total/3600);
  const minutes=Math.round((total%3600)/60);
  return hours?`${hours} h ${minutes} min`:`${Math.max(1,minutes)} min`;
}
