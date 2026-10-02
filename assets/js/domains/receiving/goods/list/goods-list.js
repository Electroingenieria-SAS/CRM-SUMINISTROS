import { can } from "../../../../core/state.js";
import { loading, empty } from "../../../../core/ui.js";
import { rpc } from "../data/goods-rpc.js";
import { esc, dateInput } from "../shared/goods-values.js";
import { goodsReceiptCard } from "./receipt-card.js";
import { openGoodsReceiptOrigin } from "../create/receipt-origin.js";
import { openGoodsReceiptDetail } from "../detail/receipt-detail.js";

export async function renderGoodsReceiving(host){
  const canCreateGoods=can("receiving","canCreate")||can("receiving","canUpdate");
  host.innerHTML=`
    <section class="v115-goods-hero">
      <div class="v115-goods-copy"><span>RECEPCIÓN DE MERCANCÍA</span><h3>Ingreso físico a sistema y bodega</h3><p>Este proceso no crea, mueve ni finaliza pedidos. Puedes registrar una compra directamente o enlazar un PVE solo para centralizar la OC y marcar Mercancía OK.</p></div>
      <div class="v115-goods-actions">${canCreateGoods?'<button type="button" class="btn btn-create btn-large" data-v115-new-goods>+ Nueva recepción de mercancía</button>':''}<small>PVE opcional · inventario obligatorio</small></div>
    </section>
    <section class="card card-pad v115-goods-list-card">
      <div class="v115-list-toolbar"><div><span>Historial de bodega</span><strong>Recepciones de mercancía</strong></div><div class="v115-list-filters"><input class="control" type="search" placeholder="Recepción, PVE, OC, proveedor o factura…" data-v115-search><input class="control" type="date" data-v115-from><input class="control" type="date" data-v115-to><button type="button" class="btn btn-search" data-v115-filter>Buscar</button></div></div>
      <div data-v115-goods-list>${loading("Consultando recepciones de bodega…")}</div>
    </section>`;
  const today=new Date(),from=new Date(today.getTime()-30*864e5);
  host.querySelector("[data-v115-from]").value=dateInput(from);
  host.querySelector("[data-v115-to]").value=dateInput(today);
  host.querySelector("[data-v115-new-goods]")?.addEventListener("click",openGoodsReceiptOrigin);
  const load=()=>loadGoodsList(host);
  host.querySelector("[data-v115-filter]").addEventListener("click",load);
  host.querySelector("[data-v115-search]").addEventListener("keydown",event=>{if(event.key==="Enter")load()});
  await load();
}

export async function loadGoodsList(host){
  const target=host.querySelector("[data-v115-goods-list]");
  target.innerHTML=loading("Consultando recepciones de bodega…");
  try{
    const rows=await rpc("erp_x_goods_receipt_list",{
      p_search:host.querySelector("[data-v115-search]").value.trim()||null,
      p_from:host.querySelector("[data-v115-from]").value||null,
      p_to:host.querySelector("[data-v115-to]").value||null,
      p_limit:200
    });
    target.innerHTML=rows.length?`<div class="v115-goods-list">${rows.map(goodsReceiptCard).join("")}</div>`:empty("Aún no hay recepciones de mercancía","Crea la primera recepción cuando llegue una compra a bodega.");
    target.querySelectorAll("[data-v115-open-receipt]").forEach(button=>button.addEventListener("click",()=>openGoodsReceiptDetail(button.dataset.v115OpenReceipt)));
  }catch(error){
    target.innerHTML=`<div class="module-error"><strong>No fue posible consultar las recepciones</strong><p>${esc(error.message)}</p></div>`;
  }
}
