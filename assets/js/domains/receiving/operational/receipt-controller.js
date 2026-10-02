import { api } from "../../../services/api.js";
import { toast } from "../../../core/ui.js";
import { fmt } from "../../../core/format.js";
import { escapeText } from "../../../core/layout/operational/operational-values.js";
import { showOperationalReceipt } from "./receipt-dialog.js";

export async function openReceiptDialog(data){
  try{
await createOperationalReceipt(data);
}catch(error){toast(error.message||String(error),"error",7500)}
}

export async function createOperationalReceipt(data){
const receiptDialog={data};
await prepareOperationalReceipt(receiptDialog);
if(!receiptDialog.items.length)return;
showOperationalReceipt(receiptDialog);
bindReceiptType(receiptDialog);
}

export async function prepareOperationalReceipt(receiptDialog){
receiptDialog.progress=await api.receiptProgress(receiptDialog.data.order.id);
receiptDialog.previous=new Map((receiptDialog.progress?.items||[]).map(item=>[String(item.orderItemId),item]));
receiptDialog.items=(receiptDialog.data.items||[]).map(item=>{
      const p=receiptDialog.previous.get(String(item.id));
      const remaining=Math.max(0,Number(p?.remainingQuantity??item.quantity??0));
      return {...item,_receivedBefore:Number(p?.acceptedQuantity||0),_remaining:remaining};
    }).filter(item=>item._remaining>0.0001);
if(!receiptDialog.items.length){toast("Las cantidades aceptadas ya cubren el pedido.","success",6000);return}
receiptDialog.requestId=crypto.randomUUID?.()||`receipt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
receiptDialog.rows=receiptDialog.items.map(item=>`<div class="simple-receipt-line v112-receipt-line" data-item="${escapeText(item.id)}"><div><strong>${escapeText(item.sku||item.description)}</strong><small>Pendiente: ${fmt.number(item._remaining,3)} de ${fmt.number(item.quantity,3)} ${escapeText(item.unit)}${item._receivedBefore?` · ya aceptado ${fmt.number(item._receivedBefore,3)}`:""}</small></div><label>Aceptado<input class="control" name="accepted" type="number" min="0" max="${Number(item._remaining)}" step="any" value="${Number(item._remaining)}"></label></div>`).join("");
}

export function bindReceiptType(receiptDialog){
receiptDialog.type=receiptDialog.view.root.querySelector('[name="receiptType"]');
receiptDialog.prefix=receiptDialog.view.root.querySelector('[name="documentPrefix"]');
receiptDialog.type?.addEventListener("change",()=>{receiptDialog.prefix.value=receiptDialog.type.value==="RETURN"?"DEV":"REC"});
}
