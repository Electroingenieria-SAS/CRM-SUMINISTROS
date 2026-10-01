import { fmt } from "../../../../core/format.js";
import { toast } from "../../../../core/ui.js";
import { rpc } from "../data/goods-rpc.js";
import { esc } from "../shared/goods-values.js";
import { openGoodsReceiptForm } from "./receipt-form.js";

export function pveCard(row){
  let arrivalLabel="Sin recepción";
  if(row.arrivalStatus==="ARRIVED")arrivalLabel="Mercancía OK";
  else if(row.warehouseReceiptCount)arrivalLabel=`${row.warehouseReceiptCount} recepción(es)`;
  return `<label class="v115-pve-card"><input type="radio" name="v115Pve" value="${esc(row.id)}"><span></span><div><small>PVE · ${esc(fmt.step(row.currentStep))}</small><strong>${esc(row.orderNumber)}</strong><p>${esc(row.clientName)}</p></div><div><small>Orden de compra</small><b>${esc(row.purchaseOrder||"—")}</b><small>Proveedor</small><b>${esc(row.supplierName||"—")}</b></div><em>${esc(arrivalLabel)}</em></label>`;
}

export function pveCards(rows){return `<div class="v115-pve-list">${rows.map(pveCard).join("")}</div>`}

export async function openGoodsReceiptFormForPve(orderId){
  try{
    const detail=await rpc("erp_x_goods_receipt_pve_detail",{p_order_id:orderId});
    openGoodsReceiptForm(detail);
  }catch(error){toast(error.message,"error",7500)}
}
