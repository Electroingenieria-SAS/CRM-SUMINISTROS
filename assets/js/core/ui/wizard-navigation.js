import { FOCUSABLE } from "./accessibility.js";
import { toast } from "./toast.js";
import { closeDialog } from "./dialog.js";
import { semanticActionClass, validatePanel, serializeForm } from "./forms.js";

export function prepareWizardNavigation(wizardState){
wizardState.form=wizardState.root.querySelector(".wizard-form");
wizardState.close=closeDialog;
wizardState.prev=wizardState.root.querySelector("[data-prev]");
wizardState.next=wizardState.root.querySelector("[data-next]");
wizardState.index=0;
wizardState.show=async function show(newIndex){
    wizardState.index=Math.max(0,Math.min(wizardState.steps.length-1,newIndex));
    wizardState.root.querySelectorAll("[data-wizard-panel]").forEach((panel,panelIndex)=>panel.classList.toggle("active",panelIndex===wizardState.index));
    wizardState.root.querySelectorAll("[data-wizard-jump]").forEach((button,buttonIndex)=>{
      button.classList.toggle("active",buttonIndex===wizardState.index);
      button.classList.toggle("done",buttonIndex<wizardState.index);
      button.setAttribute("aria-current",buttonIndex===wizardState.index?"step":"false");
    });
    wizardState.prev.disabled=wizardState.index===0;
    const finalStep=wizardState.index===wizardState.steps.length-1;
    wizardState.next.textContent=finalStep?wizardState.finishLabel:"Continuar";
    wizardState.next.classList.remove("btn-primary","btn-create");
    wizardState.next.classList.add(finalStep?semanticActionClass(wizardState.finishLabel):"btn-primary");
    const panel=wizardState.root.querySelector(`[data-wizard-panel="${wizardState.index}"]`);
    await wizardState.steps[wizardState.index].onEnter?.({root:wizardState.root,form:wizardState.form,panel,data:serializeForm(wizardState.form),index:wizardState.index});
    requestAnimationFrame(()=>panel.querySelector(FOCUSABLE)?.focus?.({preventScroll:true}));
  };
}

export function bindWizardNavigation(wizardState){
wizardState.prev.onclick=()=>wizardState.show(wizardState.index-1);
wizardState.next.onclick=async()=>{
    const panel=wizardState.root.querySelector(`[data-wizard-panel="${wizardState.index}"]`);
    try{
      if(!validatePanel(panel))return;
      const data=serializeForm(wizardState.form);
      const valid=await wizardState.steps[wizardState.index].validate?.({root:wizardState.root,form:wizardState.form,panel,data,index:wizardState.index});
      if(valid===false)return;
      if(wizardState.index<wizardState.steps.length-1){await wizardState.show(wizardState.index+1);return;}
      wizardState.next.disabled=true;wizardState.prev.disabled=true;
      await wizardState.onFinish?.({root:wizardState.root,form:wizardState.form,data,index:wizardState.index});
      wizardState.close();
    }catch(error){
      toast(error.message||String(error),"error",6500);
      wizardState.next.disabled=false;wizardState.prev.disabled=wizardState.index===0;
    }
  };
wizardState.root.querySelectorAll("[data-wizard-jump]").forEach(button=>button.onclick=()=>{const target=Number(button.dataset.wizardJump);if(target<=wizardState.index)wizardState.show(target)});
wizardState.show(0);
return {root:wizardState.root,form:wizardState.form,close:wizardState.close,goTo:wizardState.show,get index(){return wizardState.index}};
}
