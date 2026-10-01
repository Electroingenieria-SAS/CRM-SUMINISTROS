import { fmt } from "../../../../core/format.js";
import { loading } from "../../../../core/ui.js";

export function assignmentStageLoading(){
  return `<section class="reception-stage-card"><div class="reception-stage-heading"><div><span class="reception-step-tag">Paso 4 de 4</span><h4>Asignar responsables</h4><p>Selecciona quién alistará la mercancía y, cuando aplique, quién realizará los cortes.</p></div></div><div data-assignment-content>${loading("Consultando auxiliares disponibles…")}</div></section>`;
}

export function assignmentStage(data,draft,pickingPool,cutPool){
  const hasCuts=(draft.lines||[]).some(line=>line.requiresCut);
  return `<section class="reception-stage-card">
    <div class="reception-stage-heading"><div><span class="reception-step-tag">Paso 4 de 4</span><h4>Asignar responsables</h4><p>La confirmación enviará el pedido directamente a los auxiliares seleccionados.</p></div><button type="button" class="btn btn-ghost" data-back-lines>Editar información</button></div>
    <div class="reception-assignment-grid">
      <div class="field"><label>Auxiliar de alistamiento *</label><select class="control" data-picking-profile required><option value="">Seleccione…</option>${pickingPool.map(person=>`<option value="${person.id}" ${person.id===draft.pickingProfileId?"selected":""}>${fmt.escape(person.name)}</option>`).join("")}</select><small>Solo usuarios activos con rol Auxiliar de logística.</small></div>
      ${hasCuts?`<div class="field"><label>Auxiliar de corte *</label><select class="control" data-cut-profile required><option value="">Seleccione…</option>${cutPool.map(person=>`<option value="${person.id}" ${person.id===draft.cutProfileId?"selected":""}>${fmt.escape(person.name)}</option>`).join("")}</select><small>Se mostrará únicamente porque existen líneas marcadas para corte.</small></div>`:`<article class="reception-no-cut"><span>✓</span><div><strong>Este pedido no requiere corte</strong><p>No se generará tarea para auxiliares de corte.</p></div></article>`}
    </div>
    <div class="reception-final-summary">
      <div><small>Líneas definitivas</small><strong>${draft.lines.length}</strong></div>
      <div><small>Líneas con corte</small><strong>${draft.lines.filter(line=>line.requiresCut).length}</strong></div>
      <div><small>Origen de información</small><strong>${draft.mode==="CORRECT"?"Asesor":"Lector PDF"}</strong></div>
    </div>
    <button type="button" class="btn btn-primary reception-confirm-button" data-confirm-reception>Confirmar recepción y asignación</button>
  </section>`;
}
