import { getSupabase } from "../../../services/supabase.js";
import { loading } from "../../../core/ui.js";
import { state, filtersPayload } from "../history-state.js";
import { safe } from "../shared/history-values.js";
import { renderActive } from "../history-controller.js";

export async function rpc(name,params={}){
  const {data,error}=await getSupabase().rpc(name,params);
  if(error)throw error;
  return data;
}

export async function loadHistory(){
  const content=state.root.querySelector("[data-history-content]");
  if(state.tab==="records")content.innerHTML=loading("Consultando archivo histórico…");
  try{
    state.data=await rpc("erp_x_history_center",{p_payload:filtersPayload()});
    renderActive();
  }catch(error){
    content.innerHTML=`<section class="history-panel-v11150"><h3>No fue posible consultar el histórico</h3><p>${safe(error.message)}</p></section>`;
  }
}

export async function loadBatches(){
  try{state.batches=await rpc("erp_x_history_batches",{p_limit:100})||[];if(state.tab==="batches")renderActive()}catch{state.batches=[]}
}
