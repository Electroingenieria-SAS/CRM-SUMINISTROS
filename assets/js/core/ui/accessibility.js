import { dialogState } from "./dialog-state.js";

export const FOCUSABLE='button:not([disabled]),a[href],input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function visibleFocusable(container){
  return [...container.querySelectorAll(FOCUSABLE)].filter(el=>el.offsetParent!==null&&!el.closest('[aria-hidden="true"]')&&!el.closest('[inert]'));
}

export function activeDialog(root){
  const dialogs=[...root.querySelectorAll('.modal,[role="dialog"]')].filter(el=>el.offsetParent!==null);
  return dialogs.at(-1)||null;
}

export function prepareDialog(dialog){
  if(!dialog)return;
  dialog.setAttribute("role","dialog");
  dialog.setAttribute("aria-modal","true");
  if(!dialog.hasAttribute("tabindex"))dialog.setAttribute("tabindex","-1");
  const title=dialog.querySelector('.modal-head h3,.modal-head h2,header h3,header h4');
  if(title){
    if(!title.id)title.id=`erp-dialog-title-${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
    dialog.setAttribute("aria-labelledby",title.id);
  }else if(!dialog.hasAttribute("aria-label"))dialog.setAttribute("aria-label","Ventana de operación");
}

export function syncDialogState(root){
  const dialog=activeDialog(root);
  const app=document.querySelector("#app");
  const open=Boolean(dialog);
  document.documentElement.classList.toggle("dialog-open",open);
  document.body?.classList.toggle("dialog-open",open);
  if(open){
    if(!dialogState.dialogPreviousFocus||!document.contains(dialogState.dialogPreviousFocus))dialogState.dialogPreviousFocus=document.activeElement;
    [...root.querySelectorAll('.modal,[role="dialog"]')].forEach(prepareDialog);
    if(app){
      if("inert" in app)app.inert=true;
      else app.setAttribute("aria-hidden","true");
    }
    requestAnimationFrame(()=>{
      if(!root.contains(document.activeElement)){
        const focusable=visibleFocusable(dialog);
        (dialog.querySelector('[autofocus]')||focusable[0]||dialog).focus?.({preventScroll:true});
      }
    });
  }else{
    if(app){
      if("inert" in app)app.inert=false;
      app.removeAttribute("aria-hidden");
    }
    const target=dialogState.dialogPreviousFocus;
    dialogState.dialogPreviousFocus=null;
    if(target instanceof HTMLElement&&document.contains(target))requestAnimationFrame(()=>target.focus?.({preventScroll:true}));
  }
}
