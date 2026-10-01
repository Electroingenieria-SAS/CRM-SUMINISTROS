import { toast } from "../../../core/ui.js";
import { loadOriginPlan } from "../origins/origin-plan.js";

export function restoreOriginSelections(verification){
verification.host.querySelectorAll("[data-picking-item]").forEach(row=>{
    const item=verification.itemMap.get(row.dataset.itemId);
    row.__savedOrigins=verification.draft[row.dataset.itemId]?.origins||[];
    if(row.dataset.result==="FOUND"&&!item?.requires_cut)loadOriginPlan(row,item,row.__savedOrigins).then(verification.sync).catch(error=>{row.dataset.originError=error.message;verification.sync()});
  });
}

export function bindVerificationResults(verification){
verification.host.querySelectorAll("[data-result]").forEach(button=>button.addEventListener("click",async()=>{
    const row=button.closest("[data-picking-item]");
    row.querySelectorAll("[data-result]").forEach(item=>{const selected=item===button;item.classList.toggle("selected",selected);item.setAttribute("aria-pressed",String(selected));});
    row.dataset.result=button.dataset.result;
    const novelty=row.querySelector("[data-novelty-wrap]");novelty.hidden=button.dataset.result!=="MISSING";
    const textarea=novelty.querySelector("textarea");textarea.required=button.dataset.result==="MISSING";if(button.dataset.result==="FOUND")textarea.value="";
    const origin=row.querySelector("[data-origin-wrap]");
    if(origin)origin.hidden=button.dataset.result!=="FOUND";
    if(button.dataset.result==="FOUND"&&row.dataset.requiresCut!=="true"){
      try{await loadOriginPlan(row,verification.itemMap.get(row.dataset.itemId),row.__savedOrigins||[])}catch(error){toast(error.message,"error",6500);row.dataset.originError=error.message}
    }
    verification.sync();
  }));
verification.host.addEventListener("picking:origin-change",verification.sync);
verification.host.querySelectorAll("[data-picking-item] textarea").forEach(textarea=>textarea.addEventListener("input",verification.sync));
}
