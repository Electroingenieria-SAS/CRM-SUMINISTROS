import { fmt } from "../format.js";
import { modal } from "./dialog.js";

export function guide({title,description,items=[],confirmLabel="Entendido"}){
  return modal({
    title,
    confirmLabel,
    cancelLabel:"Cerrar",
    body:`<div class="guide-intro">${fmt.escape(description||"")}</div><div class="guide-list">${items.map((item,index)=>`<article class="guide-list-item"><span>${index+1}</span><div><strong>${fmt.escape(item.title||item)}</strong>${item.detail?`<p>${fmt.escape(item.detail)}</p>`:""}</div></article>`).join("")}</div>`,
    onConfirm:async()=>{}
  });
}
