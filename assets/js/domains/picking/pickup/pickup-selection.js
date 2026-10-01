import { toast } from "../../../core/ui.js";

export function bindPickupSelection(host,items,onConfirm){
  const sync=()=>{
    const selected=[...host.querySelectorAll("[data-cut-pickup-item].selected")];
    const counter=host.querySelector("[data-cut-pickup-selected]");
    if(counter)counter.textContent=String(selected.length);
    const button=host.querySelector("[data-confirm-cut-pickup]");
    if(button){
      button.disabled=selected.length===0;
      button.textContent=selected.length===items.length?"Confirmar todos como recogidos":`Confirmar ${selected.length} recogido(s)`;
    }
  };
  host.querySelectorAll("[data-toggle-cut-pickup]").forEach(button=>button.addEventListener("click",()=>{
    const row=button.closest("[data-cut-pickup-item]");
    const selected=!row.classList.contains("selected");
    row.classList.toggle("selected",selected);
    button.setAttribute("aria-pressed",String(selected));
    button.innerHTML=selected?'<span aria-hidden="true">✓</span> Marcado como recogido':'<span aria-hidden="true">○</span> Marcar como recogido';
    sync();
  }));
  host.querySelector("[data-confirm-cut-pickup]")?.addEventListener("click",async event=>{
    const button=event.currentTarget;
    const ids=[...host.querySelectorAll("[data-cut-pickup-item].selected")].map(row=>row.dataset.requirementId);
    if(!ids.length)return;
    button.disabled=true;
    try{await onConfirm(ids)}catch(error){toast(error.message,"error",7500);button.disabled=false}
  });
  sync();
}
