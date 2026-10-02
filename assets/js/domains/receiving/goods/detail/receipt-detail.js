import { fmt } from "../../../../core/format.js";
import { modal, toast } from "../../../../core/ui.js";
import { rpc } from "../data/goods-rpc.js";
import { esc } from "../shared/goods-values.js";
import { printGoodsReceipt } from "./print-receipt.js";

export async function openGoodsReceiptDetail(id){
  try{
    const data=await rpc("erp_x_goods_receipt_detail",{p_receipt_id:id});
    const r=data.receipt,linked=data.linkedPve;
    const verificationText=r.verified_at?`Verificada · ${esc(data.verifiedBy||"")}`:"Pendiente";
    const relationText=linked?`${esc(linked.orderNumber)} · Mercancía OK`:"Independiente";
    const workflowHtml=linked
      ? `<div class="v115-no-workflow"><strong>✓ PVE enlazado sin modificar workflow</strong><span>Etapa actual: ${esc(fmt.step(linked.currentStep))} · Estado: ${esc(fmt.label(linked.status))}</span></div>`
      : `<div class="v115-no-workflow"><strong>Recepción independiente</strong><span>No existe ni se requiere un pedido para este ingreso de bodega.</span></div>`;
    const linesHtml=(data.lines||[]).map(line=>{
      return `<tr><td><strong>${esc(line.reference)}</strong><small>${esc(line.description)}</small></td><td>${fmt.number(line.receivedQuantity,3)} ${esc(line.unit)}</td><td>${fmt.number(line.acceptedQuantity,3)}</td><td>${fmt.number(line.rejectedQuantity,3)}</td><td>${esc(line.location)}</td><td>${esc(line.lotNumber||"—")}</td></tr>`;
    }).join("");
    const body=`
      <section class="v115-detail-hero"><div><span>RECEPCIÓN DE MERCANCÍA</span><strong>${esc(r.receipt_number)}</strong><p>${esc(r.supplier_name||"Proveedor no informado")} · ${fmt.date(r.received_at)}</p></div><div class="v115-detail-actions"><button type="button" class="btn btn-primary" data-v115-print>Imprimir QR + código</button></div></section>
      <div class="v115-detail-grid"><article><small>Tipo</small><strong>${r.receipt_type==="RETURN"?"Devolución":"Compra"}</strong></article><article><small>Orden de compra</small><strong>${esc(r.purchase_order_number||"—")}</strong></article><article><small>Factura proveedor</small><strong>${esc(r.invoice_number||"—")}</strong></article><article><small>Recibió</small><strong>${esc(data.receivedBy||"—")}</strong></article><article><small>Verificación</small><strong>${verificationText}</strong></article><article><small>Relación con pedido</small><strong>${relationText}</strong></article></div>
      ${workflowHtml}
      <div class="table-wrap v115-detail-lines"><table><thead><tr><th>Material</th><th>Recibido</th><th>Aceptado</th><th>Rechazado</th><th>Ubicación</th><th>Lote</th></tr></thead><tbody>${linesHtml}</tbody></table></div>`;
    const view=modal({title:`Recepción ${r.receipt_number}`,confirmLabel:"Cerrar",size:"wide",body});
    view.root.querySelector("[data-v115-print]")?.addEventListener("click",()=>printGoodsReceipt(data));
  }catch(error){toast(error.message,"error",7500)}
}
