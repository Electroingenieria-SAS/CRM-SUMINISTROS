import { patchInvoiceSave } from "./save/invoice-save-adapter.js";
import { enhanceInvoiceDialog } from "./ui/invoice-dialog.js";
import { invoiceReaderState } from "./reader-state.js";

export function schedule(){
  if(invoiceReaderState.scheduled)return;
  invoiceReaderState.scheduled=true;
  requestAnimationFrame(()=>{
    invoiceReaderState.scheduled=false;
    invoiceReaderState.observer?.disconnect();
    enhanceAll();
    observe();
  });
}

export function observe(){
  const root=document.querySelector("#modal-root");
  if(root&&invoiceReaderState.observer)invoiceReaderState.observer.observe(root,{childList:true,subtree:true});
}

export function enhanceAll(){
  document.querySelectorAll("#modal-root .modal").forEach(enhanceInvoiceDialog);
}

export function install(){
  patchInvoiceSave();
  enhanceAll();
  const root=document.querySelector("#modal-root");
  if(!root)return;
  invoiceReaderState.observer=new MutationObserver(schedule);
  observe();
}
