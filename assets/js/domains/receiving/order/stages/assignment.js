import { fmt } from "../../../../core/format.js";
import { icon } from "../../../../core/icons.js";
import { loading } from "../../../../core/ui.js";

export function assignmentStageLoading(){
  return `<section class="reception-stage-card"><div class="reception-stage-heading"><div><span class="reception-step-tag">Paso 4</span><h4>Asigna y finaliza</h4><p>Elige quién continúa con el pedido y confirma la recepción.</p></div></div><div data-assignment-content>${loading("Consultando auxiliares disponibles…")}</div></section>`;
}

export function assignmentStage(data,draft,pickingPool,cutPool){
  const hasCuts=(draft.lines||[]).some(line=>line.requiresCut);
  return `<section class="reception-stage-card">
    <div class="reception-stage-heading"><div><span class="reception-step-tag">Paso 4</span><h4>Asigna y finaliza</h4><p>Elige quién continúa con el pedido y confirma la recepción.</p></div><button type="button" class="btn btn-ghost reception-back" data-back-lines>Editar información</button></div>
    <div class="reception-assignment-grid">
      <div class="field"><label>Auxiliar de alistamiento *</label><select class="control" data-picking-profile required><option value="">Seleccione…</option>${pickingPool.map(person=>`<option value="${person.id}" ${person.id===draft.pickingProfileId?"selected":""}>${fmt.escape(person.name)}</option>`).join("")}</select><small>Solo usuarios activos con rol Auxiliar de logística.</small></div>
      ${hasCuts?`<div class="field"><label>Auxiliar de corte *</label><select class="control" data-cut-profile required><option value="">Seleccione…</option>${cutPool.map(person=>`<option value="${person.id}" ${person.id===draft.cutProfileId?"selected":""}>${fmt.escape(person.name)}</option>`).join("")}</select><small>Se mostrará únicamente porque existen líneas marcadas para corte.</small></div>`:`<article class="reception-no-cut"><span aria-hidden="true">${icon("check")}</span><div><strong>Este pedido no requiere corte</strong><p>No se generará tarea para auxiliares de corte.</p></div></article>`}
    </div>
    <div class="reception-final-summary"><div><small>Líneas definitivas</small><strong>${draft.lines.length}</strong></div><div><small>Líneas con corte</small><strong>${draft.lines.filter(line=>line.requiresCut).length}</strong></div><div><small>Origen de información</small><strong>${draft.mode==="CORRECT"?"Asesor":"Lector PDF"}</strong></div></div>
    <button type="button" class="btn btn-primary reception-confirm-button reception-main-action reception-primary" data-confirm-reception><span class="reception-button-icon" aria-hidden="true">${icon("check")}</span><span data-button-label>Confirmar y enviar a alistamiento</span></button>
  </section>`;
}
