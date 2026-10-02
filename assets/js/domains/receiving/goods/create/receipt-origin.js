import { modal, toast, empty } from "../../../../core/ui.js";
import { rpc } from "../data/goods-rpc.js";
import { normalize } from "../shared/goods-values.js";
import { pveCards } from "./purchase-order-choice.js";
import { openGoodsReceiptForm } from "./receipt-form.js";

export async function openGoodsReceiptOrigin(){
  try{
    const pves=await rpc("erp_x_goods_receipt_pve_candidates",{p_search:null,p_limit:120});
    const view=modal({
      title:"Nueva recepción de mercancía",
      confirmLabel:"Continuar",
      size:"wide",
      body:`
        <section class="v115-dialog-intro"><span>PASO 1</span><strong>¿Quieres enlazar esta recepción con un PVE?</strong><p>El enlace es opcional. Nunca cambia el estado ni la etapa del pedido; solo precarga datos y marca Mercancía OK al guardar.</p></section>
        <div class="v115-source-choice">
          <label><input type="radio" name="sourceMode" value="NONE" checked><span><b>Recepción independiente</b><small>Compra o devolución que llega a bodega sin depender de un pedido.</small></span></label>
          <label class="${pves.length?"":"disabled"}"><input type="radio" name="sourceMode" value="PVE" ${pves.length?"":"disabled"}><span><b>Enlazar con PVE</b><small>Precarga OC, proveedor y materiales. Al guardar marca Mercancía OK.</small></span></label>
        </div>
        <section class="v115-pve-picker" data-v115-pve-picker hidden>
          <div class="field"><label>Buscar PVE</label><input class="control" type="search" placeholder="PVE, cliente, OC o proveedor…" data-v115-pve-search></div>
          <div data-v115-pve-list>${pves.length?pveCards(pves):empty("No hay PVE disponibles","Puedes crear la recepción de forma independiente.")}</div>
        </section>`,
      onConfirm:async dialog=>{
        const mode=dialog.querySelector('[name="sourceMode"]:checked')?.value||"NONE";
        if(mode==="NONE"){
          setTimeout(()=>openGoodsReceiptForm(null),40);
          return;
        }
        const selected=dialog.querySelector('[name="v115Pve"]:checked')?.value;
        if(!selected)throw new Error("Selecciona el PVE que deseas enlazar.");
        const detail=await rpc("erp_x_goods_receipt_pve_detail",{p_order_id:selected});
        setTimeout(()=>openGoodsReceiptForm(detail),40);
      }
    });
    const picker=view.root.querySelector("[data-v115-pve-picker]");
    view.root.querySelectorAll('[name="sourceMode"]').forEach(input=>input.addEventListener("change",()=>picker.hidden=input.value!=="PVE"||!input.checked));
    const search=view.root.querySelector("[data-v115-pve-search]"),list=view.root.querySelector("[data-v115-pve-list]");
    search?.addEventListener("input",()=>{
      const q=normalize(search.value);
      const filtered=pves.filter(row=>normalize(`${row.orderNumber} ${row.clientName} ${row.purchaseOrder||""} ${row.supplierName||""}`).includes(q));
      list.innerHTML=filtered.length?pveCards(filtered):empty("Sin coincidencias","Busca por PVE, cliente, OC o proveedor.");
    });
  }catch(error){toast(error.message,"error",7500)}
}
