import { fmt } from "../../../../core/format.js";
import { editableLine } from "../lines/editable-line.js";

export function editStage(data,draft){
  const rows=(draft.lines||[]).map((line,index)=>editableLine(line,index)).join("");
  return `<section class="reception-stage-card">
    <div class="reception-stage-heading"><div><span class="reception-step-tag">Paso 3 de 4</span><h4>Validar líneas detectadas</h4><p>Corrige, agrega o elimina cualquier dato antes de confirmar la información.</p></div><button type="button" class="btn btn-ghost" data-back-pdf>Volver al PDF</button></div>
    <div class="reception-reader-summary"><strong>${draft.lines?.length||0} línea(s) detectada(s)</strong><span>${fmt.escape(draft.sourceFileName||"Carga manual")}</span></div>
    <div class="reception-lines-editor" data-lines-editor>${rows||'<div class="reception-file-warning"><strong>No se detectaron líneas.</strong><p>Agrega la primera línea manualmente.</p></div>'}</div>
    <div class="reception-editor-actions"><button type="button" class="btn btn-create" data-add-line>Agregar línea</button><button type="button" class="btn btn-primary" data-confirm-lines>Confirmar información</button></div>
    ${draft.rawPreview?`<details class="reception-raw-text"><summary>Ver texto extraído del PDF</summary><pre>${fmt.escape(draft.rawPreview)}</pre></details>`:""}
  </section>`;
}
