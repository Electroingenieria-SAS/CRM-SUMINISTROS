import { fmt } from "../../../core/format.js";
import { timeOnly } from "../shared/local-dates.js";

function requestTime(row){
  const start=row.plannedStart?`${fmt.date(row.plannedStart)} · ${timeOnly(row.plannedStart)}`:"Sin fecha";
  return `${start}${row.plannedEnd?` a ${timeOnly(row.plannedEnd)}`:" · sin hora final estimada"}`;
}
export function activityRequestsHtml(pending=[],history=[]){
  if(!pending.length&&!history.length)return "";
  return `<section class="card work-requests-card">
    <header class="card-head"><div><h3>Solicitudes de mi jornada</h3><p>Las actividades pendientes aún no pueden iniciar. Aquí verás la decisión del responsable.</p></div><span class="workforce-count">${pending.length}</span></header>
    <div class="card-body work-requests-list">
      ${pending.map(row=>`<article class="work-request-row pending"><span class="work-request-state pending">Pendiente</span><div><strong>${fmt.escape(row.title)}</strong><small>${fmt.escape(requestTime(row))}</small><p>${fmt.escape(row.reason||"")}</p></div></article>`).join("")}
      ${history.map(row=>`<article class="work-request-row ${row.approvalStatus==="APPROVED"?"approved":"rejected"}"><span class="work-request-state ${row.approvalStatus==="APPROVED"?"approved":"rejected"}">${row.approvalStatus==="APPROVED"?"Aprobada":"Rechazada"}</span><div><strong>${fmt.escape(row.title)}</strong><small>${fmt.escape(requestTime(row))}</small><p>${fmt.escape(row.decisionNote||"Decisión registrada")}</p></div></article>`).join("")}
    </div>
  </section>`;
}
