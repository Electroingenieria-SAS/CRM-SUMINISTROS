import { fmt } from "../../../../core/format.js";
import { icon } from "../../../../core/icons.js";
import { pdfFiles } from "../pdf/file-metadata.js";

export function pdfStage(data,draft){
  const pdfs=pdfFiles(data.files||[]);
  return `<section class="reception-stage-card">
    <div class="reception-stage-heading"><div><span class="reception-step-tag">Paso 2</span><h4>Selecciona el PDF</h4><p>El CRM detectará las líneas automáticamente.</p></div><button type="button" class="btn btn-ghost reception-back" data-back-review>Volver</button></div>
    <div class="reception-pdf-panel">
      ${pdfs.length?`<div class="field"><label>PDF cargado por el asesor</label><select class="control" data-source-pdf>${pdfs.map(file=>`<option value="${fmt.escape(file.drive_file_id)}" ${file.drive_file_id===draft.sourceFileId?"selected":""}>${fmt.escape(file.file_name)}</option>`).join("")}</select></div>`:`<div class="reception-file-warning"><strong>No hay un PDF registrado en el pedido.</strong><p>Puedes seleccionar el archivo manualmente sin modificar los soportes existentes.</p></div>`}
      <div class="reception-pdf-actions">
        ${pdfs.length?`<button type="button" class="btn btn-primary reception-main-action reception-primary" data-read-drive-pdf><span class="reception-button-icon" aria-hidden="true">${icon("imports")}</span><span data-button-label>Leer PDF del asesor</span></button>`:""}
        <label class="btn btn-ghost reception-file-picker reception-alt-action">Usar otro PDF<input type="file" accept="application/pdf,.pdf" data-local-pdf hidden></label>
      </div>
      <div class="reception-reader-status" data-reader-status>El lector identificará referencias, descripciones, cantidades, unidades y posibles cortes.</div>
    </div>
  </section>`;
}
