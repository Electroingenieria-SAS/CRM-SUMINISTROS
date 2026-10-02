import { api } from "../../../services/api.js";
import { fmt } from "../../../core/format.js";
import { toast } from "../../../core/ui.js";
import { bindPickupSelection } from "./pickup-selection.js";
import { shell, bindClose } from "../ui/picking-shell.js";
import { pendingCutPickups } from "../shared/picking-status.js";
import { pickingProgress } from "../ui/picking-progress.js";

export function renderCutPickup(host,data,{reload,refreshLists}){
  const items=pendingCutPickups(data);
  host.innerHTML=shell(data,`
    ${pickingProgress(data,"PICKUP")}
    <section class="cut-pickup-workbench">
      <header class="cut-pickup-stage-head">
        <div><span class="picking-step-tag">Paso previo al alistamiento</span><h4>Cortes por recoger</h4><p>Confirma físicamente cada referencia terminada. Puedes recoger una parte y volver después por las demás.</p></div>
        <div class="cut-pickup-counter"><strong data-cut-pickup-selected>0</strong><span>de ${items.length} marcados</span></div>
      </header>
      <div class="cut-pickup-items">
        ${items.map((item,index)=>cutPickupItem(item,index)).join("")}
      </div>
      <section class="cut-pickup-summary">
        <div><small>Referencias listas</small><strong>${items.length}</strong></div>
        <div><small>Longitud procesada</small><strong>${fmt.number(items.reduce((sum,item)=>sum+Number(item.total_length||0),0),3)} m</strong></div>
        <div><small>Después de recoger</small><strong>Verificar mercancía</strong></div>
      </section>
      <button type="button" class="btn btn-primary cut-pickup-confirm" data-confirm-cut-pickup disabled>Confirmar recogida seleccionada</button>
      <small class="picking-route-note">Los cortes recogidos quedan ligados a este mismo pedido y no vuelven a aparecer en la bandeja.</small>
    </section>`);
  bindClose(host);

  bindPickupSelection(host,items,async ids=>{
    const result=await api.confirmCutPickup(data.order.id,ids);
    toast(result.allCollected?"Todos los cortes fueron recogidos. Continúa con la verificación de mercancía.":`Recogida registrada. Quedan ${result.remaining} corte(s) pendientes.`,"success",7000);
    refreshLists?.();
    await reload?.();
  });
}

export function cutPickupItem(item,index){
  const resolution=String(item.resolution_code||"").toUpperCase();
  const resolutionLabel=resolution==="FULL_REEL"?"Carreto completo":resolution==="NO_CUT"?"No requería corte":"Corte ejecutado";
  return `<article class="cut-pickup-item" data-cut-pickup-item data-requirement-id="${fmt.escape(item.id)}">
    <div class="cut-pickup-index">${index+1}</div>
    <div class="cut-pickup-data">
      <span class="cut-pickup-resolution ${fmt.escape(resolution.toLowerCase())}">${fmt.escape(resolutionLabel)}</span>
      <strong>${fmt.escape(item.reference||item.sku||item.description)}</strong>
      <p>${fmt.escape(item.description)}</p>
      <div><span><small>Cantidad</small><b>${fmt.number(item.units_required,2)} × ${fmt.number(item.length_each,3)} m</b></span><span><small>Total</small><b>${fmt.number(item.total_length,3)} m</b></span><span><small>Carreto</small><b>${fmt.escape(cutLotLabel(item))}</b></span></div>
    </div>
    <button type="button" class="cut-pickup-toggle" data-toggle-cut-pickup aria-pressed="false"><span aria-hidden="true">○</span> Marcar como recogido</button>
  </article>`;
}

export function cutLotLabel(item){
  const explicit=Array.isArray(item.origins)?item.origins:[];
  const metadataOrigins=Array.isArray(item.metadata?.cutOrigins)?item.metadata.cutOrigins:[];
  const origins=[...explicit,...metadataOrigins];
  const unique=[];
  const seen=new Set();
  origins.forEach(origin=>{const key=String(origin.inventoryLotId||origin.lotId||origin.lotNumber||origin.location||"");if(key&&!seen.has(key)){seen.add(key);unique.push(origin)}});
  if(unique.length>1)return `${unique.length} carretos`;
  if(unique.length===1)return unique[0].lotNumber||unique[0].location||"Carreto trazado";
  const batch=(item.cut_batch_id||item.inventory_lot_id)?"Listo en Corte":"Sin carreto";
  return item.lot_number||item.location||item.metadata?.lotNumber||item.metadata?.location||batch;
}
