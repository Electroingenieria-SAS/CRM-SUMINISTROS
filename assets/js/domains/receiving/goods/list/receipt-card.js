import { fmt } from "../../../../core/format.js";
import { esc } from "../shared/goods-values.js";

export function goodsReceiptCard(row){
  const linked=Boolean(row.linkedPveId);
  return `<article class="v115-goods-row">
    <div class="v115-goods-id"><span>${row.receiptType==="RETURN"?"DEVOLUCIÓN":"COMPRA"}</span><strong>${esc(row.receiptNumber)}</strong><small>${fmt.date(row.receivedAt)}</small></div>
    <div class="v115-goods-meta"><span><small>Proveedor</small><b>${esc(row.supplierName||"—")}</b></span><span><small>OC / factura</small><b>${esc(row.purchaseOrderNumber||row.invoiceNumber||"—")}</b></span><span><small>Materiales</small><b>${fmt.number(row.lineCount||0)} línea(s)</b></span><span><small>Aceptado</small><b>${fmt.number(row.acceptedQuantity||0,3)}</b></span></div>
    <div class="v115-goods-link ${linked?"linked":"standalone"}"><small>${linked?"PVE ENLAZADO":"INDEPENDIENTE"}</small><strong>${linked?esc(row.linkedPveNumber):"Sin pedido"}</strong>${linked?"<em>Mercancía OK sincronizado</em>":"<em>No afecta pedidos</em>"}</div>
    <button type="button" class="btn btn-primary" data-v115-open-receipt="${esc(row.id)}">Ver recepción</button>
  </article>`;
}
