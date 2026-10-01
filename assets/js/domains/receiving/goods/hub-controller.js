import { renderQueue } from "../../../modules/queue.js";
import { loading } from "../../../core/ui.js";
import { renderGoodsReceiving } from "./list/goods-list.js";
import { receivingHubState } from "./goods-state.js";

export async function renderReceivingHub(root){
  receivingHubState.activeView="GOODS";
  root.innerHTML=`
    <section class="page-head v115-receiving-head">
      <div><span class="v115-kicker">Dos procesos · una sola área</span><h2>Recepción</h2><p>Separa el ingreso físico a bodega de la validación logística de pedidos.</p></div>
      <div class="page-actions"><button type="button" class="btn btn-help" data-v113-guide-module>Guía de Recepción</button></div>
    </section>
    <section class="v115-process-switch" aria-label="Procesos de Recepción">
      <button type="button" class="v115-process-card active" data-v115-view="GOODS">
        <span class="v115-process-icon">▣</span><div><small>PROCESO DE BODEGA</small><strong>Recepción de mercancía</strong><p>Recibe compras, registra materiales e ingresa existencias al sistema y a bodega.</p></div><em>Independiente de pedidos</em>
      </button>
      <button type="button" class="v115-process-card" data-v115-view="ORDER">
        <span class="v115-process-icon">✓</span><div><small>PROCESO DEL PEDIDO</small><strong>Recepción de pedido</strong><p>Valida la información comercial y asigna responsables para continuar el pedido.</p></div><em>Sí modifica el flujo del pedido</em>
      </button>
    </section>
    <div id="receiving-v115-content">${loading("Preparando Recepción de mercancía…")}</div>`;
  root.querySelectorAll("[data-v115-view]").forEach(button=>button.addEventListener("click",()=>switchView(root,button.dataset.v115View)));
  await renderGoodsReceiving(root.querySelector("#receiving-v115-content"));
}

export async function switchView(root,view){
  if(view===receivingHubState.activeView)return;
  receivingHubState.activeView=view;
  root.querySelectorAll("[data-v115-view]").forEach(button=>button.classList.toggle("active",button.dataset.v115View===view));
  const host=root.querySelector("#receiving-v115-content");
  host.innerHTML=loading(view==="GOODS"?"Preparando Recepción de mercancía…":"Cargando Recepción de pedido…");
  if(view==="ORDER"){
    host.className="v115-order-host";
    await renderQueue(host,{moduleId:"receiving",steps:["RECEPCION_PEDIDO"],params:{step:"RECEPCION_PEDIDO"}});
  }else{
    host.className="";
    await renderGoodsReceiving(host);
  }
}
