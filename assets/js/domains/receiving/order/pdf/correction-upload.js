import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { downloadDriveFile, uploadOrderFile } from "../../../../services/drive.js";
import { validateUploadFile } from "../../../../integrations/drive/validation/upload-file.js";
import { processPdf } from "./process-pdf.js";
import { pdfFiles } from "./file-metadata.js";
import { activeTask } from "../actions/start-reception.js";

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

export function bindCorrectionPdf(host,data,draft,callbacks){
  const panel=host.querySelector("[data-correction-pdf-panel]");
  if(!panel)return;
  let busy=false;
  const run=async(getFile,options)=>{
    if(busy)return;
    busy=true;
    try{await processPdf(host,data,draft,callbacks,getFile,{mergeExisting:true,...options})}
    finally{busy=false}
  };
  panel.querySelector("[data-correction-read-drive]")?.addEventListener("click",()=>{
    const id=panel.querySelector("[data-correction-source-pdf]")?.value;
    const file=pdfFiles(data.files||[]).find(item=>item.drive_file_id===id);
    if(!file)return toast("Selecciona un PDF adjunto al pedido.","error");
    return run(()=>downloadDriveFile(file.drive_file_id),{sourceFileId:file.drive_file_id,sourceFileName:file.file_name});
  });
  panel.querySelector("[data-correction-local-pdf]")?.addEventListener("change",async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    try{
      validateUploadFile(file);
      if(!/\.pdf$/i.test(file.name))throw new Error("Selecciona un documento PDF.");
    }catch(error){toast(error.message,"error",7000);event.target.value="";return}
    await run(()=>file,{
      sourceFileId:"",sourceFileName:file.name,
      afterRead:async()=>{
        try{
          const task=activeTask(data);
          const response=await uploadOrderFile(data.order.id,file,"EVIDENCE",task?.id,data.order.order_number);
          const registered=response?.file||response;
          return {sourceFileId:registered?.drive_file_id||registered?.driveFileId||"",savedToDrive:true};
        }catch(error){
          console.warn("[RECEPTION PDF] No se pudo guardar el documento:",error);
          return {sourceFileId:"",uploadWarning:"El PDF se leyó, pero no pudo guardarse como soporte en Drive. Comprueba la conexión o los permisos de carga."};
        }
      }
    });
  });
}
