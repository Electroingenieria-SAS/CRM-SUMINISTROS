import { loading } from "../../../../core/ui.js";
import { state, reportsMount } from "../reports-state.js";
import { empty } from "../shared/report-values.js";
import { rpc } from "../data/report-rpc.js";
import { renderExplorerResult } from "./explorer-view.js";

export async function loadExplorer(){
  const explorer=state.explorer;
  const box=reportsMount.rootNode.querySelector("[data-exp-result]");
  if(box)box.innerHTML=loading("Analizando dataset…");
  try{
    explorer.result=await rpc("erp_x_reports_explore",{p_payload:{dataset:explorer.dataset,dimension:explorer.dimension,metric:explorer.metric,from:state.from,to:state.to,limit:explorer.limit}});
    if(box)box.innerHTML=renderExplorerResult();
  }catch(error){
    if(box)box.innerHTML=empty(error.message);
  }
}
