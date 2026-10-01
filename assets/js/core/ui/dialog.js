import { fmt } from "../format.js";
import { sanitizeHtml } from "./sanitation.js";
import { toast } from "./toast.js";
import { visibleFocusable, activeDialog, syncDialogState } from "./accessibility.js";
import { semanticActionClass, validatePanel } from "./forms.js";
import { dialogState } from "./dialog-state.js";

export function closeDialog(){
  document.querySelector("#modal-root")?.replaceChildren();
}

export function installDialogSystem(){
  if(dialogState.dialogSystemInstalled)return;
  const root=document.querySelector("#modal-root");
  if(!root)return;
  dialogState.dialogSystemInstalled=true;

  root.addEventListener("keydown",event=>{
    const dialog=activeDialog(root);if(!dialog)return;
    if(event.key==="Escape"){
      const taskPanel=root.querySelector('[data-modal-task-panel]');
      if(taskPanel){event.preventDefault();taskPanel.querySelector('[data-task-panel-close]')?.click();return}
      event.preventDefault();closeDialog();return;
    }
    if(event.key!=="Tab")return;
    const focusable=visibleFocusable(dialog);if(!focusable.length){event.preventDefault();dialog.focus();return}
    const first=focusable[0],last=focusable.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
  });

  root.addEventListener("click",event=>{
    const close=event.target.closest?.('[data-close]');
    if(close){event.preventDefault();closeDialog();return}
    const overlay=event.target.closest?.('.modal-overlay');
    if(overlay===event.target&&overlay.dataset.dismissable==="true")closeDialog();
  });

  dialogState.dialogMutation=new MutationObserver(()=>syncDialogState(root));
  dialogState.dialogMutation.observe(root,{childList:true,subtree:true});
  syncDialogState(root);
}

export function renderDialogShell(root,{title,body,footer="",size="",className="",subtitle="",kicker=""}){
  const titleId=`erp-dialog-title-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
  const safeBody=sanitizeHtml(body);
  const safeFooter=sanitizeHtml(footer);
  root.innerHTML=`<div class="modal-overlay"><section class="modal ${size} ${className}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1"><header class="modal-head"><div class="modal-title-group">${kicker?`<span class="modal-kicker">${fmt.escape(kicker)}</span>`:""}<h3 id="${titleId}">${fmt.escape(title)}</h3>${subtitle?`<p>${fmt.escape(subtitle)}</p>`:""}</div><button type="button" class="icon-btn icon-close" data-close aria-label="Cerrar ventana">×</button></header><div class="modal-body">${safeBody}</div>${safeFooter?`<footer class="modal-foot">${safeFooter}</footer>`:""}</section></div>`;
}

export function modal({title,body,confirmLabel="Guardar",cancelLabel="Cancelar",size="",onConfirm}){
  installDialogSystem();
  const root=document.querySelector("#modal-root");
  renderDialogShell(root,{title,body,size,footer:`<button class="btn btn-ghost" type="button" data-close>${fmt.escape(cancelLabel)}</button>${confirmLabel?`<button class="btn ${semanticActionClass(confirmLabel)}" type="button" data-confirm>${fmt.escape(confirmLabel)}</button>`:""}`});
  const close=closeDialog;
  const confirm=root.querySelector("[data-confirm]");
  if(confirm)confirm.onclick=async()=>{
    try{
      confirm.disabled=true;
      const dialog=root.querySelector(".modal");
      if(!validatePanel(dialog)){confirm.disabled=false;return;}
      await onConfirm?.(dialog);
      close();
    }catch(error){
      toast(error.message||String(error),"error",6500);
      confirm.disabled=false;
    }
  };
  return {root,close};
}
