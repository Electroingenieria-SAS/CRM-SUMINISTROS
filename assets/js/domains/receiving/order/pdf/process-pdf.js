import { toast } from "../../../../core/ui.js";
import { readOrderPdf } from "../../../../services/pdf-order-reader.js";
import { resolveMaterialLines } from "../../../../services/materials.js";
import { renderWorkbench } from "../reception-controller.js";
import { persistDraft } from "../draft/reception-draft.js";
import { mergeReaderLine } from "../lines/map-reception-line.js";
import { mergePdfIntoReception } from "./merge-corrections.js";

export async function processPdf(host,data,draft,callbacks,getFile,options={}){
  const status=host.querySelector("[data-reader-status]");
  const buttons=[...host.querySelectorAll("[data-read-drive-pdf], [data-local-pdf], [data-correction-read-drive], [data-correction-local-pdf]")];
  buttons.forEach(button=>button.disabled=true);
  if(status)status.innerHTML='<span class="spinner"></span> Leyendo materiales y lotes del PDF…';
  try{
    const file=await getFile();
    const parsed=await readOrderPdf(file);
    if(!parsed.items.length)throw new Error("No se reconocieron materiales en el PDF. Verifica el archivo y conserva la captura manual.");
    const detected=parsed.items.map((line,index)=>mergeReaderLine(line,data.items||[],index));
    const resolved=await resolveMaterialLines(detected);
    const merge=options.mergeExisting?mergePdfIntoReception(draft.lines,resolved):null;
    const nextLines=merge?merge.lines:resolved;
    const stored=await options.afterRead?.(file);
    draft.lines=nextLines;
    draft.sourceFileId=stored&&Object.hasOwn(stored,"sourceFileId")?stored.sourceFileId:(options.sourceFileId??draft.sourceFileId??"");
    draft.sourceFileName=options.sourceFileName||file?.name||draft.sourceFileName||"";
    draft.mode="PDF";
    draft.rawPreview=parsed.raw.slice(0,30000);
    draft.readerVersion=parsed.readerVersion;
    draft.stage="EDIT";
    persistDraft(data.order.id,draft);
    renderWorkbench(host,data,draft,callbacks);
    const details=merge?.summary;
    const result=details?`PDF leído: ${details.lotsCompleted} material(es) con lotes completados, ${details.newMaterials} agregado(s), ${details.conflicts+details.ambiguous} pendiente(s) de cotejo.`:`${draft.lines.length} línea(s) detectada(s). Revisa los materiales y sus lotes.`;
    toast(result,"success",7500);
    if(stored?.uploadWarning)toast(stored.uploadWarning,"warning",8500);
  }catch(error){
    if(status)status.textContent=error.message;
    toast(error.message,"error",7500);
    buttons.forEach(button=>button.disabled=false);
  }
}
