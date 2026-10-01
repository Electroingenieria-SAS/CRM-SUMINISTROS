import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { parallelWorkFooter } from "../../../modules/active-work.js";
import { cutPickupItem } from "./cut-pickup-stage.js";
import { bindPickupSelection } from "./pickup-selection.js";
import { bindClose } from "../ui/picking-shell.js";

export async function openCutPickup(orderId,{refreshLists}={}){
  const host=document.querySelector("#modal-root");
  host.innerHTML='<div class="modal-overlay"><section class="modal cut-pickup-standalone"><div class="modal-body"><div class="loading">Consultando cortes listos…</div></div></section></div>';
  try{
    const data=await api.cutPickupDetail(orderId);
    renderStandaloneCutPickup(host,data,{refreshLists});
  }catch(error){
    host.innerHTML=`<div class="modal-overlay"><section class="modal"><header class="modal-head"><div><h3>No fue posible abrir la recogida</h3></div><button class="icon-btn" data-close aria-label="Cerrar">×</button></header><div class="modal-body"><p class="danger">${fmt.escape(error.message)}</p></div></section></div>`;
    bindClose(host);
  }
}

export function renderStandaloneCutPickup(host,data,{refreshLists}={}){
  const order=data.order||{};
  const items=(data.items||[]).map(item=>({
    id:item.requirementId,reference:item.reference,sku:item.sku,description:item.description,
    units_required:item.unitsRequired,length_each:item.lengthEach,total_length:item.totalLength,
    resolution_code:item.resolution,lot_number:item.lotNumber,location:item.location,origins:item.origins||[]
  }));
  host.innerHTML=`<div class="modal-overlay simple-process-overlay">
    <section class="modal simple-process-modal wide picking-process-modal cut-pickup-standalone" data-order-id="${fmt.escape(order.id)}">
      <header class="modal-head simple-process-head picking-process-head"><div><span class="wizard-kicker">Alistamiento · Recogida desde Corte</span><h3>${fmt.escape(order.orderNumber)}</h3><p>${fmt.escape(order.clientName)} · ${fmt.escape(fmt.route(order.route))}</p></div><button class="icon-btn" data-close aria-label="Cerrar">×</button></header>
      <div class="modal-body simple-process-body picking-process-body">
        <section class="cut-pickup-early-banner"><span>LISTO PARA RECOGER</span><div><strong>${data.pickupWhileCutting?"Recogida anticipada":"Cortes terminados"}</strong><p>${data.pickupWhileCutting?`Puedes recoger estas referencias ahora. Otras referencias del mismo pedido todavía continúan en Corte mientras Alistamiento avanza en paralelo.`:"Confirma las referencias entregadas por Corte antes de iniciar la verificación normal."}</p></div></section>
        <section class="cut-pickup-workbench">
          <header class="cut-pickup-stage-head"><div><span class="picking-step-tag">Entrega física</span><h4>Cortes por recoger</h4><p>Marca únicamente lo que recibiste físicamente.</p></div><div class="cut-pickup-counter"><strong data-cut-pickup-selected>0</strong><span>de ${items.length} marcados</span></div></header>
          <div class="cut-pickup-items">${items.map((item,index)=>cutPickupItem(item,index)).join("")}</div>
          <button type="button" class="btn btn-primary cut-pickup-confirm" data-confirm-cut-pickup disabled>Confirmar recogida seleccionada</button>
        </section>
      </div>
      ${parallelWorkFooter("ALISTAMIENTO")}
    </section>
  </div>`;
  bindClose(host);
  bindPickupSelection(host,items,async ids=>{
    const result=await api.confirmCutPickup(order.id,ids);
    toast(result.allCollected?"Recogida completada.":`Recogida registrada. Quedan ${result.remaining} referencia(s) listas por entregar.`,"success",6500);
    refreshLists?.();
    window.__erpQueueRefresh?.();
    window.__erpCuttingRefresh?.();
    if(result.remaining>0){
      const latest=await api.cutPickupDetail(order.id);
      renderStandaloneCutPickup(host,latest,{refreshLists});
    }else host.replaceChildren();
  });
}
