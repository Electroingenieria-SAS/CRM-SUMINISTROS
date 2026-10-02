import { fmt } from "../format.js";
import { sanitizeHtml } from "./sanitation.js";
import { toast } from "./toast.js";
import { visibleFocusable } from "./accessibility.js";
import { semanticActionClass, validatePanel } from "./forms.js";

export function taskPanel(host,{title,body,confirmLabel="Confirmar",cancelLabel="Cancelar",kicker="Acción de la operación",tone="",onConfirm,onClose}={}){
  const parent=host?.querySelector?.(':scope > .modal-overlay > .modal')||host?.querySelector?.('.modal');
  if(!parent)throw new Error("No hay una ventana operativa activa para abrir la acción.");
  parent.querySelector('[data-modal-task-panel]')?.remove();
  const previous=document.activeElement;
  const titleId=`erp-task-panel-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
  const wrapper=document.createElement("div");
  wrapper.className="modal-task-panel-shell";
  wrapper.dataset.modalTaskPanel="1";
  wrapper.innerHTML=`<div class="modal-task-panel-scrim" aria-hidden="true"></div><section class="modal-task-panel ${fmt.escape(tone)}" role="region" aria-labelledby="${titleId}" tabindex="-1"><header><div><span>${fmt.escape(kicker)}</span><h4 id="${titleId}">${fmt.escape(title||"Acción")}</h4></div><button type="button" class="icon-btn icon-close" data-task-panel-close aria-label="Cerrar acción">×</button></header><div class="modal-task-panel-body">${sanitizeHtml(body||"")}</div><footer><button type="button" class="btn btn-ghost" data-task-panel-close>${fmt.escape(cancelLabel)}</button>${confirmLabel?`<button type="button" class="btn ${semanticActionClass(confirmLabel)}" data-task-panel-confirm>${fmt.escape(confirmLabel)}</button>`:""}</footer></section>`;
  parent.append(wrapper);
  parent.classList.add("has-task-panel");
  const contextState=[...parent.children].filter(node=>node!==wrapper).map(node=>({node,inert:node.hasAttribute("inert"),ariaHidden:node.getAttribute("aria-hidden")}));
  contextState.forEach(({node})=>{node.setAttribute("inert","");node.setAttribute("aria-hidden","true")});
  const panel=wrapper.querySelector('.modal-task-panel');
  const close=()=>{
    contextState.forEach(({node,inert,ariaHidden})=>{
      if(!inert)node.removeAttribute("inert");
      if(ariaHidden===null)node.removeAttribute("aria-hidden");else node.setAttribute("aria-hidden",ariaHidden);
    });
    wrapper.remove();
    parent.classList.remove("has-task-panel");
    onClose?.();
    if(previous instanceof HTMLElement&&document.contains(previous))requestAnimationFrame(()=>previous.focus?.({preventScroll:true}));
  };
  wrapper.querySelectorAll('[data-task-panel-close]').forEach(button=>button.addEventListener("click",close));
  wrapper.querySelector('.modal-task-panel-scrim')?.addEventListener("click",close);
  const confirm=wrapper.querySelector('[data-task-panel-confirm]');
  if(confirm)confirm.addEventListener("click",async event=>{
    const button=event.currentTarget;
    if(!validatePanel(panel))return;
    button.disabled=true;
    try{
      const outcome=await onConfirm?.(panel,button);
      if(outcome!==false&&wrapper.isConnected)close();
    }catch(error){toast(error.message||String(error),"error",7000);button.disabled=false}
  });
  requestAnimationFrame(()=>{const first=visibleFocusable(panel)[0];(first||panel).focus?.({preventScroll:true});});
  return {panel,close};
}
