import { toast } from "../../../../core/ui.js";
import { downloadDriveFile } from "../../../../services/drive.js";
import { renderWorkbench } from "../reception-controller.js";
import { processPdf } from "../pdf/process-pdf.js";
import { bindLineEditor } from "../lines/editor-bindings.js";
import { loadAssignmentStage } from "../assignment/assignment-pool.js";
import { persistDraft } from "../draft/reception-draft.js";
import { fromOrderItem } from "../lines/map-reception-line.js";
import { pdfFiles } from "../pdf/file-metadata.js";

export function bindStage(host,data,draft,callbacks){
  host.querySelector("[data-info-correct]")?.addEventListener("click",()=>{
    draft.mode="CORRECT";
    draft.stage="ASSIGN";
    draft.lines=(data.items||[]).map((item,index)=>fromOrderItem(item,index));
    persistDraft(data.order.id,draft);
    renderWorkbench(host,data,draft,callbacks);
  });
  host.querySelector("[data-info-assign]")?.addEventListener("click",()=>{
    draft.mode="PDF";
    draft.stage="PDF";
    const first=pdfFiles(data.files||[])[0];
    draft.sourceFileId=draft.sourceFileId||first?.drive_file_id||"";
    draft.sourceFileName=draft.sourceFileName||first?.file_name||"";
    persistDraft(data.order.id,draft);
    renderWorkbench(host,data,draft,callbacks);
  });
  host.querySelector("[data-back-review]")?.addEventListener("click",()=>{draft.stage="REVIEW";persistDraft(data.order.id,draft);renderWorkbench(host,data,draft,callbacks)});
  host.querySelector("[data-back-pdf]")?.addEventListener("click",()=>{draft.stage="PDF";persistDraft(data.order.id,draft);renderWorkbench(host,data,draft,callbacks)});
  host.querySelector("[data-back-lines]")?.addEventListener("click",()=>{draft.stage=draft.mode==="PDF"?"EDIT":"REVIEW";persistDraft(data.order.id,draft);renderWorkbench(host,data,draft,callbacks)});

  host.querySelector("[data-read-drive-pdf]")?.addEventListener("click",async event=>{
    const select=host.querySelector("[data-source-pdf]");
    const file=(data.files||[]).find(item=>item.drive_file_id===select?.value);
    if(!file)return toast("Selecciona un PDF válido.","error");
    draft.sourceFileId=file.drive_file_id;
    draft.sourceFileName=file.file_name;
    await processPdf(host,data,draft,callbacks,()=>downloadDriveFile(file.drive_file_id));
  });
  host.querySelector("[data-local-pdf]")?.addEventListener("change",async event=>{
    const file=event.target.files?.[0];
    if(!file)return;
    draft.sourceFileId="";
    draft.sourceFileName=file.name;
    await processPdf(host,data,draft,callbacks,()=>file);
  });

  if(draft.stage==="EDIT")bindLineEditor(host,data,draft,callbacks);
  if(draft.stage==="ASSIGN")loadAssignmentStage(host,data,draft,callbacks);
}
