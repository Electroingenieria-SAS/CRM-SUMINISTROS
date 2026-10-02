import { originSelectionValid, readRow } from "../origins/origin-selection.js";
import { saveDraft } from "../draft/picking-draft.js";

export function summaryMarkup(total,found,missing,verified){
  const pending=total-verified;
  const kind=verified===total?(missing?"partial":"complete"):"pending";
  return `<div class="picking-summary-state ${kind}"><strong>${verified===total?(missing?"Envío parcial":"Envío completo"):"Verificación en curso"}</strong><span>${found} encontrada(s) · ${missing} no encontrada(s) · ${pending} por marcar</span></div>`;
}

export function prepareVerificationSync(verification){
verification.itemMap=new Map(verification.processable.map(item=>[item.id,item]));
verification.sync=()=>{
    const rows=[...verification.host.querySelectorAll("[data-picking-item]")];
    const results=rows.map(readRow);
    const verified=results.filter(row=>row.result).length;
    const missing=results.filter(row=>row.result==="MISSING").length;
    const found=results.filter(row=>row.result==="FOUND").length;
    const missingWithoutReason=results.some(row=>row.result==="MISSING"&&!row.novelty);
    const originPending=[...verification.host.querySelectorAll("[data-picking-item]")].some(row=>row.dataset.result==="FOUND"&&row.dataset.requiresCut!=="true"&&!originSelectionValid(row));
    const counter=verification.host.querySelector("[data-picking-verified]");if(counter)counter.textContent=String(verified);
    const summary=verification.host.querySelector("[data-picking-summary]");if(summary)summary.innerHTML=summaryMarkup(verification.processable.length,found,missing,verified)+(originPending?'<div class="picking-origin-alert">Falta confirmar el origen físico de una o más líneas encontradas.</div>':"");
    const send=verification.host.querySelector("[data-picking-send]");if(send)send.disabled=verified!==verification.processable.length||missingWithoutReason||originPending||verification.processable.length===0;
    saveDraft(verification.task,results);
  };
}
