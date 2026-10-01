import { fmt } from "../../../../core/format.js";

export function statusStage({title="Estado de la recepción",text="Consulta quién tiene el pedido y su estado actual.",assignee=""}={}){
  return `<section class="reception-stage-card reception-status-stage"><div class="reception-stage-heading"><div><span class="reception-step-tag">Estado</span><h4>${fmt.escape(title)}</h4><p>${fmt.escape(text)}</p></div></div>${assignee?`<div class="reception-assigned-warning">Responsable actual: <strong>${fmt.escape(assignee)}</strong></div>`:""}</section>`;
}
