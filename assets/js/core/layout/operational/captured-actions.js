import { api } from "../../../services/api.js";
import { openReceiptDialog } from "../../../domains/receiving/operational/receipt-controller.js";
import { openInvoiceDialog } from "../../../domains/billing/operational/invoice-dialog.js";
import { openCarrierGuideDialog } from "../../../domains/logistics/operational/carrier-guide-dialog.js";

export let installed=false;

export function installOperationalV112(){
  if(installed)return;
  installed=true;
  document.addEventListener("click",handleCapturedClick,true);
}

export async function handleCapturedClick(event){
  const target=event.target?.closest?.("button,[role='button']");
  if(!target||target.disabled)return;

  if(target.matches("[data-add-guide]")){
    const shell=target.closest(".shipping-process-modal[data-order-id]");
    if(!shell)return;
    event.preventDefault();event.stopImmediatePropagation();
    const orderId=shell.dataset.orderId;
    if(orderId)await openCarrierGuideDialog(orderId);
    return;
  }

  if(target.matches("[data-next-action='RESOLVE']")){
    const shell=target.closest(".simple-process-modal[data-order-id]");
    const orderId=shell?.dataset.orderId;
    if(!orderId)return;
    const data=await api.getOrder(orderId);
    const step=String(data?.order?.current_step_code||"").toUpperCase();
    if(step==="RECEPCION_MERCANCIA"){
      event.preventDefault();event.stopImmediatePropagation();
      await openReceiptDialog(data);
      return;
    }
    if(step==="FACTURACION"&&String(data?.order?.order_type_code||"").toUpperCase()!=="PVP"){
      event.preventDefault();event.stopImmediatePropagation();
      openInvoiceDialog(data);
      return;
    }
  }
}
