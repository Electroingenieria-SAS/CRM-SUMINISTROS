import { fmt } from "../../../core/format.js";
import { can } from "../../../core/state.js";
import { state } from "../history-state.js";
import { safe, n, dateTime, label } from "../shared/history-values.js";

export function renderBatches(){
  const rows=state.batches||[];
  return `<section class="history-section-v11150">
    <div class="history-subhead-v11150"><div><span class="history-eyebrow-v11150">Gobierno de importaciones</span><h3>Lotes históricos</h3><p>Cada carga conserva archivo, responsable, resultado y muestra de rechazos.</p></div>${can("imports","canCreate")?'<button class="btn btn-primary" data-history-import>Importar nuevo archivo</button>':""}</div>
    ${rows.length?`<div class="history-batches-v11150">${rows.map(batchCard).join("")}</div>`:`<div class="history-empty-v11150"><div class="history-empty-icon-v11150">⇩</div><h3>Todavía no hay importaciones</h3><p>Los lotes CSV que se procesen aparecerán aquí con su trazabilidad completa.</p></div>`}
  </section>`;
}

export function batchCard(batch){
  const total=Math.max(1,n(batch.totalRows)),ok=n(batch.insertedRows),bad=n(batch.rejectedRows);
  return `<article class="history-batch-v11150">
    <header><div><span class="history-batch-status-v11150 ${String(batch.status).toLowerCase()}">${safe(label(batch.status))}</span><h4>${safe(batch.fileName)}</h4><p>${safe(batch.importedBy||"Usuario no disponible")} · ${dateTime(batch.createdAt)}</p></div><strong>${fmt.number(total)} filas</strong></header>
    <div class="history-batch-meter-v11150"><i style="width:${Math.min(100,ok/total*100)}%"></i></div>
    <div class="history-batch-stats-v11150"><span><b>${fmt.number(ok)}</b> incorporadas</span><span><b>${fmt.number(bad)}</b> rechazadas</span><span><b>${batch.completedAt?dateTime(batch.completedAt):"—"}</b> finalización</span></div>
    ${batch.errors?.length?`<details><summary>Ver muestra de errores (${batch.errors.length})</summary><div class="history-errors-v11150">${batch.errors.map(e=>`<div><b>Fila ${fmt.number(e.rowNumber)}</b><span>${safe(e.message)}</span><small>${safe(e.code)}</small></div>`).join("")}</div></details>`:""}
  </article>`;
}
