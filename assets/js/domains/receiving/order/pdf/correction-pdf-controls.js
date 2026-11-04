import { fmt } from "../../../../core/format.js";
import { pdfFiles } from "./file-metadata.js";

export function correctionPdfControls(data,draft){
  const files=pdfFiles(data.files||[]);
  return `<section class="reception-correction-pdf" data-correction-pdf-panel>
    <div class="reception-correction-pdf-heading"><div><strong>Completar o corregir con un PDF</strong>
      <p>Lee un PDF sin salir de esta etapa. Se conservan tus correcciones:
      el lector completa lotes vacíos y añade materiales nuevos para revisión.</p></div>
      <span>PDF + revisión manual</span></div>
    <div class="reception-correction-pdf-actions">
      ${files.length?`<label class="field">PDF del pedido
        <select class="control" data-correction-source-pdf>
          ${files.map(file=>`<option value="${fmt.escape(file.drive_file_id)}" ${file.drive_file_id===draft.sourceFileId?"selected":""}>${fmt.escape(file.file_name)}</option>`).join("")}
        </select></label><button type="button" class="btn btn-ghost" data-correction-read-drive>Leer PDF adjunto</button>`:""}
      <label class="btn btn-primary reception-correction-pdf-picker">Seleccionar y leer PDF
        <input type="file" accept="application/pdf,.pdf" data-correction-local-pdf hidden>
      </label>
    </div>
    <p class="reception-correction-pdf-status" data-reader-status aria-live="polite">
      No se sobrescriben lotes que ya diligenciaste; las diferencias se revisan manualmente.
    </p>
  </section>`;
}
