import { api } from "../../../services/api.js";
import { toast } from "../../../core/ui.js";
import { openConfirmation } from "../actions/confirm-picking.js";
import { actionCodes } from "../shared/picking-status.js";
import { readRow } from "../origins/origin-selection.js";
import { clearDraft } from "../draft/picking-draft.js";

export function bindVerificationSubmit(verification){
verification.host.querySelector("[data-picking-send]")?.addEventListener("click",async event=>{
    const button=event.currentTarget;
    const results=[...verification.host.querySelectorAll("[data-picking-item]")].map(readRow);
    if(verification.parallel){
      button.disabled=true;
      try{
        await api.savePickingPrecheck(verification.data.order.id,results);
        let latest=await api.getOrder(verification.data.order.id);
        const actions=actionCodes(latest);
        if(actions.has("WAIT"))await api.executeAction(latest.order.id,"WAIT",{reason:"Esperando cortes pendientes",detail:`Alistamiento paralelo guardado. ${verification.cutsPending.length} referencia(s) continúan en Corte.`},latest.order.version);
        clearDraft(verification.task);
        toast("Avance de Alistamiento guardado. Corte continúa en paralelo.","success",6500);
        verification.refreshLists?.();verification.host.replaceChildren();
      }catch(error){toast(error.message,"error",7500);button.disabled=false}
    }else openConfirmation(verification.host,verification.data,verification.task,verification.refreshLists);
  });
verification.sync();
}
