import { api } from "../../../services/api.js";
import { toast, taskPanel } from "../../../core/ui.js";
import { readRow } from "../origins/origin-selection.js";
import { clearDraft } from "../draft/picking-draft.js";

export function openConfirmation(host,data,task,refreshLists){
  const results=[...host.querySelectorAll("[data-picking-item]")].map(readRow);
  const missing=results.filter(row=>row.result==="MISSING");
  const found=results.length-missing.length;
  taskPanel(host,{
    title:missing.length?"Enviar pedido parcial":"Enviar pedido completo",
    kicker:"Confirmación final · Alistamiento",
    confirmLabel:"Confirmar y enviar a facturación",
    body:`<div class="picking-confirm-body"><p class="modal-task-panel-lead">Esta acción cerrará la ronda actual de Alistamiento.</p><div class="picking-confirm-counts"><div><small>Encontradas</small><strong>${found}</strong></div><div><small>Pendientes</small><strong>${missing.length}</strong></div></div>${missing.length?`<div class="picking-confirm-warning"><strong>El pedido continuará con etiqueta de pedido parcial.</strong><p>Cuando termine esta salida y llegue la mercancía faltante, podrás reabrir el mismo pedido desde Alistamiento.</p></div>`:`<div class="picking-confirm-success"><strong>Toda la mercancía fue encontrada.</strong><p>El pedido continuará sin pendientes.</p></div>`}</div>`,
    onConfirm:async(_panel,button)=>{
      try{
        const result=await api.confirmPickingRound(data.order.id,{items:results});
        clearDraft(task);
        toast(result.partial?`Pedido parcial enviado. Quedaron ${result.missingLines} línea(s) pendientes.`:"Alistamiento completo y enviado a facturación.","success",7500);
        refreshLists?.();
        host.replaceChildren();
      }catch(error){button.disabled=false;throw error}
    }
  });
}
