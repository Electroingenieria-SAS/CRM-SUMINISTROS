import { state } from "../../../../core/state.js";
import { modal, toast } from "../../../../core/ui.js";
import { rpc } from "../data/goods-rpc.js";
import { esc } from "../shared/goods-values.js";
import { renderGoodsReceiving } from "../list/goods-list.js";
import { blankGoodsLine, goodsLineHtml, bindGoodsLines } from "../lines/goods-lines.js";
import { collectGoodsReceipt } from "./collect-receipt.js";
import { openGoodsReceiptDetail } from "../detail/receipt-detail.js";
import { receivingHubState } from "../goods-state.js";

export function openGoodsReceiptForm(pveDetail){
  const linked=Boolean(pveDetail?.order?.id);
  const po=pveDetail?.purchaseOrder||{};
  const initial=(pveDetail?.items||[]).map(item=>({
    orderItemId:item.orderItemId,materialMasterId:item.materialMasterId,materialVariantId:item.materialVariantId,reference:item.reference||item.sku,
    description:item.description,unit:item.unit||"UND",expected:item.quantity,received:item.quantity,accepted:item.quantity,rejected:0,location:"RECEPCION",lot:""
  }));
  const lines=initial.length?initial:[blankGoodsLine()];
  const requestId=crypto.randomUUID?.()||`goods-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const view=modal({
    title:"Recepción de mercancía · ingreso a bodega",
    confirmLabel:"Guardar e ingresar a bodega",
    size:"wide",
    body:`
      <section class="v115-receipt-banner ${linked?"linked":"standalone"}"><div><span>${linked?"PVE ENLAZADO":"RECEPCIÓN INDEPENDIENTE"}</span><strong>${linked?esc(pveDetail.order.orderNumber):"Ingreso físico de mercancía"}</strong><p>${linked?"El PVE solo aporta contexto. Esta recepción no cambia su etapa ni su estado.":"No necesitas un pedido para registrar esta entrada a bodega."}</p></div><div><small>Efecto sobre pedidos</small><b>${linked?"Mercancía OK únicamente":"Ninguno"}</b></div></section>
      <div class="v115-receipt-status" role="radiogroup"><label><input type="radio" name="receiptStatus" value="CONFORMING" checked><span><b>Conforme</b><small>Mercancía aceptada.</small></span></label><label><input type="radio" name="receiptStatus" value="PARTIAL"><span><b>Parcial</b><small>Ingreso parcial.</small></span></label><label><input type="radio" name="receiptStatus" value="NONCONFORMING"><span><b>Con novedad</b><small>Existe rechazo o incidencia.</small></span></label></div>
      <section class="v115-form-section"><header><span>1</span><div><strong>Documento y origen</strong><small>Identifica la compra o devolución que está entrando a bodega.</small></div></header><div class="form-grid">
        <div class="field"><label>Tipo *</label><select class="control" name="receiptType"><option value="PURCHASE">Compra</option><option value="RETURN">Devolución</option></select></div>
        <div class="field"><label>Prefijo *</label><input class="control" name="documentPrefix" value="REC" minlength="2" maxlength="8" required></div>
        <div class="field"><label>Orden de compra</label><input class="control" name="purchaseOrderNumber" value="${esc(po.poNumber||"")}"></div>
        <div class="field"><label>Proveedor / origen</label><input class="control" name="supplierName" value="${esc(po.supplierName||"")}"></div>
        <div class="field"><label>NIT / documento proveedor</label><input class="control" name="supplierDocument"></div>
        <div class="field"><label>Factura proveedor</label><input class="control" name="invoiceNumber"></div>
        <div class="field"><label>Bodega</label><input class="control" name="warehouseCode" placeholder="Código o nombre"></div>
        <div class="field"><label>Ubicación por defecto *</label><input class="control" name="defaultLocation" value="RECEPCION" required></div>
      </div></section>
      <section class="v115-form-section"><header><span>2</span><div><strong>Materiales recibidos</strong><small>Selecciona siempre el material oficial Siesa. Solo las cantidades aceptadas ingresan al inventario.</small></div></header><div class="v115-goods-lines" data-v115-lines>${lines.map((line,index)=>goodsLineHtml(line,index)).join("")}</div><button type="button" class="btn btn-create" data-v115-add-line>+ Agregar material</button></section>
      <section class="v115-form-section"><header><span>3</span><div><strong>Novedades y verificación</strong><small>La evidencia queda en la recepción de bodega, no en el workflow del pedido.</small></div></header><div class="form-grid">
        <div class="field"><label>Tipo de novedad</label><select class="control" name="noveltyType"><option value="">Sin novedad</option><option value="SHORTAGE">Faltante</option><option value="EXCESS">Sobrante</option><option value="DAMAGED">Avería</option><option value="WRONG_ITEM">Material incorrecto</option><option value="DOCUMENT">Documento / factura</option><option value="QUALITY">Calidad</option><option value="OTHER">Otra</option></select></div>
        <div class="field"><label>Severidad</label><select class="control" name="noveltySeverity"><option value="LOW">Baja</option><option value="MEDIUM" selected>Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Crítica</option></select></div>
        <div class="field full"><label>Detalle de novedad</label><textarea class="control" name="noveltyNote"></textarea></div>
        <label class="v115-verified full"><input type="checkbox" name="verified" checked><span><b>Recepción verificada</b><small>Registra automáticamente usuario y fecha.</small></span></label>
        <div class="field full"><label>Información levantada</label><textarea class="control" name="informationCaptured" placeholder="Empaque, placas, sellos, factura, referencias, observaciones del proveedor, etc."></textarea></div>
        <div class="field full"><label>Nota de verificación</label><textarea class="control" name="verificationNote"></textarea></div>
        <div class="field full"><label>Observación general</label><textarea class="control" name="generalNote"></textarea></div>
      </div></section>`,
    onConfirm:async dialog=>{
      const payload=collectGoodsReceipt(dialog,pveDetail,requestId);
      const result=await rpc("erp_x_goods_receipt_create",{p_payload:payload});
      const message=linked?`Recepción ${result.receipt.receipt_number} guardada. Mercancía OK quedó marcada en el PVE sin mover su flujo.`:`Recepción ${result.receipt.receipt_number} guardada e ingresada a bodega.`;
      toast(message,"success",8000);
      window.__erpQueueRefresh?.();
      setTimeout(()=>openGoodsReceiptDetail(result.receipt.id),60);
      if(state.currentModule==="receiving"&&receivingHubState.activeView==="GOODS")setTimeout(()=>{const host=document.querySelector("#receiving-v115-content");if(host)renderGoodsReceiving(host)},120);
    }
  });
  bindGoodsLines(view.root);
  view.root.querySelector("[data-v115-add-line]").addEventListener("click",()=>{
    const host=view.root.querySelector("[data-v115-lines]");
    host.insertAdjacentHTML("beforeend",goodsLineHtml(blankGoodsLine(),host.children.length));
    bindGoodsLines(view.root);
  });
  const type=view.root.querySelector('[name="receiptType"]'),prefix=view.root.querySelector('[name="documentPrefix"]');
  type.addEventListener("change",()=>{prefix.value=type.value==="RETURN"?"DEV":"REC"});
}
