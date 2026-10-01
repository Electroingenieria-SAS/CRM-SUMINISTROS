import { closeDialog } from "../../../core/ui.js";
import { openGoodsReceiptFormForPve } from "./create/purchase-order-choice.js";
import { receivingHubState } from "./goods-state.js";

export function installReceivingDomainV115(){
  if(receivingHubState.domainInstalled)return;
  receivingHubState.domainInstalled=true;
  document.addEventListener("click",event=>{
    const arrival=event.target?.closest?.('[data-arrival="ARRIVED"]');
    if(!arrival)return;
    const shell=arrival.closest(".purchase-shadow-modal[data-order-id]");
    if(!shell)return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const orderId=shell.dataset.orderId;
    closeDialog();
    setTimeout(()=>openGoodsReceiptFormForPve(orderId),30);
  },true);
  const root=document.querySelector("#modal-root");
  if(root){
    const observer=new MutationObserver(()=>enhancePurchaseShadow(root));
    observer.observe(root,{childList:true,subtree:true});
    enhancePurchaseShadow(root);
  }
}

export function enhancePurchaseShadow(root){
  root.querySelectorAll('.purchase-shadow-modal [data-arrival="ARRIVED"]').forEach(button=>{
    if(button.dataset.v115Enhanced==="1")return;
    button.dataset.v115Enhanced="1";
    button.textContent="Registrar recepción de mercancía";
    const note=button.nextElementSibling;
    if(note)note.textContent="Al guardar la recepción de bodega enlazada con este PVE, Mercancía OK se marcará automáticamente.";
  });
  root.querySelectorAll('.purchase-shadow-modal .v114-purchase-receipt-note,[data-v114-create-receipt]').forEach(node=>node.remove());
}
