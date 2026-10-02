import { loading } from "../../../../core/ui.js";
import { state, reportsMount } from "../reports-state.js";
import { safe } from "../shared/report-values.js";
import { rpc } from "./report-rpc.js";
import { renderActive } from "../ui/active-view.js";

export async function loadDashboard(){
  const content=reportsMount.rootNode.querySelector("[data-bi-content]");
  content.innerHTML=`<div class="bi-skeleton-v11140">${loading("Calculando KPIs, tendencias, SLA, inventario y productividad…")}</div>`;
  try{
    state.data=await rpc("erp_x_reports_analytics",{p_from:state.from,p_to:state.to});
    renderActive();
  }catch(error){
    content.innerHTML=`<section class="bi-panel-v11140"><h3>No fue posible cargar la analítica</h3><p>${safe(error.message)}</p></section>`;
  }
}

export async function loadViews(){
  try{
    state.views=await rpc("erp_x_reports_views",{p_action:"LIST",p_payload:{}})||[];
    if(state.tab==="saved")renderActive();
  }catch{
    state.views=[];
  }
}
