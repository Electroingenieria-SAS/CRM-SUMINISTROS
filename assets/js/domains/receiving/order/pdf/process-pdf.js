import { toast } from "../../../../core/ui.js";
import { readOrderPdf } from "../../../../services/pdf-order-reader.js";
import { resolveMaterialLines } from "../../../../services/materials.js";
import { renderWorkbench } from "../reception-controller.js";
import { persistDraft } from "../draft/reception-draft.js";
import { mergeReaderLine } from "../lines/map-reception-line.js";

export async function processPdf(host,data,draft,callbacks,getFile){
  const status=host.querySelector("[data-reader-status]");
  const buttons=[...host.querySelectorAll("[data-read-drive-pdf], [data-local-pdf]")];
  buttons.forEach(button=>button.disabled=true);
  if(status)status.innerHTML='<span class="spinner"></span> Leyendo y organizando las líneas del pedido…';
  try{
    const file=await getFile();
    const parsed=await readOrderPdf(file);
    const detected=parsed.items.map((line,index)=>mergeReaderLine(line,data.items||[],index));
    draft.lines=await resolveMaterialLines(detected);
    draft.rawPreview=parsed.raw.slice(0,30000);
    draft.readerVersion=parsed.readerVersion;
    draft.stage="EDIT";
    persistDraft(data.order.id,draft);
    renderWorkbench(host,data,draft,callbacks);
    toast(`${draft.lines.length} línea(s) detectada(s). Revisa el resultado antes de confirmar.`,"success",6000);
  }catch(error){
    if(status)status.textContent=error.message;
    toast(error.message,"error",7500);
    buttons.forEach(button=>button.disabled=false);
  }
}
