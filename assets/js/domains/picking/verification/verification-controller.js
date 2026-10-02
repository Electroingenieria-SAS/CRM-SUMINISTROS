import { api } from "../../../services/api.js";
import { activeTask, rounds, pendingItems } from "../shared/picking-status.js";
import { loadDraft } from "../draft/picking-draft.js";
import { renderVerificationView } from "./verification-view.js";
import { prepareVerificationSync } from "./result-summary.js";
import { restoreOriginSelections, bindVerificationResults } from "./result-bindings.js";
import { bindVerificationSubmit } from "./submit-verification.js";

export async function renderVerification(host,data,{reload,refreshLists}){
const verification={host,data,reload,refreshLists};
await loadVerificationContext(verification);
renderVerificationView(verification);
prepareVerificationSync(verification);
restoreOriginSelections(verification);
bindVerificationResults(verification);
bindVerificationSubmit(verification);
}

export async function loadVerificationContext(verification){
verification.task=activeTask(verification.data);
verification.allPending=pendingItems(verification.data);
verification.cutMap=new Map((verification.data.cutRequirements||[]).map(item=>[item.order_item_id,item]));
verification.cutsPending=(verification.data.cutRequirements||[]).filter(item=>String(item.process_status||"").toUpperCase()!=="READY");
verification.processable=verification.allPending.filter(item=>{
    if(!item.requires_cut)return true;
    const cut=verification.cutMap.get(item.id);
    return cut&&String(cut.process_status||"").toUpperCase()==="READY"&&String(cut.collection_status||"").toUpperCase()==="COLLECTED";
  });
verification.serverDraft={};
try{
    const pre=await api.pickingPrecheck(verification.data.order.id);
    verification.serverDraft=Object.fromEntries((pre.items||[]).map(item=>[item.orderItemId,{result:item.result||"",novelty:item.novelty||"",origins:item.origins||[]}])) ;
  }catch(error){
    console.warn("[ALISTAMIENTO PRECHECK]",error);
  }
verification.localDraft=loadDraft(verification.task,verification.processable);
verification.draft=Object.fromEntries(verification.processable.map(item=>[item.id,{...(verification.serverDraft[item.id]||{}),...(verification.localDraft[item.id]||{})}]));
verification.roundNo=rounds(verification.data).length+1;
verification.previous=rounds(verification.data).length;
verification.parallel=verification.cutsPending.length>0;
}
